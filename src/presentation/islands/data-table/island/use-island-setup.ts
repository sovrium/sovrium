/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { subscribe as subscribeIslandEvent } from '../../_shared/event-bus'
import { useDataTableQuery } from '../../hooks/use-data-table-query'
import { useDataTableState, ROW_HEIGHT_CLASSES } from '../../hooks/use-data-table-state'
import { useInlineEditing, type FieldMetaMap } from '../../hooks/use-inline-editing'
import { useIslandSearch } from '../../hooks/use-island-search'
import { useIslandSystemQuery } from '../../hooks/use-island-system-query'
import { useRealtimeReconciliation } from '../../hooks/use-realtime-reconciliation'
import { useRealtimeSubscription } from '../../hooks/use-realtime-subscription'
import {
  savedViewFiltersToDataFilters,
  useSavedViews,
  type SavedView,
  type SavedViewConfigPayload,
} from '../../hooks/use-saved-views'
import { useSharedFilter } from '../../hooks/use-shared-filter'
import { useGridRefresh, useSortRefusal } from '../../hooks/use-sort-refusal'
import {
  densityToHeight,
  heightToDensity,
  useTablePreferences,
  type RowDensity,
} from '../../hooks/use-table-preferences'
import { buildSummaryAggregateParam } from '../summary-aggregate'
import { executeBulkAction } from './bulk-action-execute'
import { buildColumns } from './columns'
import {
  applyClientFilters,
  buildGroupByParam,
  resolveEditableFields,
  resolveSaveIndicator,
  shouldShowSearch,
  useColumnSizingPersistence,
} from './island-setup-helpers'
import { createRowActionHandler } from './row-actions'
import { useSavedViewsOrchestration, computeViewSnapshot } from './use-saved-views-orchestration'
import { useDataTableInstance } from './use-table'
import { useDataTableUiState, type FilterRow, type SortRow } from './use-ui-state'
import { useUrlSyncedActiveView } from './use-url-synced-active-view'
import type { InlineAutoSave } from '../body'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTableGroupBy,
  DataTablePagination,
  ComponentSearch,
  DataTableSelection,
  DataTableSummaryItem,
  DataTableSystemSource,
  DataTableToolbar,
  RowHeight,
} from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'

// Re-export the save-indicator settings type from its new helper home so the
// existing `data-table-view.tsx` import path stays stable.
export type { SaveIndicatorSettings } from './island-setup-helpers'

interface IslandSetupParams {
  readonly dataSource: {
    /** Bound DB table name — ABSENT for a system-source binding. */
    readonly table?: string
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
    /** Data refresh strategy (`'poll'` enables interval re-fetch). */
    readonly refreshMode?: 'none' | 'poll' | 'realtime'
    /** Poll interval in milliseconds (used when `refreshMode` is `'poll'`). */
    readonly pollIntervalMs?: number
    /**
     * Cross-component shared-filter binding ([internal ref],
     * DB-table case). `bindTo` references a sibling publisher; when `sharedFilter`
     * is also present, the publisher's value is merged into the records request as
     * the named param(s). Inert without both.
     */
    readonly bindTo?: string
    readonly sharedFilter?: { readonly params?: readonly string[] }
    /**
     * System read-endpoint binding.
     * When present the grid is read-only: rows come from the endpoint, and
     * DB-table-only features (preferences, saved views, realtime, inline edit,
     * crud-success refresh) are skipped. The system source carries its own
     * `bindTo` + `sharedFilter` (the dynamic counterpart to the static `query`).
     */
    readonly system?: DataTableSystemSource
  }
  readonly columnConfig?: readonly DataTableColumn[]
  readonly paginationConfig?: DataTablePagination
  readonly searchConfig?: ComponentSearch
  readonly selectionConfig?: DataTableSelection
  readonly toolbarConfig?: DataTableToolbar
  readonly initialRowHeight: RowHeight
  readonly searchSourceId: string | undefined
  readonly tableFields: readonly string[] | undefined
  readonly fieldMeta: FieldMetaMap | undefined
  readonly groupByConfig: DataTableGroupBy | undefined
  /**
   * Declared footer summary. Drives the whole-view `?aggregate=` request that
   * rides the records fetch — the footer used to reduce over the CURRENT PAGE's
   * records, so every aggregate reported the page rather than the view.
   */
  readonly summaryConfig: readonly DataTableSummaryItem[] | undefined
  /**
   * Whether the grid draws a leading row-number column. Inert until now:
   * declared on the schema, copied by the props builder, copied again into the
   * island's prop type, and then never read.
   */
  readonly showRowNumbers: boolean | undefined
  readonly bordered: boolean
  readonly autoSaveConfig: AutoSaveConfig | undefined
  /**
   * Developer-configured views surfaced from `app.tables[i].views[]` (PG-03 /
   * [internal ref]). These are READ-ONLY: the user can fork them
   * via `Save as new` but cannot overwrite or delete them. The schema's view
   * id is a numeric, but we normalise to string here so the cross-source
   * Views menu can key uniformly.
   */
  readonly tableViews?: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly filters?: SavedViewConfigPayload['filters']
    readonly sorts?: SavedViewConfigPayload['sorts']
    readonly groupBy?: string | null
  }>
  /**
   * Interpreter-provided commit / dismiss labels, resolved server-side against
   * the app language. Reach the action column's inline select-editor and its
   * confirm gate (an `editSelect.saveLabel` still wins for the commit button).
   */
  readonly saveLabel: string
  readonly cancelLabel: string
}

