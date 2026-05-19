/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from './template'

export const ComparisonOperatorSchema = Schema.Literal(
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'isEmpty',
  'isNotEmpty',
  'isNull',
  'isNotNull',
  'matches'
).pipe(
  Schema.annotations({
    identifier: 'ComparisonOperator',
    title: 'Comparison Operator',
    description: 'Operator for comparing values in filter conditions',
  })
)

export type ComparisonOperator = Schema.Schema.Type<typeof ComparisonOperatorSchema>

export const ConditionSchema = Schema.Struct({
  field: TemplateStringSchema.pipe(
    Schema.annotations({ description: 'Field path or template variable to evaluate' })
  ),

  operator: ComparisonOperatorSchema,

  value: Schema.optional(
    Schema.Union(Schema.String, Schema.Number, Schema.Boolean, Schema.Null).pipe(
      Schema.annotations({ description: 'Value to compare against' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'Condition',
    title: 'Filter Condition',
    description: 'Single comparison condition for filtering or branching',
    examples: [
      {
        field: '{{trigger.data.status}}',
        operator: 'equals' as const,
        value: 'active',
      },
      {
        field: '{{fetchUser.response.body.email}}',
        operator: 'isNotEmpty' as const,
      },
    ],
  })
)

export type Condition = Schema.Schema.Type<typeof ConditionSchema>

export const ConditionGroupSchema = Schema.Struct({
  logic: Schema.optional(
    Schema.Literal('and', 'or').pipe(
      Schema.annotations({
        description: 'Logical operator: and (all must match) or or (any must match). Default: and',
      })
    )
  ),

  conditions: Schema.Array(ConditionSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({ description: 'One or more conditions to evaluate' })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'ConditionGroup',
    title: 'Condition Group',
    description: 'Group of conditions combined with AND/OR logic',
  })
)

export type ConditionGroup = Schema.Schema.Type<typeof ConditionGroupSchema>
