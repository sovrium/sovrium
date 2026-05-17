/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Success-page action button. Each entry renders as a `<button>` on the
 * post-submit success screen and dispatches one of two predefined intents
 * (which mirror the top-level `onSuccess.type: reset` and
 * `onSuccess.type: redirect` analogs):
 *   - `action: 'reset'` returns the form to its empty initial state, ready
 *     for another submission. Equivalent to `onSuccess.type: reset`.
 *   - `action: 'navigate'` redirects the submitter to `url`. Equivalent to
 *     `onSuccess.type: redirect`. `url` is required for this variant.
 *
 * Defined as a plain Struct (rather than a discriminated union) because
 * the `url` field is only referenced when `action: 'navigate'`; downstream
 * cross-validation can warn about a stray `url` on a `reset` row without
 * blocking schema decoding.
 */
export const SuccessPageActionSchema = Schema.Struct({
  /** Button label shown on the success screen. Supports `$t:` keys. */
  label: Schema.String.pipe(Schema.minLength(1)),
  /** Behavior when the button is clicked. */
  action: Schema.Literal('reset', 'navigate'),
  /** Navigation target — required when `action: 'navigate'`. */
  url: Schema.optional(Schema.String),
}).annotations({
  identifier: 'SuccessPageAction',
  title: 'Success Page Action',
})

/**
 * Success Page — show a custom success page after submission.
 */
export const SuccessPageOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('successPage'),
  /** Heading shown on the success page. Supports `$t:` keys. */
  title: Schema.optional(Schema.String),
  /** Body message shown below the heading. Supports `$t:` keys. */
  message: Schema.optional(Schema.String),
  /** Optional button label that links the submitter back to the home page. */
  buttonLabel: Schema.optional(Schema.String),
  /** Optional URL the success page button links to. */
  buttonHref: Schema.optional(Schema.String),
  /**
   * Optional list of action buttons (`reset` and/or `navigate`) rendered
   * on the success screen. Useful for high-throughput flows where the
   * submitter wants to "submit another" without a full page reload.
   */
  actions: Schema.optional(Schema.Array(SuccessPageActionSchema)),
  /**
   * Whether to render a summary of the submitted values on the success
   * screen. The renderer ignores hidden fields and applies field-level
   * read permissions before listing values.
   */
  showSummary: Schema.optional(Schema.Boolean),
}).annotations({
  identifier: 'SuccessPageOnSuccess',
  title: 'Success Page (onSuccess)',
})

/**
 * Redirect — navigate to another URL after submission.
 */
export const RedirectOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('redirect'),
  /**
   * Target URL — absolute or path-relative. May interpolate the
   * following template variables, evaluated against the submission
   * response (`{ submissionId, linkedRecordId }`):
   *   - `$submission.id` → ledger row id (empty when `storeSubmission: false`)
   *   - `$record.id`     → bound-table row id (empty when no `submitTo.table`)
   */
  url: Schema.String.pipe(Schema.minLength(1)),
  /**
   * Delay before the navigation fires, in seconds. Default 2 — gives the
   * submitter a moment to read any flash UI rendered before the redirect.
   * `0` triggers an immediate navigation (used by tests that need a
   * deterministic post-submit URL assertion).
   */
  delaySeconds: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
}).annotations({
  identifier: 'RedirectOnSuccess',
  title: 'Redirect (onSuccess)',
})

/**
 * Reset — clear the form for another submission.
 */
export const ResetOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('reset'),
  /** Optional toast message shown after the reset. */
  message: Schema.optional(Schema.String),
  /**
   * Field names to preserve across the reset (e.g. `email` so a returning
   * user does not retype it).
   */
  preserveFields: Schema.optional(Schema.Array(Schema.String)),
}).annotations({
  identifier: 'ResetOnSuccess',
  title: 'Reset (onSuccess)',
})

/**
 * Toast — show a transient toast notification.
 */
export const ToastOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('toast'),
  message: Schema.String,
  /** Toast variant. */
  variant: Schema.optional(Schema.Literal('success', 'info')),
}).annotations({
  identifier: 'ToastOnSuccess',
  title: 'Toast (onSuccess)',
})

/**
 * Inline Message — replace the form with an inline message in place.
 */
export const MessageOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('message'),
  message: Schema.String,
}).annotations({
  identifier: 'MessageOnSuccess',
  title: 'Inline Message (onSuccess)',
})

/**
 * Form onSuccess — discriminated union of post-submit behaviors.
 */
export const FormOnSuccessSchema = Schema.Union(
  SuccessPageOnSuccessSchema,
  RedirectOnSuccessSchema,
  ResetOnSuccessSchema,
  ToastOnSuccessSchema,
  MessageOnSuccessSchema
).annotations({
  identifier: 'FormOnSuccess',
  title: 'Form onSuccess',
  description: 'Post-submit behavior. Discriminated by `type`.',
})

/** @public */
export type SuccessPageAction = Schema.Schema.Type<typeof SuccessPageActionSchema>
/** @public */
export type SuccessPageOnSuccess = Schema.Schema.Type<typeof SuccessPageOnSuccessSchema>
/** @public */
export type RedirectOnSuccess = Schema.Schema.Type<typeof RedirectOnSuccessSchema>
/** @public */
export type ResetOnSuccess = Schema.Schema.Type<typeof ResetOnSuccessSchema>
/** @public */
export type ToastOnSuccess = Schema.Schema.Type<typeof ToastOnSuccessSchema>
/** @public */
export type MessageOnSuccess = Schema.Schema.Type<typeof MessageOnSuccessSchema>
/** @public */
export type FormOnSuccess = Schema.Schema.Type<typeof FormOnSuccessSchema>
