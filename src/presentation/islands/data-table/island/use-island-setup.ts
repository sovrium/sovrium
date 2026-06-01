/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { subscribe as subscribeIslandEvent } from '../../_shared/event-bus'
import { useDataTableQuery } from '../../hooks/use-data-table-query'
import { useDataTableState, ROW_HEIGHT_CLASSES } from '../../hooks/use-data-table-state'
import { useInlineEditing, type FieldMetaMap } from '../../hooks/use-inline-editing'
import { useIslandSearch } from '../../hooks/use-island-search'
import { useRealtimeReconciliation } from '../../hooks/use-realtime-reconciliation'
import { useRealtimeSubscription } from '../../hooks/use-realtime-subscription'
import {
  savedViewFiltersToDataFilters,
  useSavedViews,
  type SavedView,
  type SavedViewConfigPayload,
} from '../../hooks/use-saved-views'
import {
  densityToHeight,
  heightToDensity,
  useTablePreferences,
  writeColumnWidthsToCache,
  type RowDensity,
} from '../../hooks/use-table-preferences'
import { executeBulkAction } from './bulk-action-execute'
import { buildColumns } from './columns'
import {
  applyClientFilters,
  resolveEditableFields,
  resolveSaveIndicator,
  shouldShowSearch,
} from './island-setup-helpers'
import { createRowActionHandler } from './row-actions'
import { useSavedViewsOrchestration, computeViewSnapshot } from './use-saved-views-orchestration'
import { useDataTableInstance } from './use-table'
import { useDataTableUiState, type FilterRow, type SortRow } from './use-ui-state'
import { useUrlSyncedActiveView } from './use-url-synced-active-view'
import type { InlineAutoSave } from '../body'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTableGroupBy,
  DataTablePagination,
  DataTableSearch,
  DataTableSelection,
  DataTableToolbar,
  RowHeight,
} from '@/domain/models/app/pages/components/data-table'

export type { SaveIndicatorSettings } from './island-setup-helpers'

interface IslandSetupParams {
  readonly dataSource: {
    readonly table: string
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
    readonly refreshMode?: 'none' | 'poll' | 'realtime'
    readonly pollIntervalMs?: number
  }
  readonly columnConfig?: readonly DataTableColumn[]
  readonly paginationConfig?: DataTablePagination
  readonly searchConfig?: DataTableSearch
  readonly selectionConfig?: DataTableSelection
  readonly toolbarConfig?: DataTableToolbar
  readonly initialRowHeight: RowHeight
  readonly searchSourceId: string | undefined
  readonly tableFields: readonly string[] | undefined
  readonly fieldMeta: FieldMetaMap | undefined
  readonly groupByConfig: DataTableGroupBy | undefined
  readonly bordered: boolean
  readonly autoSaveConfig: AutoSaveConfig | undefined
  readonly tableViews?: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly filters?: SavedViewConfigPayload['filters']
    readonly sorts?: SavedViewConfigPayload['sorts']
    readonly groupBy?: string | null
  }>
}

