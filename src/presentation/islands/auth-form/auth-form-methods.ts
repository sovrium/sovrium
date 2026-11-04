/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The auth-form's per-method requests to Better Auth: sign-in (password, mailed
 * link, two-step owed), sign-up, sign-out, the reset-password pair. Each one
 * resolves to an `AuthOutcome` the submit pipeline (`auth-form-submit.ts`)
 * turns into state, a toast or a navigation; nothing here touches the form.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { authClient } from '../runtime/auth-client'
import { pageQueryParam } from './page-query-param'
import { signInDestination } from './sign-in-destination'
import { trackSignIn } from './sign-in-in-flight'
import type { AuthMethod } from '@/presentation/design/auth-form-types'

/** A form's `onSuccess` / `onError` toast config. */
export interface ToastConfig {
  readonly message?: string
  readonly variant?: string
}

/**
 * The banner a password sign-in shows when the account still owes its second
 * step: the English built-in, which the page-language words replace
 * (`twoFactor.pendingSignIn`, handed to the island by the server).
 */
const TWO_FACTOR_PENDING_MESSAGE =
  'Two-step verification is on — enter your code to finish signing in'

/**
 * A refused sign-in or sign-up, in the page language: the server files the
 * words of a wrong address or password, and of an address that already holds
 * an account, under the error code itself (`keyRefusalsByCode`) where they
 * differ from English; any other refusal keeps the server's own sentence. The
 * API body itself stays English.
 */
const refusalOf = (
  error: { readonly code?: string; readonly message?: string },
  words: Readonly<Record<string, string>> | undefined,
  fallback = 'Authentication failed'
): string => (error.code !== undefined && words?.[error.code]) || (error.message ?? fallback)

/** What an auth method resolved to: a refusal, a banner, or a page to open now. */
interface AuthOutcome {
  readonly error?: string
  readonly code?: string
  readonly success?: string
  /** A same-origin path to open at once (a sign-in that still owes its code). */
  readonly navigate?: string
}

/**
 * A password sign-in. An account with two-step on is NOT signed in yet: the
 * server answers `twoFactorRedirect` and holds the attempt in a short-lived
 * cookie until a `verifyTwoFactor` form checks the code.
 *
 * A form naming its code page (`onTwoFactor.navigate`) opens it, the cookie
 * untouched, and sends where it was headed as `callbackURL`: the server keeps
 * that beside the attempt for the code page. Without one, the form says a code
 * is needed and stays — its code form sits on the same page.
 */
async function handleLogin(
  input: AuthMethodInput,
  destination: string | undefined
): Promise<AuthOutcome> {
  const codePage = toSafeRedirectPath(input.twoFactorPath)
  const callbackURL = codePage === undefined ? undefined : destination
  const result = await trackSignIn(
    authClient.signIn.email({
      email: input.email,
      password: input.password,
      ...(callbackURL !== undefined && { callbackURL }),
    })
  )
  if (result.error) return { error: refusalOf(result.error, input.words), code: result.error.code }
  const pending = (result.data as { readonly twoFactorRedirect?: unknown } | null)
    ?.twoFactorRedirect
  if (pending !== true) return {}
  if (codePage !== undefined) return { navigate: codePage }
  return { success: input.words?.['twoFactor.pendingSignIn'] ?? TWO_FACTOR_PENDING_MESSAGE }
}

/** A sign-up; an account whose form asks for no name is named after its address. */
async function handleSignup(input: AuthMethodInput): Promise<string | undefined> {
  const { email, password } = input
  const result = await authClient.signUp.email({
    email,
    password,
    name: input.name || (email.split('@')[0] ?? ''),
  })
  return result.error ? refusalOf(result.error, input.words, 'Sign up failed') : undefined
}

async function handleLogout(): Promise<string | undefined> {
  const result = await authClient.signOut()
  // Forget this browser's language choice: the next person reads the default
  localStorage.removeItem('sovrium_language')
  return result.error ? (result.error.message ?? 'Sign out failed') : undefined
}

/** English fallback when the form declares no `onSuccess.toast.message`. */
const RESET_PASSWORD_SENT_MESSAGE = 'Check your email — a reset link has been sent'

/**
 * Asks Better Auth to mail a reset link to `email`.
 *
 * `redirectTo` IS the `callbackURL` that Better Auth appends the token to: the
 * emailed link hits `GET /api/auth/reset-password/:token?callbackURL=…`, which
 * redirects there with `?token=…`. It is the form's `redirectUrl`, which the
 * server sets to the app's page holding the `setNewPassword` form
 * (`auth-form-facts-stamp.ts`) — the console's own reset page on the console.
 * It is read off the document, so it goes through `toSafeRedirectPath`.
 */
