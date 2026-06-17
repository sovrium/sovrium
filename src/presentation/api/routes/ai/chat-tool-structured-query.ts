/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TOOL_FILTER_OPERATORS, MAX_QUERY_ROWS } from '@/domain/services/ai-chat/ai-chat-tools'
import type { DynamicRecordCondition } from '@/application/ports/repositories/tables/dynamic-record-repository'

const OPERATOR_MAP: Record<string, string> = {
  eq: 'equals',
  neq: 'notEquals',
  gt: 'greaterThan',
  gte: 'greaterThanOrEqual',
  lt: 'lessThan',
  lte: 'lessThanOrEqual',
  contains: 'contains',
  startsWith: 'startsWith',
  endsWith: 'endsWith',
  in: 'in',
  isNull: 'isNull',
  isNotNull: 'isNotNull',
}

const TOOL_OPERATOR_SET: ReadonlySet<string> = new Set(TOOL_FILTER_OPERATORS)

const VALUELESS_OPERATORS: ReadonlySet<string> = new Set(['isNull', 'isNotNull'])

const DEFAULT_LIMIT = 50

export interface StructuredQueryInputs {
  readonly columns: ReadonlyArray<string> | undefined
  readonly conditions: ReadonlyArray<DynamicRecordCondition>
  readonly sortColumn: string | undefined
  readonly sortDirection: 'asc' | 'desc' | undefined
  readonly limit: number
}

export interface StructuredCountInputs {
  readonly conditions: ReadonlyArray<DynamicRecordCondition>
}

export type StructuredQueryValidation =
  | { readonly ok: true; readonly inputs: StructuredQueryInputs }
  | { readonly ok: false; readonly error: string }

export type StructuredCountValidation =
  | { readonly ok: true; readonly inputs: StructuredCountInputs }
  | { readonly ok: false; readonly error: string }

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const validateSelect = (
  raw: unknown,
  readable: ReadonlySet<string>
):
  | { readonly ok: true; readonly columns: ReadonlyArray<string> | undefined }
  | { readonly ok: false; readonly error: string } => {
  if (raw === undefined) return { ok: true, columns: undefined }
  if (!Array.isArray(raw))
    return { ok: false, error: 'Invalid select: must be an array of column names.' }
  const unknown = raw.find((c) => typeof c !== 'string' || !readable.has(c))
  if (unknown !== undefined) {
    return {
      ok: false,
      error: `Invalid select: unknown or not-allowed column "${String(unknown)}".`,
    }
  }
  return { ok: true, columns: raw.length === 0 ? undefined : (raw as ReadonlyArray<string>) }
}

type ConditionResult =
  | { readonly ok: true; readonly condition: DynamicRecordCondition }
  | { readonly ok: false; readonly error: string }

const validateOneFilter = (entry: unknown, readable: ReadonlySet<string>): ConditionResult => {
  const filter = asRecord(entry)
  const { field, operator } = filter
  if (typeof field !== 'string' || !readable.has(field)) {
    return { ok: false, error: `Invalid filter: unknown or not-allowed field "${String(field)}".` }
  }
  if (typeof operator !== 'string' || !TOOL_OPERATOR_SET.has(operator)) {
    return { ok: false, error: `Invalid filter: unknown operator "${String(operator)}".` }
  }
  const internalOperator = OPERATOR_MAP[operator] ?? 'equals'
  return {
    ok: true,
    condition: VALUELESS_OPERATORS.has(operator)
      ? { column: field, operator: internalOperator }
      : { column: field, operator: internalOperator, value: filter['value'] },
  }
}

type FiltersResult =
  | { readonly ok: true; readonly conditions: ReadonlyArray<DynamicRecordCondition> }
  | { readonly ok: false; readonly error: string }

const validateFilters = (raw: unknown, readable: ReadonlySet<string>): FiltersResult => {
  if (raw === undefined) return { ok: true, conditions: [] }
  if (!Array.isArray(raw)) return { ok: false, error: 'Invalid filters: must be an array.' }
  return raw.reduce<FiltersResult>(
    (acc, entry) => {
      if (!acc.ok) return acc
      const result = validateOneFilter(entry, readable)
      return result.ok ? { ok: true, conditions: [...acc.conditions, result.condition] } : result
    },
    { ok: true, conditions: [] }
  )
}

const validateSort = (
  raw: unknown,
  readable: ReadonlySet<string>
):
  | {
      readonly ok: true
      readonly sortColumn: string | undefined
      readonly sortDirection: 'asc' | 'desc' | undefined
    }
  | { readonly ok: false; readonly error: string } => {
  if (raw === undefined) return { ok: true, sortColumn: undefined, sortDirection: undefined }
  const sort = asRecord(raw)
  const { field, direction } = sort
  if (typeof field !== 'string' || !readable.has(field)) {
    return { ok: false, error: `Invalid sort: unknown or not-allowed field "${String(field)}".` }
  }
  if (direction !== undefined && direction !== 'asc' && direction !== 'desc') {
    return { ok: false, error: 'Invalid sort: direction must be "asc" or "desc".' }
  }
  return { ok: true, sortColumn: field, sortDirection: direction as 'asc' | 'desc' | undefined }
}

const resolveLimit = (
  raw: unknown
):
  | { readonly ok: true; readonly limit: number }
  | { readonly ok: false; readonly error: string } => {
  if (raw === undefined) return { ok: true, limit: DEFAULT_LIMIT }
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
    return { ok: false, error: 'Invalid limit: must be a positive integer.' }
  }
  return { ok: true, limit: Math.min(raw, MAX_QUERY_ROWS) }
}

export const buildStructuredQuery = (
  args: Record<string, unknown>,
  readableColumns: ReadonlyArray<string>
): StructuredQueryValidation => {
  const readable = new Set(readableColumns)

  const select = validateSelect(args['select'], readable)
  if (!select.ok) return { ok: false, error: select.error }

  const filters = validateFilters(args['filters'], readable)
  if (!filters.ok) return { ok: false, error: filters.error }

  const sort = validateSort(args['sort'], readable)
  if (!sort.ok) return { ok: false, error: sort.error }

  const limit = resolveLimit(args['limit'])
  if (!limit.ok) return { ok: false, error: limit.error }

  return {
    ok: true,
    inputs: {
      columns: select.columns,
      conditions: filters.conditions,
      sortColumn: sort.sortColumn,
      sortDirection: sort.sortDirection,
      limit: limit.limit,
    },
  }
}

export const buildStructuredCount = (
  args: Record<string, unknown>,
  readableColumns: ReadonlyArray<string>
): StructuredCountValidation => {
  const readable = new Set(readableColumns)
  const filters = validateFilters(args['filters'], readable)
  if (!filters.ok) return { ok: false, error: filters.error }
  return { ok: true, inputs: { conditions: filters.conditions } }
}
