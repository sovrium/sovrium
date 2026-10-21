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
 * boundary: the auth-form field resolver (`resolveAuthFormFields`) produces an array
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
 * - `autoComplete` / `inputMode` are the browser hints, decided once by
 *   {@link withAuthFieldHints} so the skeleton and the island draw the same.
 * - `errorId` is the id of the field's inline-error region, unique per form so
 *   two forms on one page never share one.
 * - `labelKey` names the catalogue key a built-in default label is worded by.
 * - `rule` is the password rule a field that SETS a password states under it
 *   ("At least 8 characters"), worded by the server in the page language.
 */
export interface AuthFormField {
  readonly name: string
  readonly label: string
  readonly required: boolean
  readonly placeholder?: string
  readonly inputType: 'email' | 'password' | 'text'
  readonly autoComplete?: string
  readonly inputMode?: 'numeric'
  readonly errorId?: string
  /**
   * The catalogue key a built-in field's label is worded by (`auth.email`,
   * `auth.password`): the renderer words it in the page language and drops
   * the key, so it never reaches the island.
   */
  readonly labelKey?: string
  /** The rule under a new-password field, already in the page language. */
  readonly rule?: string
  /**
   * A sign-in password field's way back in: the link drawn at the end of its
   * label row, to the app's password-reset request page, worded in the page
   * language.
   */
  readonly recovery?: { readonly href: string; readonly text: string }
}

/** What an auth form's browser hints depend on. */
export interface AuthFieldHintContext {
  readonly method: string
  /** The action's `strategy`, or its `factor` for a second-factor step. */
  readonly variant?: string
  /** The app offers passkeys, so a sign-in email field also offers them. */
  readonly passkeyAutofill?: boolean
}

/** Methods whose password field asks for the password the reader already has. */
const CURRENT_PASSWORD_METHODS: ReadonlySet<string> = new Set([
  'login',
  'enableTwoFactor',
  'disableTwoFactor',
  'regenerateBackupCodes',
])

/** The factors whose code a device can autofill: digits from an authenticator app. */
const ONE_TIME_CODE_FACTORS: ReadonlySet<string> = new Set(['totp'])

/** The `autocomplete` and `inputmode` a field takes in a form of `context`. */
function fieldHints(
  field: AuthFormField,
  context: AuthFieldHintContext
): Pick<AuthFormField, 'autoComplete' | 'inputMode'> {
  const { method, variant, passkeyAutofill } = context
  if (field.inputType === 'email')
    return {
      autoComplete: method === 'login' && passkeyAutofill === true ? 'username webauthn' : 'email',
    }
  if (field.inputType === 'password')
    return {
      autoComplete: CURRENT_PASSWORD_METHODS.has(method) ? 'current-password' : 'new-password',
    }
  if (method === 'verifyTwoFactor' && field.name === 'code')
    return variant === undefined || ONE_TIME_CODE_FACTORS.has(variant)
      ? { autoComplete: 'one-time-code', inputMode: 'numeric' }
      : { autoComplete: 'off' }
  return {}
}

/**
 * The fields with their browser hints and per-form error ids filled in.
 *
 * - an email is `email`, or `username webauthn` on a sign-in form of an app
 *   offering passkeys, so the browser proposes a saved passkey in the field;
 * - a password is `current-password` where the reader types the one they have
 *   (signing in, confirming a two-step change) and `new-password` elsewhere;
 * - a second-factor code from an authenticator app is `one-time-code` with a
 *   numeric keyboard; a recovery code is not autofilled.
 *
 * The error id is scoped by the form's method and variant, so a page carrying
 * the code form and the recovery-code form names two distinct regions.
 */
export function withAuthFieldHints(
  fields: readonly AuthFormField[],
  context: AuthFieldHintContext
): readonly AuthFormField[] {
  const scope = [context.method, context.variant].filter(Boolean).join('-')
  return fields.map((field) => ({
    ...field,
    ...fieldHints(field, context),
    errorId: `${scope}-${field.name}-error`,
  }))
}

