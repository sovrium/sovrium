/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flushSync } from 'react-dom'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { type AuthMethod } from '@/presentation/design/auth-form-types'
import { showSuccessToast } from '../parts/crud-form/toast'
import { authClient } from '../runtime/auth-client'
import { executeAuthMethod, type ToastConfig } from './auth-form-methods'
import { type AuthFormField } from './auth-form-validation'
import { successMoveAddress } from './auth-success-move'
import { signInDestination } from './sign-in-destination'

// Re-exported so existing importers of `auth-form-submit` keep working.
export { type AuthMethod, type ToastConfig }

export interface AuthState {
  readonly error?: string
  /** The server's code for the error, which a declared `credentialError` answers. */
  readonly code?: string
  readonly success?: string
  readonly isPending: boolean
  /**
   * The values the reader sent, once a form declaring a success page has sent
   * its request: the form gives way to that page, which reads them.
   */
  readonly sentValues?: Readonly<Record<string, string>>
}

/**
 * Picks the email + password values from the form's field-value map. The first
 * `email`-typed field is the email; the first `password`-typed field is the
 * password — decoupling the auth API call from custom field names.
 */
function pickCredentials(
  fields: readonly AuthFormField[],
  values: Readonly<Record<string, string>>
): { email: string; password: string; name?: string } {
  const emailField = fields.find((f) => f.inputType === 'email')
  const passwordField = fields.find((f) => f.inputType === 'password')
  return {
    email: emailField ? (values[emailField.name] ?? '') : '',
    password: passwordField ? (values[passwordField.name] ?? '') : '',
    name: values['name'], // a sign-up form asking for the person's name
  }
}

export interface SubmitContext {
  readonly method: AuthMethod
  readonly strategy?: string
  readonly fields: readonly AuthFormField[]
  readonly values: Readonly<Record<string, string>>
  readonly redirectUrl: string | undefined
  readonly successToast: ToastConfig | undefined
  readonly errorToast: ToastConfig | undefined
  /** The form declares `onSuccess.type: 'successPage'`. */
  readonly hasSuccessPage?: boolean
  /** The form's banners in the page language (two-step owed, a link mailed), where they differ from English. */
  readonly words?: Readonly<Record<string, string>>
  /** `login`: the page an account still owing its code is sent to. */
  readonly twoFactorPath?: string
  readonly setState: (s: AuthState) => void
  /** The form, whose submit takes the focus back on a refusal. */
  readonly form?: HTMLFormElement
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
  // A relative address resolved against this page; the toast follows a move away.
  const target = toSafeRedirectPath(
    successMoveAddress(
      ctx.method === 'login' ? signInDestination(ctx.redirectUrl) : ctx.redirectUrl,
      ctx.successToast
    )
  )
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
    const result = await executeAuthMethod({
      method: ctx.method,
      strategy: ctx.strategy,
      ...pickCredentials(ctx.fields, ctx.values),
      redirectUrl: ctx.redirectUrl,
      successToast: ctx.successToast,
      words: ctx.words,
      twoFactorPath: ctx.twoFactorPath,
    })
    const codePage = toSafeRedirectPath(result.navigate)
    if (codePage !== undefined) {
      // Pending stays on: the page is about to change.
      globalThis.location.assign(codePage)
      return
    }
    if (result.error) {
      // The error drawn first, then the focus back on the submit, then the onError toast.
      flushSync(() => ctx.setState({ error: result.error, code: result.code, isPending: false }))
      ctx.form?.querySelector<HTMLElement>('button[type="submit"]')?.focus()
      fireToast(ctx.errorToast)
      return
    }
    if (result.success) {
      // A request that resolves to a message (a link mailed) becomes the
      // declared success page when there is one, and the banner otherwise.
      ctx.setState(
        ctx.hasSuccessPage === true
          ? { isPending: false, sentValues: ctx.values }
          : { success: result.success, isPending: false }
      )
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
  const callbackURL = toSafeRedirectPath(signInDestination(input.callbackURL))
  const result = await authClient.signIn.social({
    provider: input.provider,
    ...(callbackURL !== undefined && { callbackURL }),
  })
  return result.error ? (result.error.message ?? 'Sign in failed') : undefined
}
