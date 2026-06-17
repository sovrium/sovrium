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

export interface AuthFormStateInput {
  readonly method: AuthMethod
  readonly fields: readonly AuthFormField[]
  readonly redirectUrl?: string
  readonly successToast?: ToastConfig
  readonly errorToast?: ToastConfig
}

export interface AuthFormStateResult {
  readonly fieldErrors: FieldErrors
  readonly summaryErrors: FieldErrors
  readonly state: AuthState
  readonly handleBlur: (name: string, value: string) => void
  readonly handleSubmit: (e: FormEvent<HTMLFormElement>) => void
}

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
