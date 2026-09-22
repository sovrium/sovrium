/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  useTable,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnSizingState,
  type ColumnVisibilityState,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import { dataTableFeatures, type DataTableColumnDef } from './table-features'
import type { TableRecord } from '../../runtime/types'
import type { DataTableSelection } from '@/domain/models/app/pages/components/component-types/data/table/schema'

interface UseDataTableInstanceParams {
  readonly records: readonly TableRecord[]
  readonly allColumns: readonly DataTableColumnDef[]
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
  readonly columnVisibility: ColumnVisibilityState
  readonly setColumnVisibility: OnChangeFn<ColumnVisibilityState>
  readonly columnOrder: ColumnOrderState
  readonly setColumnOrder: OnChangeFn<ColumnOrderState>
  readonly columnSizing: ColumnSizingState
  readonly setColumnSizing: OnChangeFn<ColumnSizingState>
  readonly selectionConfig: DataTableSelection | undefined
  readonly totalRecords: number
  /**
   * Whether the RESPONSE declared that the server already applied the search
   * term (its `appliedQuery` key was present — see `FetchResult.appliedQuery`).
   *
   * Exactly one layer may filter, and both failure modes are wrong-answer bugs.
   * Filter NEITHER and the box is inert. Filter BOTH and the server's matches
   * are silently discarded whenever the field that matched is not a rendered
   * column — which is precisely how a users-directory row matched on `name`
   * disappeared before `name` was a column.
   *
   * Keyed on the response rather than on "is this a system source" deliberately:
   * several system endpoints (automation runs, connections, form submissions)
   * still ignore `?q=`, and their grids must keep filtering in memory. The
   * endpoint is the only party that knows, so it says so in its own body.
   */
  readonly serverFiltered: boolean
  /**
   * Whether this grid sorts its OWN rows rather than asking the server to.
   *
   * True only when the grid holds the whole result set of a source that will
   * not sort it — see `resolveClientSorted`. Everywhere else the server sorts
   * and this stays false, which is what `manualSorting` has always meant.
   *
   * Sorting a PAGE in the browser would be worse than not sorting at all: it
   * reorders the rows on screen and presents the result as an ordering of the
   * whole view, so the reader is shown a false answer rather than none.
   */
  readonly clientSorted: boolean
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
 * Assemble the full `useTable` options object. Pure (no hooks) so the
 * `useDataTableInstance` hook body stays a thin `useTable(...)` call
 * under the function-size limit.
 */
function buildTableOptions(params: UseDataTableInstanceParams) {
  const { records, allColumns, selectionConfig, totalRecords, pagination } = params
  const selectionEnabled =
    selectionConfig?.mode === 'single' || selectionConfig?.mode === 'multiple'
  return {
    features: dataTableFeatures,
    data: records,
    columns: allColumns,
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
    enableRowSelection: selectionEnabled,
    enableMultiRowSelection: selectionConfig?.mode === 'multiple',
    // v9 turns shift-click range selection ON by default inside
    // `row.getToggleSelectedHandler()` — the handler the selection checkbox
    // column wires up. Left on, a shift-click would select a span of rows
    // where every already-shipped grid selects exactly one.
    enableRowRangeSelection: false,
    // Always sort ASC on the first click, regardless of column type. TanStack's
    // default is DESC-first for numeric/date columns, which contradicts the
    // user-expectation set by every common data grid (Linear, Notion, Airtable
    // and [internal ref] specs) — first click should always yield
    // the smallest values at the top.
    sortDescFirst: false,
    manualPagination: true,
    // The server sorts, EXCEPT where it demonstrably will not and the grid
    // already holds every row — then the registered sorted row model runs and
    // the reorder happens in the reader's own browser.
    manualSorting: !params.clientSorted,
    // When the response declared the search already ran server-side, the
    // filtered row model is bypassed (it returns the pre-filtered core model)
    // so the page of MATCHES the server sent is rendered as sent.
    manualFiltering: params.serverFiltered,
    pageCount: Math.ceil(totalRecords / pagination.pageSize),
  }
}

/**
 * Wire the TanStack Table instance for the data-table island.
 *
 * Centralises the option assembly — controlled state, manual pagination/sorting
 * flags — so the orchestrator can remain a thin coordinator over UI
 * sub-components. Which capabilities the instance has at all is declared once
 * in `table-features.ts`.
 *
 * Grouping is deliberately not among them. The grid partitions its own rows
 * (`group-order.ts`), which is what lets a level group by a field the grid does
 * not show as a column: TanStack can only group a declared column, and a
 * grouping field is not required to be one — the group header is what carries
 * its value to the reader.
 */
export function useDataTableInstance(params: UseDataTableInstanceParams) {
  return useTable(buildTableOptions(params))
}
