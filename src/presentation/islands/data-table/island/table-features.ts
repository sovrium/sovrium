/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type Cell,
  type CellContext,
  type Column,
  type ColumnDef,
  type Header,
  type HeaderGroup,
  type ReactTable,
  type Row,
} from '@tanstack/react-table'
import type { TableRecord } from '../../runtime/types'
import type { CellStyleCondition } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * Per-column metadata the grid attaches to every `ColumnDef` it builds.
 *
 * Declared ONCE here through the `columnMeta` slot rather than re-asserted at
 * each read site: before v9 every reader carried its own `as { frozen?: … }`
 * cast, so a renamed key type-checked at all four of them and failed only at
 * runtime.
 */
export interface DataTableColumnMeta {
  /** Pins the column to the left edge; consumed by `frozen-columns.ts`. */
  readonly frozen?: boolean
  /** Conditional cell styling rules evaluated per row. */
  readonly cellStyle?: readonly CellStyleCondition[]
  /** The bound record field. Absent on display columns (selection, actions). */
  readonly field?: string
  /** Opts the column into inline double-click editing. */
  readonly editable?: boolean
  /**
   * The width the CONFIG declared for this column, in pixels — absent when the
   * column declared none.
   *
   * It duplicates the column def's `size` on purpose, because `size` cannot
   * answer the only question the header cell asks: was this width AUTHORED?
   * TanStack merges its own default into every column def, so `getSize()`
   * returns 150 for a column nobody sized, indistinguishable from a column
   * someone sized at 150. Painting that default would give every unauthored
   * column a hard 150px and destroy the auto layout the grid is built on.
   */
  readonly authoredWidth?: number
  /**
   * Marks the generated action cluster column, whose cells are BUTTONS.
   *
   * The flag exists because that column binds no field and so had no other
   * identity a cell could be recognised by, and the cell has to be recognised:
   * a click on one of its buttons belongs to that button, never to the row
   * around it.
   */
  readonly actions?: boolean
}

/**
 * The feature registry for the data grid — v9's replacement for v8's implicit
 * "every feature is always present" model. Only what is listed here is wired
 * into the instance and shipped to the client.
 *
 * One row model is deliberately ABSENT:
 *
 * - `paginatedRowModel` — `manualPagination` is hardcoded `true` (the server
 *   pages), and `table_getPaginatedRowModel` short-circuits to the previous
 *   stage under it, so it could never run. `getPageCount` and `getCanNextPage`
 *   come from `rowPaginationFeature` and read `pageCount`.
 *
 * `sortedRowModel` was absent for the same reason until `manualSorting` stopped
 * being hardcoded. It is now the runtime `clientSorted` flag (see
 * `use-table.ts`), false for every DB-table grid and for any system feed the
 * reader holds only a page of — so on those the model still short-circuits
 * exactly as before. It runs only where the grid holds the WHOLE result set of
 * a source that will not sort it, which is the one case where a browser-side
 * sort is both necessary and complete.
 *
 * `sortFns` carries exactly the three names `column_getAutoSortFn` can select —
 * `datetime`, `alphanumeric` and `text`. Registering none of them is not free
 * and not silent: the resolver warns in development and falls back to
 * `sortFn_basic`, which compares with `<`, so `item10` sorts before `item2`.
 * Registering more than these three would ship built-ins nothing can reach.
 *
 * `filteredRowModel` IS required: `manualFiltering` is the runtime
 * `serverFiltered` flag, false for most data sources, and the model also backs
 * `getFilteredSelectedRowModel()` and the filtered-count readout in
 * `view-props.ts`. One model runs both the column filters and the global
 * filter, which is why both filtering features are registered.
 *
 * `columnFilteringFeature` is registered for that row model and for the GLOBAL
 * filter alone — `createFilteredRowModel` lives in that feature and imports
 * `column_getFilterFn` from it. The `state.columnFilters` slot it also brings
 * is deliberately never written: nothing in `src/` or `[internal ref]` calls
 * `setFilterValue`, and the runtime filter builder narrows rows before they
 * reach the instance (`applyClientFilters`). Three properties keep it that way,
 * each pinned by a test in `island-setup-helpers.test.ts`: the panel's AND/OR
 * conjunction (column filters are always AND — and the OR half is spec-pinned
 * by [internal ref]), several filter rows on ONE field (the state is
 * keyed by column id, so a second entry would collide rather than intersect),
 * and filtering on a field the grid renders no column for. That last one is the
 * grouping reason below, exactly.
 *
 * Grouping is not here either — the grid partitions its own rows in
 * `group-order.ts`, which is what lets a level group by a field the grid does
 * not show as a column.
 *
 * `columnPinningFeature` is not here, and CANNOT replace `frozen-columns.ts`.
 * v9 removed v8's `column.getStart()`: the feature's whole exported surface is
 * `column_pin` / `getIsPinned` / `getCanPin` / `getPinnedIndex` plus the
 * `table_get{Start,Center,End}*` splitters, and it computes no offsets at all.
 * Its model is STRUCTURAL — split the header and cells into three regions and
 * render them as separate tables. This grid renders one `<table>` and pins with
 * `position: sticky`, which needs a `left` value v9 will not supply, and which
 * `frozen-columns.ts` MEASURES because an auto-layout grid's real widths are
 * not the declared ones. Adopting the feature would keep every line of that
 * measurement and add a DOM restructure on top. What is actually pinned is the
 * geometry — [internal ref] and -FROZEN-REGRESSION assert that
 * a frozen header and its body cells hold their x within 1px under horizontal
 * scroll — so any replacement has to reproduce offsets v9 does not compute.
 */
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  columnMeta: metaHelper<DataTableColumnMeta>(),
})

export type DataTableFeatures = typeof dataTableFeatures

/**
 * The table instance as the grid sees it.
 *
 * `ReactTable`, not the core `Table`: only the React wrapper carries `.state`,
 * which is what replaced v8's removed `table.getState()`.
 */
export type DataTableInstance = ReactTable<DataTableFeatures, TableRecord>
export type DataTableColumnDef = ColumnDef<DataTableFeatures, TableRecord>
export type DataTableRow = Row<DataTableFeatures, TableRecord>
export type DataTableCell = Cell<DataTableFeatures, TableRecord>
/**
 * A runtime grid column. Named `…GridColumn` rather than `…Column` because the
 * domain schema already exports a `DataTableColumn` — the AUTHORED column
 * config — and several files here import both.
 */
export type DataTableGridColumn = Column<DataTableFeatures, TableRecord>
export type DataTableHeader = Header<DataTableFeatures, TableRecord>
export type DataTableHeaderGroup = HeaderGroup<DataTableFeatures, TableRecord>
export type DataTableCellContext = CellContext<DataTableFeatures, TableRecord>