/** The id of a field's inline-error region; the bare `<name>-error` for an older payload. */
export const authFieldErrorId = (field: AuthFormField): string =>
  field.errorId ?? `${field.name}-error`

/** The authentication flows an auth form / button can drive. */
export type AuthMethod = 'login' | 'signup' | 'logout' | 'resetPassword' | 'setNewPassword'

/**
 * The account methods an auth FORM runs — the second-factor step, two-step
 * enrolment, invitations answered from their link, a new API key, signing the
 * other devices out. The island draws them from a lazily loaded module, so a
 * sign-in page never downloads the enrolment screens.
 */
const ACCOUNT_FORM_METHODS: ReadonlySet<string> = new Set([
  'verifyTwoFactor',
  'enableTwoFactor',
  'disableTwoFactor',
  'regenerateBackupCodes',
  'acceptInvitation',
  'declineInvitation',
  'createApiKey',
  'revokeOtherSessions',
  'linkAccount',
  'unlinkAccount',
])

/** The account methods that connect or disconnect a sign-in provider (`provider`). */
export const isAccountLinkMethod = (method: string | undefined): boolean =>
  method === 'linkAccount' || method === 'unlinkAccount'

/**
 * The engine strings (catalogue keys, by prefix) each auth form speaks in the
 * page language: the enrolment and recovery-codes screens, the banner a
 * password sign-in shows while a two-step code is owed, the « check your
 * email » a mailed link answers with, the second step's « trust this device »
 * and a new API key's reveal.
 */
const ENGINE_STRING_PREFIXES: Readonly<Record<string, readonly string[]>> = {
  login: ['twoFactor.pendingSignIn', 'auth.magicLinkSent'],
  resetPassword: ['auth.resetSent'],
  verifyTwoFactor: ['auth.trustDevice'],
  enableTwoFactor: ['twoFactor.'],
  regenerateBackupCodes: ['twoFactor.'],
  createApiKey: ['apiKeys.copyOnce', 'apiKeys.copiedConfirm', 'apiKeys.done'],
}

/**
 * The catalogue key prefixes an auth form of `method` resolves for its island:
 * its own, the error summary's sentence and the field messages every form can show.
 */
export const authFormStringPrefixes = (method: string): readonly string[] => [
  ...(ENGINE_STRING_PREFIXES[method] ?? []),
  'auth.fixErrors',
  'auth.required',
  'auth.invalidEmail',
]

/** Whether a form's method is one of the account methods. */
export const isAccountFormMethod = (method: string | undefined): boolean =>
  method !== undefined && ACCOUNT_FORM_METHODS.has(method)

/** Submit-button label for each auth method. */
const SUBMIT_LABELS: Readonly<Record<string, string>> = {
  login: 'Sign In',
  signup: 'Sign Up',
  logout: 'Log Out',
  resetPassword: 'Send Reset Link',
  setNewPassword: 'Set New Password',
  verifyTwoFactor: 'Verify',
  enableTwoFactor: 'Turn on two-step verification',
  disableTwoFactor: 'Turn off two-step verification',
  regenerateBackupCodes: 'Regenerate codes',
  acceptInvitation: 'Accept invitation',
  declineInvitation: 'Decline',
  createApiKey: 'Create key',
  revokeOtherSessions: 'Sign out of other devices',
  linkAccount: 'Connect',
  unlinkAccount: 'Disconnect',
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
  return SUBMIT_LABELS[method ?? 'login'] ?? 'Sign In'
}

/**
 * Pending (in-flight) submit-button label for each auth method — the text shown
 * while the request is running. Mirrors {@link SUBMIT_LABELS} so a localized
 * console never falls back to a bare, untranslated `Loading…`.
 */
const PENDING_LABELS: Readonly<Record<string, string>> = {
  login: 'Signing in…',
  signup: 'Creating account…',
  logout: 'Logging out…',
  resetPassword: 'Sending…',
  setNewPassword: 'Saving…',
  verifyTwoFactor: 'Verifying…',
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
  if (isAccountFormMethod(method)) return PENDING_LABELS[method ?? ''] ?? 'Saving…'
  return PENDING_LABELS[method ?? 'login'] ?? 'Signing in…'
}

