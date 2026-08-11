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
import type { TableRecord } from '../../shared/types'
import type { DataTableSelection } from '@/domain/models/app/pages/components/component-types/data/data-table/schema'

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
  readonly totalRecords: number
}

/**
 * Assemble the controlled `state` block for the TanStack Table instance.
 * Extracted as a pure helper so `useDataTableInstance` stays under the
 * function-size limit.
 */
function buildTableState(params: UseDataTableInstanceParams) {
  return {
    sorting: params.sorting,
    columnFilters: params.columnFilters,
    globalFilter: params.globalFilter,
    pagination: params.pagination,
    rowSelection: params.rowSelection,
    columnVisibility: params.columnVisibility,
    columnOrder: params.columnOrder,
    columnSizing: params.columnSizing,
  }
}

/**
 * Assemble the full `useReactTable` options object. Pure (no hooks) so the
 * `useDataTableInstance` hook body stays a thin `useReactTable(...)` call
 * under the function-size limit.
 */
function buildTableOptions(params: UseDataTableInstanceParams) {
  const { records, allColumns, selectionConfig, totalRecords, pagination } = params
  const selectionEnabled =
    selectionConfig?.mode === 'single' || selectionConfig?.mode === 'multiple'
  return {
    // TanStack Table v8 requires mutable TData[]; the caller passes a memoized
    // mutable copy so we can hand it directly to `data:` here.
    data: records as TableRecord[],
    columns: [...allColumns],
    state: buildTableState(params),
    onSortingChange: params.setSorting,
    onColumnFiltersChange: params.setColumnFilters,
    onGlobalFilterChange: params.setGlobalFilter,
    onPaginationChange: params.setPagination,
    onRowSelectionChange: params.setRowSelection,
    onColumnVisibilityChange: params.setColumnVisibility,
    onColumnOrderChange: params.setColumnOrder,
    onColumnSizingChange: params.setColumnSizing,
    // Column resize: live update during drag.
    // TanStack Table emits `columnSizing` change events on each pointer move;
    // the orchestrator debounces the PATCH to the user-preferences endpoint
    // so a single drag does not produce dozens of writes.
    enableColumnResizing: true,
    columnResizeMode: 'onChange' as const,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: selectionEnabled,
    enableMultiRowSelection: selectionConfig?.mode === 'multiple',
    // Always sort ASC on the first click, regardless of column type. TanStack's
    // default is DESC-first for numeric/date columns, which contradicts the
    // user-expectation set by every common data grid (Linear, Notion, Airtable
    // and [internal ref] specs) — first click should always yield
    // the smallest values at the top.
    sortDescFirst: false,
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.ceil(totalRecords / pagination.pageSize),
  }
}

/**
 * Wire the TanStack Table instance for the data-table island.
 *
 * Centralises the option assembly — controlled state, row models, manual
 * pagination/sorting flags — so the orchestrator can remain a thin coordinator
 * over UI sub-components.
 *
 * Grouping is deliberately NOT among those row models. The grid partitions its
 * own rows (`group-order.ts`), which is what lets a level group by a field the
 * grid does not show as a column: TanStack can only group a declared column, and
 * a grouping field is not required to be one — the group header is what carries
 * its value to the reader.
 */
export function useDataTableInstance(params: UseDataTableInstanceParams) {
  return useReactTable(buildTableOptions(params))
}
