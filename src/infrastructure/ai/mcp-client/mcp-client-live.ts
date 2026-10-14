/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Deferred, Effect, Layer, SynchronizedRef } from 'effect'
import {
  McpClient,
  McpToolCallError,
  type McpElicitationPolicy,
  type McpServerStatus,
  type McpToolCallOutcome,
  type McpToolResult,
} from '@/application/ports/services/mcp-client'
import {
  parseMcpClientEnv,
  undeclaredAgentMcpServers,
  type McpClientServerConfig,
} from '@/domain/models/process-env/mcp-client'
import { boundedHttpClientLayer } from '@/infrastructure/egress/bounded-http-client'
import { makePausedCalls, type PausedCalls } from './mcp-call-limits'
import { makeMcpHttpTransport, type McpHttpOpen, type McpHttpPost } from './mcp-http'
import { connectMcpServer, type ConnectOutcome, type SessionDeps } from './mcp-session'
import { callMcpTool, type CallFailure, type CallOutcome, type ToolText } from './mcp-tool-call'
import type { McpToolDescriptor } from '@/domain/models/app/agents/mcp-tool-service'
import type { Scope } from 'effect'

/**
 * The live MCP client: one session per server the operator declared.
 *
 * Built once per server runtime (it is part of the domain layer, so its scope
 * is the server's). At build it reads `MCP_CLIENT_*` and refuses the boot on a
 * malformed value, or on an agent naming a server the environment does not
 * declare. It then STARTS a connection attempt per server in the background —
 * the boot does not wait for a slow server — and every read waits for the
 * attempt in flight, which is bounded by `MCP_CLIENT_TIMEOUT` per request.
 *
 * A server that is not connected is tried again on a later read, at most once
 * per {@link RETRY_AFTER_MS}, so a server that comes up after the boot is
 * picked up without a restart.
 */

/** The boot refused the MCP client configuration. The message names what to fix. */
export class McpClientConfigError extends Data.TaggedError('McpClientConfigError')<{
  readonly message: string
}> {}

const RETRY_AFTER_MS = 30_000

interface Attempt {
  readonly outcome: Deferred.Deferred<ConnectOutcome>
  readonly startedAt: number
}

interface ServerEntry {
  readonly config: McpClientServerConfig
  readonly attempt: SynchronizedRef.SynchronizedRef<Attempt>
}

/** The declared address as shown to the operator: without any user-info part. */
const displayUrl = (raw: string): string => {
  const url = new URL(raw)
  url.username = ''
  url.password = ''
  return url.toString()
}

const statusOf = (config: McpClientServerConfig, outcome: ConnectOutcome): McpServerStatus => ({
  name: config.name,
  url: displayUrl(config.url),
  authType: config.authType,
  ...(config.headerName !== undefined && { headerName: config.headerName }),
  status: outcome.state,
  ...(outcome.state === 'connected'
    ? { toolCount: outcome.session.tools.length }
    : { reason: outcome.reason }),
})

const startAttempt = (
  deps: SessionDeps,
  config: McpClientServerConfig,
  scope: Scope.Scope
): Effect.Effect<Attempt> =>
  Effect.gen(function* () {
    const outcome = yield* Deferred.make<ConnectOutcome>()
    yield* connectMcpServer(deps, config).pipe(
      Effect.flatMap((result) => Deferred.succeed(outcome, result)),
      Effect.withSpan('mcp-client.connect', { attributes: { 'mcp.server': config.name } }),
      Effect.forkIn(scope)
    )
    return { outcome, startedAt: Date.now() }
  })

/** The current outcome of `entry`, retrying a failed attempt once it is old enough. */
const outcomeOf = (
  deps: SessionDeps,
  entry: ServerEntry,
  scope: Scope.Scope
): Effect.Effect<ConnectOutcome> =>
  SynchronizedRef.modifyEffect(entry.attempt, (attempt) =>
    Effect.gen(function* () {
      const done = yield* Deferred.isDone(attempt.outcome)
      if (!done) return [attempt, attempt] as const
      const settled = yield* Deferred.await(attempt.outcome)
      if (settled.state === 'connected' || Date.now() - attempt.startedAt < RETRY_AFTER_MS) {
        return [attempt, attempt] as const
      }
      const next = yield* startAttempt(deps, entry.config, scope)
      return [next, next] as const
    })
  ).pipe(Effect.flatMap((attempt) => Deferred.await(attempt.outcome)))