/**
 * The catalogue key of a method's built-in submit word (`auth.submit.<method>`),
 * or `undefined` for a method the catalogue words no submit for.
 */
export function authSubmitLabelKey(method: string | undefined): string | undefined {
  const key = method ?? 'login'
  if (key === 'verifyTwoFactor') return 'twoFactor.verify'
  return SUBMIT_LABELS[key] === undefined ? undefined : `auth.submit.${key}`
}

/** The catalogue key of each method's built-in in-flight word, where it is not `form.saving`. */
const PENDING_LABEL_KEYS: Readonly<Record<string, string>> = {
  login: 'auth.pending.login',
  signup: 'auth.pending.signup',
  logout: 'auth.pending.logout',
  resetPassword: 'form.sending',
  setNewPassword: 'form.saving',
  verifyTwoFactor: 'auth.pending.verifyTwoFactor',
}

/** The catalogue key of a method's built-in in-flight word, mirroring {@link authPendingLabel}. */
export function authPendingLabelKey(method: string | undefined): string {
  if (isAccountFormMethod(method)) return PENDING_LABEL_KEYS[method ?? ''] ?? 'form.saving'
  return PENDING_LABEL_KEYS[method ?? 'login'] ?? 'auth.pending.login'
}

const EMAIL_FIELD: AuthFormField = {
  name: 'email',
  label: 'Email',
  labelKey: 'auth.email',
  required: true,
  inputType: 'email',
}

const PASSWORD_FIELD: AuthFormField = {
  name: 'password',
  label: 'Password',
  labelKey: 'auth.password',
  required: true,
  inputType: 'password',
}

/** The one field the second-factor step asks for, named after its factor. */
const codeField = (factor: string | undefined): AuthFormField => ({
  name: 'code',
  label: factor === 'backupCode' ? 'Recovery code' : 'Verification code',
  labelKey: factor === 'backupCode' ? 'auth.recoveryCode' : 'twoFactor.code',
  required: true,
  inputType: 'text',
})

/** The account methods whose form is one password field confirming the change. */
const PASSWORD_ONLY_METHODS: ReadonlySet<string> = new Set([
  'enableTwoFactor',
  'disableTwoFactor',
  'regenerateBackupCodes',
  'acceptInvitation',
])

/** The fields of an account method's form; `undefined` for any other method. */
function accountMethodFields(
  method: string,
  factor?: string
): readonly AuthFormField[] | undefined {
  if (method === 'verifyTwoFactor') return [codeField(factor)]
  if (method === 'createApiKey')
    return [
      { name: 'name', label: 'Name', labelKey: 'auth.keyName', required: true, inputType: 'text' },
    ]
  if (PASSWORD_ONLY_METHODS.has(method)) return [PASSWORD_FIELD]
  return isAccountFormMethod(method) ? [] : undefined
}

/**
 * Default email + password fields used when an auth form does not declare an
 * explicit `fields[]` array.
 *
 * - `setNewPassword` → password only.
 * - `resetPassword` → email only.
 * - `login` with the `magicLink` strategy → email only: the link mailed to that
 *   address IS the credential, so a password input would ask for something the
 *   sign-in never reads.
 * - `logout` → nothing: signing out needs no input, so the form is its button.
 * - `login` / `signup` (and any unknown method) → email + password.
 * - an account method → its own fields: the code (named by `strategy`, which
 *   carries the action's `factor` for `verifyTwoFactor`), the password that
 *   confirms a two-step change or sets an invitee's account, a new key's name,
 *   or nothing at all.
 */
export function defaultAuthFields(method: string, strategy?: string): readonly AuthFormField[] {
  const account = accountMethodFields(method, strategy)
  if (account !== undefined) return account
  if (method === 'logout') return []
  if (method === 'setNewPassword') return [PASSWORD_FIELD]
  if (method === 'resetPassword') return [EMAIL_FIELD]
  if (method === 'login' && strategy === 'magicLink') return [EMAIL_FIELD]
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
