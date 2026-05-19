/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ConditionOperatorSchema = Schema.Literal(
  'eq',
  'neq',
  'contains',
  'empty',
  'notEmpty',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'notIn'
).annotations({
  identifier: 'ConditionOperator',
  title: 'Condition Operator',
  description: 'Comparison operator for conditional field visibility / required / disabled rules',
})

export const VisibleWhenSchema = Schema.Struct({
  field: Schema.String.pipe(Schema.minLength(1)).annotations({
    description: 'Field name whose value is evaluated for the condition',
  }),
  operator: ConditionOperatorSchema,
  value: Schema.optional(
    Schema.Union(
      Schema.String,
      Schema.Number,
      Schema.Boolean,
      Schema.Array(Schema.Union(Schema.String, Schema.Number, Schema.Boolean))
    ).annotations({
      description:
        'Value to compare the field against (scalar for eq/neq/contains/gt/gte/lt/lte; array for in/notIn)',
    })
  ),
}).annotations({
  identifier: 'VisibleWhen',
  title: 'Visible-When Condition',
  description: 'Condition that controls visibility / required / disabled state of a form field',
})

export type ConditionOperator = Schema.Schema.Type<typeof ConditionOperatorSchema>
export type VisibleWhen = Schema.Schema.Type<typeof VisibleWhenSchema>


export type VisibleWhenCondition =
  | VisibleWhen
  | { readonly or: readonly VisibleWhenCondition[] }
  | { readonly and: readonly VisibleWhenCondition[] }

export const VisibleWhenConditionSchema: Schema.Schema<VisibleWhenCondition> = Schema.Union(
  Schema.Struct({
    or: Schema.Array(
      Schema.suspend((): Schema.Schema<VisibleWhenCondition> => VisibleWhenConditionSchema)
    ),
  }),
  Schema.Struct({
    and: Schema.Array(
      Schema.suspend((): Schema.Schema<VisibleWhenCondition> => VisibleWhenConditionSchema)
    ),
  }),
  VisibleWhenSchema
).annotations({
  identifier: 'VisibleWhenCondition',
  title: 'Visible-When Condition (with OR/AND)',
  description:
    'Condition supporting simple comparisons and compound OR/AND logic for field visibility, required, and disabled states',
})
