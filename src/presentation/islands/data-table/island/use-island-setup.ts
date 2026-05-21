/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useDataTableQuery } from '../../hooks/use-data-table-query'
import { useDataTableState, ROW_HEIGHT_CLASSES } from '../../hooks/use-data-table-state'
import { useInlineEditing, type FieldMetaMap } from '../../hooks/use-inline-editing'
import { useIslandSearch } from '../../hooks/use-island-search'
import { executeBulkAction } from './bulk-action-execute'
import { buildColumns } from './columns'
import { createRowActionHandler } from './row-actions'
import { useDataTableInstance } from './use-table'
import { useDataTableUiState } from './use-ui-state'
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

interface IslandSetupParams {
  readonly dataSource: {
    readonly table: string
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
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
}

function resolveEditableFields(
  columnConfig: readonly DataTableColumn[] | undefined
): readonly string[] {
  if (!columnConfig) return []
  return columnConfig
    .filter((col): col is Extract<DataTableColumn, { field: string }> => 'field' in col)
    .filter((col) => col.editable === true)
    .map((col) => col.field)
}

function shouldShowSearch(
  searchConfig: DataTableSearch | undefined,
  toolbarConfig: DataTableToolbar | undefined
): boolean {
  return !!(
    (searchConfig && searchConfig.enabled !== false) ||
    (toolbarConfig && toolbarConfig.search)
  )
}

export interface SaveIndicatorSettings {
  readonly show: boolean
  readonly position: 'inline' | 'toast' | 'toolbar'
}

function resolveSaveIndicator(
  autoSaveConfig: AutoSaveConfig | undefined
): SaveIndicatorSettings | undefined {
  if (!autoSaveConfig) return undefined
  const mode = autoSaveConfig.saveMode ?? 'manual'
  if (mode === 'manual') return undefined
  const show = autoSaveConfig.showSaveIndicator !== false
  return { show, position: autoSaveConfig.saveIndicatorPosition ?? 'inline' }
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
  } = params

  const queryClient = useQueryClient()
  const ui = useDataTableUiState()

  const tableState = useDataTableState({
    initialPageSize: paginationConfig?.pageSize ?? 25,
    initialRowHeight,
  })

  const { data, isLoading, isError, error, queryKey } = useDataTableQuery({
    table: dataSource.table,
    pagination: tableState.pagination,
    sorting: tableState.sorting,
    globalFilter: tableState.globalFilter,
    dataSourceFilter: dataSource.filter,
    dataSourceSort: dataSource.sort,
  })

  const handleRefresh = useCallback(
    () => void queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  )

  const inlineEditing = useInlineEditing({
    tableName: dataSource.table,
    fieldMeta,
    onSave: handleRefresh,
    autoSave: autoSaveConfig,
  })

  const executeRowAction = createRowActionHandler({ queryClient, queryKey })


  const records = useMemo(() => [...(data?.records ?? [])], [data?.records])
  const totalRecords = data?.total ?? 0
  const allColumns = buildColumns({
    columnConfig,
    records,
    selectionConfig,
    tableFields,
    groupByField: groupByConfig?.field,
    onActionClick: executeRowAction,
  })

  const table = useDataTableInstance({
    records,
    allColumns,
    sorting: tableState.sorting,
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
    selectionConfig,
    groupByConfig,
    totalRecords,
  })

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
    globalFilter: tableState.globalFilter,
    setGlobalFilter: tableState.setGlobalFilter,
    rowSelection: tableState.rowSelection,
    currentRowHeight: tableState.currentRowHeight,
    toggleDensity: tableState.toggleDensity,
    cellClass: ROW_HEIGHT_CLASSES[tableState.currentRowHeight],
    borderClass: bordered ? 'border border-gray-200' : '',
    showSearch: shouldShowSearch(searchConfig, toolbarConfig),
  }
}
