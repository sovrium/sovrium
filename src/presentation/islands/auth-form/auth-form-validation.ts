/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isValidEmail } from '@/domain/utils/email-validation'
import { type AuthFormField } from '@/presentation/utils/auth-form-types'

export { type AuthFormField }

export type FieldErrors = Readonly<Record<string, string>>

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

export function validateAllFields(
  fields: readonly AuthFormField[],
  values: Readonly<Record<string, string>>
): FieldErrors {
  const entries = fields
    .map((field) => [field.name, validateField(field, values[field.name] ?? '')] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] !== undefined)
  return Object.fromEntries(entries)
}

export function withFieldError(
  errors: FieldErrors,
  name: string,
  error: string | undefined
): FieldErrors {
  const entries = Object.entries(errors).filter(([key]) => key !== name)
  return Object.fromEntries(error ? [...entries, [name, error]] : entries)
}
