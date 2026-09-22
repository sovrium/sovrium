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
} from '@/presentation/design/auth-form-types'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  AUTH_ERROR_BANNER_STYLE,
  AUTH_SUCCESS_BANNER_STYLE,
  computeAuthFeedbackBannerClasses,
  computeFormLayoutClasses,
} from '@/presentation/design/form-layout-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { AuthErrorSummary, AuthFieldRow } from './auth-form-fields'
import { OAuthSignInForm } from './auth-form-oauth'
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
  /**
   * Auth strategy from the action. `'oauth'` selects the social sign-in branch
   * — one submit button, no fields; anything else (including absent) is a
   * credential form. This is the DISCRIMINANT, deliberately rather than
   * `provider`: `provider` is `Schema.optional`, so a schema-valid
   * `strategy: 'oauth'` action may omit it, and keying off it then sent a form
   * whose SSR skeleton is a single OAuth button to the credential branch,
   * which replaced that button with email/password inputs on hydration.
   */
  readonly strategy?: string
  /**
   * Provider handle for a social (OAuth) sign-in form, e.g. `google`. Empty
   * when the action omits it — the OAuth branch still renders, so the server
   * and the hydrated island agree, and the flow fails at the provider call
   * rather than silently becoming a different form.
   */
  readonly provider?: string
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
// Credential (email/password) branch
// ---------------------------------------------------------------------------

function CredentialAuthForm(props: AuthFormIslandProps) {
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
      className={resolveClasses(computeFormLayoutClasses(), className)}
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
        className={`${computeButtonDefaultClasses()} w-full`}
      >
        {state.isPending ? pendingLabel : submitLabel}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main component (branch dispatcher)
// ---------------------------------------------------------------------------

/**
 * Auth-form island entry point.
 *
 * A social (OAuth) sign-in form SHARES this island rather than owning its own.
 * Its branch renders no fields and runs no validation, so a separate island
 * type would buy a second chunk — plus its island-registry, preload-manifest
 * and payload-budget entries — for a single button. `strategy` is the
 * discriminant, and only the OAuth renderer ever sets it to `'oauth'`;
 * `redirectUrl` (the action's resolved `onSuccess` destination) rides on as
 * the round-trip `callbackURL`.
 *
 * The two branches are separate COMPONENTS rather than an early return inside
 * one, because the credential branch calls `useAuthFormState` and a hook may
 * not sit behind a conditional return.
 */
export default function AuthFormIsland(props: AuthFormIslandProps) {
  if (props.strategy === 'oauth') {
    return (
      <OAuthSignInForm
        provider={props.provider ?? ''}
        callbackUrl={props.redirectUrl}
        className={props.className}
        id={props.id}
        data-testid={props['data-testid']}
      />
    )
  }
  return <CredentialAuthForm {...props} />
}
