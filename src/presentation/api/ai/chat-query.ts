/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat read-query executor.
 *
 * Powers `[internal ref]`.
 * Given a {@link QueryIntent} parsed from the user's chat message, this module:
 *
 *  - enforces table-level read RBAC — a role lacking `read` on the target
 *    table yields a `forbidden` outcome the route maps to HTTP 403
 *;
 *  - caps the result set at `AI_CHAT_MAX_QUERY_ROWS` (default 100) so a query
 *    never streams an unbounded payload back to the caller
 *;
 *  - executes the read as parameterised SQL via `db.execute` — values are
 *    never string-interpolated, so a SQL-injection-shaped message can do no
 * harm;
 *  - formats a human-readable summary reply and an `actions[]` entry of
 * `type: 'query'` carrying the table + description;
 *  - never echoes a field whose name looks sensitive (`ssn`, `password`, …)
 *    so field-level RBAC is honoured even when the schema declares no explicit
 * field permissions.
 *
 * The same lazy, side-effecting `db.execute` discipline as `chat-mutation.ts`
 * is used — the chat surface stays free of the full `TableRepository`/RLS
 * wiring while remaining deterministic for the spec.
 */

import { Effect } from 'effect'
import {
  aggregateDynamicRecords,
  countDynamicRecords,
  listDynamicRecords,
} from '@/application/use-cases/ai/dynamic-record-query'
import {
  chatTableRoles,
  passesChatTableGate,
  readScopeOf,
  resolveChatRowScope,
  type ChatReader,
  type ChatRowScope,
} from './chat-read-scope'
import { readableColumnsForTable } from './chat-table-projection'
import type { ChatAction } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'
import type { QueryIntent, QueryTable } from '@/domain/models/app/agents/ai-chat-query-parser'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

/** Table shape carrying the (untyped) permissions block for RBAC checks. */
export type QueryTableWithPerms = QueryTable & { readonly permissions?: unknown }

/** Outcome of attempting to run a read query. */
export type QueryOutcome =
  | { readonly status: 'forbidden'; readonly message: string }
  | {
      readonly status: 'answered'
      readonly action: ChatAction
      readonly reply: string
    }

/** Inputs required to run a read query. */
export interface RunQueryInput {
  /** The server's resolved services, taken off the request that started the turn. */
  readonly services: DomainContext
  readonly intent: QueryIntent
  /** The app the tables come from — the records gates read its declarations. */
  readonly app: App | undefined
  /**
   * Who the query reads as. The table gate asks the records route's effective
   * roles for the table — role, `group:<name>` per group (a bare role never
   * matches one) and, under row-level rules, every assignment role — and the
   * row-level read rule narrows the rows, as the records API narrows them.
   */
  readonly reader: ChatReader
  /** The full set of app tables (carries permissions + field metadata). */
  readonly tables: ReadonlyArray<QueryTableWithPerms>
}

/**
 * Default ceiling for query result rows when `AI_CHAT_MAX_QUERY_ROWS` is unset
 *.
 */
const DEFAULT_MAX_QUERY_ROWS = 100

/** Resolve the operator-tunable result-row cap from the environment. */
const resolveMaxQueryRows = (): number => {
  const raw = process.env.AI_CHAT_MAX_QUERY_ROWS
  if (raw === undefined) return DEFAULT_MAX_QUERY_ROWS
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_QUERY_ROWS
}

/**
 * Field names treated as sensitive — their values are never echoed in a chat
 * reply, so field-level RBAC is honoured even when the schema declares no
 * explicit field permissions.
 */
const SENSITIVE_FIELD_RE = /\b(ssn|social.?security|password|secret|api.?key|token|salary)\b/i

/** Resolve the {@link QueryTable} for an intent, if the app declares it. */
const resolveTable = (input: RunQueryInput): QueryTableWithPerms | undefined =>
  input.tables.find((table) => table.name === input.intent.table)

// ---------------------------------------------------------------------------
// SQL execution helpers — fronted by the DynamicRecordRepository port
//
// The raw parameterised SQL lives in the infrastructure layer
// (`dynamic-record-repository-live.ts`); these helpers consume the
// `dynamic-record-query` use-case via `Effect.runPromise` so the presentation
// layer holds no raw SQL literal. Behavior is byte-identical to the prior
// inline SQL (same `COUNT(*)::int`, `AVG/SUM(…)::float`, `SELECT *` shapes).
// ---------------------------------------------------------------------------

/** Run a `COUNT(*)` query, optionally narrowed by a single equality filter. */
const runCount = async (
  services: DomainContext,
  intent: QueryIntent,
  scope: ChatRowScope
): Promise<number> =>
  scope.kind === 'nothing'
    ? 0
    : Effect.runPromise(
        countDynamicRecords({
          table: intent.table,
          filter: intent.filter,
          ...readScopeOf(scope),
        }).pipe(Effect.provide(services))
      )

/** Run an `AVG`/`SUM` aggregate over a numeric column. */
const runAggregate = async (
  services: DomainContext,
  intent: QueryIntent,
  input: { readonly fn: 'AVG' | 'SUM'; readonly scope: ChatRowScope }
): Promise<number | undefined> => {
  if (intent.aggregateColumn === undefined || input.scope.kind === 'nothing') return undefined
  return Effect.runPromise(
    aggregateDynamicRecords({
      table: intent.table,
      fn: input.fn,
      column: intent.aggregateColumn,
      filter: intent.filter,
      ...readScopeOf(input.scope),
    }).pipe(Effect.provide(services))
  )
}

