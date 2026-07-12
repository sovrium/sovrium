/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../../action'
import { ConfirmGateSchema } from '../../../confirm-gate'
import { optStr } from '../../../shared-schemas'


export const ColumnFormatSchema = Schema.Literal(
  'truncate',
  'currency',
  'percentage',
  'compact',
  'relative-date',
  'relative-time',
  'short-date',
  'long-date',
  'datetime',
  'yes-no',
  'check-cross'
).annotations({
  title: 'Column Format',
  description:
    'Display format override for column rendering. relative-date = past-only English; relative-time = signed, locale-aware (dans N j / il y a N j) and future-capable.',
})


const ConditionValueSchema = Schema.Union(Schema.String, Schema.Number, Schema.Boolean)

const ConditionValueArraySchema = Schema.Array(ConditionValueSchema)

const ConditionOperatorsSchema = Schema.Struct({
  eq: Schema.optional(ConditionValueSchema),
  neq: Schema.optional(ConditionValueSchema),
  in: Schema.optional(ConditionValueArraySchema),
  notIn: Schema.optional(ConditionValueArraySchema),
  contains: Schema.optional(ConditionValueSchema),
  gt: Schema.optional(ConditionValueSchema),
  lt: Schema.optional(ConditionValueSchema),
  gte: Schema.optional(ConditionValueSchema),
  lte: Schema.optional(ConditionValueSchema),
}).annotations({
  title: 'Condition Operators',
  description:
    'Condition matcher: { operator: value }. Supports eq, neq, in, notIn, contains, gt, lt, gte, lte. Shared by cellStyle[].when and action visibleWhen.',
})

export const CellStyleConditionSchema = Schema.Struct({
  when: ConditionOperatorsSchema.annotations({
    description:
      'Condition matched against the cell value: { operator: value }. Supports eq, neq, in, notIn, contains, gt, lt, gte, lte.',
  }),
  className: Schema.String.annotations({
    description: 'Tailwind CSS classes applied when the condition is met',
    examples: ['bg-green-50 text-green-700', 'bg-red-50 text-red-400 line-through'],
  }),
}).annotations({
  title: 'Cell Style Condition',
  description: 'Conditional styling rule for table cells',
})


const actionVisibleWhenSchema = Schema.Struct({
  field: Schema.String.annotations({
    description: 'Row field whose value the visibility predicate is matched against',
  }),
  ...ConditionOperatorsSchema.fields,
}).annotations({
  title: 'Action Visible When',
  description:
    'Per-row visibility predicate: the action renders only on rows whose `field` value satisfies the operator(s). Reuses the shared condition vocabulary (eq, neq, in, notIn, contains, gt, lt, gte, lte). Omit to show the action on every row.',
})


const EditSelectOptionSchema = Schema.Struct({
  value: Schema.String.annotations({
    description: 'Option value submitted on commit (overrides $record.<field> in the action body)',
  }),
  label: optStr('Option display label (defaults to value)'),
}).annotations({
  title: 'Edit Select Option',
  description: 'A single { value, label? } option in an inline select-edit dropdown',
})

export const EditSelectSchema = Schema.Struct({
  field: Schema.String.annotations({
    description:
      'Row field edited: its value preselects the dropdown and the picked value overrides $record.<field> at dispatch',
  }),
  label: Schema.String.annotations({
    description: 'Accessible name (aria-label) of the inline select control',
  }),
  options: Schema.Array(EditSelectOptionSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({ description: 'Select options ({ value, label? }); at least one required' })
  ),
  saveLabel: optStr('Commit button label (defaults to "Enregistrer")'),
}).annotations({
  title: 'Edit Select',
  description:
    'Inline single-select editor for an action item: the trigger reveals a per-row <select> whose picked value overrides $record.<field> in the item action (POSTing an arbitrary endpoint), then composes with the action onSuccess.refetch.',
})

export const ActionColumnItemSchema = Schema.Struct({
  label: Schema.String.annotations({ description: 'Action button label' }),
  icon: Schema.optional(
    Schema.String.annotations({ description: 'Icon name (e.g., pencil, trash)' })
  ),
  action: ActionSchema,
  editSelect: Schema.optional(EditSelectSchema),
  confirm: Schema.optional(ConfirmGateSchema),
  visibleWhen: Schema.optional(actionVisibleWhenSchema),
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
  valueLabels: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }).annotations({
      title: 'Value Labels',
      description:
        'Map of raw cell value -> display label, applied at render time only (does not mutate the record value or the API contract). Unmapped values render verbatim.',
      examples: [{ active: 'Actif', oauth2: 'OAuth2' }],
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
export type EditSelect = Schema.Schema.Type<typeof EditSelectSchema>
export type ActionColumnItem = Schema.Schema.Type<typeof ActionColumnItemSchema>
export type FieldColumn = Schema.Schema.Type<typeof FieldColumnSchema>
export type ActionColumn = Schema.Schema.Type<typeof ActionColumnSchema>
export type DataTableColumn = Schema.Schema.Type<typeof DataTableColumnSchema>
