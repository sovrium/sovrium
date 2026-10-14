/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { McpClient } from '@/application/ports/services/mcp-client'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { isSystemAgentName, SYSTEM_AGENT_NAME } from '@/domain/models/app/agents/agent-identity'
import { isAiProviderConfigured } from '@/domain/models/process-env/ai/ai-providers'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { checkTriggerPermission } from '@/presentation/api/agents/agent-trigger-guard'
import { runAgentBoundChatTurn } from '@/presentation/api/agents/chat-routes'
import {
  summariseMcpTool,
  type McpClientToolSummary,
} from '@/presentation/api/agents/mcp-client-config'
import { agentNotFound } from '@/presentation/api/runtime/agent-lookup'
import { errorBody, notFoundBody } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import type { McpServerStatus } from '@/application/ports/services/mcp-client'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * AI MCP cross-cutting status routes (X-1) and MCP client agent surface (X-2).
 *
 * Routes registered here:
 *
 *   GET  /api/ai/mcp/server/status   — JSON body when MCP server is enabled
 *                                      (MCP_SERVER_ENABLED or MCP_ENABLED), 404
 *                                      when both are unset / disabled.
 *   GET  /api/ai/mcp/client/status   — Per declared server (`MCP_CLIENT_SERVERS`):
 *                                      its name, address, `authType`, and the
 *                                      state of its session — `connected` with
 *                                      the `toolCount` its `tools/list`
 *                                      returned, or `unavailable` / `refused` /
 *                                      `error` with a `reason`. 404 when no
 *                                      server is declared.
 *   GET  /api/ai/mcp/client/tools    — The tools the connected servers listed,
 *                                      each with its server, description and
 *                                      argument schema. 404 when no server is
 *                                      declared.
 *   POST /api/agents/:name/chat      — One turn with a named agent, run by
 *                                      the agent runtime exactly as
 *                                      `POST /api/ai/chat` runs it for that
 *                                      agent: its actions, and the tools of
 *                                      the external servers it names
 *                                      (`mcp.servers`, narrowed by
 *                                      `mcp.allowedTools`) as
 *                                      `<server>__<tool>`, are called.
 *
 * Default-off semantics: every status route is always REGISTERED but reports
 * 404 with a JSON envelope when the relevant env vars are unset, so callers
 * can distinguish "feature disabled" from "route does not exist". This matches
 * the M-1 keystone behaviour for `/mcp` (route never mounted when
 * `MCP_ENABLED=false`) — discovery vs. activation are kept separate.
 *
 * Token confidentiality: the status endpoints surface `authType` and (where
 * applicable) `headerName`, but never the token value itself. Credentials stay
 * inside the MCP client (`infrastructure/ai/mcp-client/`), which sends each one
 * only to its own server.
 */

interface ServerStatusBody {
  readonly enabled: true
  readonly transport: string
  readonly mountPath: string
}

interface ClientStatusBody {
  readonly enabled: true
  readonly servers: ReadonlyArray<McpServerStatus>
}

interface ClientToolsBody {
  readonly enabled: true
  readonly tools: ReadonlyArray<McpClientToolSummary>
}

interface AgentChatRequestBody {
  readonly message?: unknown
  readonly sessionId?: unknown
}

const isTruthyEnvFlag = (value: string | undefined): boolean =>
  value === 'true' || value === 'TRUE' || value === '1'

const isMcpServerEnabled = (env: NodeJS.ProcessEnv): boolean =>
  isTruthyEnvFlag(env.MCP_SERVER_ENABLED) || isTruthyEnvFlag(env.MCP_ENABLED)

const handleServerStatus = (c: Context): Response => {
  const { env } = process
  if (!isMcpServerEnabled(env)) {
    return c.json(
      {
        enabled: false,
        ...notFoundBody('MCP server is disabled'),
      },
      404
    )
  }
  const body: ServerStatusBody = {
    enabled: true,
    transport: env.MCP_TRANSPORT ?? 'streamable-http',
    mountPath: env.MCP_MOUNT_PATH ?? '/mcp',
  }
  return c.json(body, 200)
}

/** Client mode is off: no server is declared. */
const DISABLED = { enabled: false } as const

const clientDisabled = (c: Context): Response =>
  c.json({ enabled: false, ...notFoundBody('MCP client is disabled') }, 404)

/**
 * Read the MCP client off the request's domain services. Both reads wait for a
 * connection attempt still in flight, each request of which is bounded by
 * `MCP_CLIENT_TIMEOUT`; neither can fail.
 */
const readMcpClient = <A>(
  c: Context,
  read: (client: McpClient['Service']) => Effect.Effect<A>
): Promise<A> =>
  runDomainPromise(
    c,
    Effect.gen(function* () {
      return yield* read(yield* McpClient)
    })
  )

