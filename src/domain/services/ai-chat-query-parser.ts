/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { findReferencedTable, findSelectOptionMention, QUOTED_RE } from './ai-chat-parsing'

export interface QueryField {
  readonly name: string
  readonly type: string
  readonly options?: ReadonlyArray<string>
}

export interface QueryTable {
  readonly name: string
  readonly fields: ReadonlyArray<QueryField>
}

export interface QueryFilter {
  readonly column: string
  readonly value: string
}

export interface QueryIntent {
  readonly aggregate: 'count' | 'avg' | 'sum' | 'list'
  readonly table: string
  readonly filter?: QueryFilter
  readonly aggregateColumn?: string
  readonly limit?: number
  readonly sortColumn?: string
}

const PROPER_NOUN_RE = /\b[A-Z][\w]*(?:\s+[A-Z][\w]*)*\b/g

const STOP_WORDS = new Set([
  'what',
  'whats',
  'which',
  'who',
  'show',
  'list',
  'find',
  'how',
  'now',
  'the',
  'a',
  'an',
])

const findSelectFilter = (message: string, table: QueryTable): QueryFilter | undefined => {
  const mention = findSelectOptionMention(message, table.fields)
  return mention === undefined ? undefined : { column: mention.field, value: mention.value }
}

const findTextFilter = (message: string, table: QueryTable): QueryFilter | undefined => {
  const textField = table.fields.find(
    (field) => field.type === 'single-line-text' || field.type === 'long-text'
  )
  if (textField === undefined) return undefined
  const quoted = message.match(QUOTED_RE)?.[1]
  const properNoun = pickEntityProperNoun(message)
  const value = quoted ?? properNoun
  return value !== undefined ? { column: textField.name, value } : undefined
}

const pickEntityProperNoun = (message: string): string | undefined => {
  const runs = message.match(PROPER_NOUN_RE) ?? []
  return runs.find((run) => {
    const words = run.split(/\s+/)
    if (words.length > 1) return true
    return !STOP_WORDS.has(run.toLowerCase())
  })
}

const parseRequestedLimit = (lower: string): number | undefined => {
  const match = lower.match(/\b(?:top|first|limit|last)\s+(\d+)\b/)
  return match?.[1] !== undefined ? Number(match[1]) : undefined
}

const findNumericColumn = (message: string, table: QueryTable): string | undefined => {
  const lower = message.toLowerCase()
  const numericFields = table.fields.filter((field) => field.type === 'number')
  const named = numericFields.find((field) => lower.includes(field.name.toLowerCase()))
  return (named ?? numericFields[0])?.name
}

const looksLikeQuery = (message: string, lower: string): boolean =>
  /\?/.test(message) ||
  /\b(show|list|find|count|how many|which|what|average|avg|sum|total|filter|display|get)\b/.test(
    lower
  )

const resolveAggregate = (lower: string): QueryIntent['aggregate'] => {
  if (/\b(how many|count|number of)\b/.test(lower)) return 'count'
  if (/\b(average|avg|mean)\b/.test(lower)) return 'avg'
  const totalAsVerb = /\btotal\b/.test(lower) && !/\bby\s+total\b/.test(lower)
  if (/\bsum\b/.test(lower) || totalAsVerb) return 'sum'
  return 'list'
}

const buildIntent = (parts: {
  readonly aggregate: QueryIntent['aggregate']
  readonly table: string
  readonly filter: QueryFilter | undefined
  readonly aggregateColumn: string | undefined
  readonly limit: number | undefined
  readonly sortColumn: string | undefined
}): QueryIntent => ({
  aggregate: parts.aggregate,
  table: parts.table,
  ...(parts.filter !== undefined && { filter: parts.filter }),
  ...(parts.aggregateColumn !== undefined && { aggregateColumn: parts.aggregateColumn }),
  ...(parts.limit !== undefined && { limit: parts.limit }),
  ...(parts.sortColumn !== undefined && { sortColumn: parts.sortColumn }),
})

export const parseQueryIntent = (
  message: string,
  tables: ReadonlyArray<QueryTable>,
  fallbackTable?: string
): QueryIntent | undefined => {
  const lower = message.toLowerCase()
  const resolved =
    findReferencedTable(message, tables) ?? tables.find((table) => table.name === fallbackTable)
  if (resolved === undefined || !looksLikeQuery(message, lower)) return undefined

  const aggregate = resolveAggregate(lower)
  const wantsAggregateColumn = aggregate === 'avg' || aggregate === 'sum'
  return buildIntent({
    aggregate,
    table: resolved.name,
    filter: findSelectFilter(message, resolved) ?? findTextFilter(message, resolved),
    aggregateColumn: wantsAggregateColumn ? findNumericColumn(message, resolved) : undefined,
    limit: parseRequestedLimit(lower),
    sortColumn: /\bby\b/.test(lower) ? findNumericColumn(message, resolved) : undefined,
  })
}
