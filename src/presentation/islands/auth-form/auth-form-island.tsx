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
  isAccountFormMethod,
  isAccountLinkMethod,
  type AuthFormField,
  type AuthMethod,
} from '@/presentation/design/auth-form-types'
import {
  computeSubmitButtonClasses,
  type ButtonVariant,
} from '@/presentation/design/button-default-classes'
import { computeFormLayoutClasses } from '@/presentation/design/form-layout-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { AccountLinkBoundary, AccountMethodBoundary } from './account-method-boundary'
import { AuthFormFeedback } from './auth-form-feedback'
import { AuthErrorSummary, AuthFieldRow } from './auth-form-fields'
import { OAuthSignInForm } from './auth-form-oauth'
import { PasskeyForm } from './auth-form-passkey'
import { SsoSignInForm, type SsoButtonProvider } from './auth-form-sso'
import { useAuthFormState, type AuthFormStateInput } from './auth-form-state'
import { type ToastConfig } from './auth-form-submit'
import { AuthSuccessPage, type AuthSuccessPageConfig } from './auth-form-success-page'
import type { TwoFactorNotice } from './two-factor-notice'

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
  /** The submit's weight (`action.submitVariant`); absent keeps the primary fill. */
  readonly submitVariant?: ButtonVariant
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
  /** `verifyTwoFactor`'s factor and its "Trust this device" offer (`account-method-form`). */
  readonly factor?: string
  readonly trustDevice?: boolean
  /** `login`: the page an account still owing its code is sent to (`onTwoFactor.navigate`). */
  readonly twoFactorPath?: string
  /** `verifyTwoFactor`: what it says when no sign-in waits for its code. */
  readonly twoFactorNotice?: TwoFactorNotice
  /** The query key an invitation answer reads its token from (`page.invitation.param`). */
  readonly tokenParam?: string
  /** The island's own words in the page language, where they differ from English. */
  readonly uiStrings?: Readonly<Record<string, string>>
  /** The `auth.sso` providers a `strategy: 'sso'` form draws a button for. */
  readonly ssoProviders?: readonly SsoButtonProvider[]
  readonly successToast?: ToastConfig
  readonly errorToast?: ToastConfig
  /** `onSuccess.type: 'successPage'`: the page that replaces the form once sent. */
  readonly successPage?: AuthSuccessPageConfig
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  readonly initialValues?: Record<string, string>
}

/** Stable empty list, so a form with no stamped provider does not re-render per pass. */
const NO_SSO_PROVIDERS: readonly SsoButtonProvider[] = []

// ---------------------------------------------------------------------------
// Credential (email/password) branch
// ---------------------------------------------------------------------------

/** The fields a credential form draws: the server's, or the method's defaults. */
const credentialFields = (props: AuthFormIslandProps): readonly AuthFormField[] =>
  props.fields && props.fields.length > 0
    ? props.fields
    : defaultAuthFields(props.method, props.strategy)

/** The submit and in-flight labels: the server-resolved ones, or the built-ins. */
const credentialLabels = (props: AuthFormIslandProps) => ({
  submitLabel: props.submitLabel ?? authSubmitLabel(props.method),
  pendingLabel: props.pendingLabel ?? authPendingLabel(props.method),
})

/** What a credential form's state drives its submit with. */
const credentialStateInput = (
  props: AuthFormIslandProps,
  fields: readonly AuthFormField[]
): AuthFormStateInput => ({
  method: props.method,
  strategy: props.strategy,
  fields,
  redirectUrl: props.redirectUrl,
  successToast: props.successToast,
  errorToast: props.errorToast,
  hasSuccessPage: props.successPage !== undefined,
  pendingSignIn: props.uiStrings?.['twoFactor.pendingSignIn'],
  twoFactorPath: props.twoFactorPath,
})

function CredentialAuthForm(props: AuthFormIslandProps) {
  const { method, className, initialValues } = props
  const fields = credentialFields(props)
  const { submitLabel, pendingLabel } = credentialLabels(props)

  const { fieldErrors, summaryErrors, state, handleBlur, handleSubmit } = useAuthFormState(
    credentialStateInput(props, fields)
  )

  if (props.successPage !== undefined && state.sentValues !== undefined)
    return (
      <AuthSuccessPage
        {...props}
        config={props.successPage}
        values={state.sentValues}
      />
    )

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
        data-component-type="button"
        disabled={state.isPending}
        className={`${computeSubmitButtonClasses(props.submitVariant)} w-full`}
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
  if (isAccountLinkMethod(props.method)) return <AccountLinkBoundary {...props} />
  if (isAccountFormMethod(props.method)) {
    return <AccountMethodBoundary {...props} />
  }
  if (props.strategy === 'sso') {
    return (
      <SsoSignInForm
        providers={props.ssoProviders ?? NO_SSO_PROVIDERS}
        callbackUrl={props.redirectUrl}
        className={props.className}
        id={props.id}
        data-testid={props['data-testid']}
      />
    )
  }
  // `registerPasskey` is not a credential method, so it sits outside `AuthMethod`.
  const registers = (props.method as string) === 'registerPasskey'
  if (props.strategy === 'passkey' || registers) {
    return (
      <PasskeyForm
        mode={registers ? 'register' : 'sign-in'}
        label={props.submitLabel}
        callbackUrl={props.redirectUrl}
        className={props.className}
        id={props.id}
        data-testid={props['data-testid']}
      />
    )
  }
  if (props.strategy === 'oauth') {
    return (
      <OAuthSignInForm
        provider={props.provider ?? ''}
        label={props.submitLabel}
        callbackUrl={props.redirectUrl}
        className={props.className}
        id={props.id}
        data-testid={props['data-testid']}
      />
    )
  }
  return <CredentialAuthForm {...props} />
}
