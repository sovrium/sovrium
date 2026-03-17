/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from './action'
import { DataFilterSchema, DataSortSchema } from './data-source'

// ---------------------------------------------------------------------------
// Column format
// ---------------------------------------------------------------------------

/**
 * Display format overrides for column rendering.
 *
 * Each format corresponds to a field type:
 * - Text: truncate
 * - Number: currency, percentage, compact (1.2K)
 * - Date: relative-date ("2 days ago"), short-date, long-date, datetime
 * - Boolean: yes-no, check-cross
 */
export const ColumnFormatSchema = Schema.Literal(
  'truncate',
  'currency',
  'percentage',
  'compact',
  'relative-date',
  'short-date',
  'long-date',
  'datetime',
  'yes-no',
  'check-cross'
).annotations({
  title: 'Column Format',
  description: 'Display format override for column rendering',
})

// ---------------------------------------------------------------------------
// Cell style condition
// ---------------------------------------------------------------------------

/**
 * Conditional cell styling based on cell value.
 *
 * @example
 * ```yaml
 * cellStyle:
 *   - when: { eq: shipped }
 *     className: bg-green-50 text-green-700
 *   - when: { eq: cancelled }
 *     className: bg-red-50 text-red-400 line-through
 * ```
 */
const ConditionValueSchema = Schema.Union(Schema.String, Schema.Number, Schema.Boolean)

export const CellStyleConditionSchema = Schema.Struct({
  /** Condition matcher: operator → value (at least one operator required) */
  when: Schema.Struct({
    eq: Schema.optional(ConditionValueSchema),
    neq: Schema.optional(ConditionValueSchema),
    contains: Schema.optional(ConditionValueSchema),
    gt: Schema.optional(ConditionValueSchema),
    lt: Schema.optional(ConditionValueSchema),
    gte: Schema.optional(ConditionValueSchema),
    lte: Schema.optional(ConditionValueSchema),
  }).annotations({
    description: 'Condition: { operator: value }. Supports eq, neq, contains, gt, lt, gte, lte.',
  }),
  /** Tailwind CSS classes to apply when condition matches */
  className: Schema.String.annotations({
    description: 'Tailwind CSS classes applied when the condition is met',
    examples: ['bg-green-50 text-green-700', 'bg-red-50 text-red-400 line-through'],
  }),
}).annotations({
  title: 'Cell Style Condition',
  description: 'Conditional styling rule for table cells',
})

// ---------------------------------------------------------------------------
// Action column item
// ---------------------------------------------------------------------------

/**
 * A single action button within an action column.
 *
 * @example
 * ```yaml
 * - label: Edit
 *   icon: pencil
 *   action:
 *     type: crud
 *     operation: update
 *     table: orders
 * ```
 */
export const ActionColumnItemSchema = Schema.Struct({
  /** Button label */
  label: Schema.String.annotations({ description: 'Action button label' }),
  /** Optional icon name */
  icon: Schema.optional(
    Schema.String.annotations({ description: 'Icon name (e.g., pencil, trash)' })
  ),
  /** Action to execute (reuses ActionSchema) */
  action: ActionSchema,
  /** Optional confirmation prompt */
  confirm: Schema.optional(
    Schema.String.annotations({
      description: 'Confirmation dialog message. Supports {count} placeholder for bulk.',
    })
  ),
}).annotations({
  title: 'Action Column Item',
  description: 'Single action button within an action column',
})

// ---------------------------------------------------------------------------
// Column definitions (discriminated by presence of `field` vs `type: actions`)
// ---------------------------------------------------------------------------

/**
 * Field column — binds to a table field with presentation overrides.
 */