async function handleResetPasswordRequest(
  email: string,
  redirectTo: string | undefined
): Promise<string | undefined> {
  const result = await authClient.requestPasswordReset({
    email,
    redirectTo: toSafeRedirectPath(redirectTo),
  })
  return result.error ? (result.error.message ?? 'Password reset request failed') : undefined
}

async function handleSetNewPassword(password: string): Promise<string | undefined> {
  const token = pageQueryParam('token')
  const result = await authClient.resetPassword({ newPassword: password, token })
  return result.error ? (result.error.message ?? 'Password reset failed') : undefined
}

/** English fallback when a magic-link form declares no `onSuccess.toast.message`. */
const MAGIC_LINK_SENT_MESSAGE = 'Check your email — a sign-in link has been sent'

/**
 * Asks Better Auth to mail a sign-in link to `email`.
 *
 * Reached through `$fetch` rather than the `magicLinkClient` plugin: the plugin
 * adds nothing but a typed wrapper around this one POST, and every byte it
 * would add ships to every visitor of a page carrying any auth form.
 * `callbackURL` is where the link lands once verified; it is author config, so
 * it goes through `toSafeRedirectPath` and an unsafe value is dropped, leaving
 * Better Auth's own default.
 */
async function handleMagicLinkRequest(
  email: string,
  redirectUrl: string | undefined
): Promise<string | undefined> {
  const callbackURL = toSafeRedirectPath(signInDestination(redirectUrl))
  const result = await authClient.$fetch('/sign-in/magic-link', {
    method: 'POST',
    body: { email, ...(callbackURL !== undefined && { callbackURL }) },
  })
  return result.error ? (result.error.message ?? 'Sign-in link request failed') : undefined
}

/**
 * Everything `executeAuthMethod` needs, as ONE object.
 *
 * Deliberately not positional: the reset-password branch needs the form's
 * configured success copy, and a 4th positional parameter would sit exactly on
 * the `max-params: 4` ceiling — one more
 * dependency away from a lint failure.
 */
export interface AuthMethodInput {
  readonly method: AuthMethod
  /** The action's `strategy`; `magicLink` turns a login into a mailed link. */
  readonly strategy: string | undefined
  readonly email: string
  readonly password: string
  readonly name?: string
  /** Where a mailed sign-in link lands once verified; for a reset request, where its emailed link does. */
  readonly redirectUrl: string | undefined
  /** The form's `onSuccess.toast` config, when it declares one. */
  readonly successToast: ToastConfig | undefined
  /** The form's banners in the page language (two-step owed, a link mailed), where they differ from English. */
  readonly words?: Readonly<Record<string, string>>
  /** `login`: the page an account still owing its code is sent to (`onTwoFactor.navigate`). */
  readonly twoFactorPath?: string
}

/**
 * The banner a mailed link answers with: the form's `onSuccess.toast.message`,
 * else the engine's words in the page language, else the English.
 */
const sentBanner = (input: AuthMethodInput, key: string, english: string): string =>
  input.successToast?.message ?? input.words?.[key] ?? english

/**
 * A magic-link login resolves to a banner rather than a navigation: the reader
 * is not signed in until they open the mailed link.
 */
async function executeMagicLinkLogin(
  input: AuthMethodInput
): Promise<{ error?: string; success?: string }> {
  const error = await handleMagicLinkRequest(input.email, input.redirectUrl)
  if (error) return { error }
  return { success: sentBanner(input, 'auth.magicLinkSent', MAGIC_LINK_SENT_MESSAGE) }
}

export async function executeAuthMethod(input: AuthMethodInput): Promise<AuthOutcome> {
  const { method, email, password } = input
  switch (method) {
    case 'login':
      if (input.strategy === 'magicLink') return executeMagicLinkLogin(input)
      return handleLogin(input, toSafeRedirectPath(signInDestination(input.redirectUrl)))
    case 'signup':
      return { error: await handleSignup(input) }
    case 'logout':
      return { error: await handleLogout() }
    case 'resetPassword': {
      const error = await handleResetPasswordRequest(email, input.redirectUrl)
      if (error) return { error }
      // A reset request resolves to a banner instead of navigating, so the
      // form's configured `onSuccess.toast.message` is the copy the operator
      // sees. Honouring it here is what lets a localized console (the French
      // `/_admin` recovery form) speak its own language — and phrase the
      // banner conditionally, matching Better Auth's always-200,
      // anti-enumeration contract. The English string is only the fallback.
      return { success: sentBanner(input, 'auth.resetSent', RESET_PASSWORD_SENT_MESSAGE) }
    }
    case 'setNewPassword':
      return { error: await handleSetNewPassword(password) }
  }
}
