/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Clock, Deferred, Effect, Exit, Fiber, Option, Queue, Stream } from 'effect'
import { ELICITATION_TTL_MS } from '@/domain/models/app/agents/ask-user-service'
import { MAX_SERVER_REQUESTS, type PausedCalls } from './mcp-call-limits'
import { openViaPost, type McpHttpFailure } from './mcp-http'
import {
  isResponseTo,
  readResponseMessage,
  readServerRequest,
  readToolCallResult,
  rpcReply,
  rpcRequest,
  type ServerRequest,
} from './mcp-json-rpc'
import {
  fromHttpFailure,
  headersFor,
  redact,
  type Failed,
  type McpSession,
  type SessionDeps,
} from './mcp-session'
import type {
  McpElicitationPolicy,
  McpElicitationReply,
  McpToolCallFailure,
} from '@/application/ports/services/mcp-client'
import type { McpClientServerConfig } from '@/domain/models/process-env/mcp-client'
import type { Scope } from 'effect'

/**
 * One `tools/call` to an open session, read as its answer arrives (MCP
 * Streamable HTTP, a server request tied to a client request).
 *
 * A server may answer `200 text/event-stream` and, before the tool's result,
 * send requests of its own on that stream. The client answers each by POSTing
 * the JSON-RPC response with the session's headers:
 *
 *  - `elicitation/create` (form mode) goes to the caller's policy, which
 *    answers at once (`cancel` where nobody can answer, `-32602` for a form
 *    that cannot be shown) or RELAYS it to a person: the call then returns
 *    `asked`, and the stream stays open — read by a fiber in the client's own
 *    scope, past the request that started the turn — until her answer comes.
 *    A question nobody answers within {@link ELICITATION_TTL_MS} is answered
 *    `cancel` and its stream closed, so no socket is held forever. One
 *    question per call is relayed; a second is answered `cancel`.
 *  - `ping` is answered; anything else is refused (`-32601`). Past
 *    {@link MAX_SERVER_REQUESTS} requests on one call, the call fails.
 *
 * `MCP_CLIENT_TIMEOUT` bounds the SERVER's time, never the person's: from the
 * request to its result or question, then from her answer to the result. A
 * message does not extend it, so a server cannot hold a call open by talking.
 * Past the client's limit of paused calls (`mcp-call-limits.ts`), a question
 * is answered `cancel` rather than relayed.
 *
 * Never retried: a tool may write.
 */

/** What a `tools/call` answered: its text, and the server's own `isError`. */
export interface ToolText {
  readonly text: string
  readonly isError: boolean
}

/** Why a `tools/call` produced no result, safe to show. */
export interface CallFailure {
  readonly reason: McpToolCallFailure
  readonly message: string
  /** The server no longer knows the session (HTTP 404): reconnect before the next call. */
  readonly sessionLost: boolean
}

/** A call that has its result, or that waits on a question relayed to a person. */
export type CallOutcome =
  | { readonly kind: 'result'; readonly result: ToolText }
  | {
      readonly kind: 'asked'
      readonly question: { readonly message: string; readonly requestedSchema: unknown }
      readonly answer: (reply: McpElicitationReply) => Effect.Effect<ToolText, CallFailure>
    }

/** One server's open session, as a call to it needs it. */
export interface CallPeer {
  readonly deps: SessionDeps
  readonly server: McpClientServerConfig
  readonly session: McpSession
}

/** How a call treats a server's question, and where its reader lives. */
export interface CallOptions {
  readonly policy: McpElicitationPolicy
  /** The scope the call's reader is forked into: the client's, not the request's. */
  readonly scope: Scope.Scope
  /** How long a relayed question waits for its answer; {@link ELICITATION_TTL_MS} by default. */
  readonly ttlMs?: number
  /**
   * The client's count of calls paused on a person, shared by every call:
   * past its limit a question is answered `cancel`. Absent, unbounded.
   */
  readonly paused?: PausedCalls
}

const ELICITATION_METHOD = 'elicitation/create'

/** A call ended by the client itself shutting down. */
const SHUT_DOWN: CallFailure = {
  reason: 'unavailable',
  message: 'the MCP client shut down before the tool answered',
  sessionLost: false,
}

/** The three promises one call keeps: its first outcome, its result, the person's reply. */
interface Exchange {
  readonly first: Deferred.Deferred<CallOutcome, CallFailure>
  readonly final: Deferred.Deferred<ToolText, CallFailure>
  readonly reply: Deferred.Deferred<McpElicitationReply>
}

/** What a call's reader carries: its promises, its options, and when the server's phase ends. */
interface CallContext {
  readonly exchange: Exchange
  readonly options: CallOptions
  readonly budget: { deadlineMs: number; requests: number }
}

const failed = (reason: string, kind: Failed['kind'] = 'status'): Failed => ({
  state: 'error',
  reason,
  kind,
})

