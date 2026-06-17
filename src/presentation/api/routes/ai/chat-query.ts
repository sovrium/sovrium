/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export type QueryTableWithPerms = QueryTable & { readonly permissions?: unknown }

export type QueryOutcome =
  | { readonly status: 'forbidden'; readonly message: string }
  | {
      readonly status: 'answered'
      readonly action: ChatAction
      readonly reply: string
    }

export interface RunQueryInput {
  readonly intent: QueryIntent
  readonly userRole: string
  readonly tables: ReadonlyArray<QueryTableWithPerms>
}

const DEFAULT_MAX_QUERY_ROWS = 100

const resolveMaxQueryRows = (): number => {
  const raw = process.env.AI_CHAT_MAX_QUERY_ROWS
  if (raw === undefined) return DEFAULT_MAX_QUERY_ROWS
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_QUERY_ROWS
}

const SENSITIVE_FIELD_RE = /\b(ssn|social.?security|password|secret|api.?key|token|salary)\b/i

const resolveTable = (input: RunQueryInput): QueryTableWithPerms | undefined =>
  input.tables.find((table) => table.name === input.intent.table)


const runCount = async (intent: QueryIntent): Promise<number> =>
  Effect.runPromise(
    countDynamicRecords({
      table: intent.table,
      filter: intent.filter,
    }).pipe(provideDynamicRecordRepoLive)
  )

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

const formatCountReply = (intent: QueryIntent, count: number): string => {
  const scope = intent.filter !== undefined ? ` matching ${intent.filter.value}` : ''
  return count === 0
    ? `No ${intent.table} records${scope} were found.`
    : `There are ${String(count)} ${intent.table} record(s)${scope}.`
}

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


export const runQuery = async (input: RunQueryInput): Promise<QueryOutcome> => {
  const table = resolveTable(input)
  if (table === undefined) {
    return { status: 'forbidden', message: `Unknown table "${input.intent.table}".` }
  }
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
