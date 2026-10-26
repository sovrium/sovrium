/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'
import { findConstraintViolation } from '@/domain/errors/driver-failure'
import { languageUniqueBaseField } from '@/domain/models/app/tables/translatable-unique-service'

/**
 * A bound-table write the database refused on a rule about ONE submitted
 * value — a value already on file in a unique column, a value outside a
 * column's accepted set, or a required column left empty. Surfaces as 400 with
 * `fieldErrors` so the form runtime draws the reason under the field to
 * change, instead of a generic toast naming nothing.
 *
 * `fieldName` is only ever a key of the submitted payload (the write path
 * attributes the refusal against the caller's own keys — standing rule S4).
 */
export class FormFieldConstraintError extends Data.TaggedError('FormFieldConstraintError')<{
  readonly fieldName: string
  readonly message: string
}> {}

/** What the visitor reads under the refused field, per constraint class. */
const FIELD_REFUSAL_MESSAGES = {
  unique: 'This value is already in use',
  check: 'This value is not accepted',
  'not-null': 'This field is required',
} as const

/**
 * The field-level refusal a uniqueness violation carries, or `undefined` when
 * the write path could not attribute it to a submitted column.
 */
export const uniqueRefusalForField = (error: {
  readonly fieldName?: string
}): Readonly<FormFieldConstraintError> | undefined =>
  error.fieldName
    ? new FormFieldConstraintError({
        // A translatable field's refusal names its language (`handle (fr)`);
        // the form draws it on the field the visitor filled.
        fieldName: languageUniqueBaseField(error.fieldName),
        message: FIELD_REFUSAL_MESSAGES.unique,
      })
    : undefined

/**
 * The field-level refusal a `CHECK` or `NOT NULL` rejection carries, or
 * `undefined` when the failure is not such a rejection or names no submitted
 * column — an operator fault keeps its own, non-field answer.
 */
export const constraintRefusalForField = (error: {
  readonly fieldName?: string
  readonly cause?: unknown
}): Readonly<FormFieldConstraintError> | undefined => {
  if (!error.fieldName) return undefined
  const violation = findConstraintViolation(error.cause)
  if (violation !== 'check' && violation !== 'not-null') return undefined
  return new FormFieldConstraintError({
    fieldName: error.fieldName,
    message: FIELD_REFUSAL_MESSAGES[violation],
  })
}

/**
 * The refusal of a value a field's `options` withhold: word for word the one a
 * value outside the column's accepted set draws, so the answer does not tell a
 * withheld value from an unknown one.
 */
export const withheldChoiceRefusal = (fieldName: string): Readonly<FormFieldConstraintError> =>
  new FormFieldConstraintError({ fieldName, message: FIELD_REFUSAL_MESSAGES.check })

/**
 * The refusal of a value the form filled itself into a hidden field whose
 * `options` do not offer it: the submitter chose neither the field nor the
 * value, so the answer names the value — one the page already showed her —
 * for her, and the operator, to act on.
 */
export const formFilledChoiceRefusal = (
  fieldName: string,
  value: string
): Readonly<FormFieldConstraintError> =>
  new FormFieldConstraintError({
    fieldName,
    message: `This form filled '${value}' into this field, and its options do not offer it`,
  })
