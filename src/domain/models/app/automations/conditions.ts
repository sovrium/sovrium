/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { listValueRefusal } from './condition-validation'
import { TemplateStringSchema } from './template'

/**
 * Comparison operators for filter conditions
 */
export const ComparisonOperatorSchema = Schema.Literals([
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
  'matches',
  'in',
  'notIn',
]).pipe(
  Schema.annotate({
    identifier: 'ComparisonOperator',
    title: 'Comparison Operator',
    description:
      'Operator for comparing values in filter conditions. `in` keeps a value that is one of a list and `notIn` one that is none of it; a missing value is in no list and outside none. `matches` tests a regular expression and is refused in the filter of a record step, which runs in the database.',
  })
)

/** @public */
export type ComparisonOperator = Schema.Schema.Type<typeof ComparisonOperatorSchema>

/**
 * Single filter condition
 *
 * Evaluates: field <operator> value
 * The `field` may use template variables: {{trigger.data.status}}
 */
export const ConditionSchema = Schema.Struct({
  /** Field path or template variable to evaluate */
  field: TemplateStringSchema.pipe(
    Schema.annotate({ description: 'Field path or template variable to evaluate' })
  ),

  /** Comparison operator */
  operator: ComparisonOperatorSchema,

  /**
   * Value to compare against (optional for isEmpty/isNull operators). `in` and
   * `notIn` take a list, or one whole template resolving to a list; a single
   * value is a list of one.
   */
  value: Schema.optional(
    Schema.Union([
      Schema.String,
      Schema.Finite,
      Schema.Boolean,
      Schema.Null,
      Schema.Array(Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null])),
    ]).pipe(
      Schema.annotate({
        description:
          'Value to compare against. For `in` and `notIn`, a list of values, or one whole template such as `{{trigger.data.statuses}}` that resolves to a list; a single value is read as a list of one. A list on any other operator is refused.',
      })
    )
  ),
}).pipe(
  // The refusal of a list value is a `makeFilter`, which has no JSON Schema form: it
  // goes BEFORE the annotation, or the annotation lands on it and the published
  // `Condition` definition disappears from app.json.
  Schema.check(Schema.makeFilter((condition) => listValueRefusal(condition))),
  Schema.annotate({
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
      {
        field: 'status',
        operator: 'in' as const,
        value: ['active', 'past-due'],
      },
    ],
  })
)

/** @public */
export type Condition = Schema.Schema.Type<typeof ConditionSchema>

/**
 * Condition group with AND/OR logic
 */
export const ConditionGroupSchema = Schema.Struct({
  /** Logical operator for combining conditions */
  logic: Schema.optional(
    Schema.Literals(['and', 'or']).pipe(
      Schema.annotate({
        description: 'Logical operator: and (all must match) or or (any must match). Default: and',
      })
    )
  ),

  /** Array of conditions */
  conditions: Schema.Array(ConditionSchema).pipe(
    Schema.annotate({ description: 'One or more conditions to evaluate' }),
    Schema.check(Schema.isMinLength(1))
  ),
}).pipe(
  Schema.annotate({
    identifier: 'ConditionGroup',
    title: 'Condition Group',
    description: 'Group of conditions combined with AND/OR logic',
  })
)

export type ConditionGroup = Schema.Schema.Type<typeof ConditionGroupSchema>
