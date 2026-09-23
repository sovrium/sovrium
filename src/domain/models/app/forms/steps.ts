/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { VisibleWhenSchema } from './visible-when'

/**
 * Branching rule: if `when` evaluates true, jump to `goTo` step instead of
 * the linear next step.
 */
export const GoToRuleSchema = Schema.Struct({
  /** Condition that, when true, causes the branch to take effect. */
  when: VisibleWhenSchema,
  /** Target step id. Must match a `steps[].id` in the same form. */
  goTo: Schema.String.annotate({
    howTo:
      'It has to name a `steps[].id` of the same form. When no rule matches, the visitor simply goes to the next step in order.',
    description: 'Id of the step the visitor is taken to when the condition holds.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
}).annotate({
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
  id: Schema.String.annotate({
    description:
      'Identifier for this step, unique within the form; branching rules jump to a step by this id.',
  }).pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(64))),
  /** Step title shown above the fields. */
  title: Schema.optional(
    Schema.String.annotate({ description: "Heading shown above this step's fields." })
  ),
  /** Step description / intro paragraph. */
  description: Schema.optional(
    Schema.String.annotate({
      description: "Introductory paragraph shown under this step's heading.",
    })
  ),
  /**
   * Field names that belong to this step. Each name must match a field's
   * `name` (standalone/calculation/signature) or `column` (table-field) on
   * the parent form.
   */
  fields: Schema.Array(
    Schema.String.annotate({ description: 'One field name, as the form declares it' })
  )
    .annotate({
      description:
        'Fields shown on this step, named as they are on the form. Every field of a multi-step form belongs to exactly one step.',
    })
    .pipe(Schema.check(Schema.isMinLength(1))),
  /** When false, the entire step is skipped. */
  visibleWhen: Schema.optional(VisibleWhenSchema),
  /** Branching rules. First matching rule wins; otherwise linear flow. */
  goToWhen: Schema.optional(
    Schema.Array(GoToRuleSchema).annotate({
      description:
        'Branching rules evaluated when the visitor leaves this step; the first one that matches decides where they go next, otherwise the next step follows.',
    })
  ),
}).annotate({
  identifier: 'FormStep',
  title: 'Form Step',
  description:
    'A single step in a multi-step or one-question form. Bundles a subset of fields, with optional visibility and branching rules.',
})

/** @public */
export type GoToRule = Schema.Schema.Type<typeof GoToRuleSchema>
/** @public */
export type FormStep = Schema.Schema.Type<typeof FormStepSchema>