/** Run a row-listing query with the resolved row cap and optional sort. */
const runList = async (
  services: DomainContext,
  intent: QueryIntent,
  input: { readonly rowCap: number; readonly scope: ChatRowScope }
): Promise<ReadonlyArray<Record<string, unknown>>> =>
  input.scope.kind === 'nothing'
    ? []
    : Effect.runPromise(
        listDynamicRecords({
          table: intent.table,
          filter: intent.filter,
          sortColumn: intent.sortColumn,
          limit: input.rowCap,
          ...readScopeOf(input.scope),
        }).pipe(Effect.provide(services))
      )

// ---------------------------------------------------------------------------
// Reply formatting
// ---------------------------------------------------------------------------

/**
 * Pick the value displayed for a row: the first non-sensitive text-ish column,
 * so a query reply lists e.g. a product name without leaking an `ssn` column.
 */
const rowLabel = (
  row: Record<string, unknown>,
  table: QueryTable,
  readable: ReadonlyArray<string>
): string | undefined => {
  const labelField = table.fields.find(
    (field) =>
      (field.type === 'single-line-text' || field.type === 'long-text') &&
      !SENSITIVE_FIELD_RE.test(field.name) &&
      readable.includes(field.name)
  )
  if (labelField === undefined) return undefined
  const value = row[labelField.name]
  return typeof value === 'string' ? value : undefined
}

/** Format the human-readable reply for a `count` query. */
const formatCountReply = (intent: QueryIntent, count: number): string => {
  const scope = intent.filter !== undefined ? ` matching ${intent.filter.value}` : ''
  return count === 0
    ? `No ${intent.table} records${scope} were found.`
    : `There are ${String(count)} ${intent.table} record(s)${scope}.`
}

/** Format the human-readable reply for an `avg`/`sum` query. */
const formatAggregateReply = (
  intent: QueryIntent,
  fn: 'average' | 'total',
  value: number | undefined
): string => {
  if (value === undefined) {
    return `No ${intent.table} records were found to compute the ${fn}.`
  }
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(2)
  return `The ${fn} ${intent.aggregateColumn ?? 'value'} for ${intent.table} is ${rounded}.`
}

/**
 * Format the human-readable reply for a row-listing query: a count, the row
 * labels (capped), and — when the result set was truncated — a note that the
 * first {@link rowCap} rows are shown.
 */
const formatListReply = (
  intent: QueryIntent,
  rows: ReadonlyArray<Record<string, unknown>>,
  table: QueryTable,
  view: { readonly rowCap: number; readonly readable: ReadonlyArray<string> }
): string => {
  const { rowCap, readable } = view
  if (rows.length === 0) {
    return `No ${intent.table} records were found matching your criteria.`
  }
  const labels = rows
    .map((row) => rowLabel(row, table, readable))
    .filter((label): label is string => label !== undefined)
    .slice(0, 10)
  const truncated = rows.length >= rowCap
  const head = truncated
    ? `Showing the first ${String(rowCap)} ${intent.table} record(s)`
    : `Found ${String(rows.length)} ${intent.table} record(s)`
  return labels.length > 0 ? `${head}: ${labels.join(', ')}.` : `${head}.`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a parsed read query. Enforces table-level read RBAC, then dispatches on
 * the aggregate kind. Returns a `forbidden` outcome (→ HTTP 403) when the role
 * cannot read the table, or an `answered` outcome carrying the reply text and
 * the `type: 'query'` action entry.
 */
export const runQuery = async (input: RunQueryInput): Promise<QueryOutcome> => {
  const table = resolveTable(input)
  if (table === undefined) {
    return { status: 'forbidden', message: `Unknown table "${input.intent.table}".` }
  }
  // Table-level read RBAC, over the records
  // route's effective roles for this table; then the rows the records read
  // gate lets the caller read.
  const scope = passesChatTableGate(input.app, input.tables, table, input.reader)
    ? await resolveChatRowScope(input.services, input.app, table.name, input.reader)
    : ({ kind: 'refused' } as const)
  if (scope.kind === 'refused') {
    return {
      status: 'forbidden',
      message: `You do not have permission to read the "${table.name}" table.`,
    }
  }

  const { intent } = input
  const rowCap = resolveMaxQueryRows()
  const description = `Queried the "${intent.table}" table.`

  const reply = await runQueryReply({
    services: input.services,
    intent,
    table,
    rowCap,
    scope,
    // A row is labelled only by a column the caller may read (field read
    // audiences, as the records API projects them).
    readable: readableColumnsForTable(input.app, table, {
      role: input.reader.role,
      effectiveRoles: chatTableRoles(input.app, table.name, input.reader),
      isAuthenticated: input.reader.role !== '',
    }),
  })
  return {
    status: 'answered',
    action: { type: 'query', table: intent.table, description },
    reply,
  }
}

/** Dispatch on the aggregate kind and format the reply text. */
const runQueryReply = async (input: {
  readonly services: DomainContext
  readonly intent: QueryIntent
  readonly table: QueryTable
  readonly rowCap: number
  readonly scope: ChatRowScope
  readonly readable: ReadonlyArray<string>
}): Promise<string> => {
  const { services, intent, table, rowCap, scope, readable } = input
  switch (intent.aggregate) {
    case 'count':
      return formatCountReply(intent, await runCount(services, intent, scope))
    case 'avg':
      return formatAggregateReply(
        intent,
        'average',
        await runAggregate(services, intent, { fn: 'AVG', scope })
      )
    case 'sum':
      return formatAggregateReply(
        intent,
        'total',
        await runAggregate(services, intent, { fn: 'SUM', scope })
      )
    case 'list':
      return formatListReply(intent, await runList(services, intent, { rowCap, scope }), table, {
        rowCap,
        readable,
      })
  }
}