export const FieldColumnSchema = Schema.Struct({
  /** Table field name this column displays */
  field: Schema.String.annotations({
    description: 'Field name from the data source table',
  }),
  /** Override header text (default: field name) */
  label: Schema.optional(Schema.String.annotations({ description: 'Column header text override' })),
  /** Pixel width */
  width: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Column width in pixels' })
    )
  ),
  /** Minimum pixel width for resize */
  minWidth: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Minimum column width in pixels' })
    )
  ),
  /** Text alignment */
  align: Schema.optional(
    Schema.Literal('left', 'center', 'right').annotations({
      description: 'Column text alignment (default: left)',
    })
  ),
  /** Pin to left side */
  frozen: Schema.optional(
    Schema.Boolean.annotations({ description: 'Pin column to left side of table' })
  ),
  /** Allow sorting on this column */
  sortable: Schema.optional(
    Schema.Boolean.annotations({ description: 'Allow column sorting (default: true)' })
  ),
  /** Allow filtering on this column */
  filterable: Schema.optional(
    Schema.Boolean.annotations({ description: 'Allow column filtering (default: true)' })
  ),
  /** Allow inline editing */
  editable: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Allow inline editing (default: from table permissions)',
    })
  ),
  /** Show/hide column */
  visible: Schema.optional(
    Schema.Boolean.annotations({ description: 'Column visibility (default: true)' })
  ),
  /** Display format override */
  format: Schema.optional(ColumnFormatSchema),
  /** Conditional cell styling rules */
  cellStyle: Schema.optional(
    Schema.Array(CellStyleConditionSchema).annotations({
      description: 'Conditional styling rules evaluated against the cell value',
    })
  ),
}).annotations({
  title: 'Field Column',
  description: 'Column bound to a table field with presentation config',
})

/**
 * Action column — renders action buttons per row (no field binding).
 */
export const ActionColumnSchema = Schema.Struct({
  /** Discriminator: always 'actions' */
  type: Schema.Literal('actions').annotations({
    description: "Must be 'actions' for an action column",
  }),
  /** Column header (often empty string) */
  label: Schema.optional(Schema.String.annotations({ description: 'Column header text' })),
  /** Pixel width */
  width: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Column width in pixels' })
    )
  ),
  /** Action buttons to render in each row */
  actions: Schema.Array(ActionColumnItemSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description: 'Action buttons rendered per row',
    })
  ),
}).annotations({
  title: 'Action Column',
  description: 'Column with action buttons (edit, delete, etc.)',
})

/**
 * Data table column — either a field column or an action column.
 */
export const DataTableColumnSchema = Schema.Union(
  FieldColumnSchema,
  ActionColumnSchema
).annotations({
  identifier: 'DataTableColumn',
  title: 'Data Table Column',
  description: 'Column definition: field column (with field) or action column (with type: actions)',
})

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/**
 * Row selection configuration.
 *
 * @example
 * ```yaml
 * selection:
 *   mode: multiple
 *   showCheckboxes: true
 * ```
 */
export const DataTableSelectionSchema = Schema.Struct({
  /** Selection mode */
  mode: Schema.Literal('none', 'single', 'multiple').annotations({
    description: 'Row selection mode (default: none)',
  }),
  /** Show checkbox column (default: true when mode is multiple) */
  showCheckboxes: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Show checkbox column (default: true when mode is multiple)',
    })
  ),
}).annotations({
  title: 'Data Table Selection',
  description: 'Row selection configuration',
})

// ---------------------------------------------------------------------------
// Pagination (data-table specific, extends concept from data-source)
// ---------------------------------------------------------------------------

/**
 * Data table pagination with UI-specific options.
 *
 * @example
 * ```yaml
 * pagination:
 *   pageSize: 25
 *   pageSizeOptions: [10, 25, 50]
 *   position: bottom
 * ```
 */
