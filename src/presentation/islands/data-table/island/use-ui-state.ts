/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import type { RowDensity } from '../../hooks/use-table-preferences'
import type { DataTableViewType } from '@/domain/models/app/pages/components/component-types/data/table/schema'

export interface ActiveFilter {
  readonly field: string
  readonly value: string
}

/**
 * A single filter row authored in the runtime filter-builder panel
 * (PG-03 / [internal ref]..007).
 *
 * Rows are combined via the panel-level `filterConjunction` (AND/OR). The
 * filter-builder UI is purely client-side state — saved views (Cycle 5)
 * serialise this shape verbatim for persistence.
 */
export interface FilterRow {
  readonly id: string
  readonly field: string
  readonly operator: string
  readonly value: string
}

export type FilterConjunction = 'AND' | 'OR'

/**
 * A single sort row authored in the runtime multi-sort panel
 * (PG-03 / [internal ref]).
 *
 * Rows execute in array order — the first row is the primary sort key, the
 * second is the secondary, etc. Drag-reorder rewrites the array verbatim.
 * Saved views (Cycle 5) will serialise this shape verbatim, mirroring how
 * {@link FilterRow} is persisted.
 *
 * The shape intentionally mirrors `FilterRow` (a stable `id` + payload) so
 * future serialisation helpers can iterate either array uniformly.
 */
export interface SortRow {
  readonly id: string
  readonly field: string
  readonly direction: 'asc' | 'desc'
}

/**
 * Active view-type for the data-table island (PG-03 / [internal ref]).
 *
 * View-switching is purely client-side and does NOT remount the data-table:
 * the grid's rows are handed to the selected view island as-is, so the active
 * filters, sorts, search and grouping survive a switch by construction rather
 * than by re-deriving them.
 *
 * Aliased to the domain's `DataTableViewType` so the client union cannot drift
 * from the `views` a config is allowed to declare — adding a fifth view type to
 * the schema surfaces here as a compile error at every exhaustive switch.
 */
export type ActiveViewType = DataTableViewType

/** The initial view-type, and the fallback a saved view without one restores. */
export const DEFAULT_VIEW_TYPE: ActiveViewType = 'grid'

/**
 * Narrow to the view types rendered by a lazily-loaded island rather than by
 * the data-table's own `TableContent`. Lives here (not beside the renderer)
 * because a `.tsx` module may export components OR helpers, never both
 * (`react-refresh/only-export-components`).
 */
export const isAlternateView = (view: ActiveViewType): view is Exclude<ActiveViewType, 'grid'> =>
  view !== DEFAULT_VIEW_TYPE

/** Target of the open delete-view confirmation dialog. */
export interface DeleteViewTarget {
  readonly id: string
  readonly name: string
}

