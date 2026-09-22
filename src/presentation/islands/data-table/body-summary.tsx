/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The data-table's summary footer.
 *
 * ## It used to describe the page, not the view
 *
 * `computeAggregate` reduced over `records` — the rows of the CURRENT PAGE,
 * because the grid pages server-side. So every declared aggregate reported the
 * page: measured on a 66-row table at `pageSize: 25`, `count` showed 25 against
 * 66, `sum` showed 2650 against 7635, `avg` showed 10.79 against 28.62. The
 * numbers also *moved on every page turn*, which is the symptom a reader is most
 * likely to notice and least likely to be able to explain.
 *
 * The values now arrive pre-computed in SQL over the whole filtered table (see
 * `./summary-aggregate.ts`), so a summary is invariant under paging by
 * construction rather than by arithmetic that happens to agree.
 *
 * ## Two rendering rules the old footer did not have
 *
 * 1. **A summary is rendered in its column's format.** The footer printed the
 *    raw number, so a `format: 'currency'` column summed to `207.79999999999995`
 *    (the IEEE-754 running total) while every cell above it read `$10.10`. It
 *    now reuses the same formatter the cells do, so the footer agrees with the
 *    column it summarises.
 * 2. **A summary sits under the column it describes.** The footer emitted one
 *    `<td>` per declared item, left to right, with no relation to the columns
 *    above — so a two-column summary on a five-column grid pointed at the wrong
 *    headers. Items are now placed at their column's index.
 *
 * Several summaries may target the SAME column (a `units` column can declare
 * sum, avg, min and max at once), which cannot be aligned within one row. Each
 * item therefore keeps its own `<td>` and the footer stacks LAYERS: layer *k*
 * holds the *k*-th summary of each column. A grid declaring at most one summary
 * per column renders exactly one row, which is what it rendered before.
 */

import {
  computeTableSummaryCellClasses,
  computeTableSummaryRowClasses,
} from '@/presentation/design/table-default-classes'
import { readSummaryValue, type SummaryAggregations } from './summary-aggregate'
import { summaryCellText, type SummaryFormatContext } from './summary-format'
import type { FieldMetaMap } from '../hooks/use-inline-editing'
import type {
  DataTableColumn,
  DataTableSummaryItem,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { ReactElement } from 'react'

/** One declared summary, bound to the column index it renders under. */
interface PlacedSummary {
  readonly index: number
  readonly item: DataTableSummaryItem
}

/**
 * Bucket the declared summaries into `[columnIndex, item]` pairs, then into
 * layers — one row per "how many summaries deep" any single column goes.
 *
 * An item whose field matches no visible column keeps its value rather than
 * losing it: it is appended past the last column on the first layer, unaligned
 * but present. That is a misconfiguration, and dropping the number silently
 * would hide it.
 */
function toSummaryLayers(
  summary: readonly DataTableSummaryItem[],
  columnFields: readonly string[]
): ReadonlyArray<readonly PlacedSummary[]> {
  // Per column, the summaries targeting it in declaration order.
  const byColumn = columnFields.map((field) => summary.filter((item) => item.field === field))
  const unaligned: readonly PlacedSummary[] = summary
    .filter((item) => !columnFields.includes(item.field))
    .map((item, offset) => ({ index: columnFields.length + offset, item }))

  const depth = Math.max(1, ...byColumn.map((items) => items.length))

  return Array.from({ length: depth }, (_, layer) => [
    ...byColumn.flatMap((items, index) => {
      const item = items[layer]
      return item ? [{ index, item }] : []
    }),
    ...(layer === 0 ? unaligned : []),
  ])
}

interface TableSummaryFooterProps {
  readonly summary: readonly DataTableSummaryItem[]
  /**
   * Whole-view aggregates from the records response. Undefined until the first
   * response lands, and always for a system source (no aggregate endpoint).
   */
  readonly aggregations: SummaryAggregations | undefined
  /** Visible column field names, in render order — the alignment grid. */
  readonly columnFields: readonly string[]
  /** Column configuration, consulted for each summarised column's `format`. */
  readonly columns?: readonly DataTableColumn[]
  readonly fieldMeta?: FieldMetaMap
  /** Active page locale, threaded into the shared cell formatter. */
  readonly locale: string
}

/**
 * Renders the summary footer: one `<td>` per declared summary, placed under the
 * column it describes, holding a whole-view aggregate in that column's format.
 */
export function TableSummaryFooter({
  summary,
  aggregations,
  columnFields,
  columns,
  fieldMeta,
  locale,
}: TableSummaryFooterProps): ReactElement {
  const layers = toSummaryLayers(summary, columnFields)
  const width = Math.max(
    columnFields.length,
    ...layers.flatMap((layer) => layer.map((entry) => entry.index + 1))
  )
  const context: SummaryFormatContext = { columns, fieldMeta, locale }

  return (
    <tfoot data-summary="true">
      {layers.map((layer, layerIndex) => (
        <tr
          key={`summary-row-${String(layerIndex)}`}
          role="row"
          className={computeTableSummaryRowClasses()}
        >
          {Array.from({ length: width }, (_, columnIndex) => {
            const entry = layer.find((candidate) => candidate.index === columnIndex)
            return (
              <td
                key={`summary-${String(layerIndex)}-${String(columnIndex)}`}
                className={computeTableSummaryCellClasses()}
                {...(entry ? { 'data-summary-field': entry.item.field } : {})}
              >
                {entry
                  ? summaryCellText(readSummaryValue(aggregations, entry.item), entry.item, context)
                  : ''}
              </td>
            )
          })}
        </tr>
      ))}
    </tfoot>
  )
}
