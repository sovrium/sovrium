/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../../action'
import { optStr } from '../../../shared-schemas'

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
  /** Condition matcher: operator -> value (at least one operator required) */
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
 * Field column -- binds to a table field with presentation overrides.
 */
export const FieldColumnSchema = Schema.Struct({
  /** Table field name this column displays */
  field: Schema.String.annotations({
    description: 'Field name from the data source table',
  }),
  /** Override header text (default: field name) */
  label: optStr('Column header text override'),
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
 * Action column -- renders action buttons per row (no field binding).
 */
export const ActionColumnSchema = Schema.Struct({
  /** Discriminator: always 'actions' */
  type: Schema.Literal('actions').annotations({
    description: "Must be 'actions' for an action column",
  }),
  /** Column header (often empty string) */
  label: optStr('Column header text'),
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
 * Data table column -- either a field column or an action column.
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
// Type exports
// ---------------------------------------------------------------------------

export type ColumnFormat = Schema.Schema.Type<typeof ColumnFormatSchema>
export type CellStyleCondition = Schema.Schema.Type<typeof CellStyleConditionSchema>
export type ActionColumnItem = Schema.Schema.Type<typeof ActionColumnItemSchema>
export type FieldColumn = Schema.Schema.Type<typeof FieldColumnSchema>
export type ActionColumn = Schema.Schema.Type<typeof ActionColumnSchema>
export type DataTableColumn = Schema.Schema.Type<typeof DataTableColumnSchema>
