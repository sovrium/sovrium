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
 * TRANSPORT: this module resolves the agent BINDING only — it performs no
 * provider round-trip. The turn is dispatched by `ai-chat.ts` through the
 * `AiService` port, exactly like a generic turn.
 *
 * It used to `fetch` `${baseUrl}/chat/completions` directly, on the rationale
 * that the per-agent `model` / `temperature` overrides had to reach the wire.
 * That rationale was wrong on both counts. `ChatInput` carries `model`,
 * `temperature`, `maxTokens` and `tools`, so the port puts every override on
 * the wire; and hard-coding the OpenAI-compatible path made the agent path
 * unreachable on Ollama — the sovereignty-default provider — which serves chat
 * at the native `/api/chat`. There is no `OLLAMA_BASE_URL` an operator can set
 * that satisfies both a hard-coded `/chat/completions` and the native
 * `/api/chat`: one of the two always 404s. Only the port knows which shape a
 * provider speaks.
 *
 * Going through the port also earns the agent path the three things the raw
 * fetch structurally could not have: the tool-EXECUTION loop (it read replies
 * via `choices[0].message.content`, which is empty on a `tool_calls` reply, so
 * every tool call was silently dropped — [internal ref]), a populated
 * `actions[]` instead of a hard-coded `[]`, and durable turns attributed to
 * the agent that produced them.
 */

import { hasReadPermission } from '@/domain/models/app/auth/permission-evaluator-service'
import { resolveAgentTemperature } from '@/presentation/api/runtime/agent-ai-config'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'

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
 * The table-name allowlist an agent-bound turn narrows its tools to, or
 * `undefined` when the agent declares none.
 *
 * Implements the allowlist half of the double-gate model documented on
 * `AgentCapabilitiesSchema`. The RBAC half — role-level
 * table read permission AND field-level column scoping — is applied by the
 * shared `toToolCallTables` in the chat route, driven by `agent.role`, so it is
 * NOT duplicated here: one gate, one implementation, no drift between the agent
 * path and the generic one. An agent without an allowlist falls through to the
 * RBAC-only scoping the agent-LESS chat already applies.
 *
 * The list is intersected with the readable tables rather than trusted: an
 * allowlist naming a table the agent's role cannot read grants nothing.
 */
const resolveAgentToolTables = (app: App, agent: Agent): ReadonlyArray<string> | undefined => {
  const allowlist = agent.tools?.tables
  if (allowlist === undefined) return undefined
  const tables = app.tables ?? []
  const readable = tables.filter((table) =>
    hasReadPermission(
      table as { name: string; permissions?: { read?: unknown } },
      agent.role,
      tables as readonly { name: string }[]
    )
  )
  return readable.filter((table) => allowlist.includes(table.name)).map((table) => table.name)
}

/**
 * Default temperature applied when neither the agent nor the `AI_TEMPERATURE`
 * env var specifies one — a balanced value for chat-style completions. The
 * chat path always sends a temperature on the wire,
 * so this is the fallback handed to {@link resolveAgentTemperature}.
 */
const DEFAULT_TEMPERATURE = 0.7

/**
 * Everything an agent-bound turn contributes on top of a generic one: the
 * composed system prompt, the per-agent provider overrides, the tool-table
 * allowlist, and the agent's name (for RBAC scoping and for durable
 * attribution). Deliberately data, not behaviour — the dispatch itself is the
 * generic path's, unchanged.
 */
export interface AgentTurnBinding {
  /** The agent's declared name — RBAC role source and attribution key. */
  readonly name: string
  /** The agent's RBAC role — scopes the tables the turn's tools may reach. */
  readonly role: string
  /** Agent prompt + auto-generated table context, template-resolved. */
  readonly systemPrompt: string
  /** Per-agent model override, when declared. */
  readonly model?: string
  /** Effective temperature — always defined, so it always reaches the wire. */
  readonly temperature: number
  /** Per-agent output-token cap, when declared. */
  readonly maxTokens?: number
  /** Tool-table allowlist, or `undefined` for RBAC-only scoping. */
  readonly toolTables?: ReadonlyArray<string>
}

/**
 * Resolve the binding for an agent-bound chat turn, or `undefined` when the
 * app declares no agent by that name (the caller maps that onto HTTP 404).
 *
 * The composed system prompt is never echoed back in the response
 * — it is an input to the provider call only.
 */
export const resolveAgentTurnBinding = (
  app: App,
  agentName: string
): AgentTurnBinding | undefined => {
  const agent = app.agents?.find((candidate) => candidate.name === agentName)
  if (agent === undefined) return undefined
  // Deliberately NOT `resolveAgentModel`: that helper ends in a hard-coded
  // `'mock-model'`, which the raw-fetch path needed because it always had to put
  // SOME model on the wire. Through the port an absent model means "use the
  // provider's own default" (`llama3.1` on Ollama, the configured default on a
  // cloud provider) — strictly better than shipping a model name no real
  // provider serves. The agent override still wins, then `AI_MODEL`
  //.
  const model = agent.model ?? process.env.AI_MODEL
  const toolTables = resolveAgentToolTables(app, agent)
  return {
    name: agent.name,
    role: agent.role,
    systemPrompt: buildAgentSystemPrompt(app, agent),
    temperature: resolveAgentTemperature(agent, DEFAULT_TEMPERATURE),
    ...(model !== undefined && { model }),
    ...(agent.maxTokens !== undefined && { maxTokens: agent.maxTokens }),
    ...(toolTables !== undefined && { toolTables }),
  }
}
