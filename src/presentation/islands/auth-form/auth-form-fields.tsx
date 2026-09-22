/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeFormFieldClasses,
  computeFormFieldErrorClasses,
  computeFormFieldLabelClasses,
} from '@/presentation/design/form-layout-classes'
import { computeInputDefaultClasses } from '@/presentation/design/input-default-classes'
import { type AuthFormField, type FieldErrors } from './auth-form-validation'

/**
 * Renders a single auth-form field row: a `<div data-field>` wrapper containing
 * a `<label>`-associated input and an inline-error region.
 *
 * The input is **uncontrolled** (`defaultValue` + native DOM value): the
 * `aria-invalid` flag and the inline-error `<div id="<name>-error">` are the
 * only React-driven parts. Keeping the input uncontrolled avoids a
 * controlled-input reconciliation race where a blur-triggered re-render could
 * reset the DOM value before the matching `onChange` state update flushes —
 * which would silently drop user input during a fast fill→submit sequence.
 *
 * The inline-error region is always rendered with a reserved `min-height` so
 * an error message appearing or clearing never changes the row height — this
 * keeps the submit button from shifting under the pointer mid-click. The
 * `data-error-empty` attribute marks the no-error state for styling/testing.
 *
 * It carries {@link computeFormFieldErrorClasses} — the SAME recipe the
 * server-rendered `field-renderer.tsx` has always used. It went without one
 * for as long as this island existed, which is not a colour that drifted but
 * the ABSENCE of one: with no className the message inherited the body's
 * default foreground at the body size, so an error painted at 16px in the
 * plain text colour under a 12px label — larger and quieter than the label it
 * corrected. The recipe's `text-error-fg text-xs` is what the canvas draws for
 * the invalid state (11px on the error tone), pairing the message with the
 * `error`-state border the control beside it already carries.
 *
 * Inline errors deliberately omit `role="alert"` so a `[role="alert"]`
 * selector resolves only to the form-level summary banner.
 */
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
      <label className={computeFormFieldClasses()}>
        <span className={computeFormFieldLabelClasses()}>{field.label}</span>
        <input
          type={field.inputType}
          name={field.name}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={`${field.name}-error`}
          // Wire the auth island into the canonical, theme-aware input recipe
          // so it renders full-width + bordered + focus ring, matching
          // the design-system auth-layout scene. `error` maps to the 'error'
          // state (error-token border + ring-1), keeping the invalid-field look
          // identical to CRUD forms.
          className={computeInputDefaultClasses({ state: error ? 'error' : 'default' })}
          {...(field.placeholder && { placeholder: field.placeholder })}
          // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- closure over field.name; blur fires once per field interaction
          onBlur={(e) => onBlur(field.name, e.target.value)}
        />
      </label>
      <div
        id={`${field.name}-error`}
        className={computeFormFieldErrorClasses()}
        style={INLINE_ERROR_STYLE}
        {...(error ? {} : { 'data-error-empty': '' })}
      >
        {error}
      </div>
    </div>
  )
}

/**
 * Renders the form-level summary error banner listing every invalid field.
 *
 * The banner carries `data-testid="error-summary"` + `role="alert"` and is the
 * only `role="alert"` element in the form. Each invalid field produces a
 * `<li data-error-item>` entry, in field-declaration order.
 */
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
