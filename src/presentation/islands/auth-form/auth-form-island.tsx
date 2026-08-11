/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  authPendingLabel,
  authSubmitLabel,
  defaultAuthFields,
  type AuthFormField,
  type AuthMethod,
} from '@/presentation/utils/auth-form-types'
import { cn } from '@/presentation/utils/design/class-merge'
import {
  AUTH_ERROR_BANNER_STYLE,
  AUTH_SUCCESS_BANNER_STYLE,
  computeAuthFeedbackBannerClasses,
  computeFormLayoutClasses,
} from '@/presentation/utils/design/form-layout-classes'
import { AuthErrorSummary, AuthFieldRow } from './auth-form-fields'
import { useAuthFormState } from './auth-form-state'
import { type AuthState, type ToastConfig } from './auth-form-submit'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthFormIslandProps {
  readonly method: AuthMethod
  readonly fields?: readonly AuthFormField[]
  /**
   * Server-resolved submit-button label (already localized through page
   * `meta.lang` + app `languages`). When present, it replaces the hardcoded
   * built-in `authSubmitLabel(method)` so the hydrated island button text is
   * byte-identical to the SSR skeleton.
   */
  readonly submitLabel?: string
  /**
   * Server-resolved in-flight (pending) submit-button label, threaded the same
   * way as `submitLabel` so a localized console (e.g. the French dashboard)
   * shows a localized pending label instead of a hardcoded `Loading...`.
   */
  readonly pendingLabel?: string
  readonly redirectUrl?: string
  readonly successToast?: ToastConfig
  readonly errorToast?: ToastConfig
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  readonly initialValues?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Feedback sub-component
// ---------------------------------------------------------------------------

function AuthFormFeedback({ state }: { readonly state: AuthState }) {
  if (state.error) {
    return (
      <div
        data-error=""
        role="alert"
        className={computeAuthFeedbackBannerClasses()}
        style={AUTH_ERROR_BANNER_STYLE}
      >
        {state.error}
      </div>
    )
  }
  if (state.success) {
    return (
      <div
        data-error=""
        data-success=""
        role="status"
        className={computeAuthFeedbackBannerClasses()}
        style={AUTH_SUCCESS_BANNER_STYLE}
      >
        {state.success}
      </div>
    )
  }
  // No result yet — an empty, hidden slot. `hidden` keeps it out of layout so it
  // reserves no phantom gap in the form's flex stack, and matches the SSR
  // skeleton's `<div data-error hidden />` byte-for-byte (the styled banner only
  // ever appears post-submit, client-side, so hydration never sees a mismatch).
  return (
    <div
      data-error=""
      hidden
    />
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AuthFormIsland(props: AuthFormIslandProps) {
  const { method, redirectUrl, successToast, errorToast, className, initialValues } = props
  const fields = props.fields && props.fields.length > 0 ? props.fields : defaultAuthFields(method)
  const submitLabel = props.submitLabel ?? authSubmitLabel(method)
  const pendingLabel = props.pendingLabel ?? authPendingLabel(method)

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
        {state.isPending ? pendingLabel : submitLabel}
      </button>
    </form>
  )
}
