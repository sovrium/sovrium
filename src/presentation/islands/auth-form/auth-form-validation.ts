/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isValidEmail } from '@/domain/kernel/sanitize/email-validation'
import { type AuthFormField } from '@/presentation/design/auth-form-types'

// Re-exported so existing importers of `auth-form-validation` keep working
// without reaching across to `@/presentation/utils`.
export { type AuthFormField }

/** Per-field validation errors keyed by field name. */
export type FieldErrors = Readonly<Record<string, string>>

/** The form's words in the page language, keyed by catalogue key, where they differ from English. */
type ValidationWords = Readonly<Record<string, string>> | undefined

/**
 * Validates a single auth-form field against its declared rules, in the page
 * language (`auth.required`, `auth.invalidEmail`; English where `words` has none).
 *
 * - Required fields with an empty value produce a `"<Label> is required"`
 *   message.
 * - Email-typed fields with a non-empty value that fails the email pattern
 *   produce a `"<Label> must be a valid email address"` message.
 *
 * Returns `undefined` when the field is valid.
 */
export function validateField(
  field: AuthFormField,
  value: string,
  words?: ValidationWords
): string | undefined {
  const trimmed = value.trim()
  // The message's catalogue key and its English; `{label}` is the field's label.
  const [key, english] =
    field.required && trimmed === ''
      ? ['auth.required', '{label} is required']
      : field.inputType === 'email' && trimmed !== '' && !isValidEmail(trimmed)
        ? ['auth.invalidEmail', '{label} must be a valid email address']
        : []
  return key && (words?.[key] ?? english ?? '').replace('{label}', field.label)
}

/**
 * Validates every field in the form, returning a map of field-name → error
 * message for each invalid field. An empty object means the form is valid.
 */
export function validateAllFields(
  fields: readonly AuthFormField[],
  values: Readonly<Record<string, string>>,
  words?: ValidationWords
): FieldErrors {
  const entries = fields
    .map((field) => [field.name, validateField(field, values[field.name] ?? '', words)] as const)
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

/**
 * Whether `field` is the code a waiting sign-in asks for on a page of its own —
 * the one field that takes focus as the page opens. Never on the page holding
 * the password form too, where focus stays where the reader is typing.
 */
export const takesCodeFocus = (
  field: AuthFormField,
  notice: { readonly focusCode?: boolean } | undefined
): boolean => notice?.focusCode === true && field.autoComplete === 'one-time-code'
