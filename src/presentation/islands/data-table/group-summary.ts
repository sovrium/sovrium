/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-group summary aggregates — the group row's half of a declared `summary`.
 *
 * A declared `summary` describes whatever the grid presents as a whole; when the
 * grid is grouped, it additionally describes each group. There is no second
 * config key: the per-group row is emergent from `groupBy` + `summary`, which is
 * how the parity target behaves and what keeps one aggregate vocabulary rather
 * than two that can drift.
 *
 * Grouping is also a RUNTIME state (the toolbar's Group menu, and saved views
 * carry `groupBy`), so a grid can be grouped by a reader with no static
 * `groupBy` block at all — which is why nothing here consults one.
 *
 * ## Scope: the groups follow the page, the numbers follow the view
 *
 * The groups rendered are the ones with a row on the open page — a header
 * reading `lost (1)` above an empty body is a worse answer than its absence, and
 * the grid's rows and its group headers must describe the same set. The numbers
 * inside them come from the server's whole-view partition, so they do not move
 * when the reader turns a page.
 *
 * ## Why the totals live in the group's own row
 *
 * Two reasons, one behavioural and one mechanical. A collapsed group must keep
 * its totals — a reader collapses everything precisely in order to compare them,
 * so totals that vanish with the rows answer the wrong question. And the runtime
 * grouping specs count data rows with `tbody tr:not(.group-header)`, so an extra
 * `<tr>` inside the group body would be counted as a data row.
 */

import type { SummaryAggregations } from './summary-aggregate'
import type { SummaryFormatContext } from './summary-format'
import type { DataTableSummaryItem } from '@/domain/models/app/pages/components/component-types/data/data-table/schema'

/** Everything the group row needs to render the declared summaries for one group. */
export interface GroupSummaryContext extends SummaryFormatContext {
  readonly items: readonly DataTableSummaryItem[]
  /**
   * Whole-view aggregations per group PATH (`groupPathKey`), from the records
   * response. Keyed by path rather than by value because at depth ≥ 2 the value
   * names two groups: `EMEA › Prospect` and `AMER › Prospect` are different sets
   * and must not share a total.
   */
  readonly byGroup: Readonly<Record<string, SummaryAggregations>>
  /** Visible column field names, in render order — the alignment grid. */
  readonly columnFields: readonly string[]
}

/**
 * Where each declared summary sits within the group's single `<tr>`.
 *
 * The group NAME has to occupy the leading cell (it is the collapse toggle and
 * the row's label), so the leading cell absorbs column 0 plus every column after
 * it that carries no summary — which is what lets a summary keep the column it
 * describes while the name still has room to read as a name. Any summary that
 * falls inside that absorbed span, or that names no visible column at all,
 * renders INSIDE the leading cell rather than being dropped: an unaligned number
 * is a misconfiguration, and silently discarding it would hide one.
 */
export interface GroupSummaryLayout {
  /** `colSpan` of the leading (name + toggle) cell. */
  readonly leadSpan: number
  /** Summaries rendered inside the leading cell, in declaration order. */
  readonly leading: readonly DataTableSummaryItem[]
  /** Summaries for each column from `leadSpan` onward, index-aligned. */
  readonly trailing: ReadonlyArray<readonly DataTableSummaryItem[]>
}

export function buildGroupSummaryLayout(
  columnFields: readonly string[],
  items: readonly DataTableSummaryItem[]
): GroupSummaryLayout {
  const byColumn = columnFields.map((field) => items.filter((item) => item.field === field))

  // Column 0 belongs to the name; keep absorbing while the next column has
  // nothing to say, so the name is not squeezed into a narrow first column when
  // the columns beside it are unsummarised anyway.
  const absorbed = byColumn.reduce<number>(
    (span, columnItems, index) =>
      index === 0 || (span === index && columnItems.length === 0) ? index + 1 : span,
    0
  )
  const leadSpan = Math.max(1, Math.min(absorbed, columnFields.length))

  const unaligned = items.filter((item) => !columnFields.includes(item.field))

  return {
    leadSpan,
    leading: [...byColumn.slice(0, leadSpan).flat(), ...unaligned],
    trailing: byColumn.slice(leadSpan),
  }
}
