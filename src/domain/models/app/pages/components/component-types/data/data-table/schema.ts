/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../../action'
import { ComponentSearchSchema } from '../../../component-search'
import { DataFilterSchema, DataSortSchema } from '../../../data-source'
import { DataTablePaginationSchema } from '../../../pagination'
import { DataTableBulkActionSchema } from './bulk-actions'
import { DataTableColumnSchema } from './columns'
import { DataTableGroupBySchema } from './group-by'
import { DataTableSelectionSchema } from './selection'
import { DataTableSummaryItemSchema } from './summary'
import { DataTableToolbarSchema } from './toolbar'

// ---------------------------------------------------------------------------
// Row height
// ---------------------------------------------------------------------------

export const RowHeightSchema = Schema.Literal('short', 'medium', 'tall').annotations({
  title: 'Row Height',
  description: 'Table row height preset (default: medium)',
})

// ---------------------------------------------------------------------------
// DataTableSchema (composed)
// ---------------------------------------------------------------------------

/**
 * Data Table Schema
 *
 * A page section component that renders an interactive data grid.
 * Binds to a table (optionally a view) and adds presentation config
 * for columns, selection, toolbar, grouping, summary, and inline editing.
 *
 * @example
 * ```yaml
 * type: data-table
 * dataSource:
 *   table: orders
 *   view: active-orders
 * columns:
 *   - field: name
 *     label: Customer
 *     width: 200
 *   - field: status
 *     cellStyle:
 *       - when: { eq: shipped }
 *         className: bg-green-50 text-green-700
 *   - type: actions
 *     width: 80
 *     actions:
 *       - label: Edit
 *         icon: pencil
 *         action:
 *           type: crud
 *           operation: update
 *           table: orders
 * rowHeight: medium
 * striped: true
 * selection:
 *   mode: multiple
 * pagination:
 *   pageSize: 25
 *   pageSizeOptions: [10, 25, 50]
 * toolbar:
 *   search: true
 *   filters: true
 *   export: true
 * bulkActions:
 *   - label: Delete Selected
 *     icon: trash
 *     action:
 *       type: crud
 *       operation: delete
 *       table: orders
 *     confirm: "Delete {count} orders?"
 * ```
 */
export const DataTableSchema = Schema.Struct({
  /** Data source binding (table + optional view + filter/sort) */
  dataSource: Schema.Struct({
    /** Table name to query */
    table: Schema.String.annotations({
      description: 'Table name to bind to (validated against app.tables)',
    }),
    /** Optional view name to inherit filters/sorts/fields */
    view: Schema.optional(
      Schema.String.annotations({
        description: 'View name to inherit configuration from (filters, sorts, fields)',
      })
    ),
    /** Server-side filter conditions (AND logic) applied before pagination */
    filter: Schema.optional(
      Schema.Array(DataFilterSchema).annotations({
        description: 'Filter conditions applied server-side with AND logic',
      })
    ),
    /** Server-side sort rules (applied in order) */
    sort: Schema.optional(
      Schema.Array(DataSortSchema).annotations({
        description: 'Default sort rules applied server-side in order',
      })
    ),
  }).annotations({
    title: 'Data Table Data Source',
    description:
      'Data binding for the table: which table (and optional view), plus default filter/sort applied server-side',
  }),

  /** Column definitions */
  columns: Schema.optional(
    Schema.Array(DataTableColumnSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Column definitions. If omitted, auto-generated from table fields.',
      })
    )
  ),

  /** Row height preset */
  rowHeight: Schema.optional(RowHeightSchema),
  /** Alternating row colors */
  striped: Schema.optional(
    Schema.Boolean.annotations({ description: 'Alternating row colors (default: false)' })
  ),
  /** Cell borders */
  bordered: Schema.optional(
    Schema.Boolean.annotations({ description: 'Show cell borders (default: false)' })
  ),
  /** Message when no records match */
  emptyMessage: Schema.optional(
    Schema.String.annotations({
      description: 'Message displayed when no records match',
      examples: ['No orders found', 'No results'],
    })
  ),
  /** Show row number column */
  showRowNumbers: Schema.optional(
    Schema.Boolean.annotations({ description: 'Show row number column (default: false)' })
  ),

  /** Row selection config */
  selection: Schema.optional(DataTableSelectionSchema),
  /** Pagination config */
  pagination: Schema.optional(DataTablePaginationSchema),
  /** Search config (shared ComponentSearchSchema: enabled, placeholder, debounceMs, highlight) */
  search: Schema.optional(ComponentSearchSchema),

  /** Default/initial sort rules (override or supplement view sorts) */
  defaultSort: Schema.optional(
    Schema.Array(DataSortSchema).annotations({
      description: 'Default sort rules (applied if no view sorts, or as initial state)',
    })
  ),
  /** Additional filters stacked on top of view filters */
  defaultFilters: Schema.optional(
    Schema.Array(DataFilterSchema).annotations({
      description: 'Additional filter conditions stacked on view filters',
    })
  ),

  /** Row grouping config */
  groupBy: Schema.optional(DataTableGroupBySchema),
  /** Summary row aggregations */
  summary: Schema.optional(
    Schema.Array(DataTableSummaryItemSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Summary row with aggregate computations',
      })
    )
  ),

  /** Toolbar controls */
  toolbar: Schema.optional(DataTableToolbarSchema),
  /** Bulk actions for selected rows */
  bulkActions: Schema.optional(
    Schema.Array(DataTableBulkActionSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Actions available when rows are selected',
      })
    )
  ),

  /** Action triggered when a row is clicked */
  onRowClick: Schema.optional(ActionSchema),
}).annotations({
  identifier: 'DataTable',
  title: 'Data Table',
  description:
    'Interactive data grid component. Binds to a table/view and provides columns, selection, toolbar, grouping, summary, and inline editing.',
})

