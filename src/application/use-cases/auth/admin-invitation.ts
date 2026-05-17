/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseDuration } from '@/domain/utils/parse-duration'
import { resolvePasswordPolicy } from '@/domain/utils/password-policy'
import {
  deleteCredentialAccountForUser,
  deletePendingInvitationsForUser,
  deleteInvitationToken,
  findInvitationToken,
  findUserByEmail,
  findUserById,
  insertCredentialAccount,
  insertInvitationToken,
  markUserEmailVerified,
  userHasCredentialPassword,
} from '@/infrastructure/auth/better-auth/invitation-queries'
import { logError } from '@/infrastructure/logging/logger'
import type { Auth } from '@/domain/models/app/auth'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { createEmailHandlers } from '@/infrastructure/auth/better-auth/email-handlers'

/**
 * Default invitation token lifetime: 72 hours.
 *
 * Production B2B onboarding: customers may not check their email
 * immediately, so a generous default keeps the experience friendly. Apps
 * that need shorter lifetimes set `auth.invitationTokenExpiry`.
 */
const DEFAULT_EXPIRY_MS = 72 * 60 * 60 * 1000

/**
 * Resolve the invitation token expiry (in milliseconds) from auth config.
 *
 * Accepts either a duration string (`'72h'`, `'7d'`, ...) or a number of
 * milliseconds. Falls back to 72h on missing or malformed input — invalid
 * values were already filtered out by the AppSchema validator at startup,
 * so this is purely defensive.
 */
export const resolveInvitationExpiryMs = (authConfig?: Auth): number => {
  const raw = authConfig?.invitationTokenExpiry
  if (raw === undefined) return DEFAULT_EXPIRY_MS
  if (typeof raw === 'number') return raw
  const parsed = parseDuration(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EXPIRY_MS
}

/**
 * Generate an opaque, URL-safe single-use invitation token.
 *
 * 32 random bytes encoded as URL-safe base64 (no padding) yields a 43-char
 * token with ~256 bits of entropy. The character set matches the regex
 * `[A-Za-z0-9_-]+` used by the spec assertions to extract the token from
 * the email body.
 */
const generateInvitationToken = (): string => {
  const bytes = new Uint8Array(32)
  // eslint-disable-next-line functional/no-expression-statements -- crypto.getRandomValues mutates the buffer
  crypto.getRandomValues(bytes)
  // base64url encode without padding
  const base64 = Buffer.from(bytes).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Build the absolute /accept-invitation URL for a given token.
 *
 * `baseURL` comes from Better Auth's runtime configuration (BASE_URL env or
 * the Hono request URL); we keep the page route on the public host so the
 * customer's browser hits the same server that issued the token.
 */
export const buildAcceptInvitationUrl = (baseURL: string, token: string): string => {
  const trimmed = baseURL.replace(/\/$/, '')
  return `${trimmed}/accept-invitation?token=${token}`
}

/**
 * Result of a successful inviteUser call.
 */
export interface InviteUserSuccess {
  readonly status: 'invited'
  readonly user: {
    readonly id: string
    readonly email: string
    readonly name: string
  }
  readonly token: string
}

/**
 * Result of a failed inviteUser call (caller maps to HTTP status codes).
 */
export interface InviteUserFailure {
  readonly status: 'already-onboarded' | 'invalid-input' | 'internal-error'
  readonly message: string
}

export type InviteUserResult = InviteUserSuccess | InviteUserFailure

/**
 * Validate the inviteUser request body.
 *
 * Returns a sanitized payload, or an error result the route can hand back
 * directly. Keeping validation here means the route handler stays focused
 * on HTTP plumbing.
 */
const validateInviteInput = (body: {
  readonly email?: unknown
  readonly name?: unknown
  readonly role?: unknown
  readonly password?: unknown
}):
  | { readonly email: string; readonly name: string; readonly role: string }
  | InviteUserFailure => {
  if (typeof body.email !== 'string' || body.email.trim().length === 0) {
    return { status: 'invalid-input', message: 'email is required' }
  }
  const email = body.email.trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { status: 'invalid-input', message: 'email must be a valid email address' }
  }
  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    return { status: 'invalid-input', message: 'name is required' }
  }
  if (typeof body.role !== 'string' || body.role.trim().length === 0) {
    return { status: 'invalid-input', message: 'role is required' }
  }
  // Reject any password field — invitation flow is passwordless by design.
  if (body.password !== undefined) {
    return {
      status: 'invalid-input',
      message: 'password is not accepted for invitations; the customer sets their own',
    }
  }
  return { email, name: body.name.trim(), role: body.role.trim() }
}

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>
type EmailHandlers = Readonly<ReturnType<typeof createEmailHandlers>>

