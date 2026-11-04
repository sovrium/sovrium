/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one numeric reduction every island that totals a column in the browser
 * shares: the data-table's summary footer over a read endpoint, and the kanban
 * board's column figure.
 *
 * It lives in `runtime/` rather than beside either consumer because the board
 * once kept its own copy, with a looser coercion (`Number(value)` after
 * dropping only `null`, `undefined` and `''`), so the same values totalled
 * differently in a column header and in a grid footer. A shared decision filed
 * under one of its consumers is a decision the next consumer does not find.
 */

import type { TableRecord } from './types'

/** The four aggregates that read a column's numbers (a count reads none). */
export type NumericAggregateFunction = 'sum' | 'avg' | 'min' | 'max'

/**
 * Every finite number a column holds across the given rows.
 *
 * Empty cells are dropped BEFORE the coercion rather than after, because
 * `Number()` answers **0** for several shapes that all mean "no value", and
 * coercing first folds each of them into the sum as a zero and drags an average
 * down with rows carrying nothing. SQL's own aggregates ignore NULL, and this
 * has to agree with them or the same grid would report two different totals
 * depending on which binding it was pointed at.
 *
 * So the admission rule is a TYPE test, not a list of blanks. A list was the
 * first shape and it let three through, each answering a plausible zero:
 *
 *  - `'   '` — a whitespace-only cell, which `''` does not cover and which
 *    imported data produces readily. `Number('   ')` is `0`.
 *  - `[]` — an empty multi-value cell (a multi-select, an attachment list).
 *    `Number([])` is `0`; SQL would never have answered a zero for it.
 *  - `false` — `Number(false)` is `0` (and `Number(true)` is `1`). A boolean
 *    column has no SUM either dialect agrees on: Postgres refuses it outright,
 *    SQLite counts 0/1. Dropping it leaves the caller's placeholder — the
 *    honest answer for a column that holds no number.
 */
export const finiteValuesAt = (rows: readonly TableRecord[], field: string): readonly number[] =>
  rows.flatMap((row) => {
    const raw = row[field]
    // Anything that is not a number or a non-blank string — `null`,
    // `undefined`, a boolean, an array, an object — reads as NaN and is dropped.
    const value =
      typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? +raw : NaN
    return Number.isFinite(value) ? [value] : []
  })

/**
 * Apply one numeric aggregate, or `undefined` when the column held no number.
 *
 * The bounds fold with `reduce` rather than `Math.min(...values)`: spreading a
 * long column into an argument list overflows the call stack.
 */
export const reduceNumericValues = (
  fn: NumericAggregateFunction,
  values: readonly number[]
): number | undefined => {
  if (values.length === 0) return undefined
  if (fn === 'min' || fn === 'max') return values.reduce((best, value) => Math[fn](best, value))
  const total = values.reduce((acc, value) => acc + value, 0)
  return fn === 'avg' ? total / values.length : total
}
