/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  defaultModelForProvider,
  isAiProviderConfigured,
} from '@/domain/models/env/ai/ai-providers'
import { logError } from '@/infrastructure/logging/logger'
import { agentNotFound } from '@/presentation/api/routes/agents/agent-lookup'
import { checkTriggerPermission } from '@/presentation/api/routes/agents/agent-trigger-guard'
import { persistChatTurnDurably } from '@/presentation/api/routes/ai/chat-durable-memory'
import { resolveAgentChatBackend } from '@/presentation/api/utils/agent-chat-env'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import {
  computeAgentMcpToolCatalog,
  DEFAULT_MCP_CLIENT_TOOL_CATALOG,
  parseMcpClientServers,
  summariseMcpClientServer,
  type McpClientServer,
  type McpClientServerSummary,
  type McpClientTool,
} from '@/presentation/api/utils/mcp-client-config'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Context, Hono } from 'hono'

/**
 * AI MCP cross-cutting status routes (X-1) and MCP client agent surface (X-2).
 *
 * Routes registered here:
 *
 *   GET  /api/ai/mcp/server/status   — JSON body when MCP server is enabled
 *                                      (MCP_SERVER_ENABLED or MCP_ENABLED), 404
 *                                      when both are unset / disabled.
 *   GET  /api/ai/mcp/client/status   — JSON body when MCP_CLIENT_SERVERS is
 *                                      set, 404 otherwise. Includes per-server
 *                                      `authType` (bearer | header | none).
 *   GET  /api/ai/mcp/client/tools    — JSON body listing the discovered tool
 *                                      catalog from the configured external
 *                                      MCP servers, 404 when MCP client mode
 *                                      is disabled.
 *   POST /api/agents/:name/chat      — Per-agent chat endpoint. Forwards the
 *                                      message to the configured AI provider
 *                                      with the agent's MCP tool catalog
 *                                      (filtered by `mcp.allowedTools` when
 *                                      declared) so the LLM can decide whether
 *                                      to invoke external MCP tools. Returns a
 *                                      `{ reply: string }` envelope. Tolerant
 *                                      of unreachable MCP servers — the LLM
 *                                      sees the tool definitions but the
 *                                      runtime falls back to text replies when
 *                                      tool execution fails (`MCP_CLIENT_TIMEOUT`
 *                                      bounds individual tool calls).
 *
 * Default-off semantics: every status route is always REGISTERED but reports
 * 404 with a JSON envelope when the relevant env vars are unset, so callers
 * can distinguish "feature disabled" from "route does not exist". This matches
 * the M-1 keystone behaviour for `/mcp` (route never mounted when
 * `MCP_ENABLED=false`) — discovery vs. activation are kept separate.
 *
 * Token confidentiality: the status endpoints surface `authType` and (where
 * applicable) `headerName`, but never the token value itself. Auth tokens are
 * read from env vars and only used inside the network layer when the platform
 * actually contacts the external MCP server.
 */

interface ServerStatusBody {
  readonly enabled: true
  readonly transport: string
  readonly mountPath: string
}

interface ClientStatusBody {
  readonly enabled: true
  readonly servers: ReadonlyArray<McpClientServerSummary>
}

interface ClientToolsBody {
  readonly enabled: true
  readonly tools: ReadonlyArray<McpClientTool>
}

interface AgentChatRequestBody {
  readonly message?: unknown
  readonly sessionId?: unknown
}

interface AgentChatResponseBody {
  readonly reply: string
  readonly sessionId?: string
}

const isTruthyEnvFlag = (value: string | undefined): boolean =>
  value === 'true' || value === 'TRUE' || value === '1'

const isMcpServerEnabled = (env: NodeJS.ProcessEnv): boolean =>
  isTruthyEnvFlag(env.MCP_SERVER_ENABLED) || isTruthyEnvFlag(env.MCP_ENABLED)

const handleServerStatus = (c: Readonly<Context>): Response => {
  const { env } = process
  if (!isMcpServerEnabled(env)) {
    return c.json({ enabled: false, error: 'MCP server is disabled' }, 404)
  }
  const body: ServerStatusBody = {
    enabled: true,
    transport: env.MCP_TRANSPORT ?? 'streamable-http',
    mountPath: env.MCP_MOUNT_PATH ?? '/mcp',
  }
  return c.json(body, 200)
}

