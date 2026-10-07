/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'

/**
 * The failures a form submission is refused with, each carrying what the route
 * needs to answer it.
 */

/**
 * Form not found in the running app's `forms[]` array.
 */
export class FormNotFoundError extends Data.TaggedError('FormNotFoundError')<{
  readonly formName: string
}> {}

/**
 * Form-level required-field check failed (`fields[].required: true` set
 * by the form author, independent of whether the bound table column is
 * required). Surfaces as 400 in the route layer with the same
 * `fieldErrors` envelope used for column-level rejections so client UIs
 * can show a single inline error per field.
 */
export class FormFieldRequiredError extends Data.TaggedError('FormFieldRequiredError')<{
  readonly fieldName: string
  readonly message: string
}> {}

/**
 * Form field write violated a foreign-key constraint (typically a `user`-typed
 * column that auto-FKs to `auth_user.id` receiving a string that is not a real
 * user id). Surfaces as 400 with `fieldErrors` so the form-renderer can show
 * an inline error against the offending field instead of the previous opaque
 * 422 `{error:'submission_invalid', message:'Failed to create record in X'}`.

 */
export class FormFieldForeignKeyError extends Data.TaggedError('FormFieldForeignKeyError')<{
  readonly fieldName: string
  readonly message: string
}> {}

/** The field error a reference to a row that does not exist gets. */
export const missingRowError = (fieldName: string | undefined) =>
  new FormFieldForeignKeyError({
    fieldName: fieldName ?? '',
    message: `${fieldName ?? ''} references a record that does not exist`.trimStart(),
  })

/** A link the form did not offer, or a hidden link it did not render, is answered as a missing row. */
export const refuseAsMissingRow = (fieldName: string | undefined) =>
  fieldName === undefined ? Effect.void : Effect.fail(missingRowError(fieldName))

/**
 * Submission rejected because the form is not yet open (`availability.opensAt`
 * is in the future). Surfaces as 403 `{ error: 'form not yet open', opensAt }`.
 */
export class FormNotYetOpenError extends Data.TaggedError('FormNotYetOpenError')<{
  readonly opensAt: string
}> {}

/**
 * Submission rejected because the form has closed (`availability.closesAt` is
 * in the past). Surfaces as 403 `{ error: 'form closed', closedAt }`.
 */
export class FormClosedError extends Data.TaggedError('FormClosedError')<{
  readonly closedAt: string
}> {}
