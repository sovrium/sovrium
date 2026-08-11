/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Agent-aware variant of the generic `POST /api/ai/chat` endpoint.
 *
 * When the chat request body carries an `agent` field naming an entry in
 * `app.agents[]`, the chat turn is bound to that agent's configuration:
 *
 * - [internal ref]: the agent's `systemPrompt` is sent as the
 *    `system` message to the AI provider (and verbatim per agent — two agents
 *    with distinct prompts produce distinct system messages).
 * - [internal ref]: the agent's `model` override is sent;
 *    when omitted, the platform default (`AI_MODEL`) is used.
 * - [internal ref]: the agent's `temperature` override is
 *    sent; when omitted, the env default (`AI_TEMPERATURE`) is used, if any.
 * - [internal ref]: auto-generated table context (one line
 *    per `app.tables[]` entry) is appended AFTER the agent prompt so the LLM
 *    knows which data surfaces it may reason about.
 * - [internal ref]: `{{appName}}` / `{{userRole}}` template
 *    variables in the agent prompt are resolved before delivery.
 * - [internal ref]: the resolved system prompt is NEVER echoed back
 *    in the JSON response — only the model's `reply` is returned.
 *
 * This module performs a direct OpenAI-compatible `fetch` (mirroring
 * `agent-ai-call.ts` and `ai-mcp-status.ts`) rather than routing through the
 * `AiService` Effect port, because the per-agent `model` / `temperature`
 * overrides must reach the wire so the AI mock server's request recorder
 * (`ai.getChatRequests()`) can assert them.
 */

import {
  buildChatToolDefinitions,
  type ChatToolDefinition,
} from '@/domain/services/ai-chat/ai-chat-tools'
import { hasReadPermission } from '@/domain/validators/permission-evaluators'
import { resolveAgentChatBackend } from '@/presentation/api/utils/agent-chat-env'
import { readableColumnsForRole } from '../ai/chat-table-projection'
import { resolveAgentModel, resolveAgentTemperature } from './agent-ai-config'
import { postChatCompletion } from './openai-chat-fetch'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'

interface AgentChatRequest {
  readonly message: string
  readonly sessionId: string
  readonly agentName: string
}

/**
 * Resolve `{{appName}}` and `{{userRole}}` template variables in an agent's
 * system prompt. Unknown `{{...}}` tokens are left intact so a typo surfaces
 * to the prompt author rather than being silently dropped.
 */
const resolveTemplateVariables = (prompt: string, app: App, agent: Agent): string =>
  prompt.replaceAll('{{appName}}', app.name).replaceAll('{{userRole}}', agent.role)

/**
 * Build the one-line-per-table context block appended after the agent prompt.
 * Returns an empty string when the app declares no tables.
 *
 * Tables are scoped by the agent's RBAC role: an agent
 * operates under its declared `role`, so a table the role cannot read
 * (`permissions.read` excludes it) is omitted entirely — neither the table nor
 * its field names reach the model prompt.
 */
const buildTableContext = (app: App, agent: Agent): string => {
  const tables = app.tables ?? []
  const readableTables = tables.filter((table) =>
    hasReadPermission(
      table as { name: string; permissions?: { read?: unknown } },
      agent.role,
      tables as readonly { name: string }[]
    )
  )
  if (readableTables.length === 0) return ''
  const lines = readableTables.map((table) => {
    const fieldNames = table.fields.map((field) => field.name).join(', ')
    return `- ${table.name} (fields: ${fieldNames})`
  })
  return ['Available data tables:', ...lines].join('\n')
}

/**
 * Compose the effective system prompt delivered to the AI provider:
 * the agent's (template-resolved) prompt followed by auto-generated table
 * context. Either part may be empty; the join collapses blank segments so an
 * empty agent prompt yields just the table context.
 */
const buildAgentSystemPrompt = (app: App, agent: Agent): string => {
  const resolvedPrompt = resolveTemplateVariables(agent.systemPrompt, app, agent)
  const tableContext = buildTableContext(app, agent)
  return [resolvedPrompt, tableContext].filter((part) => part.trim().length > 0).join('\n\n')
}

/**
 * Build the OpenAI-compatible `tools[]` array for an agent-bound chat turn —
 * one `query_<table>` definition per table the agent's role can read AND, when
 * an explicit `agent.tools.tables` allowlist is declared, that the allowlist
 * names. Implements the double-gate model documented on
 * `AgentCapabilitiesSchema`: RBAC gate (role-level read permission) AND
 * allowlist gate (per-agent capability). An agent without an allowlist falls
 * back to the RBAC-only restriction so the agent-LESS chat behavior is
 * preserved for unrestricted agents.
 */
const buildAgentChatTools = (app: App, agent: Agent): ReadonlyArray<ChatToolDefinition> => {
  const tables = app.tables ?? []
  const readableTables = tables.filter((table) =>
    hasReadPermission(
      table as { name: string; permissions?: { read?: unknown } },
      agent.role,
      tables as readonly { name: string }[]
    )
  )
  const allowlist = agent.tools?.tables
  const allowedReadableTables =
    allowlist === undefined
      ? readableTables
      : readableTables.filter((table) => allowlist.includes(table.name))
  return buildChatToolDefinitions(
    allowedReadableTables.map((table) => {
      // Project the raw schema fields onto the minimal {name,type} shape the
      // readable-columns helper consumes, then apply field-level read scoping
      // for the agent's role ([internal ref] parity for the agent path).
      const fields = table.fields.map((field) => ({
        name: (field as { name: string }).name,
        type: (field as { type: string }).type,
      }))
      return {
        name: table.name,
        columns: readableColumnsForRole(
          fields,
          (table as { permissions?: unknown }).permissions,
          agent.role
        ),
      }
    })
  )
}

