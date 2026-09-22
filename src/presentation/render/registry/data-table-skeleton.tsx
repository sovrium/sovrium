/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableCellClasses,
  computeTableHeaderCellClasses,
  computeTableSkeletonBarClasses,
} from '@/presentation/design/table-default-classes'
import type { ReactElement } from 'react'

/**
 * The widths the placeholder bars cycle through, so the skeleton reads as text
 * of differing lengths rather than as a regular grid of blocks. Same rounding
 * of the design's 70 / 50 / 40 / 45 % as the island's own skeleton.
 */
const SKELETON_BAR_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/5', 'w-5/12'] as const

/**
 * The pre-hydration grid placeholder, lifted out of the dispatch entry so that
 * entry reads as what it DECIDES — island props, expand wiring, host — rather
 * than as forty lines of pulse bars.
 */
export function DataTableSkeleton(): ReactElement {
  return (
    <div
      aria-label="Loading data table..."
      role="status"
    >
      {/* Toolbar skeleton */}
      <div className="border-border border-b p-3">
        <div className="bg-background-inset h-9 w-64 animate-pulse rounded-sm" />
      </div>
      {/* Header skeleton — the same header-cell chrome the hydrated grid paints,
          so the row does not shift tone or height on hydration. */}
      <div className={`${computeTableHeaderCellClasses()} flex gap-4`}>
        {SKELETON_BAR_WIDTHS.map((width) => (
          <div
            key={`header-bar-${width}`}
            className={`${computeTableSkeletonBarClasses()} ${width}`}
          />
        ))}
      </div>
      {/* Row skeletons, at the grid's own default density. */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={`skeleton-${String(i)}`}
          className={`${computeTableCellClasses({ rowHeight: 'medium' })} border-border flex items-center gap-4 border-b`}
        >
          {SKELETON_BAR_WIDTHS.map((width) => (
            <div
              key={`row-bar-${width}`}
              className={`${computeTableSkeletonBarClasses()} ${width}`}
            />
          ))}
        </div>
      ))}
      {/* Pagination skeleton */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="bg-background-inset h-4 w-24 animate-pulse rounded-sm" />
        <div className="flex gap-2">
          <div className="bg-background-inset h-8 w-20 animate-pulse rounded-sm" />
          <div className="bg-background-inset h-8 w-20 animate-pulse rounded-sm" />
        </div>
      </div>
    </div>
  )
}
