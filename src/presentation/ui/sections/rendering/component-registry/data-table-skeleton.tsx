/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeDataTableHeaderClasses } from '../../renderers/element-renderers/recipes/data-default-classes'
import type { ReactElement } from 'react'

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
        <div className="bg-background-subtle h-9 w-64 animate-pulse rounded" />
      </div>
      {/* Header skeleton — [internal ref] paints the uppercase chrome + bg-bgSubtle + border-b via helper. */}
      <div className={`${computeDataTableHeaderClasses()} flex gap-4`}>
        <div className="bg-background-subtle h-4 w-24 animate-pulse rounded" />
        <div className="bg-background-subtle h-4 w-32 animate-pulse rounded" />
        <div className="bg-background-subtle h-4 w-20 animate-pulse rounded" />
        <div className="bg-background-subtle h-4 w-28 animate-pulse rounded" />
      </div>
      {/* Row skeletons */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={`skeleton-${String(i)}`}
          className="border-border flex gap-4 border-b px-4 py-3"
        >
          <div className="bg-background-subtle h-4 w-24 animate-pulse rounded" />
          <div className="bg-background-subtle h-4 w-32 animate-pulse rounded" />
          <div className="bg-background-subtle h-4 w-20 animate-pulse rounded" />
          <div className="bg-background-subtle h-4 w-28 animate-pulse rounded" />
        </div>
      ))}
      {/* Pagination skeleton */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="bg-background-subtle h-4 w-24 animate-pulse rounded" />
        <div className="flex gap-2">
          <div className="bg-background-subtle h-8 w-20 animate-pulse rounded" />
          <div className="bg-background-subtle h-8 w-20 animate-pulse rounded" />
        </div>
      </div>
    </div>
  )
}