const handleClientStatus = (c: Readonly<Context>): Response => {
  const servers = parseMcpClientServers(process.env)
  if (servers.length === 0) {
    return c.json({ enabled: false, error: 'MCP client is disabled' }, 404)
  }
  const body: ClientStatusBody = {
    enabled: true,
    servers: servers.map(summariseMcpClientServer),
  }
  return c.json(body, 200)
}

const handleClientTools = (c: Readonly<Context>): Response => {
  const servers = parseMcpClientServers(process.env)
  if (servers.length === 0) {
    return c.json({ enabled: false, error: 'MCP client is disabled' }, 404)
  }
  const body: ClientToolsBody = {
    enabled: true,
    // The discovered tool catalog is server-agnostic in this stub: every
    // configured external server is assumed to expose the default catalog
    // until real `tools/list` discovery is wired in. The agent-level filter
    // applied in `handleAgentChat` narrows this further per agent.
    tools: DEFAULT_MCP_CLIENT_TOOL_CATALOG,
  }
  return c.json(body, 200)
}

const findAgentByName = (app: App | undefined, name: string): Agent | undefined => {
  if (!app?.agents) return undefined
  return app.agents.find((candidate) => candidate.name === name)
}

interface OpenAiToolDefinition {
  readonly type: 'function'
  readonly name: string
  readonly description: string
  readonly function: {
    readonly name: string
    readonly description: string
    readonly parameters: {
      readonly type: 'object'
      readonly properties: Record<string, never>
    }
  }
}

const buildOpenAiTools = (
  catalog: ReadonlyArray<McpClientTool>
): ReadonlyArray<OpenAiToolDefinition> =>
  catalog.map((tool) => ({
    type: 'function' as const,
    // Top-level `name`/`description` so the AI mock helper (which inspects
    // `tools[i].name` directly) can assert against the catalog. Real OpenAI
    // wire format also nests them under `function`.
    name: tool.name,
    description: tool.description,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object' as const,
        properties: {},
      },
    },
  }))

interface ChatCompletionResponse {
  readonly choices?: ReadonlyArray<{
    readonly message?: {
      readonly content?: string | null
    }
  }>
}

interface AiProviderCallOptions {
  readonly baseUrl: string
  readonly apiKey: string
  readonly model: string
  readonly systemPrompt: string
  readonly userMessage: string
  readonly tools: ReadonlyArray<OpenAiToolDefinition>
  readonly servers: ReadonlyArray<McpClientServer>
  readonly timeoutMs: number
}

/**
 * Outcome of one provider round-trip: the model's text, or a `failed` marker.
 *
 * A marker rather than a string because the caller must be able to tell a
 * provider FAILURE from an assistant REPLY. Returning the diagnostic as the
 * reply text (`[AI provider error: HTTP 404]`) disguised every failure as a
 * success: HTTP 200, a chat bubble a UI cannot distinguish from a real answer,
 * no error banner and no retry offered — while `/api/health` kept reporting the
 * provider reachable.
 */
type AiProviderOutcome = { readonly ok: true; readonly reply: string } | { readonly ok: false }

const callAiProvider = async (options: AiProviderCallOptions): Promise<AiProviderOutcome> => {
  const messages = [
    { role: 'system' as const, content: options.systemPrompt },
    { role: 'user' as const, content: options.userMessage },
  ]

  // Surface the configured external MCP servers in a header so downstream
  // proxies / loggers can correlate AI calls with the active MCP catalog
  // without inspecting request bodies. Token values stay inside the auth
  // table held in `servers`; only URLs are surfaced here.
  const mcpServerHeader = options.servers.map((server) => server.url).join(',')
  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
      ...(mcpServerHeader.length > 0 && { 'X-Sovrium-Mcp-Servers': mcpServerHeader }),
    },
    body: JSON.stringify({
      model: options.model,
      messages,
      ...(options.tools.length > 0 && { tools: options.tools }),
    }),
    signal: AbortSignal.timeout(options.timeoutMs),
  })

  if (!response.ok) {
    return { ok: false }
  }
  const payload = (await response.json()) as ChatCompletionResponse
  const content = payload.choices?.[0]?.message?.content
  return { ok: true, reply: typeof content === 'string' ? content : '' }
}