const toCallFailure = (peer: CallPeer, failure: Failed): CallFailure => {
  const reason: McpToolCallFailure =
    failure.kind === 'timeout'
      ? 'timeout'
      : failure.state === 'unavailable'
        ? 'unavailable'
        : 'error'
  const text = redact(failure.reason, peer.server)
  return {
    reason,
    message: reason === 'timeout' ? `the tool timed out: ${text}` : text,
    sessionLost: failure.status === 404 && peer.session.sessionId !== undefined,
  }
}

/** Send the client's JSON-RPC response to a server request. */
const sendReply = (
  peer: CallPeer,
  request: ServerRequest,
  reply: Parameters<typeof rpcReply>[1]
): Effect.Effect<void, Failed> =>
  peer.deps
    .post({
      url: peer.server.url,
      headers: headersFor(peer.server, peer.session),
      body: JSON.stringify(rpcReply(request.id, reply)),
      timeoutMs: peer.deps.timeoutMs,
    })
    .pipe(
      Effect.mapError(fromHttpFailure),
      Effect.flatMap((response) =>
        response.status >= 200 && response.status < 300
          ? Effect.void
          : Effect.fail(
              failed(`the server answered HTTP ${response.status} to the client's answer`)
            )
      )
    )

/** An elicitation reply as the JSON-RPC response carries it. */
const replyBody = (reply: McpElicitationReply): Parameters<typeof rpcReply>[1] =>
  'error' in reply ? { error: reply.error } : { result: { ...reply } }

/** The question of an `elicitation/create`, as the policy reads it. */
const questionOf = (peer: CallPeer, request: ServerRequest) => ({
  server: peer.server.name,
  message: typeof request.params['message'] === 'string' ? request.params['message'] : '',
  requestedSchema: request.params['requestedSchema'],
})

/**
 * Relay the question to a person: the call's first outcome becomes `asked`,
 * and the reader waits for her reply — at most {@link ELICITATION_TTL_MS},
 * after which the server is told `cancel` and the call ends.
 */
const relay = (
  peer: CallPeer,
  request: ServerRequest,
  context: CallContext
): Effect.Effect<void, Failed> =>
  Effect.gen(function* () {
    const { exchange, options } = context
    const { message, requestedSchema } = questionOf(peer, request)
    yield* Deferred.succeed(exchange.first, {
      kind: 'asked',
      question: { message, requestedSchema },
      answer: (reply) =>
        Deferred.succeed(exchange.reply, reply).pipe(
          Effect.andThen(Deferred.await(exchange.final))
        ),
    })
    const reply = yield* Deferred.await(exchange.reply).pipe(
      Effect.asSome,
      Effect.timeoutOrElse({
        duration: options.ttlMs ?? ELICITATION_TTL_MS,
        orElse: () => Effect.succeedNone,
      }),
      Effect.ensuring(Effect.sync(() => options.paused?.release()))
    )
    if (Option.isSome(reply)) {
      yield* sendReply(peer, request, replyBody(reply.value))
      // The server's second phase: from her answer to the tool's result.
      context.budget.deadlineMs = (yield* Clock.currentTimeMillis) + peer.deps.timeoutMs
      return
    }
    yield* sendReply(peer, request, { result: { action: 'cancel' } })
    return yield* Effect.fail(
      failed('the question waited too long for an answer and was cancelled')
    )
  })

/** Answer one `elicitation/create`: relayed once per call, otherwise per the policy. */
const answerElicitation = (
  peer: CallPeer,
  request: ServerRequest,
  context: CallContext
): Effect.Effect<void, Failed> =>
  Effect.gen(function* () {
    if (peer.deps.elicitation !== true) {
      return yield* sendReply(peer, request, {
        error: { code: -32_601, message: 'This client declared no elicitation capability.' },
      })
    }
    const { mode } = request.params
    if (mode !== undefined && mode !== 'form') {
      return yield* sendReply(peer, request, {
        error: { code: -32_602, message: 'Only form mode elicitation is supported.' },
      })
    }
    const alreadyAsked = yield* Deferred.isDone(context.exchange.first)
    const decision = alreadyAsked
      ? ({ action: 'cancel' } as const)
      : context.options.policy(questionOf(peer, request))
    const { paused } = context.options
    if (decision === 'relay' && (paused === undefined || paused.acquire())) {
      return yield* relay(peer, request, context)
    }
    return yield* sendReply(
      peer,
      request,
      replyBody(decision === 'relay' ? { action: 'cancel' } : decision)
    )
  })

/** Answer a request the server sent on the call's stream. */
const answerServerRequest = (
  peer: CallPeer,
  request: ServerRequest,
  context: CallContext
): Effect.Effect<void, Failed> => {
  context.budget.requests += 1
  if (context.budget.requests > MAX_SERVER_REQUESTS) {
    return Effect.fail(
      failed(`the server sent more than ${MAX_SERVER_REQUESTS} requests during one call`)
    )
  }
  if (request.method === ELICITATION_METHOD) return answerElicitation(peer, request, context)
  if (request.method === 'ping') return sendReply(peer, request, { result: {} })
  return sendReply(peer, request, {
    error: { code: -32_601, message: `Method not supported: ${request.method.slice(0, 100)}` },
  })
}