/** Force a reconnect on the next read (the server forgot the session). */
const invalidate = (
  deps: SessionDeps,
  entry: ServerEntry,
  scope: Scope.Scope
): Effect.Effect<void> =>
  SynchronizedRef.modifyEffect(entry.attempt, () =>
    startAttempt(deps, entry.config, scope).pipe(Effect.map((next) => [undefined, next] as const))
  )

const callError = (
  server: string,
  tool: string,
  reason: McpToolCallError['reason'],
  message: string
): McpToolCallError => new McpToolCallError({ server, tool, reason, message })

/** A finished call, as the port reports it: attributed, and marked untrusted. */
const toResult = (server: string, tool: string, result: ToolText): McpToolResult => ({
  server,
  tool,
  untrusted: true as const,
  text: result.text,
  isError: result.isError,
})

/** Every question answered `cancel`: the policy of a call nobody can answer. */
const CANCEL_EVERY_QUESTION: McpElicitationPolicy = () => ({ action: 'cancel' })

/** The connected session of `server` that lists `tool`, or why there is none. */
const sessionFor = (
  deps: SessionDeps,
  context: { readonly entries: readonly ServerEntry[]; readonly scope: Scope.Scope },
  server: string,
  tool: string
) =>
  Effect.gen(function* () {
    const entry = context.entries.find((candidate) => candidate.config.name === server)
    if (entry === undefined) {
      return yield* callError(
        server,
        tool,
        'unknown-tool',
        `no MCP server named "${server}" is declared`
      )
    }
    const outcome = yield* outcomeOf(deps, entry, context.scope)
    if (outcome.state !== 'connected') {
      return yield* callError(
        server,
        tool,
        'unavailable',
        `the MCP server "${server}" is ${outcome.state}: ${outcome.reason}`
      )
    }
    if (!outcome.session.tools.some((listed) => listed.name === tool)) {
      return yield* callError(
        server,
        tool,
        'unknown-tool',
        `the MCP server "${server}" lists no tool "${tool}"`
      )
    }
    return { entry, session: outcome.session }
  })

/** A call's outcome as the port reports it; a later answer's failure is typed the same way. */
const toOutcome = (
  server: string,
  tool: string,
  outcome: CallOutcome,
  onFailure: <A>(effect: Effect.Effect<A, CallFailure>) => Effect.Effect<A, McpToolCallError>
): McpToolCallOutcome =>
  outcome.kind === 'result'
    ? { kind: 'result', result: toResult(server, tool, outcome.result) }
    : {
        kind: 'asked',
        question: { server, ...outcome.question },
        answer: (reply) =>
          onFailure(outcome.answer(reply)).pipe(
            Effect.map((result) => toResult(server, tool, result))
          ),
      }

const failureOf = (server: string, tool: string, failure: CallFailure): McpToolCallError =>
  callError(server, tool, failure.reason, failure.message)

const makeStartToolCall =
  (
    deps: SessionDeps,
    entries: readonly ServerEntry[],
    shared: { readonly scope: Scope.Scope; readonly paused: PausedCalls }
  ) =>
  (
    server: string,
    tool: string,
    args: Readonly<Record<string, unknown>>,
    policy: McpElicitationPolicy
  ): Effect.Effect<McpToolCallOutcome, McpToolCallError> =>
    Effect.gen(function* () {
      const { scope, paused } = shared
      const { entry, session } = yield* sessionFor(deps, { entries, scope }, server, tool)
      const onFailure = <A>(
        effect: Effect.Effect<A, CallFailure>
      ): Effect.Effect<A, McpToolCallError> =>
        effect.pipe(
          Effect.tapError((failure) =>
            failure.sessionLost ? invalidate(deps, entry, scope) : Effect.void
          ),
          Effect.mapError((failure) => failureOf(server, tool, failure))
        )
      const outcome = yield* onFailure(
        callMcpTool(
          { deps, server: entry.config, session },
          { tool, args },
          { policy, scope, paused }
        )
      )
      return toOutcome(server, tool, outcome, onFailure)
    }).pipe(
      Effect.withSpan('mcp-client.call-tool', {
        attributes: { 'mcp.server': server, 'mcp.tool': tool },
      })
    )

