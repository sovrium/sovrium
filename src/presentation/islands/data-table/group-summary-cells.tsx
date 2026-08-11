/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readSummaryValue } from './summary-aggregate'
import { summaryCellText } from './summary-format'
import type { GroupSummaryContext, GroupSummaryLayout } from './group-summary'
import type { DataTableSummaryItem } from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
import type { ReactElement } from 'react'

/**
 * One group's declared summaries, rendered as the trailing cells of that group's
 * own row.
 *
 * Marked `data-group-summary-field` on the element that carries the field's
 * value — the same hook the footer's `data-summary-field` gives its own cells,
 * so both scopes are addressable the same way.
 */
export function GroupSummaryCells({
  layout,
  context,
  groupKey,
  cellClass,
  borderClass,
}: {
  readonly layout: GroupSummaryLayout
  readonly context: GroupSummaryContext
  /** The group's `groupPathKey` — how `byGroup` is keyed at every level. */
  readonly groupKey: string
  readonly cellClass: string
  readonly borderClass: string
}): ReactElement {
  const aggregations = context.byGroup[groupKey]
  const text = (item: DataTableSummaryItem): string =>
    summaryCellText(readSummaryValue(aggregations, item), item, context)

  return (
    <>
      {layout.trailing.map((columnItems, offset) => (
        <td
          key={`group-summary-${groupKey}-${String(offset)}`}
          className={`${cellClass} ${borderClass} text-foreground font-medium whitespace-nowrap`}
          {...(columnItems[0] ? { 'data-group-summary-field': columnItems[0].field } : {})}
        >
          {columnItems.map((item) => (
            <span
              key={`${item.field}-${item.function}`}
              className="block"
            >
              {text(item)}
            </span>
          ))}
        </td>
      ))}
    </>
  )
}

/**
 * The summaries that fall inside the group-name cell — column 0's, any absorbed
 * with it, and any naming no visible column. Rendered beside the name rather
 * than dropped: an unaligned number marks a misconfiguration, and discarding it
 * silently would hide one.
 */
export function GroupSummaryLeadingCells({
  layout,
  context,
  groupKey,
}: {
  readonly layout: GroupSummaryLayout
  readonly context: GroupSummaryContext
  /** The group's `groupPathKey` — how `byGroup` is keyed at every level. */
  readonly groupKey: string
}): ReactElement {
  const aggregations = context.byGroup[groupKey]
  return (
    <>
      {layout.leading.map((item) => (
        <span
          key={`${item.field}-${item.function}`}
          data-group-summary-field={item.field}
          className="text-foreground-muted ml-4 font-normal"
        >
          {summaryCellText(readSummaryValue(aggregations, item), item, context)}
        </span>
      ))}
    </>
  )
}
