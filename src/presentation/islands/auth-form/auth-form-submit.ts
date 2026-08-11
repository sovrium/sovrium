/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isSafeRedirectPath } from '@/domain/utils/redirect-safety'
import { type AuthMethod } from '@/presentation/utils/auth-form-types'
import { showSuccessToast } from '../components/crud-form/toast'
import { authClient } from '../shared/auth-client'
import { type AuthFormField } from './auth-form-validation'

// Re-exported so existing importers of `auth-form-submit` keep working.
export { type AuthMethod }

export interface ToastConfig {
  readonly message?: string
  readonly variant?: string
}

export interface AuthState {
  readonly error?: string
  readonly success?: string
  readonly isPending: boolean
}

/**
 * Picks the email + password values from the form's field-value map. The first
 * `email`-typed field is the email; the first `password`-typed field is the
 * password — decoupling the auth API call from custom field names.
 */
function pickCredentials(
  fields: readonly AuthFormField[],
  values: Readonly<Record<string, string>>
): { email: string; password: string } {
  const emailField = fields.find((f) => f.inputType === 'email')
  const passwordField = fields.find((f) => f.inputType === 'password')
  return {
    email: emailField ? (values[emailField.name] ?? '') : '',
    password: passwordField ? (values[passwordField.name] ?? '') : '',
  }
}

async function handleLogin(email: string, password: string): Promise<string | undefined> {
  const result = await authClient.signIn.email({ email, password })
  return result.error ? (result.error.message ?? 'Authentication failed') : undefined
}

async function handleSignup(email: string, password: string): Promise<string | undefined> {
  const result = await authClient.signUp.email({
    email,
    password,
    name: email.split('@')[0] ?? '',
  })
  return result.error ? (result.error.message ?? 'Sign up failed') : undefined
}

async function handleLogout(): Promise<string | undefined> {
  const result = await authClient.signOut()
  return result.error ? (result.error.message ?? 'Sign out failed') : undefined
}

/**
 * Where the emailed reset link lands.
 *
 * `redirectTo` IS the `callbackURL` that Better Auth appends the token to:
 * the emailed link hits `GET /api/auth/reset-password/:token?callbackURL=…`,
 * which redirects here with `?token=…`. So this path must be one the running
 * app actually serves.
 *
 * It points at the Native Admin Dashboard because that console is auto-mounted
 * at `/_admin` in EVERY booted app — so `/_admin/reset-password`
 * always resolves, whatever the operator's config contains. The previous value,
 * `/auth/reset-password`, resolved nowhere: no Sovrium app serves that path, so
 * every password-reset email in the product pointed at a 404 and the (complete)
 * Better Auth backend was unreachable.
 */
const RESET_PASSWORD_CALLBACK_PATH = '/_admin/reset-password'

/** English fallback when the form declares no `onSuccess.toast.message`. */
const RESET_PASSWORD_SENT_MESSAGE = 'Check your email — a reset link has been sent'

async function handleResetPasswordRequest(email: string): Promise<string | undefined> {
  const result = await authClient.requestPasswordReset({
    email,
    redirectTo: RESET_PASSWORD_CALLBACK_PATH,
  })
  return result.error ? (result.error.message ?? 'Password reset request failed') : undefined
}

async function handleSetNewPassword(password: string): Promise<string | undefined> {
  const token = new URLSearchParams(globalThis.location?.search ?? '').get('token') ?? ''
  const result = await authClient.resetPassword({ newPassword: password, token })
  return result.error ? (result.error.message ?? 'Password reset failed') : undefined
}

/**
 * Everything `executeAuthMethod` needs, as ONE object.
 *
 * Deliberately not positional: the reset-password branch needs the form's
 * configured success copy, and a 4th positional parameter would sit exactly on
 * the `max-params: 4` ceiling — one more
 * dependency away from a lint failure.
 */
interface AuthMethodInput {
  readonly method: AuthMethod
  readonly email: string
  readonly password: string
  /** The form's `onSuccess.toast` config, when it declares one. */
  readonly successToast: ToastConfig | undefined
}

async function executeAuthMethod(
  input: AuthMethodInput
): Promise<{ error?: string; success?: string }> {
  const { method, email, password } = input
  switch (method) {
    case 'login':
      return { error: await handleLogin(email, password) }
    case 'signup':
      return { error: await handleSignup(email, password) }
    case 'logout':
      return { error: await handleLogout() }
    case 'resetPassword': {
      const error = await handleResetPasswordRequest(email)
      if (error) return { error }
      // A reset request resolves to a banner instead of navigating, so the
      // form's configured `onSuccess.toast.message` is the copy the operator
      // sees. Honouring it here is what lets a localized console (the French
      // `/_admin` recovery form) speak its own language — and phrase the
      // banner conditionally, matching Better Auth's always-200,
      // anti-enumeration contract. The English string is only the fallback.
      return { success: input.successToast?.message ?? RESET_PASSWORD_SENT_MESSAGE }
    }
    case 'setNewPassword':
      return { error: await handleSetNewPassword(password) }
  }
}

export interface SubmitContext {
  readonly method: AuthMethod
  readonly fields: readonly AuthFormField[]
  readonly values: Readonly<Record<string, string>>
  readonly redirectUrl: string | undefined
  readonly successToast: ToastConfig | undefined
  readonly errorToast: ToastConfig | undefined
  readonly setState: (s: AuthState) => void
}

/** Fires a toast for the given config when it carries a message. */
function fireToast(toast: ToastConfig | undefined): void {
  if (toast?.message) {
    showSuccessToast({ message: toast.message, variant: toast.variant })
  }
}

/**
 * Handles a successful auth result: fires the `onSuccess` toast and either
 * navigates to a same-origin `redirectUrl` (after a short delay so the toast is
 * observable) or clears the pending state.
 */
function handleAuthSuccess(ctx: SubmitContext): void {
  fireToast(ctx.successToast)
  const target = ctx.redirectUrl
  if (isSafeRedirectPath(target)) {
    // Delay the redirect so the success toast is observable before the page
    // unloads — mirrors the crud-form submit-pipeline navigation pattern.
    setTimeout(() => globalThis.location.assign(target), 500)
  } else {
    ctx.setState({ isPending: false })
  }
}

/**
 * Executes the auth action for the form's method.
 *
 * On a credentialed failure, fires the optional `onError` toast and surfaces the
 * error message. On success, fires the optional `onSuccess` toast and navigates
 * to `redirectUrl` (when it is a same-origin path). Reset-password requests
 * resolve to a `success` message instead of navigating.
 */
export async function submitAuthForm(ctx: SubmitContext): Promise<void> {
  ctx.setState({ isPending: true })
  try {
    const { email, password } = pickCredentials(ctx.fields, ctx.values)
    const result = await executeAuthMethod({
      method: ctx.method,
      email,
      password,
      successToast: ctx.successToast,
    })
    if (result.error) {
      fireToast(ctx.errorToast)
      ctx.setState({ error: result.error, isPending: false })
      return
    }
    if (result.success) {
      ctx.setState({ success: result.success, isPending: false })
      return
    }
    handleAuthSuccess(ctx)
  } catch (err) {
    ctx.setState({
      error: err instanceof Error ? err.message : 'An error occurred',
      isPending: false,
    })
  }
}
