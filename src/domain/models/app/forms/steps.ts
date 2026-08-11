/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { VisibleWhenSchema } from '../../shared/visible-when'

/**
 * Branching rule: if `when` evaluates true, jump to `goTo` step instead of
 * the linear next step.
 */
export const GoToRuleSchema = Schema.Struct({
  /** Condition that, when true, causes the branch to take effect. */
  when: VisibleWhenSchema,
  /** Target step id. Must match a `steps[].id` in the same form. */
  goTo: Schema.String.pipe(Schema.minLength(1)),
}).annotations({
  identifier: 'GoToRule',
  title: 'Go-To Rule',
  description: 'Branching rule: when condition is true, jump to a specific step',
})

/**
 * Form Step
 *
 * A single step in a multi-step or one-question-at-a-time layout. Bundles a
 * subset of the form's fields, optional title/description, optional whole-step
 * visibility rule, and optional branching rules that override linear flow.
 */
export const FormStepSchema = Schema.Struct({
  /** Unique step id within the form (kebab-case recommended). */
  id: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(64)),
  /** Step title shown above the fields. */
  title: Schema.optional(Schema.String),
  /** Step description / intro paragraph. */
  description: Schema.optional(Schema.String),
  /**
   * Field names that belong to this step. Each name must match a field's
   * `name` (standalone/calculation/signature) or `column` (table-field) on
   * the parent form.
   */
  fields: Schema.Array(Schema.String).pipe(Schema.minItems(1)),
  /** When false, the entire step is skipped. */
  visibleWhen: Schema.optional(VisibleWhenSchema),
  /** Branching rules. First matching rule wins; otherwise linear flow. */
  goToWhen: Schema.optional(Schema.Array(GoToRuleSchema)),
}).annotations({
  identifier: 'FormStep',
  title: 'Form Step',
  description:
    'A single step in a multi-step or one-question form. Bundles a subset of fields, with optional visibility and branching rules.',
})

/** @public */
export type GoToRule = Schema.Schema.Type<typeof GoToRuleSchema>
/** @public */
export type FormStep = Schema.Schema.Type<typeof FormStepSchema>
