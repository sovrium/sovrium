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
import { hasReadPermission } from '@/domain/validators/permission-evaluators'
import { provideDynamicRecordRepoLive } from '@/presentation/api/routes/ai/effect-runner'
import type { ChatAction } from '@/domain/models/api/ai/chat'
import type { QueryIntent, QueryTable } from '@/domain/services/ai-chat/ai-chat-query-parser'

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
  readonly intent: QueryIntent
  /** The acting user's role — used for table-level read RBAC. */
  readonly userRole: string
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
const runCount = async (intent: QueryIntent): Promise<number> =>
  Effect.runPromise(
    countDynamicRecords({
      table: intent.table,
      filter: intent.filter,
    }).pipe(provideDynamicRecordRepoLive)
  )

/** Run an `AVG`/`SUM` aggregate over a numeric column. */
const runAggregate = async (
  intent: QueryIntent,
  fn: 'AVG' | 'SUM'
): Promise<number | undefined> => {
  if (intent.aggregateColumn === undefined) return undefined
  return Effect.runPromise(
    aggregateDynamicRecords({
      table: intent.table,
      fn,
      column: intent.aggregateColumn,
      filter: intent.filter,
    }).pipe(provideDynamicRecordRepoLive)
  )
}

/** Run a row-listing query with the resolved row cap and optional sort. */
const runList = async (
  intent: QueryIntent,
  rowCap: number
): Promise<ReadonlyArray<Record<string, unknown>>> =>
  Effect.runPromise(
    listDynamicRecords({
      table: intent.table,
      filter: intent.filter,
      sortColumn: intent.sortColumn,
      limit: rowCap,
    }).pipe(provideDynamicRecordRepoLive)
  )

// ---------------------------------------------------------------------------
// Reply formatting
// ---------------------------------------------------------------------------

/**
 * Pick the value displayed for a row: the first non-sensitive text-ish column,
 * so a query reply lists e.g. a product name without leaking an `ssn` column.
 */
const rowLabel = (row: Record<string, unknown>, table: QueryTable): string | undefined => {
  const labelField = table.fields.find(
    (field) =>
      (field.type === 'single-line-text' || field.type === 'long-text') &&
      !SENSITIVE_FIELD_RE.test(field.name)
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
  rowCap: number
): string => {
  if (rows.length === 0) {
    return `No ${intent.table} records were found matching your criteria.`
  }
  const labels = rows
    .map((row) => rowLabel(row, table))
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
  // Table-level read RBAC.
  if (
    !hasReadPermission(
      table as { name: string; permissions?: { read?: unknown } },
      input.userRole,
      input.tables as ReadonlyArray<{ name: string; permissions?: never }>
    )
  ) {
    return {
      status: 'forbidden',
      message: `You do not have permission to read the "${table.name}" table.`,
    }
  }

  const { intent } = input
  const rowCap = resolveMaxQueryRows()
  const description = `Queried the "${intent.table}" table.`

  const reply = await runQueryReply(intent, table, rowCap)
  return {
    status: 'answered',
    action: { type: 'query', table: intent.table, description },
    reply,
  }
}

/** Dispatch on the aggregate kind and format the reply text. */
const runQueryReply = async (
  intent: QueryIntent,
  table: QueryTable,
  rowCap: number
): Promise<string> => {
  switch (intent.aggregate) {
    case 'count':
      return formatCountReply(intent, await runCount(intent))
    case 'avg':
      return formatAggregateReply(intent, 'average', await runAggregate(intent, 'AVG'))
    case 'sum':
      return formatAggregateReply(intent, 'total', await runAggregate(intent, 'SUM'))
    case 'list':
      return formatListReply(intent, await runList(intent, rowCap), table, rowCap)
  }
}
