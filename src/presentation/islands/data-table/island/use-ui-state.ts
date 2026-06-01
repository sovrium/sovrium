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

export interface FilterRow {
  readonly id: string
  readonly field: string
  readonly operator: string
  readonly value: string
}

export type FilterConjunction = 'AND' | 'OR'

export interface SortRow {
  readonly id: string
  readonly field: string
  readonly direction: 'asc' | 'desc'
}

export type ActiveViewType = 'grid' | 'kanban'

interface DeleteViewTarget {
  readonly id: string
  readonly name: string
}

export function useDataTableUiState() {
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [filterOverlayOpen, setFilterOverlayOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState<readonly FilterRow[]>([])
  const [filterConjunction, setFilterConjunction] = useState<FilterConjunction>('AND')
  const [sortOverlayOpen, setSortOverlayOpen] = useState(false)
  const [activeSorts, setActiveSorts] = useState<readonly SortRow[]>([])
  const [activeView, setActiveView] = useState<ActiveViewType>('grid')
  const [runtimeGroupBy, setRuntimeGroupByState] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlyArray<string>>([])
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [activeViewSource, setActiveViewSource] = useState<'developer' | 'personal' | null>(null)
  const [baseViewSnapshot, setBaseViewSnapshot] = useState<string | null>(null)
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false)
  const [deleteViewTarget, setDeleteViewTarget] = useState<DeleteViewTarget | null>(null)

  const onOpenImportDialog = useCallback(() => setImportDialogOpen(true), [])
  const onCloseImportDialog = useCallback(() => setImportDialogOpen(false), [])
  const onOpenFilterOverlay = useCallback(() => setFilterOverlayOpen(true), [])
  const onCloseFilterOverlay = useCallback(() => setFilterOverlayOpen(false), [])
  const onOpenSortOverlay = useCallback(() => setSortOverlayOpen(true), [])
  const onCloseSortOverlay = useCallback(() => setSortOverlayOpen(false), [])
  const onToggleColumnsMenu = useCallback(() => setColumnsMenuOpen((prev) => !prev), [])
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

  const setActiveViewGrid = useCallback(() => setActiveView('grid'), [])
  const setActiveViewKanban = useCallback(() => setActiveView('kanban'), [])

  const setRuntimeGroupBy = useCallback((field: string | null) => {
    setRuntimeGroupByState(field)
    setCollapsedGroups([])
  }, [])

  const toggleGroupCollapsed = useCallback((groupValue: string) => {
    setCollapsedGroups((prev) =>
      prev.includes(groupValue) ? prev.filter((v) => v !== groupValue) : [...prev, groupValue]
    )
  }, [])

  const applySavedView = useCallback(
    (input: {
      readonly id: string
      readonly source: 'developer' | 'personal'
      readonly filters: readonly FilterRow[]
      readonly sorts: readonly SortRow[]
      readonly groupBy: string | null
      readonly snapshot: string
      readonly closeOverlays?: boolean
    }) => {
      setActiveFilters(input.filters)
      setFilterConjunction('AND')
      setActiveSorts(input.sorts)
      setRuntimeGroupByState(input.groupBy)
      setCollapsedGroups([])
      setActiveViewId(input.id)
      setActiveViewSource(input.source)
      setBaseViewSnapshot(input.snapshot)
      if (input.closeOverlays === true) {
        setFilterOverlayOpen(false)
        setSortOverlayOpen(false)
      }
    },
    []
  )

  const clearActiveView = useCallback(() => {
    setActiveViewId(null)
    setActiveViewSource(null)
    setBaseViewSnapshot(null)
  }, [])

  const onOpenSaveViewDialog = useCallback(() => setSaveViewDialogOpen(true), [])
  const onCloseSaveViewDialog = useCallback(() => setSaveViewDialogOpen(false), [])
  const onOpenDeleteViewDialog = useCallback(
    (target: { readonly id: string; readonly name: string }) => setDeleteViewTarget(target),
    []
  )
  const onCloseDeleteViewDialog = useCallback(() => setDeleteViewTarget(null), [])

  const activeFilter: ActiveFilter | undefined =
    activeFilters.length > 0 && activeFilters[0]
      ? { field: activeFilters[0].field, value: activeFilters[0].value }
      : undefined

  return {
    columnVisibility,
    setColumnVisibility,
    columnOrder,
    setColumnOrder,
    columnsMenuOpen,
    onToggleColumnsMenu,
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
    activeView,
    setActiveViewGrid,
    setActiveViewKanban,
    runtimeGroupBy,
    setRuntimeGroupBy,
    collapsedGroups,
    toggleGroupCollapsed,
    activeViewId,
    activeViewSource,
    baseViewSnapshot,
    saveViewDialogOpen,
    onOpenSaveViewDialog,
    onCloseSaveViewDialog,
    deleteViewTarget,
    onOpenDeleteViewDialog,
    onCloseDeleteViewDialog,
    applySavedView,
    clearActiveView,
  }
}