/**
 * Create or reuse a Better Auth user record for an invited email.
 *
 * If the user does not exist we ask Better Auth's admin API to create them
 * (using a long random throw-away password — Better Auth requires one, but
 * we never expose it and we never insert a credential account row, so the
 * user has no usable login until they accept the invitation).
 *
 * If the user exists but has NOT yet linked a credential account, we treat
 * them as "pending" and re-issue a fresh token (clearing any stale ones).
 *
 * If the user exists AND has a credential password, the email is already a
 * fully-onboarded user and we surface 422 to the caller.
 */
const findOrCreateInvitedUser = async (
  authInstance: AuthInstance,
  input: { readonly email: string; readonly name: string; readonly role: string }
): Promise<
  | {
      readonly outcome: 'ready'
      readonly user: { readonly id: string; readonly email: string; readonly name: string }
    }
  | InviteUserFailure
> => {
  const existing = await findUserByEmail(input.email)

  if (existing) {
    if (await userHasCredentialPassword(existing.id)) {
      return {
        status: 'already-onboarded',
        message:
          'A user with this email already exists and has completed onboarding. Use the password reset flow instead.',
      }
    }
    // Pending user — clear any stale invitation tokens and re-issue.
    // eslint-disable-next-line functional/no-expression-statements -- DB delete is a side effect
    await deletePendingInvitationsForUser(existing.id)
    return { outcome: 'ready', user: existing }
  }

  // Brand new user. Better Auth's admin createUser requires a password, so
  // we feed it a long random one (32 bytes ≈ 256 bits, safely above the
  // max-128-char enforced by buildAuthHooks). We immediately discard the
  // value AND strip the credential account row Better Auth links, so the
  // user cannot log in until the customer accepts the invitation and sets
  // their own password.
  const throwaway = `${crypto.randomUUID()}${crypto.randomUUID()}`.slice(0, 100)
  const createdUserId = await createPlaceholderUser(authInstance, input, throwaway)
  if (!createdUserId) {
    return { status: 'internal-error', message: 'Failed to create invited user record' }
  }

  // Better Auth's admin.createUser linked a credential account using the
  // throwaway password. Strip it so the user cannot accidentally sign in
  // with anything we generated — the invitation flow is the only path.
  // eslint-disable-next-line functional/no-expression-statements -- DB cleanup is a side effect
  await deleteCredentialAccountForUser(createdUserId)

  return {
    outcome: 'ready',
    user: { id: createdUserId, email: input.email, name: input.name },
  }
}

/**
 * Call Better Auth's admin.createUser API to provision a placeholder user.
 *
 * Returns the new user's id, or `undefined` when Better Auth refused the
 * request. The role string is widened at the call boundary because Better
 * Auth's plugin types insist on its closed `'user' | 'admin'` union while
 * Sovrium permits custom roles via `auth.roles[]`.
 */
const createPlaceholderUser = async (
  authInstance: AuthInstance,
  input: { readonly email: string; readonly name: string; readonly role: string },
  throwawayPassword: string
): Promise<string | undefined> => {
  try {
    const createResult = await authInstance.api.createUser({
      body: {
        email: input.email,
        name: input.name,
        role: input.role as 'user' | 'admin',
        password: throwawayPassword,
      },
    })
    if ('user' in createResult && createResult.user?.id) {
      return createResult.user.id
    }
    return undefined
  } catch (error) {
    logError('[admin-invitation] Better Auth createUser failed', error)
    return undefined
  }
}

/**
 * Issue an admin invitation: create or reuse the user, generate and store a
 * single-use token, and send the invitation email.
 *
 * Returns the token AND the placeholder user record so the route handler
 * can both build its JSON response AND surface the bare token in the
 * `Location` header for tooling (CI, automation) when needed.
 */
