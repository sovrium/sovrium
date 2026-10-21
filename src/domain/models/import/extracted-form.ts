/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Contract between the page migration converter and the forms mapper of
 * `sovrium import`.
 *
 * A site export carries its forms inside its pages: a Webflow page holds a
 * `<form>` with its inputs, its action, its redirect and its success and error
 * messages. The page converter (`planMigratedPages`) owns the PAGE — it emits a
 * `form` node that references the form by name — and returns each form it
 * found as an `ExtractedForm`. The forms mapper owns the FORM as data — the
 * `forms[]` entry, the `<form>_responses` table it writes to, and any seed
 * records — and reads only this shape.
 *
 * ─── ORDER, AND ONE DECODE ────────────────────────────────────────────────
 *
 * The page converter runs first, then the forms mapper; the whole migrated app
 * is decoded against AppSchema once, before any file is written. A page whose
 * form reference resolves to no emitted form is refused.
 *
 * ─── NO RESPONSE DATA ─────────────────────────────────────────────────────
 *
 * A site export holds no submissions (Webflow's form processing is not
 * exported), and this shape has nowhere to put one. Responses reach a migrated
 * form only from a form tool's own API or export, through the data path.
 *
 * ─── THE NAME IS THE JOIN ─────────────────────────────────────────────────
 *
 * `name` is a deterministic slug of the form, the same on every run of the same
 * export, and is the one value both sides write: the page's `form` node
 * references it, and the `forms[]` entry carries it. It follows the form-name
 * rule (kebab-case, starting with a letter, 64 characters at most).
 */

/** The input types a site-export form field can carry. */
export const extractedFormInputTypeSchema = Schema.Literals([
  'text',
  'email',
  'tel',
  'url',
  'number',
  'date',
  'datetime-local',
  'time',
  'password',
  'textarea',
  'select',
  'checkbox',
  'radio',
  'file',
  'hidden',
]).annotate({
  description:
    'The control the source page drew: an `<input>` type, a `<textarea>` or a `<select>`. A `password` input is never migrated as a password; the forms mapper reports it',
})

/** One field of an extracted form. */
export const extractedFormFieldSchema = Schema.Struct({
  name: Schema.String.annotate({
    description: 'The `name` the source input submitted under',
    examples: ['email', 'company-size'],
  }).check(Schema.isMinLength(1)),
  label: Schema.optional(
    Schema.String.annotate({ description: 'The label the page showed for the input' })
  ),
  inputType: extractedFormInputTypeSchema,
  required: Schema.Boolean.annotate({ description: 'Whether the page marked the input required' }),
  options: Schema.optional(
    Schema.Array(
      Schema.Struct({
        value: Schema.String.annotate({ description: 'The value submitted' }),
        label: Schema.String.annotate({ description: 'The text shown' }),
      }).annotate({ strictKeys: true, title: 'sovrium:strict-keys' })
    ).annotate({ description: 'The choices of a select, a radio group or a checkbox group' })
  ),
  placeholder: Schema.optional(
    Schema.String.annotate({ description: 'The placeholder the input showed' })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ExtractedFormField',
})

/**
 * One form found on a migrated page.
 *
 * @public Authored ahead of the page migration converter, which returns it.
 */
export const extractedFormSchema = Schema.Struct({
  sourceId: Schema.String.annotate({
    description:
      "The form's identity in the export: Webflow's `data-wf-element-id` when present, otherwise the page path and the form's position in it",
    examples: ['6a1f0c2e-91d4-7b3e-0c55-2f1e8a4d9b10', '/contact#form-0'],
  }).check(Schema.isMinLength(1)),
  name: Schema.String.annotate({
    description:
      'A deterministic kebab-case slug; the page node references the form by it and the forms entry carries it',
    examples: ['contact', 'newsletter-signup'],
  }).check(Schema.isMinLength(1), Schema.isMaxLength(64), Schema.isPattern(/^[a-z][a-z0-9-]*$/)),
  title: Schema.optional(
    Schema.String.annotate({
      description:
        "The form's title as its author named it: Webflow's `data-name`, else its `name`, else the first heading of the form block",
      examples: ['Mooring request', 'Newsletter sign-up'],
    })
  ),
  fields: Schema.Array(extractedFormFieldSchema).annotate({
    description: 'The fields, in page order',
  }),
  action: Schema.optional(
    Schema.String.annotate({ description: 'The `action` URL the source form posted to' })
  ),
  method: Schema.optional(
    Schema.Literals(['get', 'post']).annotate({ description: 'The HTTP method, lower-case' })
  ),
  redirect: Schema.optional(
    Schema.String.annotate({ description: 'Where the respondent was sent after submitting' })
  ),
  successMessage: Schema.optional(
    Schema.String.annotate({ description: 'The message shown after a successful submission' })
  ),
  errorMessage: Schema.optional(
    Schema.String.annotate({ description: 'The message shown when the submission failed' })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ExtractedForm',
  description: 'A form found on a migrated page, with its fields and messages and no responses.',
})

/** @public */
export type ExtractedForm = typeof extractedFormSchema.Type
/** @public */
export type ExtractedFormField = typeof extractedFormFieldSchema.Type
