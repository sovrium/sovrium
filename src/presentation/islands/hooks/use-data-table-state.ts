/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  type ColumnSizingState,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { useEffect, useState } from 'react'
import { computeTableCellClasses } from '@/presentation/design/table-default-classes'
import type { RowHeight } from '@/domain/models/app/pages/components/component-types/data/table/schema'

// ---------------------------------------------------------------------------
// Row height cycling
// ---------------------------------------------------------------------------

/**
 * The class each density paints on a BODY cell.
 *
 * It no longer reaches the HEADER. The map used to be interpolated into the
 * `<th>` as well, so switching a grid to `tall` grew the column labels'
 * padding alongside the data — turning a density control for the ROWS into one
 * that also inflated the chrome above them. A header's padding is now a fixed
 * constant of the design, in `computeTableHeaderCellClasses()`.
 *
 * The map keeps its shape — it is threaded on to `build-setup-result.ts` as a
 * plain string — and delegates each entry to the recipe, so the density
 * control and the paint cannot disagree.
 */
export const ROW_HEIGHT_CLASSES: Record<RowHeight, string> = {
  short: computeTableCellClasses({ rowHeight: 'short' }),
  medium: computeTableCellClasses({ rowHeight: 'medium' }),
  tall: computeTableCellClasses({ rowHeight: 'tall' }),
}

const ROW_HEIGHT_CYCLE: Record<RowHeight, RowHeight> = {
  short: 'medium',
  medium: 'tall',
  tall: 'short',
}

// ---------------------------------------------------------------------------
// Hook params
// ---------------------------------------------------------------------------

interface UseDataTableStateParams {
  readonly initialPageSize: number
  readonly initialRowHeight: RowHeight
  /**
   * Initial column-width override map (`{ [columnId]: widthPx }`) loaded from
   * the per-user table preferences. When the prefs query resolves AFTER mount
   * (the common case — preferences are fetched async on the client), the
   * sizing state syncs to this new value so a restored width takes effect on
   * navigation back to the page.
   */
  readonly initialColumnSizing?: Record<string, number>
  /**
   * When provided, this column-sizing map is used directly each render and
   * the internal `useState` is bypassed — same pattern as
   * `controlledRowHeight` below. Used by the user-preferences flow so a
   * freshly-mounted island synchronously reflects the persisted widths on
   * the very first paint.
   *
   * When set, column resizing is still allowed (the resize handle dispatches
   * `setColumnSizing` via the hook's setter); the orchestrator persists the
   * resulting state back to the prefs row, and the next render reads the
   * fresh prefs through `controlledColumnSizing` again.
   */
  readonly controlledColumnSizing?: Record<string, number>
  /**
   * When provided, this row height is used directly each render and the
   * internal `useState` is bypassed — required by the user-preferences flow
   * so a freshly-mounted island synchronously reflects the persisted density
   * once the prefs query resolves, without a stale-paint flash that races
   * with E2E assertions.
   *
   * When undefined, the hook owns its own row-height state and accepts
   * imperative toggles via the returned `toggleDensity`.
   */
  readonly controlledRowHeight?: RowHeight
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Manages local UI state for the data table (sorting, filters, pagination, row selection, density). */
export function useDataTableState(params: UseDataTableStateParams) {
  const {
    initialPageSize,
    initialRowHeight,
    initialColumnSizing,
    controlledColumnSizing,
    controlledRowHeight,
  } = params

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [internalRowHeight, setInternalRowHeight] = useState<RowHeight>(initialRowHeight)
  const [internalColumnSizing, setInternalColumnSizing] = useState<ColumnSizingState>(
    initialColumnSizing ?? {}
  )
  // Render-derived columnSizing: when prefs provide a controlled value, use it
  // directly so a freshly-mounted island shows the persisted widths on the
  // very first paint. Internal state is the fallback
  // and is the value mutated by the resize handle; the orchestrator persists
  // it back to prefs which then flows back through `controlledColumnSizing`.
  const columnSizing = controlledColumnSizing ?? internalColumnSizing
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  })

  // When `controlledRowHeight` is provided the orchestrator drives the
  // density externally (from the user-preferences row) — read it directly
  // each render so a freshly-mounted island synchronously reflects the
  // persisted density on the next paint (avoids the stale-paint race that
  // breaks [internal ref]). Otherwise fall back to internal
  // toggle state.
  const currentRowHeight = controlledRowHeight ?? internalRowHeight

  // Mirror initialColumnSizing into internal state when prefs land
  // post-mount (used when no `controlledColumnSizing` is provided — fallback
  // path for callers that want lazy/imperative behavior instead of fully
  // controlled).
  useEffect(() => {
    if (initialColumnSizing) setInternalColumnSizing(initialColumnSizing)
  }, [initialColumnSizing])

  const toggleDensity = () => {
    setInternalRowHeight((prev) => ROW_HEIGHT_CYCLE[prev])
  }

  return {
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,
    rowSelection,
    setRowSelection,
    currentRowHeight,
    setCurrentRowHeight: setInternalRowHeight,
    toggleDensity,
    columnSizing,
    setColumnSizing: setInternalColumnSizing,
    pagination,
    setPagination,
  }
}