export const inviteUser = async (params: {
  readonly authInstance: AuthInstance
  readonly authConfig: Auth | undefined
  readonly emailHandlers: EmailHandlers
  readonly baseURL: string
  readonly inviterName: string
  readonly body: {
    readonly email?: unknown
    readonly name?: unknown
    readonly role?: unknown
    readonly password?: unknown
  }
}): Promise<InviteUserResult> => {
  const validation = validateInviteInput(params.body)
  if ('status' in validation) {
    return validation
  }

  const findOrCreate = await findOrCreateInvitedUser(params.authInstance, validation)
  if ('status' in findOrCreate) {
    return findOrCreate
  }
  const { user } = findOrCreate

  const token = generateInvitationToken()
  const expiryMs = resolveInvitationExpiryMs(params.authConfig)
  const expiresAt = new Date(Date.now() + expiryMs)

  const persistOk = await insertInvitationToken({
    id: crypto.randomUUID(),
    token,
    userId: user.id,
    expiresAt,
  }).then(
    () => true,
    (error: unknown) => {
      logError('[admin-invitation] Failed to persist invitation token', error)
      return false
    }
  )
  if (!persistOk) {
    return { status: 'internal-error', message: 'Failed to persist invitation token' }
  }

  const acceptUrl = buildAcceptInvitationUrl(params.baseURL, token)

  // Fire-and-forget — the email handler swallows errors internally. We
  // await so that test fixtures observing mailpit don't race the response.
  // eslint-disable-next-line functional/no-expression-statements -- email send is a side effect
  await params.emailHandlers.invitation({
    email: user.email,
    name: user.name,
    url: acceptUrl,
    inviterName: params.inviterName,
  })

  return { status: 'invited', user, token }
}

/**
 * Result of a successful acceptInvitation call.
 */
export interface AcceptInvitationSuccess {
  readonly status: 'accepted'
  readonly user: { readonly id: string; readonly email: string; readonly name: string }
}

/**
 * Result of a failed acceptInvitation call (caller maps to HTTP status).
 */
export interface AcceptInvitationFailure {
  readonly status: 'invalid-token' | 'expired-token' | 'invalid-input' | 'internal-error'
  readonly message: string
}

export type AcceptInvitationResult = AcceptInvitationSuccess | AcceptInvitationFailure

const isPasswordWithinPolicy = (password: string, authConfig?: Auth): string | undefined => {
  const { minLength, maxLength } = resolvePasswordPolicy(authConfig)
  if (password.length < minLength) return `Password must be at least ${minLength} characters`
  if (password.length > maxLength) return `Password must not exceed ${maxLength} characters`
  return undefined
}

/**
 * Validate the body of an accept-invitation request and the password
 * against the configured email-and-password policy. Splits validation out
 * of the main use-case so the orchestrator stays at a manageable size.
 */
const validateAcceptInput = (
  body: { readonly token?: unknown; readonly password?: unknown },
  authConfig: Auth | undefined
): { readonly token: string; readonly password: string } | AcceptInvitationFailure => {
  const { token, password } = body
  if (typeof token !== 'string' || token.length === 0) {
    return { status: 'invalid-input', message: 'token is required' }
  }
  if (typeof password !== 'string' || password.length === 0) {
    return { status: 'invalid-input', message: 'password is required' }
  }
  const policyError = isPasswordWithinPolicy(password, authConfig)
  if (policyError) {
    return { status: 'invalid-input', message: policyError }
  }
  return { token, password }
}

/**
 * Resolve the user record an invitation token was issued for.
 *
 * Re-fetches from the users table (rather than trusting the
 * verification.value blindly) so the caller has a fresh email + name to
 * use for sign-in / response building. Returns a failure result when the
 * user has been deleted between issuing and accepting (a rare race), in
 * which case the stale verification row is also removed best-effort.
 */
const resolveTokenUser = async (
  rowUserId: string,
  rowId: string
): Promise<
  { readonly id: string; readonly email: string; readonly name: string } | AcceptInvitationFailure
> => {
  const user = await findUserById(rowUserId)
  if (!user) {
    // eslint-disable-next-line functional/no-expression-statements -- best-effort cleanup
    await deleteInvitationToken(rowId).catch(() => undefined)
    return { status: 'invalid-token', message: 'Invitation token is invalid or already used' }
  }
  return user
}

