/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A collection page's `collection.filter`, judged in memory on the one record
 * its address names (`page-collection-resolver.ts`). The list, the sitemap and
 * the prev/next neighbours answer the same filter in SQL; this is its twin for
 * the single row, so both read the record and the literals through the
 * table's field types.
 */

import { isEmptyCell } from '@/domain/kernel/matching/empty-value'
import { filterWithFieldLiterals } from '@/domain/models/app/tables/checkbox-literal-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'

/** The shape of a declared table the filter reads: its fields' names and types. */
interface CollectionTable {
  readonly name: string
  readonly fields?: readonly { readonly name: string; readonly type: string }[]
}

/**
 * Numeric comparison helper — returns false unless both operands are numbers.
 * Centralised so the operator dispatch table stays under the cyclomatic-
 * complexity cap.
 */
const numericCompare = (
  cellValue: unknown,
  expected: unknown,
  predicate: (a: number, b: number) => boolean
): boolean =>
  typeof cellValue === 'number' && typeof expected === 'number'
    ? predicate(cellValue, expected)
    : false

/**
 * Per-operator dispatch table for collection-page filter predicates.
 *
 * Supports the literal value branch of `FilterValueSchema`. Any
 * `$currentUser` reference is short-circuited at the call site (see
 * `recordMatchesFilter`) because collection filtering is meant for
 * static publish-state gates (eg. `status eq 'published'`), not
 * session-aware predicates.
 */
const FILTER_OPERATORS: Readonly<
  Record<DataFilter['operator'], (cellValue: unknown, expected: unknown) => boolean>
> = {
  eq: (cellValue, expected) => cellValue === expected,
  neq: (cellValue, expected) => cellValue !== expected,
  gt: (cellValue, expected) => numericCompare(cellValue, expected, (a, b) => a > b),
  gte: (cellValue, expected) => numericCompare(cellValue, expected, (a, b) => a >= b),
  lt: (cellValue, expected) => numericCompare(cellValue, expected, (a, b) => a < b),
  lte: (cellValue, expected) => numericCompare(cellValue, expected, (a, b) => a <= b),
  contains: (cellValue, expected) =>
    typeof cellValue === 'string' && typeof expected === 'string'
      ? cellValue.includes(expected)
      : false,
  in: (cellValue, expected) =>
    Array.isArray(expected) ? (expected as readonly unknown[]).includes(cellValue) : false,
  // Missing, null, `''`, `[]` and `{}` are empty — the one rule,
  // judged on the raw row as the SQL filter judges it (SQLite JSON text too).
  isEmpty: (cellValue) => isEmptyCell(cellValue),
  isNotEmpty: (cellValue) => !isEmptyCell(cellValue),
}

/**
 * Compares a record's field value against a DataFilter predicate.
 */
function recordMatchesFilter(record: Record<string, unknown>, filter: DataFilter): boolean {
  const expected = filter.value
  // `$currentUser` references resolve to objects, not literals; we
  // intentionally short-circuit them as no-match for collection filters.
  if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
    return false
  }
  const op = FILTER_OPERATORS[filter.operator]
  return op === undefined ? false : op(record[filter.field], expected)
}

/**
 * Whether the collection's record satisfies every `collection.filter`
 * predicate, both read through the table's field types — a SQLite checkbox
 * `1` against `eq: true`, a PostgreSQL boolean against `eq: 1` — as the list,
 * sitemap and neighbour reads compare them in SQL.
 */
export function recordMatchesCollectionFilter(
  record: Readonly<Record<string, unknown>>,
  collection: { readonly table: string; readonly filter?: readonly DataFilter[] | undefined },
  context: { readonly tables?: readonly CollectionTable[] | undefined } | undefined
): boolean {
  const table = context?.tables?.find((candidate) => candidate.name === collection.table)
  const typed = readStoredValues(table, record)
  return filterWithFieldLiterals(collection.filter, table?.fields).every((filter) =>
    recordMatchesFilter(typed, filter)
  )
}