/**
 * Wire all hooks the data-table island needs and return the bag of values
 * the orchestrator hands to `<DataTableView>`.
 *
 * Splitting this out keeps `DataTableIsland` itself a thin coordinator below
 * the size-limit caps; all the heavy hook composition lives here.
 */
// eslint-disable-next-line max-statements -- composes ~13 hooks; further extraction would create indirection without clarifying intent
export function useDataTableIslandSetup(params: IslandSetupParams) {
  const {
    dataSource,
    columnConfig,
    paginationConfig,
    searchConfig,
    selectionConfig,
    toolbarConfig,
    initialRowHeight,
    searchSourceId,
    tableFields,
    fieldMeta,
    groupByConfig,
    summaryConfig,
    showRowNumbers,
    bordered,
    autoSaveConfig,
    tableViews,
    saveLabel,
    cancelLabel,
  } = params

  const queryClient = useQueryClient()
  const ui = useDataTableUiState()

  // A system-source grid (read endpoint, no DB table) is read-only: the bound
  // `table` is absent, so prefs / saved-views / realtime / crud-refresh / inline
  // edit are all skipped. `tableKey` is the empty string for a system source —
  // the prefs / saved-views hooks short-circuit their network reads on an empty
  // key, so no `/api/tables//*` request is ever issued.
  const isSystemSource = dataSource.system !== undefined
  const tableKey = dataSource.table ?? ''

  // Per-user, per-table preferences (PG-03 / [internal ref]). The prefs row drives
  // the *effective* initial row height + column widths and exposes the
  // density-menu / settings-dialog persistence callbacks.
  const prefs = useTablePreferences(tableKey)
  const savedViews = useSavedViews(tableKey)

  // Layout precedence: the APPLIED VIEW wins while it is
  // applied; the per-(user, table) preference is the fallback when the view
  // expresses no opinion. Both halves matter — "view always wins" would satisfy
  // an override-only assertion while silently resetting every user's table-wide
  // density the moment they opened a view that never set one.
  const effectiveRowDensity = ui.activeViewRowDensity ?? prefs.preferences.rowDensity
  const effectiveColumnWidths = ui.activeViewColumnWidths ?? prefs.preferences.columnWidths

  // Drive the row height synchronously each render so the first paint after a
  // `page.reload()` already reflects whichever density is in force. With none,
  // the schema's `rowHeight` wins and the in-component toggle keeps working.
  const controlledRowHeight = effectiveRowDensity ? densityToHeight(effectiveRowDensity) : undefined

  const tableState = useDataTableState({
    initialPageSize: paginationConfig?.pageSize ?? 25,
    initialRowHeight,
    ...(controlledRowHeight && { controlledRowHeight }),
    ...(effectiveColumnWidths && {
      initialColumnSizing: effectiveColumnWidths,
      controlledColumnSizing: effectiveColumnWidths,
    }),
  })

  // [internal ref] — when the user has a default view set, resolve it
  // from the saved-views list and apply its filters on top of the schema's
  // `dataSource.filter`. The resolution happens AFTER the views query resolves
  // (the saved-views fetch is async), so the table briefly renders unfiltered
  // before the filtered query supersedes it — acceptable for the spec, which
  // asserts the final state after `page.goto` settles.
  const activeView: SavedView | undefined =
    prefs.preferences.defaultViewId !== undefined
      ? savedViews.views.find((view) => view.id === prefs.preferences.defaultViewId)
      : undefined

  const viewFilters = savedViewFiltersToDataFilters(activeView?.filters)
  const effectiveFilter = useMemo(
    () =>
      viewFilters && viewFilters.length > 0
        ? [...(dataSource.filter ?? []), ...viewFilters]
        : dataSource.filter,
    [dataSource.filter, viewFilters]
  )

  // Runtime multi-sort panel takes precedence over
  // column-header sort: when the user has committed
  // sort rows in the Sort overlay, those drive the server-side `sort` query
  // param; otherwise the column-header click handler's `tableState.sorting`
  // wins, falling back to the schema's `dataSource.sort` inside the query
  // hook itself.
  const effectiveSorting = useMemo(
    () =>
      ui.activeSorts.length > 0
        ? ui.activeSorts.map((s) => ({ id: s.field, desc: s.direction === 'desc' }))
        : tableState.sorting,
    [ui.activeSorts, tableState.sorting]
  )

  // System-source grids accept dynamic query params from an external filter bar
  // (the runs directory's automation / status filters), scoped to this grid's
  // `searchSourceId` (its component id). Empty for a DB-table grid.
  const legacySystemQuery = useIslandSystemQuery(searchSourceId)

  // Cross-component shared-filter binding:
  // when this grid's data source carries `bindTo` + `sharedFilter`, subscribe to
  // the named sibling publisher and re-read with its value merged into the request.
  // The binding lives on `system` (system source) or on the DB-table data source.
  const sharedFilterParams = useSharedFilter({
    bindTo: dataSource.system?.bindTo ?? dataSource.bindTo,
    sharedFilter: dataSource.system?.sharedFilter ?? dataSource.sharedFilter,
  })

  // System grids merge BOTH channels into the endpoint request: the legacy
  // grid-scoped filter bar AND the config shared-filter publisher (only one is
  // ever active per grid, so the spread is a no-op for the inactive channel).
  const systemQuery = useMemo(
    () => ({ ...legacySystemQuery, ...sharedFilterParams }),
    [legacySystemQuery, sharedFilterParams]
  )

  // The summary footer's numbers describe the WHOLE VIEW, so they are computed
  // in SQL over the same filtered table the page is drawn from and ride the
  // records response. Absent when no summary is declared — no aggregate SQL runs.
  const aggregateParam = buildSummaryAggregateParam(summaryConfig)

  // Effective grouping config. Runtime selection from
  // the toolbar's Group menu (`ui.runtimeGroupBy`) overrides the schema's
  // static `groupBy` block; clearing the runtime selection (set to `null`)
  // restores the schema default.
  //
  // Resolved BEFORE the records query because the grouped field is part of the
  // request: a group header's count describes the whole view, which only the
  // server can compute (see `groupCounts` below).
  const effectiveGroupByConfig: DataTableGroupBy | undefined =
    ui.runtimeGroupBy !== null ? { field: ui.runtimeGroupBy } : groupByConfig

  const groupByParam = buildGroupByParam(effectiveGroupByConfig)

  const { data, isLoading, isError, error, queryKey, groupCounts, groupAggregations } =
    useDataTableQuery({
      table: tableKey,
      ...(dataSource.system && {
        system: dataSource.system,
        systemQuery,
        sourceId: searchSourceId,
      }),
      // DB-table grids merge the shared-filter publisher's value as raw query params.
      ...(!dataSource.system && { sharedFilterParams }),
      pagination: tableState.pagination,
      sorting: effectiveSorting,
      globalFilter: tableState.globalFilter,
      ...(aggregateParam !== undefined && { aggregateParam }),
      ...(groupByParam !== undefined && { groupByParam }),
      dataSourceFilter: effectiveFilter,
      dataSourceSort: dataSource.sort,
      refreshMode: dataSource.refreshMode,
      pollIntervalMs: dataSource.pollIntervalMs,
    })

  // A sort is adopted optimistically: the header click writes state, and that
  // state feeds the request. This makes the adoption REVERSIBLE — a read that
  // fails puts the previous sort back, so the last good page returns from cache
  // and `aria-sort` stops claiming an ordering the server refused — and leaves a
  // notice the island renders ABOVE the grid rather than in place of it.
  const sortRefusal = useSortRefusal(isError, error, tableState)

  const handleRefresh = useGridRefresh(queryClient, queryKey, sortRefusal.clearReadError)

  // PG-04: when a sibling crud-form (e.g. inside
  // a quick-edit drawer) completes a successful mutation against this table,
  // it dispatches `sovrium:crud-success` on `document`. Invalidate this
  // data-table's query so the updated record value appears in the row without
  // a full page reload.
  //
  // Event payload: `{ table: string; operation?: 'create' | 'update' | 'delete'; recordId?: string }`.
  // We filter on `detail.table === dataSource.table` so unrelated tables on
  // the same page don't refetch needlessly. The matcher is case-insensitive
  // to be forgiving of casing drift between schema and runtime payloads.
  useEffect(() => {
    // A system-source grid has no bound DB table — there is no crud-success
    // channel to listen on (records are observed via the endpoint, not mutated
    // here).
    if (!dataSource.table) return undefined
    const targetTable = dataSource.table.toLowerCase()
    return subscribeIslandEvent('sovrium:crud-success', (detail) => {
      if (detail.table.toLowerCase() !== targetTable) return
      handleRefresh()
    })
  }, [dataSource.table, handleRefresh])

  // [internal ref] — a sibling fetch
  // action's `onSuccess.refetch` names this grid by its `props.id`
  // (`searchSourceId`) and dispatches `sovrium:refetch`. Re-query so a
  // freshly-mutated row appears without a reload. Unlike `crud-success` (DB-table
  // only, matched by table name), this channel is keyed on the COMPONENT id, so
  // it composes with BOTH a DB-table `dataSource` AND a `dataSource.system` read
  // endpoint (`handleRefresh` invalidates whichever query backs the grid).
  useEffect(() => {
    if (!searchSourceId) return undefined
    return subscribeIslandEvent('sovrium:refetch', (detail) => {
      if (detail.id !== searchSourceId) return
      handleRefresh()
    })
  }, [searchSourceId, handleRefresh])

  // Realtime mode: subscribe to live change events for the bound table. Each
  // `change` event invalidates the query, triggering a re-fetch that re-applies
  // the server-side `dataSource.filter`/`sort` — no client-side predicate.
  // The returned connection state drives the `data-connection-status`
  // indicator surfaced on the island.
  const connectionStatus = useRealtimeSubscription({
    // Realtime is a DB-table-only feature; a system source never enables it.
    enabled: !isSystemSource && dataSource.refreshMode === 'realtime',
    table: tableKey,
    onChange: handleRefresh,
  })

  const inlineEditing = useInlineEditing({
    tableName: tableKey,
    fieldMeta,
    onSave: handleRefresh,
    autoSave: autoSaveConfig,
  })

  const executeRowAction = createRowActionHandler({ queryClient, queryKey })

  // Spread readonly->mutable array: TanStack Table v8 requires mutable TData[].
  // Memoized so its reference is stable per data fetch — passing it as a prop to
  // FilterOverlay / TableContent would otherwise be flagged by react-perf's
  // jsx-no-new-array-as-prop on every render.

  const rawRecords = useMemo(() => [...(data?.records ?? [])], [data?.records])
  // Apply the runtime filter-builder's active filters client-side
  //. The server returns the unfiltered page;
  // the filter-builder is purely client state, so narrowing happens here
  // before the records reach TanStack Table.
  const records = useMemo(
    () => applyClientFilters(rawRecords, ui.activeFilters, ui.filterConjunction),
    [rawRecords, ui.activeFilters, ui.filterConjunction]
  )
  const totalRecords = data?.total ?? 0
  const allColumns = buildColumns({
    columnConfig,
    records,
    selectionConfig,
    tableFields,
    saveLabel,
    cancelLabel,
    onActionClick: executeRowAction,
    fieldMeta,
    showRowNumbers: showRowNumbers === true,
    // Row numbers count through the VIEW, not the page: a per-page 1..N would
    // make two different rows both "row 1", which is the one thing a row number
    // exists to prevent. The grid pages server-side, so the page's own row
    // index has to be offset by the rows that came before it.
    rowNumberOffset: tableState.pagination.pageIndex * tableState.pagination.pageSize,
    // Realtime data tables are inline-editable by default so an optimistic
    // edit can be made and then reconciled against incoming server state.
    autoColumnsEditable: dataSource.refreshMode === 'realtime',
    // Empty for a system-backed source, which has no record route to invoke —
    // a button cell there stays inert rather than addressing a bad URL.
    tableName: tableKey,
    // A button's automation commonly writes back to the record it was pressed
    // on. The grid is the only surface a button field renders on that holds a
    // query cache, so it is the one that supplies the re-read.
    onButtonInvoked: handleRefresh,
  })

  // Realtime mode: detect when an incoming server snapshot overwrites a field
  // the user could already see, and surface a conflict toast (server-wins).
  // A detected conflict also closes any open inline editor — its optimistic
  // value is stale, so the cell must render the authoritative server state.
  const { conflict, dismissConflict } = useRealtimeReconciliation({
    enabled: dataSource.refreshMode === 'realtime',
    records,
    onConflict: inlineEditing.cancelEditing,
  })

  const table = useDataTableInstance({
    records,
    allColumns,
    sorting: effectiveSorting,
    // Not the raw setter: every header click goes through the refusal guard, so
    // a sort the server declines can be taken back off the header it is drawn on.
    setSorting: sortRefusal.onSortingChange,
    columnFilters: tableState.columnFilters,
    setColumnFilters: tableState.setColumnFilters,
    globalFilter: tableState.globalFilter,
    setGlobalFilter: tableState.setGlobalFilter,
    pagination: tableState.pagination,
    setPagination: tableState.setPagination,
    rowSelection: tableState.rowSelection,
    setRowSelection: tableState.setRowSelection,
    columnVisibility: ui.columnVisibility,
    setColumnVisibility: ui.setColumnVisibility,
    columnOrder: ui.columnOrder,
    setColumnOrder: ui.setColumnOrder,
    columnSizing: tableState.columnSizing,
    setColumnSizing: tableState.setColumnSizing,
    selectionConfig,
    totalRecords,
    // The response's OWN declaration that it already applied the term. Absent
    // (`undefined`) on every endpoint that does not search — the system
    // endpoints not yet migrated, and the DB-table TRASH branch, which ignores
    // `?q=` outright — so those grids keep narrowing the page in memory exactly
    // as before. The DB-table LIST branch DOES declare it (`null` when no term
    // was supplied), which is what stops it re-filtering a page the server has
    // already filtered.
    serverFiltered: data?.appliedQuery !== undefined,
  })

  // Column-width persistence is preferences-backed (DB-table-only). For a
  // system source `tableKey` is empty and `updatePreferences` no-ops, but the
  // effect's localStorage write is also keyed on `tableKey`, so passing the
  // empty key keeps the persistence inert.
  useColumnSizingPersistence(tableKey, tableState.columnSizing, prefs.updatePreferences)

  // Density select handler — persists to the server-backed prefs row. The
  // density-menu calls this on each menuitem click; the `useEffect` in
  // useDataTableState then mirrors the new `effectiveRowHeight` value back to
  // the local row-height state for the visual switch.
  const onSelectDensity = useCallback(
    (density: RowDensity) => {
      prefs.updatePreferences({ rowDensity: density })
    },
    [prefs]
  )

  useIslandSearch(tableState.setGlobalFilter, searchSourceId)

  const onBulkExecute = useCallback(
    (action: DataTableBulkAction) => {
      void executeBulkAction(table, action, { queryClient, queryKey })
    },
    [table, queryClient, queryKey]
  )

  // Build the auto-save wiring handed to the table body. Tab navigation
  // saves the current cell, then opens an editor on the next editable column.
  const editableFields = useMemo(() => resolveEditableFields(columnConfig), [columnConfig])
  // Both 'auto' (debounced keystroke) and 'onBlur' (save on focus loss) modes
  // share the same persistence wiring; the editor decides when to fire.
  const inlineAutoSave: InlineAutoSave | undefined =
    inlineEditing.isAutoSave || inlineEditing.isOnBlurSave
      ? {
          enabled: inlineEditing.isAutoSave,
          saveOnBlur: inlineEditing.isOnBlurSave,
          debounceMs: inlineEditing.autoSaveDebounceMs,
          onAutoSave: inlineEditing.autoSaveEdit,
          onTrackValue: inlineEditing.trackPendingValue,
          onTabNext: (rowId, currentField, newValue) => {
            void Promise.resolve(inlineEditing.autoSaveEdit(newValue)).then(() => {
              const idx = editableFields.indexOf(currentField)
              const nextField = idx >= 0 ? editableFields[idx + 1] : undefined
              if (nextField !== undefined) {
                const record = records.find((r) => String(r.id) === String(rowId))
                inlineEditing.startEditing(rowId, nextField, record?.[nextField])
              }
            })
          },
        }
      : undefined

  const saveIndicator = resolveSaveIndicator(autoSaveConfig)

  // Saved-views orchestration (PG-03 / [internal ref]..022) lives in
  // its sibling `use-saved-views-orchestration.ts` to keep this file under
  // the 400-line cap. See that file for the merge / snapshot / persist /
  // dispatch logic.
  //
  // The "current sort state" the modified-indicator compares against the
  // view snapshot must observe BOTH `ui.activeSorts` (runtime multi-sort
  // panel) AND `tableState.sorting` (column-header sort), because clicking
  // a column header is a modification regardless of channel
  // ([internal ref] regression). When `activeSorts` is non-empty it
  // wins (mirrors `effectiveSorting` above); otherwise we fall back to
  // `tableState.sorting` translated into SortRow shape.
  const effectiveSortRows = useMemo(
    () =>
      ui.activeSorts.length > 0
        ? ui.activeSorts
        : tableState.sorting.map((s, i) => ({
            id: `hdr-${i}`,
            field: s.id,
            direction: s.desc ? ('desc' as const) : ('asc' as const),
          })),
    [ui.activeSorts, tableState.sorting]
  )
  const viewsOrchestration = useSavedViewsOrchestration({
    tableName: tableKey,
    tableViews,
    personalViews: savedViews.views,
    activeFilters: ui.activeFilters,
    activeSorts: effectiveSortRows,
    runtimeGroupBy: ui.runtimeGroupBy,
    activeView: ui.activeView,
    baseViewSnapshot: ui.baseViewSnapshot,
    activeViewId: ui.activeViewId,
    activeViewSource: ui.activeViewSource,
    deleteViewTarget: ui.deleteViewTarget,
    onApplySavedView: ui.applySavedView,
    onClearActiveView: ui.clearActiveView,
  })

  // PG-03 / [internal ref]..026 — URL sync.
  //
  // Reads `?userView=<id>` on mount, fetches the view via the cross-table
  // share endpoint, and applies it through the same `ui.applySavedView` seam
  // the orchestrator uses for menu-driven selection. Also keeps the URL in
  // sync with the active view as the user navigates between views (writes on
  // `sovrium:view-applied`, strips on `sovrium:view-deleted`).
  //
  // The `onApplySharedView` adapter computes the snapshot the same way
  // `useSavedViewsOrchestration.onSelectView` does so the modified-indicator
  // base-snapshot diff stays correct for view applied via a share link.
  const applyUiState = ui.applySavedView
  const onApplySharedView = useCallback(
    (input: {
      readonly id: string
      readonly filters: readonly FilterRow[]
      readonly sorts: readonly SortRow[]
      readonly groupBy: string | null
    }) => {
      const snapshot = computeViewSnapshot({
        filters: input.filters.map((f) => ({
          field: f.field,
          operator: f.operator,
          value: f.value,
        })),
        sorts: input.sorts.map((s) => ({ field: s.field, direction: s.direction })),
        groupBy: input.groupBy,
      })
      applyUiState({
        id: input.id,
        source: 'personal',
        filters: input.filters,
        sorts: input.sorts,
        groupBy: input.groupBy,
        snapshot,
        closeOverlays: true,
      })
    },
    [applyUiState]
  )
  useUrlSyncedActiveView({ tableName: tableKey, onApplySharedView })

  // Saved/user views are a DB-table-only feature — never offered for a system
  // source (there is no table id to key personal views on).
  const viewsEnabled = !isSystemSource && toolbarConfig?.views === true

  return {
    ui,
    table,
    records,
    allColumns,
    totalRecords,
    /**
     * Whole-view aggregates for the summary footer, computed server-side over
     * the filtered table. Undefined until the first records response lands (and
     * always, for a system source, which has no aggregate endpoint).
     */
    summaryAggregations: data?.aggregations,
    /**
     * Whole-view record count per group value. Undefined until the first grouped
     * response lands (and always for a system source, which has no records API
     * to ask), in which case each header counts its loaded rows instead.
     */
    groupCounts,
    /**
     * Whole-view aggregations per group value — the declared `summary` answered
     * for each group. Present only when the grid both groups and summarises.
     */
    groupAggregations,
    isLoading,
    isError,
    error,
    // The last read failure the operator has not yet acted on. Distinct from
    // `isError` deliberately: a refused sort is reverted, which returns the
    // query to its previous cached key and clears `isError` within a frame, so
    // a banner keyed on the live status would flash past unread — see
    // `useSortRefusal`.
    readError: sortRefusal.readError,
    inlineEditing,
    inlineAutoSave,
    saveIndicator,
    handleRefresh,
    onBulkExecute,
    conflict,
    dismissConflict,
    connectionStatus,
    globalFilter: tableState.globalFilter,
    setGlobalFilter: tableState.setGlobalFilter,
    rowSelection: tableState.rowSelection,
    currentRowHeight: tableState.currentRowHeight,
    currentDensity: heightToDensity(tableState.currentRowHeight),
    toggleDensity: tableState.toggleDensity,
    onSelectDensity,
    onResetPreferences: prefs.resetPreferences,
    // Active-view label shown beside the toolbar. Prefer the runtime
    // (orchestrator-tracked) view name when the user has loaded a view via the
    // Views menu; fall back to the persisted-defaults view (from prefs) so the
    // existing [internal ref] "default view auto-load" behaviour still
    // renders an `activeViewName`.
    activeViewName:
      viewsOrchestration.viewEntries.find((e) => e.id === ui.activeViewId)?.name ??
      activeView?.name,
    cellClass: ROW_HEIGHT_CLASSES[tableState.currentRowHeight],
    borderClass: bordered ? 'border border-border' : '',
    showSearch: shouldShowSearch(searchConfig, toolbarConfig),
    // True until the first prefs+views fetch resolves; the orchestrator
    // suppresses the data rendering during this window so the very first
    // paint of a freshly-reloaded page already reflects persisted density
    // and the default-view filter
    //.
    isPrefsLoading: prefs.isLoading || savedViews.isLoading,
    /**
     * Effective grouping config — runtime selection from the toolbar's Group
     * menu (`ui.runtimeGroupBy`) overrides the schema's static `groupBy`
     * block; clearing the runtime selection restores the schema default.
     * Wired through to `TableContent`/`TableBodyRows` so the rendered group
     * headers + collapsed-state subRows respect the runtime selection.
     */
    effectiveGroupByConfig,
    // Saved-views surface (PG-03 / [internal ref]..022). Sourced from
    // the sibling `useSavedViewsOrchestration` hook.
    viewsEnabled,
    viewEntries: viewsOrchestration.viewEntries,
    canSaveCurrentView: viewsOrchestration.canSaveCurrentView,
    isViewModified: viewsOrchestration.isViewModified,
    onSelectView: viewsOrchestration.onSelectView,
    onSaveNewView: viewsOrchestration.onSaveNewView,
    onSaveModifiedView: viewsOrchestration.onSaveModifiedView,
    onConfirmDeleteView: viewsOrchestration.onConfirmDeleteView,
  }
}