/**
 * Default temperature applied when neither the agent nor the `AI_TEMPERATURE`
 * env var specifies one — a balanced value for chat-style completions. The
 * chat path always sends a temperature on the wire,
 * so this is the fallback handed to {@link resolveAgentTemperature}.
 */
const DEFAULT_TEMPERATURE = 0.7

interface ChatCompletionResponse {
  readonly choices?: ReadonlyArray<{
    readonly message?: { readonly content?: string | null }
  }>
}

/** Inputs for a single agent-bound AI provider round-trip. */
interface AgentProviderCall {
  readonly baseUrl: string
  readonly apiKey: string
  readonly agent: Agent
  readonly systemPrompt: string
  readonly message: string
  /**
   * RBAC-scoped tool definitions advertised to the AI provider — one
   * `query_<table>` per table the agent's role can read
   *. Empty when the agent has no readable tables; the
   * provider call then omits the `tools` field entirely.
   */
  readonly tools: ReadonlyArray<ChatToolDefinition>
}

/** Read the model's text reply from an OpenAI-compatible chat response. */
const extractReply = (payload: ChatCompletionResponse | undefined): string => {
  const content = payload?.choices?.[0]?.message?.content
  return typeof content === 'string' && content.length > 0 ? content : ''
}

/**
 * Outcome of an agent-bound AI provider round-trip: either the model's text
 * reply, or a `failed` marker when the provider was unreachable or returned a
 * non-2xx status. The caller maps `failed` onto an HTTP error status so the
 * chat surface can show its error banner.
 */
type AgentProviderOutcome = { readonly ok: true; readonly reply: string } | { readonly ok: false }

/**
 * Perform the agent-bound AI provider round-trip. The system prompt, model,
 * and temperature carry the agent's configuration so the AI mock server's
 * request recorder observes them. Returns the model's text reply, or
 * `{ ok: false }` when the provider is unreachable or errored — provider
 * failures are surfaced (not silently degraded) so the chat UI can render an
 * error state and offer retry.
 */
const callAgentProvider = async (call: AgentProviderCall): Promise<AgentProviderOutcome> => {
  const { baseUrl, apiKey, agent, systemPrompt, message, tools } = call
  const body: Record<string, unknown> = {
    model: resolveAgentModel(agent),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
    // The chat path always puts a temperature on the wire so PROMPT-005 can
    // assert it regardless of configuration.
    temperature: resolveAgentTemperature(agent, DEFAULT_TEMPERATURE),
    ...(agent.maxTokens !== undefined && { max_tokens: agent.maxTokens }),
    // RBAC-scoped tool advertising. Omit the field
    // entirely when the agent's role can read no tables — sending `tools: []`
    // would still surface the key in the recorded request, which the spec
    // contract treats as "no agent-scoped tools".
    ...(tools.length > 0 && { tools }),
  }

  const response = await postChatCompletion({ baseUrl, apiKey }, body)

  if (response === undefined || !response.ok) {
    return { ok: false }
  }
  const payload = (await response.json().catch(() => undefined)) as
    ChatCompletionResponse | undefined
  return { ok: true, reply: extractReply(payload) }
}

/**
 * Outcome of resolving an agent-bound chat request — a ready-to-send JSON
 * body paired with the HTTP status the caller should respond with.
 */
export interface AgentChatResult {
  readonly status: 200 | 404 | 502 | 503
  readonly body: Record<string, unknown>
}

/**
 * Handle an agent-bound `/api/ai/chat` turn. The system prompt is composed
 * from the agent's configuration plus auto-generated table context; it is
 * never included in the response.
 */
export const handleAgentChat = async (
  app: App,
  req: AgentChatRequest
): Promise<AgentChatResult> => {
  const agent = app.agents?.find((candidate) => candidate.name === req.agentName)
  if (agent === undefined) {
    return {
      status: 404,
      body: { error: `Agent '${req.agentName}' is not declared in the app schema.` },
    }
  }

  const aiEnv = resolveAgentChatBackend(process.env)
  if ('error' in aiEnv) {
    return { status: 503, body: { error: aiEnv.error } }
  }
  const { baseUrl, apiKey } = aiEnv

  const systemPrompt = buildAgentSystemPrompt(app, agent)
  const tools = buildAgentChatTools(app, agent)
  const outcome = await callAgentProvider({
    baseUrl,
    apiKey,
    agent,
    systemPrompt,
    message: req.message,
    tools,
  })

  // A provider failure surfaces as HTTP 502 so the chat UI renders its error
  // banner and retry button instead of silently
  // degrading the failure into a 200 fallback reply.
  if (!outcome.ok) {
    return {
      status: 502,
      body: { error: 'The assistant is temporarily unavailable. Please try again.' },
    }
  }

  return {
    status: 200,
    body: { reply: outcome.reply, actions: [], sessionId: req.sessionId },
  }
}
