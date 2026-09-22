/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A field rendered inside an auth form.
 *
 * This is the serialized contract that crosses the SSR-renderer → island
 * boundary: the auth-form renderer (`resolveAuthFormFields`) produces an array
 * of `AuthFormField`, serializes it into `data-island-props`, and the auth-form
 * island parses it back when it mounts. Both the renderer (`presentation/ui`)
 * and the island (`presentation/islands`) import this type so the produced and
 * consumed shapes can never drift.
 *
 * - `name` drives the input `name` / `data-field` / `id` attributes.
 * - `label` is the visible text.
 * - `required` drives required-field validation.
 * - `inputType` selects the native input type (`email` → `<input type="email">`,
 *   a password-like column → `<input type="password">`, otherwise `text`).
 */
export interface AuthFormField {
  readonly name: string
  readonly label: string
  readonly required: boolean
  readonly placeholder?: string
  readonly inputType: 'email' | 'password' | 'text'
}

/** The authentication flows an auth form / button can drive. */
export type AuthMethod = 'login' | 'signup' | 'logout' | 'resetPassword' | 'setNewPassword'

/** Submit-button label for each auth method. */
const SUBMIT_LABELS: Record<AuthMethod, string> = {
  login: 'Sign In',
  signup: 'Sign Up',
  logout: 'Log Out',
  resetPassword: 'Send Reset Link',
  setNewPassword: 'Set New Password',
}

/**
 * Resolve the English built-in submit-button label for an auth-form method.
 *
 * Accepts a loosely-typed `string | undefined` (the SSR renderer reads the
 * method off an untyped action schema) and falls back to the `login` label.
 *
 * This is the *fallback* used when the action declares no `submitLabel` and no
 * matching translation exists; the renderer first honors an action-level
 * `submitLabel` (with `$t:key` localization) before falling back here.
 */
export function authSubmitLabel(method: string | undefined): string {
  return SUBMIT_LABELS[method as AuthMethod] ?? SUBMIT_LABELS.login
}

/**
 * Pending (in-flight) submit-button label for each auth method — the text shown
 * while the request is running. Mirrors {@link SUBMIT_LABELS} so a localized
 * console never falls back to a bare, untranslated `Loading…`.
 */
const PENDING_LABELS: Record<AuthMethod, string> = {
  login: 'Signing in…',
  signup: 'Creating account…',
  logout: 'Logging out…',
  resetPassword: 'Sending…',
  setNewPassword: 'Saving…',
}

/**
 * Resolve the English built-in pending-button label for an auth-form method.
 *
 * The *fallback* used when the action declares no `pendingLabel`; the renderer
 * first honors an action-level `pendingLabel` (with `$t:key` localization) —
 * threaded to the island the same way `submitLabel` is — before falling back
 * here. Keeps the in-flight label localized on a non-English console (e.g. the
 * French admin dashboard shows `Connexion…`, never a hardcoded `Loading...`).
 */
export function authPendingLabel(method: string | undefined): string {
  return PENDING_LABELS[method as AuthMethod] ?? PENDING_LABELS.login
}

const EMAIL_FIELD: AuthFormField = {
  name: 'email',
  label: 'Email',
  required: true,
  inputType: 'email',
}

const PASSWORD_FIELD: AuthFormField = {
  name: 'password',
  label: 'Password',
  required: true,
  inputType: 'password',
}

/**
 * Default email + password fields used when an auth form does not declare an
 * explicit `fields[]` array.
 *
 * - `setNewPassword` → password only.
 * - `resetPassword` → email only.
 * - `login` / `signup` (and any unknown method) → email + password.
 */
export function defaultAuthFields(method: string): readonly AuthFormField[] {
  if (method === 'setNewPassword') return [PASSWORD_FIELD]
  if (method === 'resetPassword') return [EMAIL_FIELD]
  return [EMAIL_FIELD, PASSWORD_FIELD]
}

/**
 * Visible label for a social sign-in control ("Sign in with Google").
 *
 * The control is drawn TWICE — once by the SSR skeleton in the auth-form
 * renderer and once by the hydrated island — so the label lives here, the one
 * module both sides may import (`eslint-plugin-boundaries` forbids
 * `ui/sections` ↔ `islands` in BOTH directions; `presentation/utils` is the
 * only layer reachable from each). Keeping one copy is what guarantees the
 * button text is byte-identical across hydration, so the control neither
 * reflows nor changes wording when the island mounts.
 */
export function oauthSubmitLabel(provider: string): string {
  const name = provider.charAt(0).toUpperCase() + provider.slice(1)
  return `Sign in with ${name}`
}