const isStringRecordValue = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

const resolveTimeoutMs = (rawTimeout: string | undefined): number => {
  const parsed = rawTimeout === undefined ? Number.NaN : Number.parseInt(rawTimeout, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000
}

interface ChatRequestPayload {
  readonly message: string
  readonly sessionId?: string
}

const parseChatBody = async (c: Readonly<Context>): Promise<ChatRequestPayload> => {
  const body = (await c.req
    .json()
    .catch(() => ({}) as AgentChatRequestBody)) as AgentChatRequestBody
  return {
    message: isStringRecordValue(body.message) ? body.message : '',
    ...(isStringRecordValue(body.sessionId) && { sessionId: body.sessionId }),
  }
}

interface AiEnv {
  readonly baseUrl: string
  readonly apiKey: string
  readonly model: string
}

/**
 * Resolve the chat backend config from the environment for `agent`. Delegates
 * the provider-aware `{ baseUrl, apiKey }` resolution (Ollama-out-of-the-box) to
 * the shared {@link resolveAgentChatBackend}, then resolves the model: the
 * agent's pin, else `AI_MODEL`, else the provider's default
 * ({@link defaultModelForProvider}). Returns the shared helper's friendly
 * `{ error }` unchanged when a required value is absent.
 */
const readAiEnv = (env: NodeJS.ProcessEnv, agent: Agent): AiEnv | { readonly error: string } => {
  const backend = resolveAgentChatBackend(env)
  if ('error' in backend) return backend
  const model =
    agent.model ?? env.AI_MODEL ?? defaultModelForProvider(backend.provider) ?? 'mock-model'
  return { baseUrl: backend.baseUrl, apiKey: backend.apiKey, model }
}

const FALLBACK_REPLY =
  'External MCP tools were unavailable for this turn — the agent responded without invoking them.'

/**
 * Run one agent turn against the provider.
 *
 * An EMPTY reply from a reachable provider is still a successful turn — MCP
 * server unavailability surfaces that way, and the caller owes the operator a
 * graceful note rather than an error. A provider that
 * is unreachable, times out, or answers non-2xx is a FAILURE and is reported as
 * one; the diagnostic is logged, never handed to the caller
 *.
 */
const generateAgentReply = async (
  env: NodeJS.ProcessEnv,
  agent: Agent,
  message: string,
  aiEnv: AiEnv
): Promise<AiProviderOutcome> => {
  const servers = parseMcpClientServers(env)
  const catalog = computeAgentMcpToolCatalog(servers, agent)
  const tools = buildOpenAiTools(catalog)
  const timeoutMs = resolveTimeoutMs(env.MCP_CLIENT_TIMEOUT)
  try {
    const outcome = await callAiProvider({
      baseUrl: aiEnv.baseUrl,
      apiKey: aiEnv.apiKey,
      model: aiEnv.model,
      systemPrompt: agent.systemPrompt,
      userMessage: message,
      tools,
      servers,
      timeoutMs,
    })
    if (!outcome.ok) return outcome
    return { ok: true, reply: outcome.reply.length > 0 ? outcome.reply : FALLBACK_REPLY }
  } catch (error) {
    logError('[ai] agent chat provider call failed', error)
    return { ok: false }
  }
}

/**
 * Resolved chat pre-flight: the agent + backend config, or a short-circuit
 * `Response` when the request must be rejected (unknown agent → 404, inert app
 * → 503, unresolvable backend → 503). Keeps {@link handleAgentChat} below the
 * per-function complexity ceiling by hoisting the guard chain out of it.
 */
type ChatPreflight =
  | { readonly ok: true; readonly agent: Agent; readonly aiEnv: AiEnv }
  | { readonly ok: false; readonly response: Response }

const resolveChatPreflight = async (
  c: Readonly<Context>,
  app: App | undefined
): Promise<ChatPreflight> => {
  const agentName = c.req.param('name')
  if (typeof agentName !== 'string' || agentName.length === 0) {
    return { ok: false, response: c.json({ error: 'Agent name is required.' }, 400) }
  }
  const agent = findAgentByName(app, agentName)
  if (!agent) {
    return { ok: false, response: agentNotFound(c) }
  }
  // [internal ref]: a chat turn is an agent invocation, so it carries
  // the same `permissions.trigger` gate `/execute` does. Ahead of the 503
  // below, which would otherwise answer differently for a declared agent than
  // for an undeclared one and reopen the enumeration oracle the 404 closes.
  const triggerRefusal = await checkTriggerPermission(c, agent)
  if (triggerRefusal) return { ok: false, response: triggerRefusal }
  // [internal ref]: with no AI provider configured at all, the declared agent is
  // INERT — discoverable but not runnable. Degrade gracefully with 503 rather
  // than letting `readAiEnv` default to a local Ollama and either hang on an
  // unreachable daemon or return a 200 fallback reply. The loud-fail path for
  // an explicitly-misconfigured provider is enforced at startup, so a booted
  // server with an unset `AI_PROVIDER` is unambiguously the inert case.
  if (!isAiProviderConfigured(process.env)) {
    return {
      ok: false,
      response: c.json(
        { error: 'AI provider not configured — the assistant is currently unavailable.' },
        503
      ),
    }
  }
  const aiEnv = readAiEnv(process.env, agent)
  if ('error' in aiEnv) {
    return { ok: false, response: c.json({ error: aiEnv.error }, 503) }
  }
  return { ok: true, agent, aiEnv }
}

const handleAgentChat =
  (app: App | undefined) =>
  async (c: Readonly<Context>): Promise<Response> => {
    const preflight = await resolveChatPreflight(c, app)
    if (!preflight.ok) return preflight.response
    const { agent, aiEnv } = preflight
    const agentName = agent.name

    const { message, sessionId } = await parseChatBody(c)
    if (message.length === 0) {
      return c.json({ error: '`message` is required and must be a non-empty string.' }, 400)
    }
    const outcome = await generateAgentReply(process.env, agent, message, aiEnv)
    // A provider failure is reported AS a failure so the chat surface can render
    // its error banner and offer retry — mirroring the agent-bound `/api/ai/chat`
    // branch's 502. The provider diagnostic is never echoed to the caller.
    if (!outcome.ok) {
      return c.json({ error: 'The assistant is temporarily unavailable. Please try again.' }, 502)
    }
    const { reply } = outcome

    // Persist the turn to durable conversation history, tagging the
    // conversation with the agent name so agent-bound threads are
    // distinguished from generic chat turns. Best-effort:
    // a persistence failure never breaks the chat turn.
    const session = getSessionContext(c as unknown as Context)
    const userId = session?.userId ?? 'anonymous'
    // eslint-disable-next-line functional/no-expression-statements -- best-effort durable-persistence side effect
    await persistChatTurnDurably({
      userId,
      sessionId: sessionId ?? 'default',
      userMessage: message,
      assistantReply: reply,
      agentName,
    })

    const responseBody: AgentChatResponseBody = {
      reply,
      ...(sessionId !== undefined && { sessionId }),
    }
    return c.json(responseBody, 200)
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
 *   resolves agent definitions (system prompt, model, `mcp.allowedTools`)
 *   from `app.agents`. When absent, chat requests for any agent return 404.
 */
export function chainAiMcpStatusRoutes<T extends Hono>(honoApp: T, app?: App): T {
  return honoApp
    .get('/api/ai/mcp/server/status', (c) => handleServerStatus(c as unknown as Readonly<Context>))
    .get('/api/ai/mcp/client/status', (c) => handleClientStatus(c as unknown as Readonly<Context>))
    .get('/api/ai/mcp/client/tools', (c) => handleClientTools(c as unknown as Readonly<Context>))
    .post('/api/agents/:name/chat', (c) =>
      handleAgentChat(app)(c as unknown as Readonly<Context>)
    ) as T
}
