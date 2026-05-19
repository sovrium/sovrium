/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../../action'
import { optStr } from '../../../shared-schemas'


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


const ConditionValueSchema = Schema.Union(Schema.String, Schema.Number, Schema.Boolean)

export const CellStyleConditionSchema = Schema.Struct({
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
  className: Schema.String.annotations({
    description: 'Tailwind CSS classes applied when the condition is met',
    examples: ['bg-green-50 text-green-700', 'bg-red-50 text-red-400 line-through'],
  }),
}).annotations({
  title: 'Cell Style Condition',
  description: 'Conditional styling rule for table cells',
})


export const ActionColumnItemSchema = Schema.Struct({
  label: Schema.String.annotations({ description: 'Action button label' }),
  icon: Schema.optional(
    Schema.String.annotations({ description: 'Icon name (e.g., pencil, trash)' })
  ),
  action: ActionSchema,
  confirm: Schema.optional(
    Schema.String.annotations({
      description: 'Confirmation dialog message. Supports {count} placeholder for bulk.',
    })
  ),
}).annotations({
  title: 'Action Column Item',
  description: 'Single action button within an action column',
})


export const FieldColumnSchema = Schema.Struct({
  field: Schema.String.annotations({
    description: 'Field name from the data source table',
  }),
  label: optStr('Column header text override'),
  width: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Column width in pixels' })
    )
  ),
  minWidth: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Minimum column width in pixels' })
    )
  ),
  align: Schema.optional(
    Schema.Literal('left', 'center', 'right').annotations({
      description: 'Column text alignment (default: left)',
    })
  ),
  frozen: Schema.optional(
    Schema.Boolean.annotations({ description: 'Pin column to left side of table' })
  ),
  sortable: Schema.optional(
    Schema.Boolean.annotations({ description: 'Allow column sorting (default: true)' })
  ),
  filterable: Schema.optional(
    Schema.Boolean.annotations({ description: 'Allow column filtering (default: true)' })
  ),
  editable: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Allow inline editing (default: from table permissions)',
    })
  ),
  visible: Schema.optional(
    Schema.Boolean.annotations({ description: 'Column visibility (default: true)' })
  ),
  format: Schema.optional(ColumnFormatSchema),
  cellStyle: Schema.optional(
    Schema.Array(CellStyleConditionSchema).annotations({
      description: 'Conditional styling rules evaluated against the cell value',
    })
  ),
}).annotations({
  title: 'Field Column',
  description: 'Column bound to a table field with presentation config',
})

export const ActionColumnSchema = Schema.Struct({
  type: Schema.Literal('actions').annotations({
    description: "Must be 'actions' for an action column",
  }),
  label: optStr('Column header text'),
  width: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Column width in pixels' })
    )
  ),
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

export const DataTableColumnSchema = Schema.Union(
  FieldColumnSchema,
  ActionColumnSchema
).annotations({
  identifier: 'DataTableColumn',
  title: 'Data Table Column',
  description: 'Column definition: field column (with field) or action column (with type: actions)',
})


export type ColumnFormat = Schema.Schema.Type<typeof ColumnFormatSchema>
export type CellStyleCondition = Schema.Schema.Type<typeof CellStyleConditionSchema>
export type ActionColumnItem = Schema.Schema.Type<typeof ActionColumnItemSchema>
export type FieldColumn = Schema.Schema.Type<typeof FieldColumnSchema>
export type ActionColumn = Schema.Schema.Type<typeof ActionColumnSchema>
export type DataTableColumn = Schema.Schema.Type<typeof DataTableColumnSchema>
