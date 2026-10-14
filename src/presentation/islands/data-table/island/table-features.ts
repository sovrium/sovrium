/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  metaHelper,
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
import { sortingFeatures } from '../column-header/sorting-features'
import { filteringFeatures } from '../faceted-filter/filtering-features'
import { paginationFeatures } from '../pagination/pagination-features'
import { selectionFeatures } from '../selection/selection-features'
import { viewOptionsFeatures } from '../view-options/view-options-features'
import type { TableRecord } from '../../runtime/types'
import type { DataTableColumnMeta } from '../table/column-meta'

export type { DataTableColumnMeta } from '../table/column-meta'

/**
 * The feature registry for the data grid: v9's replacement for v8's implicit
 * "every feature is always present" model. Only what is listed here is wired
 * into the instance and shipped to the client.
 *
 * Each slot owns its slice (sorting in `column-header/`, filtering in
 * `faceted-filter/`, pagination, selection, and the visibility / ordering /
 * sizing trio in `view-options/`); this file only spreads them, and each slice
 * carries the rationale for what it registers and what it leaves out.
 *
 * Grouping is not here: the grid partitions its own rows in `group-order.ts`,
 * which is what lets a level group by a field the grid does not show as a
 * column. Summary, row expand, editing, frozen columns, density, views and
 * export register no TanStack feature either.
 */
export const dataTableFeatures = tableFeatures({
  ...filteringFeatures,
  ...viewOptionsFeatures,
  ...paginationFeatures,
  ...selectionFeatures,
  ...sortingFeatures,
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
