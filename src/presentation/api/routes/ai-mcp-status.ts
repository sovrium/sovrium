/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defaultModelForProvider } from '@/domain/models/env/ai/ai-providers'
import { persistAgentTurnDurably } from '@/presentation/api/routes/ai/chat-durable-memory'
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

const callAiProvider = async (options: AiProviderCallOptions): Promise<string> => {
  const messages = [
    { role: 'system' as const, content: options.systemPrompt },
    { role: 'user' as const, content: options.userMessage },
  ]

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
    return `[AI provider error: HTTP ${response.status.toString()}]`
  }
  const payload = (await response.json()) as ChatCompletionResponse
  const content = payload.choices?.[0]?.message?.content
  if (typeof content === 'string' && content.length > 0) return content
  return ''
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

const readAiEnv = (env: NodeJS.ProcessEnv, agent: Agent): AiEnv | { readonly error: string } => {
  const backend = resolveAgentChatBackend(env)
  if ('error' in backend) return backend
  const model =
    agent.model ?? env.AI_MODEL ?? defaultModelForProvider(backend.provider) ?? 'mock-model'
  return { baseUrl: backend.baseUrl, apiKey: backend.apiKey, model }
}

const FALLBACK_REPLY =
  'External MCP tools were unavailable for this turn — the agent responded without invoking them.'

const generateAgentReply = async (
  env: NodeJS.ProcessEnv,
  agent: Agent,
  message: string,
  aiEnv: AiEnv
): Promise<string> => {
  const servers = parseMcpClientServers(env)
  const catalog = computeAgentMcpToolCatalog(servers, agent)
  const tools = buildOpenAiTools(catalog)
  const timeoutMs = resolveTimeoutMs(env.MCP_CLIENT_TIMEOUT)
  try {
    const reply = await callAiProvider({
      baseUrl: aiEnv.baseUrl,
      apiKey: aiEnv.apiKey,
      model: aiEnv.model,
      systemPrompt: agent.systemPrompt,
      userMessage: message,
      tools,
      servers,
      timeoutMs,
    })
    return reply.length > 0 ? reply : FALLBACK_REPLY
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error'
    return `Agent could not reach the AI provider: ${detail}`
  }
}

const handleAgentChat =
  (app: App | undefined) =>
  async (c: Readonly<Context>): Promise<Response> => {
    const agentName = c.req.param('name')
    if (typeof agentName !== 'string' || agentName.length === 0) {
      return c.json({ error: 'Agent name is required.' }, 400)
    }
    const agent = findAgentByName(app, agentName)
    if (!agent) {
      return c.json({ error: `Agent '${agentName}' is not declared in the app schema.` }, 404)
    }
    const aiEnv = readAiEnv(process.env, agent)
    if ('error' in aiEnv) {
      return c.json({ error: aiEnv.error }, 503)
    }
    const { message, sessionId } = await parseChatBody(c)
    if (message.length === 0) {
      return c.json({ error: '`message` is required and must be a non-empty string.' }, 400)
    }
    const reply = await generateAgentReply(process.env, agent, message, aiEnv)

    const session = getSessionContext(c as unknown as Context)
    const userId = session?.userId ?? 'anonymous'
    await persistAgentTurnDurably({
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

export function chainAiMcpStatusRoutes<T extends Hono>(honoApp: T, app?: App): T {
  return honoApp
    .get('/api/ai/mcp/server/status', (c) => handleServerStatus(c as unknown as Readonly<Context>))
    .get('/api/ai/mcp/client/status', (c) => handleClientStatus(c as unknown as Readonly<Context>))
    .get('/api/ai/mcp/client/tools', (c) => handleClientTools(c as unknown as Readonly<Context>))
    .post('/api/agents/:name/chat', (c) =>
      handleAgentChat(app)(c as unknown as Readonly<Context>)
    ) as T
}
