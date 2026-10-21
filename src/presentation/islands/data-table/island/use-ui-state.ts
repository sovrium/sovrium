/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import type { DataTableColumn } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { GridRowHeight } from '@/presentation/design/table-body-default-classes'

/**
 * The reader's own grouping for the visit: `undefined` keeps the configured one
 * (`groupBy` of the bound view), `{}` is "no grouping", `{ field }` groups by
 * that field.
 */
export type SessionGrouping = { readonly field?: string } | undefined

/**
 * The view the reader switched to for the visit: `undefined` keeps the
 * configured one (`dataSource.view`), `{}` reads the table through no view,
 * `{ id }` through that view.
 */
export type SessionView = { readonly id?: string } | undefined

/**
 * The visibility a grid opens with: every field column declared
 * `visible: 'hidden'` starts unchecked, exactly as if the reader had unchecked
 * it under View › Hide fields, so checking it there draws it. A column declared
 * `visible: false` is not here: it was never made a column at all.
 */
export const startingVisibility = (
  columns: readonly DataTableColumn[] | undefined
): Record<string, boolean> =>
  Object.fromEntries(
    (columns ?? [])
      .filter((column) => 'field' in column && column.visible === 'hidden')
      .map((column) => ['field' in column ? column.field : '', false])
  )

/**
 * Local UI state for the data-table island: column visibility and order, which
 * groups the reader has collapsed or opened, and the grouping and row height the
 * reader picked from the bottom bar. It lasts for the reader's visit and is
 * stored nowhere — not in the address, not per user: a lasting grouping is a
 * table view's `groupBy`, a lasting row height the grid's `rowHeight`.
 *
 * Kept separate from `useDataTableState` (which is concerned with TanStack
 * Table's controlled state — sorting/pagination/density) so the orchestrator's
 * hook count and complexity stay below the size limits.
 */
export function useDataTableUiState(columns: readonly DataTableColumn[] | undefined) {
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    startingVisibility(columns)
  )
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  // Groups whose open/closed state the reader has flipped, keyed by group path.
  // Stored as a readonly array — toggling rewrites the array verbatim.
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlyArray<string>>([])
  const [grouping, setGrouping] = useState<SessionGrouping>(undefined)
  const [rowHeight, setRowHeight] = useState<GridRowHeight | undefined>(undefined)
  const [view, setView] = useState<SessionView>(undefined)

  /** Collapse / expand a single group by its key. */
  const toggleGroupCollapsed = useCallback((groupValue: string) => {
    setCollapsedGroups((prev) =>
      prev.includes(groupValue) ? prev.filter((v) => v !== groupValue) : [...prev, groupValue]
    )
  }, [])

  return {
    columnVisibility,
    setColumnVisibility,
    columnOrder,
    setColumnOrder,
    collapsedGroups,
    toggleGroupCollapsed,
    grouping,
    setGrouping,
    rowHeight,
    setRowHeight,
    view,
    setView,
  }
}
