/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FormAccessSchema } from './access'
import { FormAnalyticsSchema } from './analytics'
import { AntiSpamSchema } from './anti-spam'
import { FormAvailabilitySchema } from './availability'
import { FormDisplaySchema } from './display'
import { FormFieldGroupSchema } from './field-groups'
import { FormFieldSchema } from './fields'
import { FormNameSchema } from './name'
import { FormOnErrorSchema } from './on-error'
import { FormOnSuccessSchema } from './on-success'
import { FormPathSchema } from './path'
import { PrefillSchema } from './prefill'
import { FormStepSchema } from './steps'
import { SubmitToSchema } from './submit-to'
import { SubmitterOptionsSchema } from './submitter'

export const FormLayoutModeSchema = Schema.Literal(
  'single-page',
  'multi-step',
  'one-question'
).annotations({
  identifier: 'FormLayoutMode',
  title: 'Form Layout Mode',
  description: 'Form rendering layout mode',
})

export const FormSchema = Schema.Struct({
  id: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.annotations({ description: 'Numeric form identifier (positive integer, unique)' })
  ),
  name: FormNameSchema,
  title: Schema.String.pipe(Schema.minLength(1)).annotations({
    description: 'Form title shown to submitters (supports $t: i18n keys)',
  }),
  description: Schema.optional(Schema.String),
  path: Schema.optional(FormPathSchema),
  submitTo: SubmitToSchema,
  fields: Schema.Array(FormFieldSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({ description: 'Form fields in render order' })
  ),
  layout: Schema.optional(FormLayoutModeSchema),
  steps: Schema.optional(Schema.Array(FormStepSchema).pipe(Schema.minItems(1))),
  fieldGroups: Schema.optional(Schema.Array(FormFieldGroupSchema).pipe(Schema.minItems(1))),
  display: Schema.optional(FormDisplaySchema),
  access: Schema.optional(FormAccessSchema),
  availability: Schema.optional(FormAvailabilitySchema),
  antiSpam: Schema.optional(AntiSpamSchema),
  analytics: Schema.optional(FormAnalyticsSchema),
  prefill: Schema.optional(PrefillSchema),
  submitter: Schema.optional(SubmitterOptionsSchema),
  onSuccess: Schema.optional(FormOnSuccessSchema),
  onError: Schema.optional(FormOnErrorSchema),
}).annotations({
  identifier: 'Form',
  title: 'Form',
  description:
    'Top-level form definition. Reachable as a public route, embeddable, addressable from page components and automation triggers.',
})

export const FormsSchema = Schema.Array(FormSchema).pipe(
  Schema.minItems(1),
  Schema.annotations({
    identifier: 'Forms',
    title: 'Standalone Forms',
    description:
      'Top-level forms array. When present, must contain at least one form. Forms are addressable by name from page components and automation triggers.',
  })
)

export type FormLayoutMode = Schema.Schema.Type<typeof FormLayoutModeSchema>
export type Form = Schema.Schema.Type<typeof FormSchema>
export type Forms = Schema.Schema.Type<typeof FormsSchema>

export * from './access'
export * from './analytics'
export * from './anti-spam'
export * from './availability'
export * from './display'
export * from './fields'
export * from './field-groups'
export * from './name'
export * from './on-error'
export * from './on-success'
export * from './path'
export * from './prefill'
export * from './steps'
export * from './submit-to'
export * from './submitter'
export {
  ConditionOperatorSchema,
  VisibleWhenSchema,
  type ConditionOperator,
  type VisibleWhen,
} from '../../shared/visible-when'