export const DataTablePaginationSchema = Schema.Struct({
  /** Default rows per page */
  pageSize: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Default rows per page (default: 25)',
        examples: [10, 25, 50],
      })
    )
  ),
  /** Dropdown options for page size */
  pageSizeOptions: Schema.optional(
    Schema.Array(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Page size dropdown options',
        examples: [[10, 25, 50, 100]],
      })
    )
  ),
  /** Position of pagination controls */
  position: Schema.optional(
    Schema.Literal('top', 'bottom', 'both').annotations({
      description: 'Position of pagination controls (default: bottom)',
    })
  ),
  /** Enable server-side pagination */
  serverSide: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Enable server-side pagination (default: false)',
    })
  ),
}).annotations({
  title: 'Data Table Pagination',
  description: 'Pagination configuration for the data table',
})

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Global search configuration for the data table.
 *
 * @example
 * ```yaml
 * search:
 *   enabled: true
 *   placeholder: Search orders...
 *   debounceMs: 300
 * ```
 */
export const DataTableSearchSchema = Schema.Struct({
  /** Enable global search */
  enabled: Schema.optional(
    Schema.Boolean.annotations({ description: 'Enable global search (default: true)' })
  ),
  /** Search input placeholder text */
  placeholder: Schema.optional(
    Schema.String.annotations({
      description: 'Search input placeholder text',
      examples: ['Search orders...', 'Type to search...'],
    })
  ),
  /** Debounce delay in milliseconds */
  debounceMs: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(0),
      Schema.annotations({
        description: 'Debounce delay for search input in ms (default: 300)',
        examples: [200, 300, 500],
      })
    )
  ),
}).annotations({
  title: 'Data Table Search',
  description: 'Global search configuration',
})

// ---------------------------------------------------------------------------
// Group by
// ---------------------------------------------------------------------------

/**
 * Grouping configuration for rows.
 *
 * @example
 * ```yaml
 * groupBy:
 *   field: status
 *   direction: asc
 *   collapsed: false
 * ```
 */
export const DataTableGroupBySchema = Schema.Struct({
  /** Field to group rows by */
  field: Schema.String.annotations({ description: 'Field name to group rows by' }),
  /** Group sort direction */
  direction: Schema.optional(
    Schema.Literal('asc', 'desc').annotations({
      description: 'Group sort direction (default: asc)',
    })
  ),
  /** Start groups collapsed */
  collapsed: Schema.optional(
    Schema.Boolean.annotations({ description: 'Start groups collapsed (default: false)' })
  ),
  /** Hide groups with no records */
  hideEmpty: Schema.optional(
    Schema.Boolean.annotations({ description: 'Hide empty groups (default: false)' })
  ),
}).annotations({
  title: 'Data Table Group By',
  description: 'Row grouping configuration',
})

// ---------------------------------------------------------------------------
// Summary row
// ---------------------------------------------------------------------------

/**
 * Aggregate function for summary rows.
 */
export const SummaryFunctionSchema = Schema.Literal(
  'count',
  'sum',
  'avg',
  'min',
  'max'
).annotations({
  title: 'Summary Function',
  description: 'Aggregate function for summary computation',
})

/**
 * Summary row item — an aggregate computation on a field.
 *
 * @example
 * ```yaml
 * summary:
 *   - field: total
 *     function: count
 *     label: Total
 *   - field: amount
 *     function: sum
 *     label: Revenue
 * ```
 */
export const DataTableSummaryItemSchema = Schema.Struct({
  /** Field to aggregate */
  field: Schema.String.annotations({ description: 'Field name to compute summary on' }),
  /** Aggregate function */
  function: SummaryFunctionSchema,
  /** Display label for the summary */
  label: Schema.optional(Schema.String.annotations({ description: 'Summary display label' })),
}).annotations({
  title: 'Summary Item',
  description: 'Single aggregate computation for the summary row',
})

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

/**
 * Toolbar control visibility flags.
 *
 * @example
 * ```yaml
 * toolbar:
 *   search: true
 *   filters: true
 *   export: true
 * ```
 */