/** Read messages until the response to `id`, answering every server request on the way. */
const readUntilAnswered = (
  peer: CallPeer,
  id: number,
  next: Effect.Effect<unknown, Failed>,
  context: CallContext
): Effect.Effect<ToolText, Failed> =>
  Effect.flatMap(next, (message) => {
    if (isResponseTo(message, id)) {
      const outcome = readResponseMessage(message)
      return outcome.kind === 'result'
        ? Effect.succeed(readToolCallResult(outcome.result))
        : Effect.fail(failed(outcome.message))
    }
    const request = readServerRequest(message)
    const answered =
      request === undefined ? Effect.void : answerServerRequest(peer, request, context)
    return Effect.andThen(answered, readUntilAnswered(peer, id, next, context))
  })

/** The next message of the stream, before the server's current phase ends. */
const nextMessage = (
  queue: Queue.Dequeue<unknown, McpHttpFailure | Cause.Done>,
  context: Pick<CallContext, 'budget'> & { readonly timeoutMs: number }
): Effect.Effect<unknown, Failed> =>
  Effect.flatMap(Clock.currentTimeMillis, (nowMs) =>
    Queue.take(queue).pipe(
      Effect.mapError((error) =>
        Cause.isDone(error)
          ? failed('the server closed the stream without answering the call')
          : fromHttpFailure(error)
      ),
      Effect.timeoutOrElse({
        duration: Math.max(0, context.budget.deadlineMs - nowMs),
        orElse: () =>
          Effect.fail(
            failed(`the server did not answer within ${context.timeoutMs} ms`, 'timeout')
          ),
      })
    )
  )

/** The whole exchange of one call: send it, then read its stream to the result. */
const exchangeCall = (
  peer: CallPeer,
  call: { readonly tool: string; readonly args: Readonly<Record<string, unknown>> },
  context: CallContext
): Effect.Effect<ToolText, Failed> =>
  Effect.scoped(
    Effect.gen(function* () {
      context.budget.deadlineMs = (yield* Clock.currentTimeMillis) + peer.deps.timeoutMs
      const id = peer.deps.nextId()
      const open = peer.deps.open ?? openViaPost(peer.deps.post)
      const response = yield* open({
        url: peer.server.url,
        headers: headersFor(peer.server, peer.session),
        body: JSON.stringify(
          rpcRequest(id, 'tools/call', { name: call.tool, arguments: call.args })
        ),
        timeoutMs: peer.deps.timeoutMs,
      }).pipe(Effect.mapError(fromHttpFailure))
      if (response.status < 200 || response.status >= 300) {
        return yield* Effect.fail<Failed>({
          ...failed(`the server answered HTTP ${response.status}`),
          status: response.status,
        })
      }
      const queue = yield* Stream.toQueue(response.messages, { capacity: 'unbounded' })
      const next = nextMessage(queue, { budget: context.budget, timeoutMs: peer.deps.timeoutMs })
      return yield* readUntilAnswered(peer, id, next, context)
    })
  )

/**
 * Send `tools/call` once to `peer`'s open session. The call is read by a fiber
 * in `options.scope`; this returns its result, or — once a question is relayed
 * — `asked`, whose `answer` finishes it.
 */
export const callMcpTool = (
  peer: CallPeer,
  call: { readonly tool: string; readonly args: Readonly<Record<string, unknown>> },
  options: CallOptions
): Effect.Effect<CallOutcome, CallFailure> =>
  Effect.gen(function* () {
    const exchange: Exchange = {
      first: yield* Deferred.make<CallOutcome, CallFailure>(),
      final: yield* Deferred.make<ToolText, CallFailure>(),
      reply: yield* Deferred.make<McpElicitationReply>(),
    }
    const budget: CallContext['budget'] = { deadlineMs: 0, requests: 0 }
    const fiber = yield* exchangeCall(peer, call, { exchange, options, budget }).pipe(
      Effect.mapError((failure) => toCallFailure(peer, failure)),
      Effect.exit,
      Effect.flatMap((exit) =>
        Effect.andThen(
          Deferred.done(exchange.final, exit),
          Deferred.done(
            exchange.first,
            Exit.map(exit, (result): CallOutcome => ({ kind: 'result', result }))
          )
        )
      ),
      // The client's scope closing (shutdown): whoever waits on the call is told.
      Effect.onInterrupt(() =>
        Effect.andThen(
          Deferred.fail(exchange.final, SHUT_DOWN),
          Deferred.fail(exchange.first, SHUT_DOWN)
        )
      ),
      Effect.withSpan('mcp-client.tool-call-exchange', {
        attributes: { 'mcp.server': peer.server.name, 'mcp.tool': call.tool },
      }),
      Effect.forkIn(options.scope)
    )
    return yield* Deferred.await(exchange.first).pipe(
      Effect.onInterrupt(() => Fiber.interrupt(fiber))
    )
  })
