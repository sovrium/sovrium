/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isValidEmail } from '@/domain/utils/email-validation'
import { type AuthFormField } from '@/presentation/utils/auth-form-types'

// Re-exported so existing importers of `auth-form-validation` keep working
// without reaching across to `@/presentation/utils`.
export { type AuthFormField }

/** Per-field validation errors keyed by field name. */
export type FieldErrors = Readonly<Record<string, string>>

/**
 * Validates a single auth-form field against its declared rules.
 *
 * - Required fields with an empty value produce a `"<Label> is required"`
 *   message.
 * - Email-typed fields with a non-empty value that fails the email pattern
 *   produce a `"<Label> must be a valid email address"` message.
 *
 * Returns `undefined` when the field is valid.
 */
export function validateField(field: AuthFormField, value: string): string | undefined {
  const trimmed = value.trim()
  if (field.required && trimmed === '') {
    return `${field.label} is required`
  }
  if (field.inputType === 'email' && trimmed !== '' && !isValidEmail(trimmed)) {
    return `${field.label} must be a valid email address`
  }
  return undefined
}

/**
 * Validates every field in the form, returning a map of field-name → error
 * message for each invalid field. An empty object means the form is valid.
 */
export function validateAllFields(
  fields: readonly AuthFormField[],
  values: Readonly<Record<string, string>>
): FieldErrors {
  const entries = fields
    .map((field) => [field.name, validateField(field, values[field.name] ?? '')] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] !== undefined)
  return Object.fromEntries(entries)
}

/**
 * Returns a new `FieldErrors` map with a single field's entry updated.
 *
 * When `error` is `undefined` the field's entry is omitted; otherwise it is
 * set. Implemented immutably (no mutation of the input map).
 */
export function withFieldError(
  errors: FieldErrors,
  name: string,
  error: string | undefined
): FieldErrors {
  const entries = Object.entries(errors).filter(([key]) => key !== name)
  return Object.fromEntries(error ? [...entries, [name, error]] : entries)
}
