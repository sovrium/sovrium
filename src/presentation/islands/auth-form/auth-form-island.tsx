/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cn } from '@/presentation/islands/lib/cn'
import {
  authSubmitLabel,
  defaultAuthFields,
  type AuthFormField,
  type AuthMethod,
} from '@/presentation/utils/auth-form-types'
import { computeFormLayoutClasses } from '@/presentation/utils/design/form-layout-classes'
import { AuthErrorSummary, AuthFieldRow } from './auth-form-fields'
import { useAuthFormState } from './auth-form-state'
import { type AuthState, type ToastConfig } from './auth-form-submit'


interface AuthFormIslandProps {
  readonly method: AuthMethod
  readonly fields?: readonly AuthFormField[]
  readonly submitLabel?: string
  readonly redirectUrl?: string
  readonly successToast?: ToastConfig
  readonly errorToast?: ToastConfig
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  readonly initialValues?: Record<string, string>
}


function AuthFormFeedback({ state }: { readonly state: AuthState }) {
  if (state.error) {
    return <div data-error="">{state.error}</div>
  }
  if (state.success) {
    return (
      <div
        data-error=""
        data-success=""
      >
        {state.success}
      </div>
    )
  }
  return <div data-error="" />
}


export default function AuthFormIsland(props: AuthFormIslandProps) {
  const { method, redirectUrl, successToast, errorToast, className, initialValues } = props
  const fields = props.fields && props.fields.length > 0 ? props.fields : defaultAuthFields(method)
  const submitLabel = props.submitLabel ?? authSubmitLabel(method)

  const { fieldErrors, summaryErrors, state, handleBlur, handleSubmit } = useAuthFormState({
    method,
    fields,
    redirectUrl,
    successToast,
    errorToast,
  })

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(computeFormLayoutClasses(), className)}
      id={props.id}
      data-testid={props['data-testid']}
      data-action-type="auth"
      data-action-method={method}
      noValidate
    >
      <AuthErrorSummary
        fields={fields}
        errors={summaryErrors}
      />
      {fields.map((field) => (
        <AuthFieldRow
          key={field.name}
          field={field}
          defaultValue={initialValues?.[field.name] ?? ''}
          error={fieldErrors[field.name]}
          onBlur={handleBlur}
        />
      ))}
      <AuthFormFeedback state={state} />
      <button
        type="submit"
        disabled={state.isPending}
        className="btn btn-primary w-full"
      >
        {state.isPending ? 'Loading...' : submitLabel}
      </button>
    </form>
  )
}
