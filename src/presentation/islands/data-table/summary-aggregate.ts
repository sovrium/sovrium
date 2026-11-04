/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whole-view aggregates for the data-table's summary footer.
 *
 * ## Why the footer had to stop reducing `records`
 *
 * The footer used to reduce over `records` — the rows of the CURRENT PAGE,
 * because the grid pages server-side (`manualPagination: true`, and the query
 * sends `page` + `limit`). So every aggregate reported the page rather than the
 * view. Measured on a 66-row table at `pageSize: 25`: `count` showed 25 against
 * 66, `sum` showed 2650 against 7635, `avg` showed 10.79 against 28.62 — wrong,
 * and wrong in the direction that looks plausible.
 *
 * A summary describes the view, so it must not move when the reader turns a
 * page. That is only true if the number is computed over the whole filtered
 * table, which is what the records API's `?aggregate=` parameter already does
 * in SQL. This module builds that parameter and reads the answer back.
 *
 * ## Why it rides the records request rather than a second one
 *
 * The aggregate travels on the SAME request that fetches the page, so the
 * footer's number lands in the same response as the rows it describes. A
 * separate query would resolve independently and leave a window where a
 * hydrated grid shows rows above a footer that has not answered yet.
 *
 * The SQL aggregate also removes the float artefact a client-side reduction
 * produced: summing 10.1 + 20.2 + 30.3 + 0.4 + 100.5 + 30.6 + 15.7 left to
 * right in IEEE-754 gives 207.79999999999995, which is what the footer printed.
 *
 * ## Why a read-endpoint grid still reduces in the browser
 *
 * Everything above holds for a grid bound to a DATABASE TABLE, where the records
 * API can be sent `?aggregate=` and answers in SQL. A grid bound to a read
 * ENDPOINT has no such parameter to send: the endpoint returns rows and nothing
 * else, so there is no server here that could compute the figure — and the
 * footer used to draw an em-dash under a correctly drawn label, which reads as
 * finished until someone looks at the number.
 *
 * {@link computeRowAggregations} reduces the rows in hand. WHICH rows those are
 * is the whole question, and reducing the open PAGE would have reinstated on
 * this binding exactly the defect the section above describes: a total that
 * moves on every page turn. So the caller hands it the rows the endpoint serves
 * for the binding with the grid's page window removed — see
 * `readSystemAggregations` in `use-data-table-query.ts`.
 *
 * The claim is still weaker than the SQL one, and the limit is stated rather
 * than hidden: a feed that can only be walked by cursor cannot be totalled
 * without walking it, so there the figure describes what arrived.
 */

import { finiteValuesAt, reduceNumericValues } from '../runtime/numeric-aggregate'
import type { NumericAggregateFunction } from '../runtime/numeric-aggregate'
import type { TableRecord } from '../runtime/types'
import type { DataTableSummaryItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * The aggregations block the records API returns for a non-shortcut request:
 * `count` is a scalar (SQL `COUNT(*)`, a bigint the driver stringifies), the
 * four numeric operations are keyed by field.
 */
export interface SummaryAggregations {
  readonly count?: string | number
  /** `null` is the server's answer over no values; the footer keeps its placeholder. */
  readonly sum?: Readonly<Record<string, number | null>>
  readonly avg?: Readonly<Record<string, number | null>>
  readonly min?: Readonly<Record<string, number | null>>
  readonly max?: Readonly<Record<string, number | null>>
}

const NUMERIC_FUNCTIONS: readonly NumericAggregateFunction[] = ['sum', 'avg', 'min', 'max']

/**
 * Build the `?aggregate=` parameter for a declared summary, or `undefined` when
 * the grid declares no summary at all (in which case no aggregate SQL runs).
 *
 * The JSON form is used rather than the `field:op,…` shortcut: the shortcut
 * FLATTENS its answer to a scalar whenever exactly one distinct field is
 * aggregated, so a grid summarising one column and a grid summarising two would
 * hand this module two different response shapes for no reason.
 */
export const buildSummaryAggregateParam = (
  summary: readonly DataTableSummaryItem[] | undefined
): string | undefined => {
  if (!summary || summary.length === 0) return undefined

  const fieldsFor = (fn: NumericAggregateFunction): readonly string[] => [
    ...new Set(summary.filter((item) => item.function === fn).map((item) => item.field)),
  ]

  const numeric = NUMERIC_FUNCTIONS.reduce<Record<string, readonly string[]>>((acc, fn) => {
    const fields = fieldsFor(fn)
    return fields.length > 0 ? { ...acc, [fn]: fields } : acc
  }, {})

  const wantsCount = summary.some((item) => item.function === 'count')
  if (!wantsCount && Object.keys(numeric).length === 0) return undefined

  return JSON.stringify({ ...(wantsCount ? { count: true } : {}), ...numeric })
}

/**
 * Reduce the rows a read endpoint returned into the same aggregations block the
 * records API computes in SQL, so the footer reads one shape whichever binding
 * fed it.
 *
 * `undefined` when the grid declares no summary — there is then nothing to
 * compute and nothing to render. A declared summary whose column carries no
 * number returns a block with that key ABSENT, which is exactly what the SQL
 * path does for an all-null column, so the footer keeps its placeholder instead
 * of printing a zero the data does not support. Which cell values count as a
 * number is decided once, in `runtime/numeric-aggregate.ts`, which the kanban
 * board's column figure reads too.
 */
export const computeRowAggregations = (
  rows: readonly TableRecord[],
  summary: readonly DataTableSummaryItem[] | undefined
): SummaryAggregations | undefined => {
  if (!summary || summary.length === 0) return undefined

  const numeric = NUMERIC_FUNCTIONS.reduce<Record<string, Record<string, number>>>((acc, fn) => {
    const entries = [
      ...new Set(summary.filter((item) => item.function === fn).map((item) => item.field)),
    ].flatMap((field) => {
      const value = reduceNumericValues(fn, finiteValuesAt(rows, field))
      return value === undefined ? [] : [[field, value] as const]
    })
    return entries.length === 0 ? acc : { ...acc, [fn]: Object.fromEntries(entries) }
  }, {})

  const wantsCount = summary.some((item) => item.function === 'count')
  return { ...(wantsCount ? { count: rows.length } : {}), ...numeric }
}

/**
 * Read one declared summary item's value out of the aggregations block.
 *
 * Returns `undefined` while the block has not arrived, or when the server
 * computed nothing for that field (an all-null column has no sum). The caller
 * renders a placeholder rather than a misleading zero.
 */
export const readSummaryValue = (
  aggregations: SummaryAggregations | undefined,
  item: DataTableSummaryItem
): number | undefined => {
  if (!aggregations) return undefined
  if (item.function === 'count') {
    return aggregations.count === undefined ? undefined : Number(aggregations.count)
  }
  return aggregations[item.function]?.[item.field] ?? undefined
}
