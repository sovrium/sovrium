/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseDuration } from '@/domain/kernel/time/parse-duration'
import { logError } from '@/infrastructure/logging/logger'
import type {
  InvitationAuthEngine,
  InvitationStore,
} from '@/application/ports/contracts/invitation-services'
import type { InvitationIssuingServices } from '@/application/ports/services/invitation-issuer'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Issuing an invitation: the invitee's account with no credential, and a
 * stored single-use token. Shared by the emailed invitation ({@link
 * inviteUser} in `admin-invitation.ts`) and the one a seed run prints.
 */

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
export const findOrCreateInvitedUser = async (
  { store, engine }: InvitationIssuingServices,
  input: { readonly email: string; readonly name: string; readonly role: string }
): Promise<
  | {
      readonly outcome: 'ready'
      readonly user: { readonly id: string; readonly email: string; readonly name: string }
    }
  | InviteUserFailure
> => {
  const existing = await store.findUserByEmail(input.email)

  if (existing) {
    if (await store.userHasCredentialPassword(existing.id)) {
      return {
        status: 'already-onboarded',
        message:
          'A user with this email already exists and has completed onboarding. Use the password reset flow instead.',
      }
    }
    // Pending user — clear any stale invitation tokens and re-issue.
    await store.deletePendingInvitationsForUser(existing.id)
    return { outcome: 'ready', user: existing }
  }

  // Brand new user. Better Auth's admin createUser requires a password, so
  // we feed it a long random one (32 bytes ≈ 256 bits, safely above the
  // max-128-char enforced by buildAuthHooks). We immediately discard the
  // value AND strip the credential account row Better Auth links, so the
  // user cannot log in until the customer accepts the invitation and sets
  // their own password.
  const throwaway = `${crypto.randomUUID()}${crypto.randomUUID()}`.slice(0, 100)
  const createdUserId = await createPlaceholderUser(engine, input, throwaway)
  if (!createdUserId) {
    return { status: 'internal-error', message: 'Failed to create invited user record' }
  }

  // Better Auth's admin.createUser linked a credential account using the
  // throwaway password. Strip it so the user cannot accidentally sign in
  // with anything we generated — the invitation flow is the only path.
  await store.deleteCredentialAccountForUser(createdUserId)

  return {
    outcome: 'ready',
    user: { id: createdUserId, email: input.email, name: input.name },
  }
}

/**
 * Ask the auth engine to provision a placeholder user.
 *
 * Returns the new user's id, or `undefined` when the engine refused the
 * request (the refusal is logged here, where its cause is still in scope).
 */
const createPlaceholderUser = async (
  engine: Pick<InvitationAuthEngine, 'createUser'>,
  input: { readonly email: string; readonly name: string; readonly role: string },
  throwawayPassword: string
): Promise<string | undefined> => {
  try {
    return await engine.createUser({ ...input, password: throwawayPassword })
  } catch (error) {
    logError('[admin-invitation] Better Auth createUser failed', error)
    return undefined
  }
}

/**
 * Persist the invitation row, reporting success as a boolean.
 *
 * `invitedBy` is the inviting operator's user id, recorded so the pending list
 * can answer "who sent this?" — it was previously persisted nowhere.
 *
 * Returns `false` rather than throwing so the caller maps the failure onto its
 * own result union; the error is logged here where the cause is still in scope.
 */
const persistInvitation = async (
  store: InvitationStore,
  row: {
    readonly token: string
    readonly userId: string
    readonly expiresAt: Readonly<Date>
    readonly invitedBy: string | undefined
  }
): Promise<boolean> =>
  store
    .insertInvitationToken({ id: crypto.randomUUID(), ...row, expiresAt: row.expiresAt as Date })
    .then(
      () => true,
      (error: unknown) => {
        logError('[admin-invitation] Failed to persist invitation token', error)
        return false
      }
    )

/**
 * Mint a single-use token for `userId` and store it, expiring after the app's
 * `auth.invitationTokenExpiry`. `undefined` when the row could not be written.
 */
export const mintInvitationToken = async (
  params: {
    readonly services: InvitationIssuingServices
    readonly authConfig: Auth | undefined
    readonly inviterId?: string | undefined
  },
  userId: string
): Promise<string | undefined> => {
  const token = generateInvitationToken()
  const expiresAt = new Date(Date.now() + resolveInvitationExpiryMs(params.authConfig))
  const row = { token, userId, expiresAt, invitedBy: params.inviterId }
  return (await persistInvitation(params.services.store, row)) ? token : undefined
}

/**
 * Issue a pending invitation WITHOUT sending it: the account with no credential
 * and the stored token, as an emailed invitation has them. For a caller that
 * hands the link over itself — a seed run prints it, since a demo has no
 * mailbox. The input is trusted to be valid (the caller checked the address and
 * the role), and an address that already signs in is refused as by
 * {@link inviteUser}.
 */
export const issueInvitation = async (params: {
  readonly services: InvitationIssuingServices
  readonly authConfig: Auth | undefined
  readonly invitee: { readonly email: string; readonly name: string; readonly role: string }
  readonly inviterId?: string | undefined
}): Promise<InviteUserResult> => {
  const found = await findOrCreateInvitedUser(params.services, params.invitee)
  if ('status' in found) return found
  const token = await mintInvitationToken(params, found.user.id)
  return token === undefined
    ? { status: 'internal-error', message: 'Failed to persist invitation token' }
    : { status: 'invited', user: found.user, token }
}
