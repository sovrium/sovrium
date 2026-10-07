/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'

export interface ActiveFilter {
  readonly field: string
  readonly value: string
}

/**
 * A single filter row authored in the runtime filter-builder panel.
 *
 * Rows are combined via the panel-level `filterConjunction` (AND/OR). The
 * filter-builder is transient, client-side state: it narrows the rows for the
 * reader's visit and is stored nowhere.
 */
export interface FilterRow {
  readonly id: string
  readonly field: string
  readonly operator: string
  readonly value: string
}

export type FilterConjunction = 'AND' | 'OR'

/**
 * A single sort row authored in the runtime multi-sort panel.
 *
 * Rows execute in array order — the first row is the primary sort key, the
 * second is the secondary, etc. Drag-reorder rewrites the array verbatim. Like
 * {@link FilterRow}, it lasts for the reader's visit and is stored nowhere.
 */
export interface SortRow {
  readonly id: string
  readonly field: string
  readonly direction: 'asc' | 'desc'
}

/**
 * Local UI state for the data-table island: column visibility, menu/dropdown
 * open flags, import-dialog/filter-overlay open flags, the committed filter and
 * sort rows, and which groups the reader has collapsed or opened.
 *
 * Kept separate from `useDataTableState` (which is concerned with TanStack
 * Table's controlled state — sorting/filters/pagination/density) so the
 * orchestrator's hook count and complexity stay below the size limits.
 *
 * Note: this hook lives in `.ts` (no JSX), so the no-restricted-syntax rule
 * banning `useCallback` does not apply here. The callbacks are stabilised so
 * downstream JSX consumers (DataTableToolbarBar, FilterOverlay) do not allocate
 * fresh closures on each render.
 */
// eslint-disable-next-line max-lines-per-function, max-statements -- composes ~20 useState/useCallback hooks across the filter-builder and the sort-builder; further extraction would just split a single state bag across more files
export function useDataTableUiState() {
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [filterOverlayOpen, setFilterOverlayOpen] = useState(false)
  // Filter-builder committed state (drives the records predicate).
  const [activeFilters, setActiveFilters] = useState<readonly FilterRow[]>([])
  const [filterConjunction, setFilterConjunction] = useState<FilterConjunction>('AND')
  // Sort-builder committed state (drives the server-side sort param via
  // TanStack Table's `state.sorting`). Mirrors `activeFilters` exactly so the
  // pattern is uniform across both builders.
  const [sortOverlayOpen, setSortOverlayOpen] = useState(false)
  const [activeSorts, setActiveSorts] = useState<readonly SortRow[]>([])
  // Groups whose open/closed state the reader has flipped, keyed by group path.
  // Stored as a readonly array — toggling rewrites the array verbatim.
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlyArray<string>>([])

  const onOpenImportDialog = useCallback(() => setImportDialogOpen(true), [])
  const onCloseImportDialog = useCallback(() => setImportDialogOpen(false), [])
  const onOpenFilterOverlay = useCallback(() => setFilterOverlayOpen(true), [])
  const onCloseFilterOverlay = useCallback(() => setFilterOverlayOpen(false), [])
  const onOpenSortOverlay = useCallback(() => setSortOverlayOpen(true), [])
  const onCloseSortOverlay = useCallback(() => setSortOverlayOpen(false), [])
  const onToggleExportMenu = useCallback(() => setExportMenuOpen((prev) => !prev), [])
  const onCloseExportMenu = useCallback(() => setExportMenuOpen(false), [])

  const addFilter = useCallback((row: Omit<FilterRow, 'id'>) => {
    setActiveFilters((prev) => [...prev, { id: `f-${Date.now()}-${prev.length}`, ...row }])
  }, [])
  const removeFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id))
  }, [])
  const clearAllFilters = useCallback(() => setActiveFilters([]), [])
  const toggleConjunction = useCallback(() => {
    setFilterConjunction((prev) => (prev === 'AND' ? 'OR' : 'AND'))
  }, [])

  const addSort = useCallback((row: Omit<SortRow, 'id'>) => {
    setActiveSorts((prev) => [...prev, { id: `s-${Date.now()}-${prev.length}`, ...row }])
  }, [])
  const removeSort = useCallback((id: string) => {
    setActiveSorts((prev) => prev.filter((s) => s.id !== id))
  }, [])
  const clearAllSorts = useCallback(() => setActiveSorts([]), [])
  /**
   * Reorder a single sort row to a new index (drag-reorder for priority).
   * Out-of-range indices are clamped to `[0, length - 1]`.
   */
  const reorderSort = useCallback((id: string, toIndex: number) => {
    setActiveSorts((prev) => {
      const fromIndex = prev.findIndex((s) => s.id === id)
      if (fromIndex === -1) return prev
      const clamped = Math.max(0, Math.min(toIndex, prev.length - 1))
      if (clamped === fromIndex) return prev
      const without = prev.filter((_, i) => i !== fromIndex)
      const moved = prev[fromIndex]
      if (!moved) return prev
      return [...without.slice(0, clamped), moved, ...without.slice(clamped)]
    })
  }, [])

  /** Collapse / expand a single group by its key. */
  const toggleGroupCollapsed = useCallback((groupValue: string) => {
    setCollapsedGroups((prev) =>
      prev.includes(groupValue) ? prev.filter((v) => v !== groupValue) : [...prev, groupValue]
    )
  }, [])

  // Legacy quick-filter shape exposed to the export menu — derived from the
  // first committed filter so the existing CSV-export query continues to honor
  // a single-predicate narrowing. Empty when no filters are active.
  const activeFilter: ActiveFilter | undefined =
    activeFilters.length > 0 && activeFilters[0]
      ? { field: activeFilters[0].field, value: activeFilters[0].value }
      : undefined

  return {
    columnVisibility,
    setColumnVisibility,
    columnOrder,
    setColumnOrder,
    exportMenuOpen,
    onToggleExportMenu,
    onCloseExportMenu,
    importDialogOpen,
    onOpenImportDialog,
    onCloseImportDialog,
    filterOverlayOpen,
    onOpenFilterOverlay,
    onCloseFilterOverlay,
    activeFilters,
    filterConjunction,
    addFilter,
    removeFilter,
    clearAllFilters,
    toggleConjunction,
    activeFilter,
    sortOverlayOpen,
    onOpenSortOverlay,
    onCloseSortOverlay,
    activeSorts,
    addSort,
    removeSort,
    clearAllSorts,
    reorderSort,
    collapsedGroups,
    toggleGroupCollapsed,
  }
}