/**
 * Hash a plain-text password using Better Auth's configured hasher.
 *
 * `auth.$context.password.hash` matches whatever Better Auth uses for
 * `/sign-up/email` (scrypt by default; configurable via
 * `emailAndPassword.password.hash`). Reusing it guarantees the credential
 * row we link is verifiable by Better Auth's standard sign-in flow.
 */
const hashWithAuthContext = async (
  authInstance: AuthInstance,
  password: string
): Promise<string | undefined> => {
  try {
    const ctx = await authInstance.$context
    return await ctx.password.hash(password)
  } catch (error) {
    logError('[admin-invitation] Failed to hash password', error)
    return undefined
  }
}

/**
 * Hash + link a credential account row for the invited user. Returns the
 * appropriate failure result when either step fails so the orchestrator
 * can short-circuit without re-implementing error handling.
 */
const linkPassword = async (
  authInstance: AuthInstance,
  userId: string,
  password: string
): Promise<AcceptInvitationFailure | undefined> => {
  const hashed = await hashWithAuthContext(authInstance, password)
  if (!hashed) {
    return { status: 'internal-error', message: 'Failed to set password' }
  }

  const linkResult = await insertCredentialAccount({
    id: crypto.randomUUID(),
    userId,
    hashedPassword: hashed,
  }).then(
    () => 'ok' as const,
    (error: unknown) => {
      logError('[admin-invitation] Failed to link credential account', error)
      return 'failed' as const
    }
  )
  if (linkResult === 'failed') {
    return { status: 'internal-error', message: 'Failed to set password' }
  }
  return undefined
}

/**
 * Best-effort post-acceptance bookkeeping: flip emailVerified=true (proven
 * by clicking the link) and consume the verification row (single-use).
 * Both are non-blocking — a failure here does not invalidate the
 * already-set password.
 */
const finalizeAcceptedInvitation = async (
  userId: string,
  invitationRowId: string
): Promise<void> => {
  // eslint-disable-next-line functional/no-expression-statements -- best-effort verification flag
  await markUserEmailVerified(userId).catch(() => undefined)
  // eslint-disable-next-line functional/no-expression-statements -- best-effort token consumption
  await deleteInvitationToken(invitationRowId).catch(() => undefined)
}

/**
 * Accept an admin invitation: validate the token, set the customer's
 * password (linking a credential account row), mark their email verified,
 * and consume the token.
 *
 * The route handler is responsible for translating the success result into
 * a Better Auth sign-in (so the customer ends up with a valid session
 * cookie); this function focuses purely on the token + password setup.
 */
export const acceptInvitation = async (params: {
  readonly authInstance: AuthInstance
  readonly authConfig: Auth | undefined
  readonly body: { readonly token?: unknown; readonly password?: unknown }
}): Promise<AcceptInvitationResult> => {
  const validated = validateAcceptInput(params.body, params.authConfig)
  if ('status' in validated) {
    return validated
  }

  const row = await findInvitationToken(validated.token)
  if (!row) {
    return { status: 'invalid-token', message: 'Invitation token is invalid or already used' }
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    // eslint-disable-next-line functional/no-expression-statements -- best-effort cleanup
    await deleteInvitationToken(row.id).catch(() => undefined)
    return { status: 'expired-token', message: 'Invitation token has expired' }
  }

  const userOrFailure = await resolveTokenUser(row.userId, row.id)
  if ('status' in userOrFailure) {
    return userOrFailure
  }
  const user = userOrFailure

  // If a credential row already exists (race condition with a parallel
  // accept) we treat the token as consumed and return the same response.
  if (await userHasCredentialPassword(user.id)) {
    // eslint-disable-next-line functional/no-expression-statements -- best-effort cleanup
    await deleteInvitationToken(row.id).catch(() => undefined)
    return { status: 'invalid-token', message: 'Invitation token is invalid or already used' }
  }

  const linkFailure = await linkPassword(params.authInstance, user.id, validated.password)
  if (linkFailure) return linkFailure

  // eslint-disable-next-line functional/no-expression-statements -- best-effort bookkeeping
  await finalizeAcceptedInvitation(user.id, row.id)
  return { status: 'accepted', user }
}
