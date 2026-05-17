/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { ElementProps } from './html-element-renderer'

/**
 * Auth action shape for form rendering
 */
export type AuthFormAction = {
  readonly type: string
  readonly method?: string
  readonly strategy?: string
  readonly provider?: string
  readonly onSuccess?: {
    readonly navigate?: string
    readonly toast?: { readonly message?: string }
  }
}

/**
 * Determines the submit button label for an auth form method
 */
function getAuthSubmitLabel(method: string | undefined): string {
  switch (method) {
    case 'signup':
      return 'Sign Up'
    case 'resetPassword':
      return 'Send Reset Link'
    case 'setNewPassword':
      return 'Set New Password'
    default:
      return 'Sign In'
  }
}

/**
 * Builds the serialized island props for the auth form island component.
 */
function buildIslandPropsJson(
  method: string,
  action: AuthFormAction,
  testId: unknown,
  id: unknown
): string {
  return JSON.stringify({
    method,
    redirectUrl: action.onSuccess?.navigate,
    toastMessage: action.onSuccess?.toast?.message,
    'data-testid': testId,
    id,
  })
}

/**
 * Builds data attributes for the SSR fallback form.
 */
function buildFormDataAttrs(method: string, action: AuthFormAction): Record<string, unknown> {
  return {
    'data-action-type': 'auth',
    'data-action-method': method,
    ...(action.onSuccess?.navigate && { 'data-on-success-redirect': action.onSuccess.navigate }),
    ...(action.onSuccess?.toast?.message && {
      'data-on-success-toast': action.onSuccess.toast.message,
    }),
    noValidate: true,
  }
}

/**
 * Renders an auth form as a React island with SSR skeleton.
 *
 * The island marker `data-island="auth-form"` is discovered by the island client
 * which mounts the interactive AuthFormIsland React component. The HTML form
 * inside serves as both a loading skeleton and progressive enhancement fallback
 * (form still works via native POST if JS fails to load).
 */
export function renderAuthForm(props: ElementProps, action: AuthFormAction): ReactElement {
  const method = action.method ?? 'login'
  const submitLabel = getAuthSubmitLabel(method)
  const autocompletePassword = method === 'signup' ? 'new-password' : 'current-password'
  const islandProps = buildIslandPropsJson(method, action, props['data-testid'], props.id)
  const formDataAttrs = buildFormDataAttrs(method, action)

  return (
    <div
      data-island="auth-form"
      data-island-props={islandProps}
      data-testid={props['data-testid'] as string | undefined}
      style={props.style as React.CSSProperties | undefined}
    >
      {/* SSR skeleton — used as Suspense fallback and progressive enhancement */}
      <form
        {...props}
        {...formDataAttrs}
      >
        {method !== 'setNewPassword' && (
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
            />
          </label>
        )}
        {method !== 'resetPassword' && (
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete={autocompletePassword}
            />
          </label>
        )}
        <div data-error="" />
        <button
          type="submit"
          className="btn btn-primary"
        >
          {submitLabel}
        </button>
      </form>
    </div>
  )
}

/**
 * Capitalizes the first letter of a string
 */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Renders an OAuth form with a single button that redirects to the OAuth provider
 */
export function renderOAuthForm(props: ElementProps, action: AuthFormAction): ReactElement {
  const provider = action.provider ?? ''
  const oauthUrl = `/api/auth/sign-in/${provider}`
  const redirectTarget = action.onSuccess?.navigate

  const formProps: Record<string, unknown> = {
    ...props,
    ...(redirectTarget && { 'data-redirect': redirectTarget }),
  }

  return (
    <form {...formProps}>
      <a href={oauthUrl}>
        <button type="button">Sign in with {capitalize(provider)}</button>
      </a>
    </form>
  )
}
