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
import { ShareOptionsSchema } from './share'
import { FormStepSchema } from './steps'
import { SubmitToSchema } from './submit-to'
import { SubmitterOptionsSchema } from './submitter'

/**
 * Form Layout Mode
 *
 * - `single-page`: All fields on one page (default).
 * - `multi-step`: Fields grouped into `steps[]` with prev/next navigation.
 * - `one-question`: One field per screen, Typeform-style.
 */
export const FormLayoutModeSchema = Schema.Literal(
  'single-page',
  'multi-step',
  'one-question'
).annotations({
  identifier: 'FormLayoutMode',
  title: 'Form Layout Mode',
  description: 'Form rendering layout mode',
})

/**
 * Form Schema
 *
 * Top-level form definition. Each form is uniquely identified by `id`
 * (numeric, server-internal) and `name` (kebab-case, used in references).
 *
 * Cross-validation against the parent `AppSchema`:
 * - `submitTo.table` must match an existing `tables[].name`
 * - `submitTo.automation` must match an existing `automations[].name`
 * - `name` must be unique across `forms[]`
 * - `id` must be unique across `forms[]`
 * - `path` must be unique across `forms[]` AND must not collide with `pages[].path`
 */
export const FormSchema = Schema.Struct({
  /** Numeric server-internal identifier (positive integer). */
  id: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.annotations({ description: 'Numeric form identifier (positive integer, unique)' })
  ),
  /** Kebab-case unique name used in cross-references. */
  name: FormNameSchema,
  /** Human-friendly title shown to submitters. Supports `$t:` i18n keys. */
  title: Schema.String.pipe(Schema.minLength(1)).annotations({
    description: 'Form title shown to submitters (supports $t: i18n keys)',
  }),
  /** Optional description / intro shown above the first field. */
  description: Schema.optional(Schema.String),
  /**
   * Optional public URL path. When set, the form is reachable at this path
   * AND at the canonical `/forms/{name}` route. When omitted, only the
   * canonical route applies.
   */
  path: Schema.optional(FormPathSchema),
  /** Where the submission is persisted and/or routed. Required. */
  submitTo: SubmitToSchema,
  /** Field definitions. At least one field required. */
  fields: Schema.Array(FormFieldSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({ description: 'Form fields in render order' })
  ),
  /** Layout mode. Default `single-page`. */
  layout: Schema.optional(FormLayoutModeSchema),
  /** Multi-step / one-question step definitions. */
  steps: Schema.optional(Schema.Array(FormStepSchema).pipe(Schema.minItems(1))),
  /** Field grouping inside single-page layouts. */
  fieldGroups: Schema.optional(Schema.Array(FormFieldGroupSchema).pipe(Schema.minItems(1))),
  /** Display / cosmetic options. */
  display: Schema.optional(FormDisplaySchema),
  /** Access control (public / authenticated / role-restricted). */
  access: Schema.optional(FormAccessSchema),
  /** Availability window and submission cap. */
  availability: Schema.optional(FormAvailabilitySchema),
  /** Anti-spam controls (honeypot, rate limit, CAPTCHA stub). */
  antiSpam: Schema.optional(AntiSpamSchema),
  /** Per-form analytics opt-out (default: enabled). */
  analytics: Schema.optional(FormAnalyticsSchema),
  /** Prefill map: form field → `$query`/`$user` reference or literal default. */
  prefill: Schema.optional(PrefillSchema),
  /** Save-and-resume / edit-after-submit / unique-submission options. */
  submitter: Schema.optional(SubmitterOptionsSchema),
  /** Post-submit success behavior. */
  onSuccess: Schema.optional(FormOnSuccessSchema),
  /** On-error behavior. */
  onError: Schema.optional(FormOnErrorSchema),
  /** Iframe embedding and external-share controls. */
  share: Schema.optional(ShareOptionsSchema),
}).annotations({
  identifier: 'Form',
  title: 'Form',
  description:
    'Top-level form definition. Reachable as a public route, embeddable, addressable from page components and automation triggers.',
})

/**
 * Forms Schema — non-empty array of `FormSchema`.
 */
export const FormsSchema = Schema.Array(FormSchema).pipe(
  Schema.minItems(1),
  Schema.annotations({
    identifier: 'Forms',
    title: 'Standalone Forms',
    description:
      'Top-level forms array. When present, must contain at least one form. Forms are addressable by name from page components and automation triggers.',
  })
)

/** @public */
export type FormLayoutMode = Schema.Schema.Type<typeof FormLayoutModeSchema>
export type Form = Schema.Schema.Type<typeof FormSchema>
/** @public */
export type Forms = Schema.Schema.Type<typeof FormsSchema>

// Re-export each sub-schema for ergonomic imports.
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
export * from './share'
export * from './steps'
export * from './submit-to'
export * from './submitter'
// VisibleWhen / ConditionOperator now live in src/domain/models/shared/visible-when.ts
// Re-export here for backward-compat consumers that imported via this barrel.
export {
  ConditionOperatorSchema,
  VisibleWhenSchema,
  type ConditionOperator,
  type VisibleWhen,
} from '../../shared/visible-when'
