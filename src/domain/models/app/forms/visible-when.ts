/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Condition operator for field visibility / required / disabled rules.
 *
 * This schema is the home for the cross-cutting condition primitive used by
 * both top-level forms (`src/domain/models/app/forms/`) and the legacy in-page
 * form component (`src/domain/models/app/pages/components/component-types/data/form/`).
 *
 * Lives in the `forms` slug rather than `pages`: three of its four importers
 * are forms files and the fourth is a page component that is itself a form, so
 * this placement costs ONE `pages` -> `forms` edge where the reverse would have
 * cost four. The page-component schema re-exports from this file to avoid a
 * circular dependency (pages imports forms via `formRef`).
 */
export const ConditionOperatorSchema = Schema.Literals([
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
  'notIn',
]).annotate({
  identifier: 'ConditionOperator',
  title: 'Condition Operator',
  description: 'Comparison operator for conditional field visibility / required / disabled rules',
})

/**
 * Simple conditional rule: evaluates `field`'s current value against `value`
 * using `operator`.
 *
 * `value` accepts a scalar (string / number / boolean) for the comparison
 * operators (`eq`, `neq`, `contains`, `gt`, `gte`, `lt`, `lte`) AND an array
 * of scalars for the membership operators (`in`, `notIn`). The `empty` and
 * `notEmpty` operators ignore `value` entirely; making it `optional` here
 * keeps those shapes valid.
 */
export const VisibleWhenSchema = Schema.Struct({
  /** Field whose value is evaluated. */
  field: Schema.String.pipe(Schema.check(Schema.isMinLength(1))).annotate({
    description: 'Field name whose value is evaluated for the condition',
  }),
  /** Comparison operator. */
  operator: ConditionOperatorSchema,
  /** Value to compare against (not required for empty / notEmpty; array for in / notIn). */
  value: Schema.optional(
    Schema.Union([
      Schema.String,
      Schema.Finite,
      Schema.Boolean,
      Schema.Array(Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])),
    ]).annotate({
      description:
        'Value to compare the field against (scalar for eq/neq/contains/gt/gte/lt/lte; array for in/notIn)',
    })
  ),
}).annotate({
  identifier: 'VisibleWhen',
  title: 'Visible-When Condition',
  description: 'Condition that controls visibility / required / disabled state of a form field',
})

export type ConditionOperator = Schema.Schema.Type<typeof ConditionOperatorSchema>
export type VisibleWhen = Schema.Schema.Type<typeof VisibleWhenSchema>

// ---------------------------------------------------------------------------
// Compound condition supporting OR / AND logic
// ---------------------------------------------------------------------------

/**
 * Recursive condition type for compound OR / AND logic.
 *
 * Supports:
 * - Simple condition: `{ field, operator, value? }`
 * - OR: `{ or: VisibleWhenCondition[] }` — true if ANY child is true
 * - AND: `{ and: VisibleWhenCondition[] }` — true if ALL children are true
 */
export type VisibleWhenCondition =
  | VisibleWhen
  | { readonly or: readonly VisibleWhenCondition[] }
  | { readonly and: readonly VisibleWhenCondition[] }

/**
 * Extended condition schema supporting compound OR / AND logic.
 *
 * Used in form field configs for `visibleWhen`, `requiredWhen`, and `disabledWhen`.
 * The compound variants are listed first so Effect Schema tries them before the
 * simple struct (union discrimination by presence of `or`/`and` key).
 */
export const VisibleWhenConditionSchema: Schema.Codec<VisibleWhenCondition> = Schema.Union([
  Schema.Struct({
    or: Schema.Array(
      Schema.suspend((): Schema.Codec<VisibleWhenCondition> => VisibleWhenConditionSchema)
    ),
  }),
  Schema.Struct({
    and: Schema.Array(
      Schema.suspend((): Schema.Codec<VisibleWhenCondition> => VisibleWhenConditionSchema)
    ),
  }),
  VisibleWhenSchema,
]).annotate({
  identifier: 'VisibleWhenCondition',
  title: 'Visible-When Condition (with OR/AND)',
  description:
    'Condition supporting simple comparisons and compound OR/AND logic for field visibility, required, and disabled states',
})
