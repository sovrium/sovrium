/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnSizingState,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useMemo } from 'react'
import type { TableRecord } from '../../shared/types'
import type {
  DataTableGroupBy,
  DataTableSelection,
} from '@/domain/models/app/pages/components/data-table'

function buildGroupingState(groupByConfig: DataTableGroupBy | undefined) {
  if (!groupByConfig) {
    return { rowModels: undefined, groupingState: undefined } as const
  }
  return {
    rowModels: {
      getGroupedRowModel: getGroupedRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
    },
    groupingState: {
      grouping: [groupByConfig.field] as ReadonlyArray<string>,
      expanded:
        groupByConfig.collapsed === true ? ({} as Record<string, boolean>) : (true as const),
    },
  } as const
}

interface UseDataTableInstanceParams {
  readonly records: readonly TableRecord[]
  readonly allColumns: readonly ColumnDef<TableRecord>[]
  readonly sorting: SortingState
  readonly setSorting: OnChangeFn<SortingState>
  readonly columnFilters: ColumnFiltersState
  readonly setColumnFilters: OnChangeFn<ColumnFiltersState>
  readonly globalFilter: string
  readonly setGlobalFilter: OnChangeFn<string>
  readonly pagination: PaginationState
  readonly setPagination: OnChangeFn<PaginationState>
  readonly rowSelection: RowSelectionState
  readonly setRowSelection: OnChangeFn<RowSelectionState>
  readonly columnVisibility: VisibilityState
  readonly setColumnVisibility: OnChangeFn<VisibilityState>
  readonly columnOrder: ColumnOrderState
  readonly setColumnOrder: OnChangeFn<ColumnOrderState>
  readonly columnSizing: ColumnSizingState
  readonly setColumnSizing: OnChangeFn<ColumnSizingState>
  readonly selectionConfig: DataTableSelection | undefined
  readonly groupByConfig: DataTableGroupBy | undefined
  readonly totalRecords: number
}

function buildTableState(
  params: UseDataTableInstanceParams,
  groupingState: ReturnType<typeof buildGroupingState>['groupingState']
) {
  return {
    sorting: params.sorting,
    columnFilters: params.columnFilters,
    globalFilter: params.globalFilter,
    pagination: params.pagination,
    rowSelection: params.rowSelection,
    columnVisibility: params.columnVisibility,
    columnOrder: params.columnOrder,
    columnSizing: params.columnSizing,
    ...(groupingState && {
      grouping: groupingState.grouping as string[],
      expanded: groupingState.expanded,
    }),
  }
}

function buildTableOptions(
  params: UseDataTableInstanceParams,
  groupingState: ReturnType<typeof buildGroupingState>['groupingState'],
  rowModels: ReturnType<typeof buildGroupingState>['rowModels']
) {
  const { records, allColumns, selectionConfig, totalRecords, pagination } = params
  const selectionEnabled =
    selectionConfig?.mode === 'single' || selectionConfig?.mode === 'multiple'
  return {
    data: records as TableRecord[],
    columns: [...allColumns],
    state: buildTableState(params, groupingState),
    onSortingChange: params.setSorting,
    onColumnFiltersChange: params.setColumnFilters,
    onGlobalFilterChange: params.setGlobalFilter,
    onPaginationChange: params.setPagination,
    onRowSelectionChange: params.setRowSelection,
    onColumnVisibilityChange: params.setColumnVisibility,
    onColumnOrderChange: params.setColumnOrder,
    onColumnSizingChange: params.setColumnSizing,
    enableColumnResizing: true,
    columnResizeMode: 'onChange' as const,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    ...(rowModels ?? {}),
    enableRowSelection: selectionEnabled,
    enableMultiRowSelection: selectionConfig?.mode === 'multiple',
    sortDescFirst: false,
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.ceil(totalRecords / pagination.pageSize),
  }
}

export function useDataTableInstance(params: UseDataTableInstanceParams) {
  const { groupByConfig } = params

  const groupingKey = groupByConfig?.field ?? ''
  const collapsedDefault = groupByConfig?.collapsed === true
  const { rowModels, groupingState } = useMemo(
    () =>
      buildGroupingState(
        groupingKey === ''
          ? undefined
          : { field: groupingKey, ...(collapsedDefault && { collapsed: true }) }
      ),
    [groupingKey, collapsedDefault]
  )

  return useReactTable(buildTableOptions(params, groupingState, rowModels))
}
