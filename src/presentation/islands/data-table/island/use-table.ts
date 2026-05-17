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

/**
 * Build the TanStack Table options for the (optional) grouping/expanding
 * configuration.
 *
 * Extracted as a pure helper so the orchestrator's cyclomatic complexity
 * stays below the size-limit cap.
 */
function buildGroupingState(groupByConfig: DataTableGroupBy | undefined) {
  if (!groupByConfig) return undefined
  return {
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    initialState: {
      grouping: [groupByConfig.field],
      // When `collapsed: true`, start with an empty expanded map so that no
      // group is expanded (i.e. all groups start collapsed). Otherwise expand
      // every group by default.
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

/**
 * Wire the TanStack Table instance for the data-table island.
 *
 * Centralises the option assembly — controlled state, row models, optional
 * grouping, manual pagination/sorting flags — so the orchestrator can
 * remain a thin coordinator over UI sub-components.
 */
export function useDataTableInstance(params: UseDataTableInstanceParams) {
  const { records, allColumns, selectionConfig, groupByConfig, totalRecords, pagination } = params
  const selectionEnabled =
    selectionConfig?.mode === 'single' || selectionConfig?.mode === 'multiple'

  return useReactTable({
    // TanStack Table v8 requires mutable TData[]; the caller passes a memoized
    // mutable copy so we can hand it directly to `data:` here.
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
