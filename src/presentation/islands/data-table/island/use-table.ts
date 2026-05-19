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
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import type { TableRecord } from '../../shared/types'
import type {
  DataTableGroupBy,
  DataTableSelection,
} from '@/domain/models/app/pages/components/data-table'

function buildGroupingState(groupByConfig: DataTableGroupBy | undefined) {
  if (!groupByConfig) return undefined
  return {
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    initialState: {
      grouping: [groupByConfig.field],
      expanded: groupByConfig.collapsed === true ? {} : true,
    },
  }
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
  readonly selectionConfig: DataTableSelection | undefined
  readonly groupByConfig: DataTableGroupBy | undefined
  readonly totalRecords: number
}

export function useDataTableInstance(params: UseDataTableInstanceParams) {
  const { records, allColumns, selectionConfig, groupByConfig, totalRecords, pagination } = params
  const selectionEnabled =
    selectionConfig?.mode === 'single' || selectionConfig?.mode === 'multiple'

  return useReactTable({
    data: records as TableRecord[],
    columns: [...allColumns],
    state: {
      sorting: params.sorting,
      columnFilters: params.columnFilters,
      globalFilter: params.globalFilter,
      pagination,
      rowSelection: params.rowSelection,
      columnVisibility: params.columnVisibility,
    },
    onSortingChange: params.setSorting,
    onColumnFiltersChange: params.setColumnFilters,
    onGlobalFilterChange: params.setGlobalFilter,
    onPaginationChange: params.setPagination,
    onRowSelectionChange: params.setRowSelection,
    onColumnVisibilityChange: params.setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    ...buildGroupingState(groupByConfig),
    enableRowSelection: selectionEnabled,
    enableMultiRowSelection: selectionConfig?.mode === 'multiple',
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.ceil(totalRecords / pagination.pageSize),
  })
}
