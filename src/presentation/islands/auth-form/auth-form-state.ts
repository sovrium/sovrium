/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState, type FormEvent } from 'react'
import {
  submitAuthForm,
  type AuthMethod,
  type AuthState,
  type ToastConfig,
} from './auth-form-submit'
import {
  validateAllFields,
  validateField,
  withFieldError,
  type AuthFormField,
  type FieldErrors,
} from './auth-form-validation'

/**
 * Inputs needed to drive an auth form's validation + submission lifecycle.
 */
export interface AuthFormStateInput {
  readonly method: AuthMethod
  readonly fields: readonly AuthFormField[]
  readonly redirectUrl?: string
  readonly successToast?: ToastConfig
  readonly errorToast?: ToastConfig
}

/**
 * The reactive slice of an auth form, returned by {@link useAuthFormState}.
 *
 * `fieldErrors` drives the inline per-field error text + `aria-invalid` and
 * updates on blur. `summaryErrors` drives the top-of-form summary banner and
 * updates ONLY on submit — keeping the summary decoupled from blur prevents a
 * layout shift (banner collapsing as fields are corrected) from moving the
 * submit button mid-click during a fast fill→submit interaction.
 */
export interface AuthFormStateResult {
  readonly fieldErrors: FieldErrors
  readonly summaryErrors: FieldErrors
  readonly state: AuthState
  readonly handleBlur: (name: string, value: string) => void
  readonly handleSubmit: (e: FormEvent<HTMLFormElement>) => void
}

/**
 * Manages an auth form's validation + submission state.
 *
 * Validation runs per-field on blur and for all fields on submit. On a valid
 * submit, the auth action is dispatched via {@link submitAuthForm}; invalid
 * submits populate the inline and summary error maps without dispatching.
 */
export function useAuthFormState(input: AuthFormStateInput): AuthFormStateResult {
  const { method, fields, redirectUrl, successToast, errorToast } = input
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [summaryErrors, setSummaryErrors] = useState<FieldErrors>({})
  const [state, setState] = useState<AuthState>({ isPending: false })

  const handleBlur = (name: string, value: string): void => {
    const field = fields.find((f) => f.name === name)
    if (!field) return
    const error = validateField(field, value)
    setFieldErrors((prev) => withFieldError(prev, name, error))
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    // The inputs are uncontrolled, so the form's `FormData` is always the
    // authoritative source of the current values — no stale-state race.
    const formData = new FormData(e.currentTarget)
    const current = Object.fromEntries(
      fields.map((f) => [f.name, String(formData.get(f.name) ?? '')])
    )
    const validationErrors = validateAllFields(fields, current)
    setFieldErrors(validationErrors)
    setSummaryErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return
    void submitAuthForm({
      method,
      fields,
      values: current,
      redirectUrl,
      successToast,
      errorToast,
      setState,
    })
  }

  return { fieldErrors, summaryErrors, state, handleBlur, handleSubmit }
}
