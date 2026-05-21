/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type AuthFormField, type FieldErrors } from './auth-form-validation'

const INLINE_ERROR_STYLE: React.CSSProperties = { minHeight: '1.25rem' }
export function AuthFieldRow({
  field,
  defaultValue,
  error,
  onBlur,
}: {
  readonly field: AuthFormField
  readonly defaultValue: string
  readonly error: string | undefined
  readonly onBlur: (name: string, value: string) => void
}) {
  const autoComplete =
    field.inputType === 'email'
      ? 'email'
      : field.inputType === 'password'
        ? 'new-password'
        : undefined
  return (
    <div data-field={field.name}>
      <label>
        {field.label}
        <input
          type={field.inputType}
          name={field.name}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={`${field.name}-error`}
          {...(field.placeholder && { placeholder: field.placeholder })}
          onBlur={(e) => onBlur(field.name, e.target.value)}
        />
      </label>
      <div
        id={`${field.name}-error`}
        style={INLINE_ERROR_STYLE}
        {...(error ? {} : { 'data-error-empty': '' })}
      >
        {error}
      </div>
    </div>
  )
}

export function AuthErrorSummary({
  fields,
  errors,
}: {
  readonly fields: readonly AuthFormField[]
  readonly errors: FieldErrors
}) {
  const items = fields
    .filter((field) => errors[field.name])
    .map((field) => ({ name: field.name, message: errors[field.name]! }))
  return (
    <div
      data-testid="error-summary"
      role="alert"
      hidden={items.length === 0}
    >
      <p>Please fix the following errors:</p>
      <ul>
        {items.map((item) => (
          <li
            key={item.name}
            data-error-item
          >
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