export const DataTableToolbarSchema = Schema.Struct({
  /** Show global search input */
  search: Schema.optional(Schema.Boolean.annotations({ description: 'Show search input' })),
  /** Show filter builder UI */
  filters: Schema.optional(Schema.Boolean.annotations({ description: 'Show filter builder' })),
  /** Show sort builder UI */
  sort: Schema.optional(Schema.Boolean.annotations({ description: 'Show sort builder' })),
  /** Show CSV/JSON export button */
  export: Schema.optional(Schema.Boolean.annotations({ description: 'Show export button' })),
  /** Show manual refresh button */
  refresh: Schema.optional(Schema.Boolean.annotations({ description: 'Show refresh button' })),
  /** Show row density toggle */
  density: Schema.optional(Schema.Boolean.annotations({ description: 'Show row density toggle' })),
  /** Show column visibility toggle */
  columnToggle: Schema.optional(
    Schema.Boolean.annotations({ description: 'Show column visibility toggle' })
  ),
}).annotations({
  title: 'Data Table Toolbar',
  description: 'Toolbar control visibility configuration',
})

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------

/**
 * Bulk action that operates on selected rows.
 *
 * @example
 * ```yaml
 * bulkActions:
 *   - label: Mark Shipped
 *     icon: truck
 *     action:
 *       type: crud
 *       operation: update
 *       table: orders
 *     confirm: "Mark {count} orders as shipped?"
 * ```
 */
export const DataTableBulkActionSchema = Schema.Struct({
  /** Button label */
  label: Schema.String.annotations({ description: 'Bulk action button label' }),
  /** Optional icon name */
  icon: Schema.optional(
    Schema.String.annotations({ description: 'Icon name (e.g., truck, trash)' })
  ),
  /** Action to execute on selected rows */
  action: ActionSchema,
  /** Confirmation prompt. Supports {count} placeholder. */
  confirm: Schema.optional(
    Schema.String.annotations({
      description: 'Confirmation dialog. Supports {count} for number of selected rows.',
      examples: ['Delete {count} orders?', 'Mark {count} items as shipped?'],
    })
  ),
}).annotations({
  title: 'Bulk Action',
  description: 'Action that operates on multiple selected rows',
})

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
  /** Data source binding (table + optional view) */
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
  }).annotations({
    title: 'Data Table Data Source',
    description: 'Data binding for the table: which table (and optional view) to display',
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
  /** Global search config */
  search: Schema.optional(DataTableSearchSchema),

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

  const errors = [
    ...columnErrors,
    ...groupByErrors,
    ...summaryErrors,
    ...sortErrors,
    ...filterErrors,
  ]

  return { valid: errors.length === 0, errors }
}

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type ColumnFormat = Schema.Schema.Type<typeof ColumnFormatSchema>
export type CellStyleCondition = Schema.Schema.Type<typeof CellStyleConditionSchema>
export type ActionColumnItem = Schema.Schema.Type<typeof ActionColumnItemSchema>
export type FieldColumn = Schema.Schema.Type<typeof FieldColumnSchema>
export type ActionColumn = Schema.Schema.Type<typeof ActionColumnSchema>
export type DataTableColumn = Schema.Schema.Type<typeof DataTableColumnSchema>
export type DataTableSelection = Schema.Schema.Type<typeof DataTableSelectionSchema>
export type DataTablePagination = Schema.Schema.Type<typeof DataTablePaginationSchema>
export type DataTableSearch = Schema.Schema.Type<typeof DataTableSearchSchema>
export type DataTableGroupBy = Schema.Schema.Type<typeof DataTableGroupBySchema>
export type SummaryFunction = Schema.Schema.Type<typeof SummaryFunctionSchema>
export type DataTableSummaryItem = Schema.Schema.Type<typeof DataTableSummaryItemSchema>
export type DataTableToolbar = Schema.Schema.Type<typeof DataTableToolbarSchema>
export type DataTableBulkAction = Schema.Schema.Type<typeof DataTableBulkActionSchema>
export type RowHeight = Schema.Schema.Type<typeof RowHeightSchema>
export type DataTable = Schema.Schema.Type<typeof DataTableSchema>