/**
 * Local UI state for the data-table island: column visibility, menu/dropdown
 * open flags, import-dialog/filter-overlay open flags, the in-progress
 * filter-builder draft row, and the committed filter rows + conjunction.
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
// eslint-disable-next-line max-lines-per-function, max-statements -- composes ~30 useState/useCallback hooks across filter-builder + sort-builder + view-switcher; further extraction would just split a single state bag across more files
export function useDataTableUiState() {
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
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
  // View-type switcher (grid / kanban / calendar / gallery) — purely
  // client-side; the data-table island never unmounts, so sorting/filter state
  // survives a switch trivially.
  const [activeView, setActiveView] = useState<ActiveViewType>(DEFAULT_VIEW_TYPE)
  // Layout the currently-applied saved view expresses an opinion about.
  // `undefined` means "this view said nothing", which is DISTINCT from a value:
  // the per-(user, table) `user-preferences` row is the fallback in that case,
  // so applying a view that never set a density must not clobber the user's
  // table-wide default.
  const [activeViewRowDensity, setActiveViewRowDensity] = useState<RowDensity | undefined>(
    undefined
  )
  const [activeViewColumnWidths, setActiveViewColumnWidths] = useState<
    Readonly<Record<string, number>> | undefined
  >(undefined)
  // Runtime group-by. When non-null, this
  // field name overrides the schema's static `groupBy` config; setting it to
  // null restores the schema default. Cycle 5 (saved views) will serialise
  // this `string | null` shape verbatim alongside `activeFilters` /
  // `activeSorts`.
  // eslint-disable-next-line unicorn/no-null -- saved-views wire contract: `string | null` serialises verbatim into the JSON view snapshot (orchestration computeViewSnapshot)
  const [runtimeGroupBy, setRuntimeGroupByState] = useState<string | null>(null)
  // Per-group-value collapse state. Keyed by the
  // stringified grouping value (e.g. "todo", "in-progress"). Stored as a
  // readonly array — toggling rewrites the array verbatim, matching how
  // `activeSorts` / `activeFilters` are persisted.
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlyArray<string>>([])
  // Saved-views: track which saved view (developer OR personal) is currently
  // applied. `activeViewSource` discriminates between the two so the toolbar
  // can hide the in-place `Save` button for developer views.
  // `baseViewConfig` is the snapshot of the view's filters/sorts/groupBy at
  // the moment it was applied — the modified-indicator diffs against this to
  // know when to surface `Modified` + `Save` + `Save as new`.
  // eslint-disable-next-line unicorn/no-null -- saved-views state contract: `null` = no view loaded; orchestration diffs against `null` (activeViewId/baseViewSnapshot) to drive the modified-indicator
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  // eslint-disable-next-line unicorn/no-null -- saved-views state contract: `null` = no view loaded
  const [activeViewSource, setActiveViewSource] = useState<'developer' | 'personal' | null>(null)
  // eslint-disable-next-line unicorn/no-null -- saved-views state contract: `null` = no snapshot captured
  const [baseViewSnapshot, setBaseViewSnapshot] = useState<string | null>(null)
  // Save-view dialog open state (PG-03 / [internal ref]). Controlled
  // because the same dialog is triggered from two surfaces: the toolbar
  // `Save view` button AND the Views menu's `Save current view` menuitem.
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false)
  // Delete-view confirmation dialog (PG-03 / [internal ref]). The
  // target view's id+name are stored so the confirmation prompt can include
  // the name and the orchestrator can resolve which view to delete.
  // eslint-disable-next-line unicorn/no-null -- dialog state contract: `null` = delete-view confirmation closed (orchestration guards on the target)
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

  /**
   * Select a view type from the switcher.
   *
   * Reads the target off the clicked button's `data-view-type` attribute rather
   * than taking it as an argument, so the switcher can render one button per
   * declared view type while still passing ONE stable handler reference — an
   * inline `() => select(v)` per button is what `react-perf/jsx-no-new-function-
   * as-prop` forbids, and `useCallback` is unavailable inside the `.tsx`
   * toolbar (no-restricted-syntax).
   */
  const onSelectViewType = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const next = event.currentTarget.dataset['viewType']
    if (next) setActiveView(next as ActiveViewType)
  }, [])

  /**
   * Activate runtime grouping on `field` (clearing per-group collapse state so
   * a fresh grouping starts fully expanded). Passing `null` restores the
   * schema-default grouping (or none).
   */
  const setRuntimeGroupBy = useCallback((field: string | null) => {
    setRuntimeGroupByState(field)
    setCollapsedGroups([])
  }, [])

  /** Convenience: collapse / expand a single group by its stringified value. */
  const toggleGroupCollapsed = useCallback((groupValue: string) => {
    setCollapsedGroups((prev) =>
      prev.includes(groupValue) ? prev.filter((v) => v !== groupValue) : [...prev, groupValue]
    )
  }, [])

  /**
   * Apply a saved view's payload to the current UI state. Replaces filters /
   * sorts / groupBy / collapsed-groups with the view's serialised contents
   * and records the view's id so the toolbar can render `Modified` later when
   * the user diverges from the snapshot.
   *
   * The `snapshot` argument is the JSON-stringified canonical form the
   * orchestrator computes when applying (filters + sorts + groupBy), so the
   * modified-indicator diff is purely a string comparison.
   */
  const applySavedView = useCallback(
    (input: {
      readonly id: string
      readonly source: 'developer' | 'personal'
      readonly filters: readonly FilterRow[]
      readonly sorts: readonly SortRow[]
      readonly groupBy: string | null
      /**
       * Shape the view was saved in. A view persisted WITHOUT one restores the
       * GRID — never `views[0]`, which would silently repoint every legacy
       * saved view the day an author reorders the switcher's tabs
       *.
       */
      readonly viewType?: ActiveViewType
      /** Layout the view expresses an opinion about; absent = inherit prefs. */
      readonly rowDensity?: RowDensity
      readonly columnWidths?: Readonly<Record<string, number>>
      readonly snapshot: string
      /**
       * Whether to close any open Filter / Sort overlay panel as part of
       * applying the view. Set true when the view is APPLIED via the Views
       * menu (the user opened the menu and picked a view, so fresh panel
       * state makes sense); leave false when the view was just SAVED from
       * the current state (the user is mid-authoring and the overlay must
       * remain open so the `Clear all` button stays clickable for the
       * regression's step 017).
       */
      readonly closeOverlays?: boolean
    }) => {
      setActiveFilters(input.filters)
      setFilterConjunction('AND')
      setActiveSorts(input.sorts)
      setRuntimeGroupByState(input.groupBy)
      setCollapsedGroups([])
      setActiveView(input.viewType ?? DEFAULT_VIEW_TYPE)
      setActiveViewRowDensity(input.rowDensity)
      setActiveViewColumnWidths(input.columnWidths)
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

  /** Clear the active-view tracking (called when the user clicks `Clear all` or selects a different view). */
  const clearActiveView = useCallback(() => {
    // eslint-disable-next-line unicorn/no-null -- reset to the `null` sentinel (matches the `string | null` state contract above)
    setActiveViewId(null)
    // eslint-disable-next-line unicorn/no-null -- reset to the `null` sentinel
    setActiveViewSource(null)
    // eslint-disable-next-line unicorn/no-null -- reset to the `null` sentinel
    setBaseViewSnapshot(null)
    // Drop the view's layout opinion too, so the user's own table-wide
    // preference resumes being the source of truth.
    setActiveViewRowDensity(undefined)
    setActiveViewColumnWidths(undefined)
  }, [])

  const onOpenSaveViewDialog = useCallback(() => setSaveViewDialogOpen(true), [])
  const onCloseSaveViewDialog = useCallback(() => setSaveViewDialogOpen(false), [])
  const onOpenDeleteViewDialog = useCallback(
    (target: { readonly id: string; readonly name: string }) => setDeleteViewTarget(target),
    []
  )
  // eslint-disable-next-line unicorn/no-null -- reset to the `null` sentinel (closes the delete-view dialog)
  const onCloseDeleteViewDialog = useCallback(() => setDeleteViewTarget(null), [])

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
    onSelectViewType,
    activeViewRowDensity,
    activeViewColumnWidths,
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