// ---------------------------------------------------------------------------
// Cross-schema validation
// ---------------------------------------------------------------------------

/**
 * Validates that data table column references point to valid table fields.
 *
 * Checks:
 * - Field columns reference fields that exist in the table
 * - groupBy field exists in the table
 * - Summary fields exist in the table
 * - defaultSort fields exist in the table
 * - defaultFilter fields exist in the table
 *
 * @param dataTable - The parsed DataTable configuration
 * @param availableTables - Map of table names to their field names
 * @returns An object with `valid: boolean` and `errors: string[]`
 */
export function validateDataTableColumns(
  dataTable: DataTable,
  availableTables: ReadonlyMap<string, readonly string[]>
): { readonly valid: boolean; readonly errors: readonly string[] } {
  const tableFields = availableTables.get(dataTable.dataSource.table)

  if (tableFields === undefined) {
    const tableNames = [...availableTables.keys()]
    return {
      valid: false,
      errors: [
        `Table '${dataTable.dataSource.table}' not found. Available: ${tableNames.join(', ') || '(none)'}`,
      ],
    }
  }

  const checkField = (field: string, context: string): readonly string[] =>
    tableFields.includes(field)
      ? []
      : [
          `${context}: field '${field}' not found in table '${dataTable.dataSource.table}'. Available: ${tableFields.join(', ')}`,
        ]

  const columnErrors: readonly string[] = (dataTable.columns ?? []).flatMap((col) => {
    if ('field' in col && typeof col.field === 'string') {
      return checkField(col.field, 'columns')
    }
    return []
  })

  const groupByErrors: readonly string[] = dataTable.groupBy
    ? checkField(dataTable.groupBy.field, 'groupBy')
    : []

  const summaryErrors: readonly string[] = (dataTable.summary ?? []).flatMap((item) =>
    checkField(item.field, 'summary')
  )

  const sortErrors: readonly string[] = (dataTable.defaultSort ?? []).flatMap((s) =>
    checkField(s.field, 'defaultSort')
  )

  const filterErrors: readonly string[] = (dataTable.defaultFilters ?? []).flatMap((f) =>
    checkField(f.field, 'defaultFilters')
  )

  const dataSourceSortErrors: readonly string[] = (dataTable.dataSource.sort ?? []).flatMap((s) =>
    checkField(s.field, 'dataSource.sort')
  )

  const dataSourceFilterErrors: readonly string[] = (dataTable.dataSource.filter ?? []).flatMap(
    (f) => checkField(f.field, 'dataSource.filter')
  )

  const errors = [
    ...columnErrors,
    ...groupByErrors,
    ...summaryErrors,
    ...sortErrors,
    ...filterErrors,
    ...dataSourceSortErrors,
    ...dataSourceFilterErrors,
  ]

  return { valid: errors.length === 0, errors }
}

// ---------------------------------------------------------------------------
// Re-exports from extracted files
// ---------------------------------------------------------------------------

export {
  ColumnFormatSchema,
  CellStyleConditionSchema,
  ActionColumnItemSchema,
  FieldColumnSchema,
  ActionColumnSchema,
  DataTableColumnSchema,
} from './columns'
export { DataTableSelectionSchema } from './selection'
export { DataTablePaginationSchema } from '../../../pagination'
export { DataTableSearchSchema } from '../../../search'
export { DataTableGroupBySchema } from './group-by'
export { SummaryFunctionSchema, DataTableSummaryItemSchema } from './summary'
export { DataTableToolbarSchema } from './toolbar'
export { DataTableBulkActionSchema } from './bulk-actions'

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type { ColumnFormat, CellStyleCondition, ActionColumnItem } from './columns'
export type { FieldColumn, ActionColumn, DataTableColumn } from './columns'
export type { DataTableSelection } from './selection'
export type { DataTablePagination } from '../../../pagination'
export type { DataTableSearch } from '../../../search'
export type { DataTableGroupBy } from './group-by'
export type { SummaryFunction, DataTableSummaryItem } from './summary'
export type { DataTableToolbar } from './toolbar'
export type { DataTableBulkAction } from './bulk-actions'
export type RowHeight = Schema.Schema.Type<typeof RowHeightSchema>
export type DataTable = Schema.Schema.Type<typeof DataTableSchema>
