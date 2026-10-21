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
 *  - an AI agent prompt spec: the agent's `systemPrompt` is sent as the
 *    `system` message to the AI provider (and verbatim per agent — two agents
 *    with distinct prompts produce distinct system messages).
 *  - an AI agent prompt spec: the agent's `model` override is sent;
 *    when omitted, the platform default (`AI_MODEL`) is used.
 *  - an AI agent prompt spec: the agent's `temperature` override is
 *    sent; when omitted, the env default (`AI_TEMPERATURE`) is used, if any.
 *  - an AI agent prompt spec: auto-generated table context (one line
 *    per table its tools read for the person chatting, with the fields both
 *    may read) is appended AFTER the agent prompt so the LLM knows which data
 *    surfaces it may reason about.
 *  - `{{appName}}` / `{{userRole}}` template
 *    variables in the agent prompt are resolved before delivery.
 *  - the resolved system prompt is NEVER echoed back
 *    in the JSON response — only the model's `reply` is returned.
 *
 * TRANSPORT: this module resolves the agent BINDING only — it performs no
 * provider round-trip. The turn is dispatched by `ai-chat.ts` through the
 * `AiService` port, exactly like a generic turn.
 *
 * It does not `fetch` `${baseUrl}/chat/completions` directly, and the per-agent
 * `model` / `temperature` overrides are no reason to. `ChatInput` carries
 * `model`, `temperature`, `maxTokens` and `tools`, so the port puts every
 * override on the wire; and hard-coding the OpenAI-compatible path would make
 * the agent path unreachable on Ollama — the sovereignty-default provider —
 * which serves chat at the native `/api/chat`. There is no `OLLAMA_BASE_URL` an operator can set
 * that satisfies both a hard-coded `/chat/completions` and the native
 * `/api/chat`: one of the two always 404s. Only the port knows which shape a
 * provider speaks.
 *
 * Going through the port also earns the agent path the three things the raw
 * fetch structurally could not have: the tool-EXECUTION loop (it read replies
 * via `choices[0].message.content`, which is empty on a `tool_calls` reply, so
 * every tool call was silently dropped — an AI agent tools spec), a populated
 * `actions[]` instead of a hard-coded `[]`, and durable turns attributed to
 * the agent that produced them.
 */

import { isCallerDeniedAgentAction } from '@/domain/models/app/agents/agent-gate-validation'
import { isSystemAgentName } from '@/domain/models/app/agents/agent-identity'
import {
  buildSystemAgent,
  type SystemAgentTable,
} from '@/domain/models/app/agents/system-agent-service'
import { hasReadPermission } from '@/domain/models/app/auth/permission-evaluator-service'
import { resolveAgentTemperature } from '@/presentation/api/runtime/agent-ai-config'
import type { AgentCaller } from '@/application/ports/services/agent-approval-store'
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
 * The tables, and the fields of each, an agent-bound turn describes to its
 * model: the ones its tools may read for the person it answers.
 */
export interface DescribedTable {
  readonly name: string
  readonly readableColumns: ReadonlyArray<string>
}

/**
 * Build the one-line-per-table context block appended after the agent prompt.
 * Returns an empty string when no table is described.
 *
 * `tables` is the set the turn's tools read (`toToolCallTables`, for the
 * agent's reader), narrowed to the agent's declared allowlist: a table the
 * agent's role cannot read, a table the person it answers does not list, and
 * a field either of them may not read are absent, so the prompt and the tool
 * list never name different tables or columns.
 */
const buildTableContext = (
  tables: ReadonlyArray<DescribedTable>,
  allowlist: ReadonlyArray<string> | undefined
): string => {
  const described = tables.filter(
    (table) => allowlist === undefined || allowlist.includes(table.name)
  )
  if (described.length === 0) return ''
  const lines = described.map(
    (table) => `- ${table.name} (fields: ${table.readableColumns.join(', ')})`
  )
  return ['Available data tables:', ...lines].join('\n')
}

/**
 * Compose the effective system prompt delivered to the AI provider:
 * the agent's (template-resolved) prompt followed by auto-generated table
 * context. Either part may be empty; the join collapses blank segments so an
 * empty agent prompt yields just the table context.
 */
const buildAgentSystemPrompt = (
  app: App,
  agent: Agent,
  tables: ReadonlyArray<DescribedTable>
): string => {
  const resolvedPrompt = resolveTemplateVariables(agent.systemPrompt, app, agent)
  const tableContext = buildTableContext(tables, agent.tools?.tables)
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
    hasReadPermission(table as { name: string; permissions?: { read?: unknown } }, agent.role, {
      auth: app.auth,
      tables: tables as readonly { name: string }[],
    })
  )
  return readable.filter((table) => allowlist.includes(table.name)).map((table) => table.name)
}

