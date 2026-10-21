/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The chat surface's own tools — `query_<table>` and `count_<table>`. The
 * reply a turn that called them answers with is `chat-tool-reply.ts`'s.
 *
 * The loop is not here: a chat turn runs on the agent runtime
 * (`use-cases/agents/agent-runtime.ts`), which asks the model, resolves each
 * call (an agent's actions through its gates, these table tools through
 * {@link runChatTableTool}), feeds the results back, and stops at
 * `AI_CHAT_MAX_TOOL_ITERATIONS` tool rounds. This module:
 *
 *  - runs one table tool — a `query_<table>` tool runs the AI-supplied read
 *    query against `<table>`;
 *  - RBAC-gates it by the tool's target table — a role lacking `read` on the
 *    table yields an error tool result, never data;
 *
 * SECURITY (Finding #1): the model NO LONGER supplies SQL. Each `query_<table>`
 * / `count_<table>` tool advertises a STRUCTURED schema (select/filters/sort/
 * limit) scoped to its own table's role-readable columns. `executeToolCall`
 * parses + re-validates those structured args (the security boundary) and
 * translates them into the safe, parameterized query builder via
 * `listDynamicRecords` / `countDynamicRecords`. Consequences:
 *   • cross-table reads are structurally impossible (no table-name arg);
 *   • writes / DDL are structurally impossible (read-only builder);
 *   • all values are bound; a fabricated SQL string lands in a filter `value`
 *     and is treated as data, never as SQL;
 *   • field-level read permissions scope the `select` enum and result rows;
 *   • a hard row cap of `MAX_QUERY_ROWS` is enforced server-side regardless of
 *     the requested `limit`.
 */

import { Effect } from 'effect'
import { toolSafeTableName } from '@/domain/models/app/auth/ai-access'
import { logError } from '@/infrastructure/logging/logger'
import { executeOtherTool } from './chat-browser-tool'
import {
  chatReadableColumns,
  passesChatTableGate,
  readScopeOf,
  resolveChatRowScope,
  type ChatReader,
  type ChatRowScope,
} from './chat-read-scope'
import { keepListedTables } from './chat-reader-rows'
import { projectAppTables, type ProjectedField } from './chat-table-projection'
import { toolCountProgram, toolQueryProgram } from './chat-tool-lookup-scope'
import {
  buildStructuredCount,
  buildStructuredQuery,
  type StructuredQueryValidation,
} from './chat-tool-structured-query'
import type { ChatToolCall } from '@/application/ports/services/ai-service'
import type { ChatAction } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

/**
 * Table shape carrying the permissions block (table-level RBAC re-check) plus
 * the role-readable column projection (drives the structured-arg validation and
 * the result-row projection).
 */
export interface ToolCallTable {
  readonly name: string
  readonly permissions?: unknown
  /** All fields (name/type/options) — used to derive readable columns. */
  readonly fields: ReadonlyArray<ProjectedField>
  /** Column names the acting role may READ (field-level RBAC applied). */
  readonly readableColumns: ReadonlyArray<string>
  /**
   * Columns a declared agent reads but the person it answers may not. Never
   * advertised and never returned; a `select` naming one is narrowed away, a
   * filter or sort naming one is refused like any unknown field.
   */
  readonly withheldColumns?: ReadonlyArray<string>
}

/**
 * Resolve the set of tables the acting role may *read* — the RBAC-scoped table
 * list used to build the function/tool definitions advertised to the AI
 * provider. A table the role cannot read is omitted entirely, and so is a
 * table the records list admits the reader no row of
 * ({@link keepListedTables}), so the produced tool list never names a table
 * the records API answers her as one that does not exist. Each surviving table
 * carries its role-readable column projection so the tool enums and result
 * rows are field-level scoped.
 */
export const toToolCallTables = async (
  services: DomainContext,
  app: App | undefined,
  reader: ChatReader
): Promise<ReadonlyArray<ToolCallTable>> => {
  const tables = projectAppTables(app)
  const readable = tables.flatMap((table) => {
    // The records route's own effective roles for this table: the account role,
    // a `group:<name>` entry per group (a bare role can never match one,
    // An AI chat tool spec) and, under row-level rules, every assignment role —
    // so a table the records API lists for her is advertised to her.
    // An agent answering a person passes only where she passes too, and its
    // columns are the ones both may read (`chatReadableColumns`).
    if (!passesChatTableGate(app, tables, table, reader)) return []
    return [
      {
        name: table.name,
        fields: table.fields,
        ...chatReadableColumns(app, table, reader),
        ...(table.permissions !== undefined && { permissions: table.permissions }),
      },
    ]
  })
  return keepListedTables(services, app, readable, reader)
}

/** What a chat turn's table tools read with. */
export interface ChatToolScope {
  /** The server's resolved services, taken off the request that started the turn. */
  readonly services: DomainContext
  /** Tables the acting principal may reach — drives per-table RBAC. */
  readonly tables: ReadonlyArray<ToolCallTable>
  /** The app the tables come from — the records gates read its declarations. */
  readonly app: App | undefined
  /**
   * Who the tools read as: the table gate asks the records route's effective
   * roles for each table, and the row-level read rule narrows every call.
   */
  readonly reader: ChatReader
  /** The declared agent the turn is bound to, when it is agent-bound. */
  readonly agentName?: string
}

/**
 * Default tool-calling iteration cap when `AI_CHAT_MAX_TOOL_ITERATIONS` is
 * unset. Each iteration is one provider round-trip that may emit tool calls.
 */
const DEFAULT_MAX_TOOL_ITERATIONS = 5

/** Resolve the operator-tunable tool-iteration cap from the environment. */
export const resolveMaxToolIterations = (): number => {
  const raw = process.env.AI_CHAT_MAX_TOOL_ITERATIONS
  if (raw === undefined) return DEFAULT_MAX_TOOL_ITERATIONS
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_TOOL_ITERATIONS
}

/**
 * Parse a structured tool name into its `{ kind, table }`. Recognises the two
 * read-only tool families `query_<table>` and `count_<table>`; anything else is
 * `kind: 'unknown'` (an error tool-result, never executed).
 */
interface ParsedToolName {
  readonly kind: 'query' | 'count' | 'unknown'
  readonly table?: string
}
const parseToolName = (toolName: string): ParsedToolName => {
  if (toolName.startsWith('query_'))
    return { kind: 'query', table: toolName.slice('query_'.length) }
  if (toolName.startsWith('count_'))
    return { kind: 'count', table: toolName.slice('count_'.length) }
  return { kind: 'unknown' }
}

/** The result of executing a single tool call. */
interface ToolExecution {
  /** Content placed in the `role: 'tool'` follow-up message. */
  readonly content: string
  /** The `type: 'query'` action surfaced in the chat response. */
  readonly action: ChatAction
  /** True when the call was blocked by the per-table RBAC gate. */
  readonly denied: boolean
}

/** The tool-call args object, normalised to a record (model may omit it). */
const callArgs = (call: ChatToolCall): Record<string, unknown> =>
  call.arguments !== null && typeof call.arguments === 'object'
    ? (call.arguments as Record<string, unknown>)
    : {}

/**
 * Project a result row to the role-readable columns only — defence-in-depth so
 * a restricted column never reaches the model even if it slipped into a `*`
 * select.
 */
const projectRow = (
  row: Record<string, unknown>,
  readableColumns: ReadonlyArray<string>
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(row).filter(([key]) => readableColumns.includes(key)))

/**
 * Execute one structured tool call. The tool name is parsed to `{kind, table}`;
 * table-level RBAC is re-checked (defence-in-depth); the structured args are
 * validated against the role-readable columns (the security boundary) and
 * translated into the safe parameterized query builder. A blocked/invalid/
 * failing call yields an error string fed back to the model (never throws) so
 * the provider can recover gracefully.
 */
const executeToolCall = async (
  call: ChatToolCall,
  input: ChatToolScope
): Promise<ToolExecution> => {
  const parsed = parseToolName(call.name)
  // The tool carries the table's tool-safe name (`query_Open_Deals`); the
  // action and every message name the table as the config does.
  const table = input.tables.find((candidate) => toolSafeTableName(candidate.name) === parsed.table)
  const tableName = table?.name ?? parsed.table
  const action: ChatAction = {
    type: 'query',
    ...(tableName !== undefined && { table: tableName }),
    description: `Tool ${call.name} executed.`,
  }

  // Not a table tool: `browser_use` for an agent granted it, else an unknown-tool error.
  if (parsed.kind === 'unknown') return executeOtherTool(call, input, action)

  // RBAC gate — the role must be able to read the target table
  // An unknown table or a denied role both yield an
  // error tool result; no query is run.
  const scope = await toolRowScope(table, input)
  if (table === undefined || scope.kind === 'refused') {
    return {
      content: `Error: permission denied — you cannot access the "${tableName ?? call.name}" data.`,
      action,
      denied: true,
    }
  }

  const run = { services: input.services, app: input.app, reader: input.reader }
  return parsed.kind === 'count'
    ? executeCount({ ...run, call, table, action, scope })
    : executeQuery({ ...run, call, table, action, scope })
}

/**
 * The rows of the tool's table the reader may read: refused without the
 * table's read grant (over the records route's effective roles), otherwise the
 * records read gate's row-level answer.
 */
const toolRowScope = async (
  table: ToolCallTable | undefined,
  input: ChatToolScope
): Promise<ChatRowScope> =>
  table !== undefined && passesChatTableGate(input.app, input.tables, table, input.reader)
    ? resolveChatRowScope(input.services, input.app, table.name, input.reader)
    : { kind: 'refused' }

/** One validated tool call, with the rows its reader may read. */
interface ToolCallRun {
  readonly services: DomainContext
  /** The app the table comes from — its lookups are judged by its declarations. */
  readonly app: App | undefined
  /** Who the call reads as — the lookups are judged for the person it answers. */
  readonly reader: ChatReader
  readonly call: ChatToolCall
  readonly table: ToolCallTable
  readonly action: ChatAction
  readonly scope: ChatRowScope
}

/** Execute a validated structured `query_<table>` call. */
const executeQuery = async (run: ToolCallRun): Promise<ToolExecution> => {
  const { call, table, action, scope } = run
  const validation: StructuredQueryValidation = buildStructuredQuery(
    callArgs(call),
    table.readableColumns,
    table.withheldColumns
  )
  if (!validation.ok) {
    return {
      content: `Error: invalid query arguments — ${validation.error}`,
      action,
      denied: false,
    }
  }
  const { inputs } = validation
  // A row-level rule that admits no row answers no row, as the records API does.
  if (scope.kind === 'nothing') {
    return { content: JSON.stringify({ rows: [] }), action, denied: false }
  }
  // `Effect.result` turns a failure into the error tool-result fed back to the
  // model (never throws / never 500s, an AI chat tool spec).
  const result = await Effect.runPromise(
    toolQueryProgram({
      app: run.app,
      tableName: table.name,
      reader: run.reader,
      readScope: readScopeOf(scope),
      inputs,
    }).pipe(Effect.provide(run.services), Effect.result)
  )
  if (result._tag === 'Failure') return lookupFailed(call, result.failure, action)
  // Project every returned row to the columns asked for (or every readable
  // one), the role-readable columns only — field-level scoping
  // defence-in-depth — before handing it to the model.
  const shown = (inputs.columns ?? table.readableColumns).filter((column) =>
    table.readableColumns.includes(column)
  )
  const rows = result.success.map((row) => projectRow(row, shown))
  return { content: JSON.stringify({ rows }), action, denied: false }
}

/**
 * A lookup the database did not answer: the cause is logged for the operator,
 * and the model — and the person reading, who receives what the model is
 * handed — reads one sentence naming the tool. The database's own sentence
 * can quote the SQL and the values bound to it, so it goes no further.
 */
const lookupFailed = (call: ChatToolCall, failure: unknown, action: ChatAction): ToolExecution => {
  logError('[ai-chat] a chat lookup did not complete', failure, { tool: call.name })
  return { content: `Error: the "${call.name}" lookup did not complete.`, action, denied: false }
}

/** Execute a validated structured `count_<table>` call. */
const executeCount = async (run: ToolCallRun): Promise<ToolExecution> => {
  const { services, call, table, action, scope } = run
  const validation = buildStructuredCount(callArgs(call), table.readableColumns)
  if (!validation.ok) {
    return {
      content: `Error: invalid count arguments — ${validation.error}`,
      action,
      denied: false,
    }
  }
  if (scope.kind === 'nothing') {
    return { content: JSON.stringify({ count: 0 }), action, denied: false }
  }
  const result = await Effect.runPromise(
    toolCountProgram({
      app: run.app,
      tableName: table.name,
      reader: run.reader,
      readScope: readScopeOf(scope),
      conditions: validation.inputs.conditions,
    }).pipe(Effect.provide(services), Effect.result)
  )
  if (result._tag === 'Failure') return lookupFailed(call, result.failure, action)
  return { content: JSON.stringify({ count: result.success }), action, denied: false }
}

/** Run one table tool for the agent runtime, as the result it hands the model. */
export const runChatTableTool = async (
  call: ChatToolCall,
  scope: ChatToolScope
): Promise<{ readonly content: string; readonly denied: boolean; readonly table?: string }> => {
  const execution = await executeToolCall(call, scope)
  return {
    content: execution.content,
    denied: execution.denied,
    ...(execution.action.table !== undefined && { table: execution.action.table }),
  }
}
