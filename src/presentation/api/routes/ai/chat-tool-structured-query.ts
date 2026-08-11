/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat structured-query validation + translation (Finding #1).
 *
 * The model emits STRUCTURED tool args (`{ select?, filters?, sort?, limit? }`)
 * instead of a SQL string. This module is the SECURITY BOUNDARY: it validates
 * those args against the table's ROLE-READABLE columns and a fixed operator
 * vocabulary, then translates them into the inputs of the safe, parameterized
 * `listDynamicRecords` / `countDynamicRecords` query builder. Anything the model
 * fabricates that does not validate (unknown column, unknown operator,
 * out-of-range/typed limit) is rejected — the query never runs.
 *
 * Because the only table referenced is the tool's own `<table>` (no table-name
 * arg) and `select`/`filters[].field`/`sort.field` are constrained to the
 * role-readable columns, cross-table reads and field-level leaks are impossible,
 * and a value such as `"x'; DROP TABLE t; --"` is bound as a parameter — treated
 * as data, never SQL.
 */

import { TOOL_FILTER_OPERATORS, MAX_QUERY_ROWS } from '@/domain/services/ai-chat/ai-chat-tools'
import type { DynamicRecordCondition } from '@/application/ports/repositories/tables/dynamic-record-repository'

/** Map the AI-facing operator token to the internal builder vocabulary. */
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

/** Operators that do not require (and ignore) a `value`. */
const VALUELESS_OPERATORS: ReadonlySet<string> = new Set(['isNull', 'isNotNull'])

const DEFAULT_LIMIT = 50

/** Validated, builder-ready query inputs for the structured `query_<table>` tool. */
export interface StructuredQueryInputs {
  readonly columns: ReadonlyArray<string> | undefined
  readonly conditions: ReadonlyArray<DynamicRecordCondition>
  readonly sortColumn: string | undefined
  readonly sortDirection: 'asc' | 'desc' | undefined
  readonly limit: number
}

/** Validated, builder-ready inputs for the structured `count_<table>` tool. */
export interface StructuredCountInputs {
  readonly conditions: ReadonlyArray<DynamicRecordCondition>
}

/** Discriminated-union result — `ok` carries inputs, otherwise a human error. */
export type StructuredQueryValidation =
  | { readonly ok: true; readonly inputs: StructuredQueryInputs }
  | { readonly ok: false; readonly error: string }

export type StructuredCountValidation =
  | { readonly ok: true; readonly inputs: StructuredCountInputs }
  | { readonly ok: false; readonly error: string }

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

/** Validate the `select` array against the readable-column allowlist. */
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

/** Validate a single filter entry against the readable-column allowlist. */
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

/** Validate the `filters` array → builder conditions (short-circuits on first error). */
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

/** Validate the `sort` object against the readable-column allowlist. */
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

/**
 * Resolve and CLAMP the requested limit. A non-integer / out-of-range value is
 * an error so the model learns its args were invalid; a valid value is clamped
 * to `MAX_QUERY_ROWS` (the server-side hard cap, [internal ref]).
 *
 * The tool schema advertises 1..100; values above that are clamped (not
 * rejected) so an over-eager `limit: 1000` still returns the capped 100 rows
 * rather than failing the whole call.
 */
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

/**
 * Validate + translate the `query_<table>` structured args against the
 * role-readable columns. Returns a discriminated union — `ok` carries
 * builder-ready inputs (with the limit clamped to the hard cap), otherwise an
 * error string fed back to the model.
 */
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

/** Validate + translate the `count_<table>` structured args (filters only). */
export const buildStructuredCount = (
  args: Record<string, unknown>,
  readableColumns: ReadonlyArray<string>
): StructuredCountValidation => {
  const readable = new Set(readableColumns)
  const filters = validateFilters(args['filters'], readable)
  if (!filters.ok) return { ok: false, error: filters.error }
  return { ok: true, inputs: { conditions: filters.conditions } }
}
