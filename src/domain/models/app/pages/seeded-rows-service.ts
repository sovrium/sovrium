/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A data source's query answered over rows held in memory: the rows of a seed
 * folder a page export draws from, which no database ever holds. Filters,
 * sorts and paging read as the records list reads them, on the values the
 * rows carry; an operator this reading does not know keeps every row rather
 * than hiding one a designer expected to see.
 */

type Row = Readonly<Record<string, unknown>>

/** One condition of a data source's `filter`. */
export interface SeededRowFilter {
  readonly field: string
  readonly operator: string
  readonly value?: unknown
}

/** One key of a data source's `sort`. */
export interface SeededRowSort {
  readonly field: string
  readonly direction?: string
}

const text = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value).toLowerCase()

const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0)

/** Two values that read as the same: numbers and their text spellings alike. */
const same = (left: unknown, right: unknown): boolean =>
  Array.isArray(left) ? left.some((item) => same(item, right)) : text(left) === text(right)

const compare = (left: unknown, right: unknown): number => {
  const [a, b] = [Number(left), Number(right)]
  if (!Number.isNaN(a) && !Number.isNaN(b) && left !== '' && right !== '') return a - b
  return text(left).localeCompare(text(right))
}

/** Each operator this reading knows, as a test of a row's value against the condition's. */
const OPERATORS: Readonly<Record<string, (value: unknown, expected: unknown) => boolean>> = {
  eq: (value, expected) => same(value, expected),
  neq: (value, expected) => !same(value, expected),
  in: (value, expected) => Array.isArray(expected) && expected.some((item) => same(value, item)),
  contains: (value, expected) =>
    Array.isArray(value) ? same(value, expected) : text(value).includes(text(expected)),
  startsWith: (value, expected) => text(value).startsWith(text(expected)),
  gt: (value, expected) => compare(value, expected) > 0,
  gte: (value, expected) => compare(value, expected) >= 0,
  lt: (value, expected) => compare(value, expected) < 0,
  lte: (value, expected) => compare(value, expected) <= 0,
  isEmpty: (value) => isEmpty(value),
  isNotEmpty: (value) => !isEmpty(value),
}

/** Whether one row passes one condition. */
const passes = (row: Row, filter: SeededRowFilter): boolean =>
  OPERATORS[filter.operator]?.(row[filter.field], filter.value) ?? true

/** The rows that pass every condition, in their own order. */
export const filterSeededRows = <R extends Row>(
  rows: readonly R[],
  filter: readonly SeededRowFilter[] | undefined
): readonly R[] => rows.filter((row) => (filter ?? []).every((condition) => passes(row, condition)))

/**
 * The rows a query answers: filtered, sorted by each key in turn (a stable
 * sort, so equal rows keep their order), then the requested page of them.
 */
export const queriedSeededRows = <R extends Row>(
  rows: readonly R[],
  query: {
    readonly filter?: readonly SeededRowFilter[] | undefined
    readonly sort?: readonly SeededRowSort[] | undefined
    readonly pageSize?: number | undefined
    readonly page?: number | undefined
  } = {}
): readonly R[] => {
  const sorts = query.sort ?? []
  const sorted = filterSeededRows(rows, query.filter).toSorted((left, right) =>
    sorts.reduce(
      (order, sort) =>
        order !== 0
          ? order
          : compare(left[sort.field], right[sort.field]) * (sort.direction === 'desc' ? -1 : 1),
      0
    )
  )
  if (query.pageSize === undefined) return sorted
  const start = ((query.page ?? 1) - 1) * query.pageSize
  return sorted.slice(start, start + query.pageSize)
}
