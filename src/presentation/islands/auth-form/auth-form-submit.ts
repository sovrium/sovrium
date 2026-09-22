/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { type AuthMethod } from '@/presentation/design/auth-form-types'
import { resolveMountBasePath } from '@/presentation/islands/runtime/mount-base-path'
import { showSuccessToast } from '../parts/crud-form/toast'
import { authClient } from '../runtime/auth-client'
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
 * It points at the Native Admin Dashboard because that console is mounted in
 * EVERY booted app, so the path always resolves whatever the
 * operator's config contains. The previous value, `/auth/reset-password`,
 * resolved nowhere: no Sovrium app serves that path, so every password-reset
 * email in the product pointed at a 404 and the (complete) Better Auth backend
 * was unreachable.
 *
 * RESOLVED AT SUBMIT TIME, not baked in, and this value ESCAPES the process:
 * it is what the emailed link points at. So it is taken from the document the
 * server actually rendered rather than from a `/_admin` literal compiled into
 * the bundle — the two agree today, and only one of them is guaranteed to. A
 * link that does not resolve is a dead end an operator cannot diagnose, in the
 * one flow they reach precisely because they are locked out.
 */
const resetPasswordCallbackPath = (): string => `${resolveMountBasePath()}/reset-password`

/** English fallback when the form declares no `onSuccess.toast.message`. */
const RESET_PASSWORD_SENT_MESSAGE = 'Check your email — a reset link has been sent'

async function handleResetPasswordRequest(email: string): Promise<string | undefined> {
  const result = await authClient.requestPasswordReset({
    email,
    redirectTo: resetPasswordCallbackPath(),
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
  const target = toSafeRedirectPath(ctx.redirectUrl)
  if (target !== undefined) {
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

/**
 * Starts Better Auth's social (OAuth) sign-in for `provider`.
 *
 * ─── WHY THIS IS A POST FROM JAVASCRIPT AND NOT A LINK ─────────────────────
 *
 * A social sign-in ends in a navigation, so an `<a href>` is the intuitive
 * choice — and it is the wrong one twice over. Better Auth declares no
 * `/sign-in/:provider` route (every `/sign-in/*` endpoint it exposes is a
 * literal path), so the URL a link would carry answers 404. And the endpoint
 * that does exist, `POST /sign-in/social`, answers with JSON — a body carrying
 * the provider's authorize URL — rather than a 3xx, so a native form POST would
 * render that JSON instead of following it. Whatever starts the flow has to be
 * able to read a response, which means JavaScript.
 *
 * The navigation itself is Better Auth's: its client ships a default
 * `redirectPlugin` fetch hook that assigns `window.location.href` when the
 * response carries `{ url, redirect: true }`. That is why nothing here touches
 * a navigation sink — and why nothing here needs to, which also keeps the
 * `sovrium/no-unguarded-navigation` sink count at zero for this path.
 *
 * `callbackURL` is where the reader lands once the provider comes back. It is
 * author-supplied config (`onSuccess.navigate`), so it goes through
 * `toSafeRedirectPath` before being handed over: Better Auth stores it against
 * the OAuth state cookie and redirects to it after the callback, which makes it
 * a redirect target that must be proven same-origin exactly like the email
 * path's. An unsafe value is DROPPED rather than substituted, leaving Better
 * Auth to fall back to its own default.
 */
export async function startSocialSignIn(input: {
  readonly provider: string
  readonly callbackURL: string | undefined
}): Promise<string | undefined> {
  const callbackURL = toSafeRedirectPath(input.callbackURL)
  const result = await authClient.signIn.social({
    provider: input.provider,
    ...(callbackURL !== undefined && { callbackURL }),
  })
  return result.error ? (result.error.message ?? 'Sign in failed') : undefined
}