function useColumnSizingPersistence(
  tableName: string,
  columnSizing: Record<string, number>,
  updatePreferences: (patch: { readonly columnWidths: Record<string, number> }) => void
) {
  const lastSyncedRef = useRef<string>(JSON.stringify(columnSizing))
  const timerRef = useRef<any>(undefined)
  useEffect(() => {
    const serialized = JSON.stringify(columnSizing)
    if (serialized === lastSyncedRef.current) return
    if (Object.keys(columnSizing).length === 0) return
    lastSyncedRef.current = serialized
    writeColumnWidthsToCache(tableName, columnSizing)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      updatePreferences({ columnWidths: columnSizing })
    }, 100)
  }, [tableName, columnSizing, updatePreferences])
}

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
    bordered,
    autoSaveConfig,
    tableViews,
  } = params

  const queryClient = useQueryClient()
  const ui = useDataTableUiState()

  const prefs = useTablePreferences(dataSource.table)
  const savedViews = useSavedViews(dataSource.table)

  const controlledRowHeight = prefs.preferences.rowDensity
    ? densityToHeight(prefs.preferences.rowDensity)
    : undefined

  const tableState = useDataTableState({
    initialPageSize: paginationConfig?.pageSize ?? 25,
    initialRowHeight,
    ...(controlledRowHeight && { controlledRowHeight }),
    ...(prefs.preferences.columnWidths && {
      initialColumnSizing: prefs.preferences.columnWidths,
      controlledColumnSizing: prefs.preferences.columnWidths,
    }),
  })

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

  const effectiveSorting = useMemo(
    () =>
      ui.activeSorts.length > 0
        ? ui.activeSorts.map((s) => ({ id: s.field, desc: s.direction === 'desc' }))
        : tableState.sorting,
    [ui.activeSorts, tableState.sorting]
  )

  const { data, isLoading, isError, error, queryKey } = useDataTableQuery({
    table: dataSource.table,
    pagination: tableState.pagination,
    sorting: effectiveSorting,
    globalFilter: tableState.globalFilter,
    dataSourceFilter: effectiveFilter,
    dataSourceSort: dataSource.sort,
    refreshMode: dataSource.refreshMode,
    pollIntervalMs: dataSource.pollIntervalMs,
  })

  const handleRefresh = useCallback(
    () => void queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  )

  useEffect(() => {
    const targetTable = dataSource.table.toLowerCase()
    return subscribeIslandEvent('sovrium:crud-success', (detail) => {
      if (detail.table.toLowerCase() !== targetTable) return
      handleRefresh()
    })
  }, [dataSource.table, handleRefresh])

  const connectionStatus = useRealtimeSubscription({
    enabled: dataSource.refreshMode === 'realtime',
    table: dataSource.table,
    onChange: handleRefresh,
  })

  const inlineEditing = useInlineEditing({
    tableName: dataSource.table,
    fieldMeta,
    onSave: handleRefresh,
    autoSave: autoSaveConfig,
  })

  const executeRowAction = createRowActionHandler({ queryClient, queryKey })


  const rawRecords = useMemo(() => [...(data?.records ?? [])], [data?.records])
  const records = useMemo(
    () => applyClientFilters(rawRecords, ui.activeFilters, ui.filterConjunction),
    [rawRecords, ui.activeFilters, ui.filterConjunction]
  )
  const totalRecords = data?.total ?? 0
  const effectiveGroupByConfig: DataTableGroupBy | undefined =
    ui.runtimeGroupBy !== null ? { field: ui.runtimeGroupBy } : groupByConfig
  const allColumns = buildColumns({
    columnConfig,
    records,
    selectionConfig,
    tableFields,
    groupByField: effectiveGroupByConfig?.field,
    onActionClick: executeRowAction,
    fieldMeta,
    autoColumnsEditable: dataSource.refreshMode === 'realtime',
  })

  const { conflict, dismissConflict } = useRealtimeReconciliation({
    enabled: dataSource.refreshMode === 'realtime',
    records,
    onConflict: inlineEditing.cancelEditing,
  })

  const table = useDataTableInstance({
    records,
    allColumns,
    sorting: effectiveSorting,
    setSorting: tableState.setSorting,
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
    groupByConfig: effectiveGroupByConfig,
    totalRecords,
  })

  useColumnSizingPersistence(dataSource.table, tableState.columnSizing, prefs.updatePreferences)

  const onSelectDensity = useCallback(
    (density: RowDensity) => {
      prefs.updatePreferences({ rowDensity: density })
    },
    [prefs]
  )

  useIslandSearch(tableState.setGlobalFilter, searchSourceId)

  const onBulkExecute = useCallback(
    (action: DataTableBulkAction) => executeBulkAction(table, action),
    [table]
  )

  const editableFields = useMemo(() => resolveEditableFields(columnConfig), [columnConfig])
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
    tableName: dataSource.table,
    tableViews,
    personalViews: savedViews.views,
    activeFilters: ui.activeFilters,
    activeSorts: effectiveSortRows,
    runtimeGroupBy: ui.runtimeGroupBy,
    baseViewSnapshot: ui.baseViewSnapshot,
    activeViewId: ui.activeViewId,
    activeViewSource: ui.activeViewSource,
    deleteViewTarget: ui.deleteViewTarget,
    onApplySavedView: ui.applySavedView,
    onClearActiveView: ui.clearActiveView,
  })

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
  useUrlSyncedActiveView({ tableName: dataSource.table, onApplySharedView })

  const viewsEnabled = toolbarConfig?.views === true

  return {
    ui,
    table,
    records,
    allColumns,
    totalRecords,
    isLoading,
    isError,
    error,
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
    activeViewName:
      viewsOrchestration.viewEntries.find((e) => e.id === ui.activeViewId)?.name ??
      activeView?.name,
    cellClass: ROW_HEIGHT_CLASSES[tableState.currentRowHeight],
    borderClass: bordered ? 'border border-border' : '',
    showSearch: shouldShowSearch(searchConfig, toolbarConfig),
    isPrefsLoading: prefs.isLoading || savedViews.isLoading,
    effectiveGroupByConfig,
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