const handleClientStatus = async (c: Context): Promise<Response> => {
  const body = await readMcpClient(
    c,
    (client): Effect.Effect<ClientStatusBody | typeof DISABLED> =>
      client.enabled
        ? Effect.map(client.statuses, (servers): ClientStatusBody => ({ enabled: true, servers }))
        : Effect.succeed(DISABLED)
  )
  return body.enabled ? c.json(body, 200) : clientDisabled(c)
}

const handleClientTools = async (c: Context): Promise<Response> => {
  const body = await readMcpClient(c, (client): Effect.Effect<ClientToolsBody | typeof DISABLED> =>
    client.enabled
      ? Effect.map(client.tools, (tools): ClientToolsBody => ({
          enabled: true,
          tools: tools.map(summariseMcpTool),
        }))
      : Effect.succeed(DISABLED)
  )
  return body.enabled ? c.json(body, 200) : clientDisabled(c)
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

interface ChatRequestPayload {
  readonly message: string
  readonly sessionId?: string
}

const parseChatBody = async (c: Context): Promise<ChatRequestPayload> => {
  const body = (await c.req
    .json()
    .catch(() => ({}) as AgentChatRequestBody)) as AgentChatRequestBody
  return {
    message: isNonEmptyString(body.message) ? body.message : '',
    ...(isNonEmptyString(body.sessionId) && { sessionId: body.sessionId }),
  }
}

const providerUnavailable = (c: Context): Response =>
  c.json(
    errorBody({
      error: 'AI provider not configured — the assistant is currently unavailable.',
      code: ApiErrorCode.SERVICE_UNAVAILABLE,
    }),
    503
  )

/**
 * Why a chat with `name` is refused before its turn, or nothing.
 *
 * - The built-in System Agent has no declaration: in an app with auth an
 *   anonymous caller gets the 404 an undeclared agent gives, because it reads
 *   AS the caller and a caller with no identity has nothing to read.
 * - A declared agent is found, and carries the same `permissions.trigger`
 *   gate `/execute` does — ahead of the 503 below, which would otherwise answer
 *   differently for a declared agent than for an undeclared one and reopen the
 *   enumeration oracle the 404 closes.
 * - With no AI provider configured at all, the agent is INERT: discoverable
 *   but not runnable, answered 503 rather than a hang on an absent local model.
 */
const chatRefusal = async (
  c: Context,
  app: App | undefined,
  name: string
): Promise<Response | undefined> => {
  if (isSystemAgentName(name)) {
    if (app === undefined || (app.auth !== undefined && getSessionContext(c) === undefined)) {
      return agentNotFound(c)
    }
  } else {
    const agent = app?.agents?.find((candidate) => candidate.name === name)
    if (agent === undefined) return agentNotFound(c)
    const triggerRefusal = await checkTriggerPermission(c, agent, app)
    if (triggerRefusal) return triggerRefusal
  }
  return isAiProviderConfigured(process.env) ? undefined : providerUnavailable(c)
}

/**
 * `POST /api/agents/:name/chat` — one turn with a named agent.
 *
 * Kept as its own address, but not as its own loop: the turn is the one
 * `POST /api/ai/chat` runs for `{ agent: name }` — the agent runtime, every
 * model call through `AiService`, the agent's actions through its gates, and
 * the tools of the external MCP servers it names actually called. The body is
 * `{ message, sessionId? }`; the answer is the chat envelope.
 */
const handleAgentChat =
  (app: App | undefined) =>
  async (c: Context): Promise<Response> => {
    const name = c.req.param('name') ?? ''
    const refusal = await chatRefusal(c, app, name)
    if (refusal !== undefined || app === undefined) return refusal ?? agentNotFound(c)
    const { message, sessionId } = await parseChatBody(c)
    if (message.length === 0) {
      return c.json(
        errorBody({
          error: '`message` is required and must be a non-empty string.',
          code: ApiErrorCode.BAD_REQUEST,
        }),
        400
      )
    }
    return runAgentBoundChatTurn(c, app, {
      message,
      sessionId: sessionId ?? crypto.randomUUID(),
      agentName: isSystemAgentName(name) ? SYSTEM_AGENT_NAME : name,
    })
  }

/**
 * Chain AI MCP cross-cutting routes onto a Hono app.
 *
 * Always registered: when the relevant env vars are unset, handlers return
 * 404 so the API shape stays stable across configurations. The MCP server
 * route itself (`/mcp`) is mounted separately by `setupMcpRoutes` and is
 * gated by `MCP_ENABLED`.
 *
 * @param app — Optional app schema. When present, the agent chat handler
 *   resolves the agent from `app.agents`. When absent, chat requests for any
 *   agent return 404.
 */
export function chainAiMcpStatusRoutes<T extends Hono>(honoApp: T, app?: App): T {
  return honoApp
    .get('/api/ai/mcp/server/status', (c) => handleServerStatus(c))
    .get('/api/ai/mcp/client/status', (c) => handleClientStatus(c))
    .get('/api/ai/mcp/client/tools', (c) => handleClientTools(c))
    .post('/api/agents/:name/chat', handleAgentChat(app)) as T
}