/**
 * The tables each of a declared agent's actions names to its model. Answering
 * a person (`caller`), an action names only an allowlisted table she may reach
 * with it herself: one her chat tools list (`listed`), or for `record.create`
 * one she may create in — never a table the records API answers her as
 * unknown. With no one to answer, the whole allowlist.
 */
export const actionTablesFor =
  (
    agent: Agent,
    app: App | undefined,
    caller: AgentCaller | undefined,
    listed: ReadonlySet<string>
  ) =>
  (action: string): ReadonlyArray<string> => {
    const allowlist = agent.tools?.tables ?? []
    if (caller === undefined) return allowlist
    return allowlist.filter(
      (table) =>
        (action === 'record.create' || listed.has(table)) &&
        !isCallerDeniedAgentAction({ action, table, caller: caller.grantOn(table) }, app)
    )
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
  /**
   * `true` for the built-in System Agent only. It changes three things, each
   * because the System Agent is the caller's own read-only assistant rather
   * than a configured actor:
   *
   *  - its tools read as the CALLER, never as {@link role}, so a member asking
   *    it is offered exactly the tables a member may read;
   *  - it replays the session's history like the generic chat does (it has no
   *    fact memory to re-learn from a replay);
   *  - its turns persist UNATTRIBUTED (`agent_name IS NULL`), which is the row
   *    set its admin conversation view is defined as.
   */
  readonly builtIn?: true
}

/**
 * The declared agent `agentName` names, or `undefined` when the app declares
 * none by that name (the caller maps that onto HTTP 404). The built-in System
 * Agent is not a declared one.
 */
export const findDeclaredAgent = (app: App, agentName: string): Agent | undefined =>
  isSystemAgentName(agentName)
    ? undefined
    : app.agents?.find((candidate) => candidate.name === agentName)

/**
 * Resolve the binding for a turn with the declared `agent`, describing to its
 * model the `tables` its tools read for this turn ({@link DescribedTable}).
 *
 * The composed system prompt is never echoed back in the response
 * — it is an input to the provider call only.
 */
export const resolveAgentTurnBinding = (
  app: App,
  agent: Agent,
  tables: ReadonlyArray<DescribedTable>
): AgentTurnBinding => {
  // Deliberately NOT `resolveAgentModel`: that helper ends in a hard-coded
  // `'mock-model'`, which the raw-fetch path needed because it always had to put
  // SOME model on the wire. Through the port an absent model means "use the
  // provider's own default" (`llama3.1` on Ollama, the configured default on a
  // cloud provider) — strictly better than shipping a model name no real
  // provider serves. The agent override still wins, then `AI_MODEL`
  const model = agent.model ?? process.env.AI_MODEL
  const toolTables = resolveAgentToolTables(app, agent)
  return {
    name: agent.name,
    role: agent.role,
    systemPrompt: buildAgentSystemPrompt(app, agent, tables),
    temperature: resolveAgentTemperature(agent, DEFAULT_TEMPERATURE),
    ...(model !== undefined && { model }),
    ...(agent.maxTokens !== undefined && { maxTokens: agent.maxTokens }),
    ...(toolTables !== undefined && { toolTables }),
  }
}

/**
 * The binding for a turn addressed to the built-in System Agent.
 *
 * `readableTables` are the tables (and readable columns) the CALLER may read —
 * the same RBAC-scoped set its tools are built from — so the prompt and the
 * tool list can never name different tables or columns. Model and temperature follow the platform defaults
 * (`AI_MODEL`, `AI_TEMPERATURE`): the System Agent declares no override.
 */
export const resolveSystemAgentTurnBinding = (
  app: App,
  readableTables: ReadonlyArray<DescribedTable>
): AgentTurnBinding => {
  const tables: ReadonlyArray<SystemAgentTable> = readableTables.map((table) => ({
    name: table.name,
    fields: table.readableColumns.map((name) => ({ name })),
  }))
  const agent = buildSystemAgent(
    { name: app.name, ...(app.description !== undefined && { description: app.description }) },
    tables
  )
  const model = process.env.AI_MODEL
  return {
    name: agent.name,
    role: agent.role,
    systemPrompt: agent.systemPrompt,
    temperature: resolveAgentTemperature(agent, DEFAULT_TEMPERATURE),
    ...(model !== undefined && { model }),
    builtIn: true,
  }
}

/**
 * The name a turn's persisted row is attributed to: the agent's, except for the
 * System Agent, whose turns stay unattributed (`agent_name IS NULL`).
 */
export const agentAttribution = (agent: AgentTurnBinding | undefined): string | undefined =>
  agent === undefined || agent.builtIn === true ? undefined : agent.name
