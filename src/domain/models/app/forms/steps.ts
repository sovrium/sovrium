/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { VisibleWhenSchema } from '../../shared/visible-when'

export const GoToRuleSchema = Schema.Struct({
  when: VisibleWhenSchema,
  goTo: Schema.String.pipe(Schema.minLength(1)),
}).annotations({
  identifier: 'GoToRule',
  title: 'Go-To Rule',
  description: 'Branching rule: when condition is true, jump to a specific step',
})

export const FormStepSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(64)),
  title: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  fields: Schema.Array(Schema.String).pipe(Schema.minItems(1)),
  visibleWhen: Schema.optional(VisibleWhenSchema),
  goToWhen: Schema.optional(Schema.Array(GoToRuleSchema)),
}).annotations({
  identifier: 'FormStep',
  title: 'Form Step',
  description:
    'A single step in a multi-step or one-question form. Bundles a subset of fields, with optional visibility and branching rules.',
})

export type GoToRule = Schema.Schema.Type<typeof GoToRuleSchema>
export type FormStep = Schema.Schema.Type<typeof FormStepSchema>
