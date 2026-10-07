/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableBodyClasses,
  computeTableSkeletonBarClasses,
} from '@/presentation/design/table-default-classes'
import type { DataTableColumnDef } from './island/table-features'
import type { ReactElement } from 'react'

/**
 * The placeholder rows the grid draws while its first page loads.
 */

/**
 * The widths a skeleton bar cycles through, column by column.
 *
 * A placeholder has to read as TEXT of differing lengths; a run of identical
 * bars reads as a grid of blocks, which is not what the arriving content will
 * look like. The design calls for 70 / 50 / 40 / 45 %, and these are the
 * nearest fraction utilities (75 / 50 / 40 / 41.7 %) — a rounding worth taking
 * to stay off arbitrary values, since those numbers encode "visibly unequal"
 * rather than any measured relationship.
 */
const SKELETON_BAR_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/5', 'w-5/12'] as const

/**
 * Renders loading skeleton rows
 */
export function SkeletonRows({
  allColumns,
  cellClass,
}: {
  readonly allColumns: readonly DataTableColumnDef[]
  readonly cellClass: string
}): ReactElement {
  return (
    <tbody
      className={computeTableBodyClasses()}
      aria-hidden="true"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <tr
          key={`skeleton-${String(i)}`}
          data-skeleton-row="true"
          // Loading placeholders are inert: marking them `pointer-events: none`
          // keeps a click that lands during the records-fetch window from
          // resolving against a content-less skeleton `<tr>` (which carries no
          // `onRowClick` handler). Without this, a row click fired before the
          // real rows mount was silently dropped — the schema-driven
          // `onRowClick.path` navigation never ran. With pointer events
          // disabled the click waits for a real, clickable data row.
          className="pointer-events-none"
        >
          {allColumns.map((_, j) => (
            <td
              key={`skeleton-cell-${String(j)}`}
              className={cellClass}
            >
              <div
                className={`${computeTableSkeletonBarClasses()} ${SKELETON_BAR_WIDTHS[j % SKELETON_BAR_WIDTHS.length]}`}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}