/** A call whose every question is cancelled: it always ends with a result. */
const makeCallTool =
  (startToolCall: ReturnType<typeof makeStartToolCall>) =>
  (
    server: string,
    tool: string,
    args: Readonly<Record<string, unknown>>
  ): Effect.Effect<McpToolResult, McpToolCallError> =>
    Effect.flatMap(startToolCall(server, tool, args, CANCEL_EVERY_QUESTION), (outcome) =>
      outcome.kind === 'result'
        ? Effect.succeed(outcome.result)
        : outcome.answer({ action: 'cancel' })
    )

const toolsOf = (entry: ServerEntry, outcome: ConnectOutcome): readonly McpToolDescriptor[] =>
  outcome.state === 'connected'
    ? outcome.session.tools.map((tool) => ({ server: entry.config.name, ...tool }))
    : []

const makeEnabled = (
  servers: readonly McpClientServerConfig[],
  transport: Pick<SessionDeps, 'post' | 'open' | 'timeoutMs' | 'elicitation'>
): Effect.Effect<McpClient['Service'], never, Scope.Scope> =>
  Effect.gen(function* () {
    const scope = yield* Effect.scope
    let lastId = 0
    const deps: SessionDeps = { ...transport, nextId: () => ++lastId }
    const entries = yield* Effect.forEach(servers, (config) =>
      startAttempt(deps, config, scope).pipe(
        Effect.flatMap((attempt) => SynchronizedRef.make(attempt)),
        Effect.map((attempt): ServerEntry => ({ config, attempt }))
      )
    )
    const startToolCall = makeStartToolCall(deps, entries, { scope, paused: makePausedCalls() })
    const outcomes = Effect.forEach(entries, (entry) => outcomeOf(deps, entry, scope), {
      concurrency: 'unbounded',
    })
    return McpClient.of({
      enabled: true,
      statuses: outcomes.pipe(
        Effect.map((all) => all.map((outcome, index) => statusOf(entries[index]!.config, outcome)))
      ),
      tools: outcomes.pipe(
        Effect.map((all) => all.flatMap((outcome, index) => toolsOf(entries[index]!, outcome)))
      ),
      callTool: makeCallTool(startToolCall),
      startToolCall,
    })
  })

const DISABLED = McpClient.of({
  enabled: false,
  statuses: Effect.succeed([]),
  tools: Effect.succeed([]),
  callTool: (server, tool) =>
    Effect.fail(callError(server, tool, 'unknown-tool', 'no external MCP server is declared')),
  startToolCall: (server, tool) =>
    Effect.fail(callError(server, tool, 'unknown-tool', 'no external MCP server is declared')),
})

/**
 * The MCP client for an app. `post` is the transport seam (see `mcp-http.ts`);
 * it defaults to the bounded `HttpClient` one, restricted to the declared
 * servers' origins, never retried and never redirected.
 */
export const makeMcpClientLayer = (
  app:
    | {
        readonly agents?: readonly {
          readonly name: string
          readonly mcp?: { readonly servers?: readonly string[] }
        }[]
        readonly auth?: unknown
      }
    | undefined,
  options: {
    readonly env?: Readonly<Record<string, string | undefined>>
    readonly post?: McpHttpPost
  } = {}
): Layer.Layer<McpClient, McpClientConfigError> =>
  Layer.effect(
    McpClient,
    Effect.gen(function* () {
      const parsed = parseMcpClientEnv(options.env ?? process.env)
      if (!parsed.ok) return yield* new McpClientConfigError({ message: parsed.error })
      const { servers, timeoutMs } = parsed.config
      const undeclared = undeclaredAgentMcpServers(app?.agents ?? [], servers)
      if (undeclared !== undefined) {
        return yield* new McpClientConfigError({ message: undeclared })
      }
      if (servers.length === 0) return DISABLED
      const transport: { readonly post: McpHttpPost; readonly open?: McpHttpOpen } =
        options.post !== undefined
          ? { post: options.post }
          : yield* makeMcpHttpTransport(
              new Set(servers.map((server) => new URL(server.url).origin))
            )
      // A server may ask a question only where a signed-in person can answer it.
      return yield* makeEnabled(servers, {
        ...transport,
        timeoutMs,
        elicitation: app?.auth !== undefined,
      })
    })
  ).pipe(Layer.provide(boundedHttpClientLayer({ retry: false })))
