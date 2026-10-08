/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isValidEmail } from '@/domain/kernel/sanitize/email-validation'
import { resolvePasswordPolicy } from '@/domain/models/app/auth/password-policy'
import {
  assignableRoleNames,
  isAdminEquivalent,
  isAssignableRole,
} from '@/domain/models/app/auth/roles'
import {
  buildInvitationLink,
  invitationLinkTarget,
  type InvitationLinkPage,
} from '@/domain/models/app/pages/invitation-link-service'
import { logError } from '@/infrastructure/logging/logger'
import {
  findOrCreateInvitedUser,
  mintInvitationToken,
  type InviteUserFailure,
  type InviteUserResult,
} from './invitation-issuance'
import type {
  InvitationAuthEngine,
  InvitationMailer,
  InvitationServices,
  InvitationStore,
} from '@/application/ports/contracts/invitation-services'
import type { Auth } from '@/domain/models/app/auth'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'

/**
 * Build the absolute invitation URL for a given token.
 *
 * It opens the app's own invitation page — the first page declaring
 * `invitation`, with the token under the key its `param` names — or the
 * built-in `/accept-invitation` when the app declares none
 * ({@link invitationLinkTarget}). `baseURL` comes from Better Auth's runtime
 * configuration (BASE_URL env or the Hono request URL); we keep the page route
 * on the public host so the customer's browser hits the same server that
 * issued the token.
 */
export const buildAcceptInvitationUrl = (
  baseURL: string,
  token: string,
  pages?: readonly InvitationLinkPage[]
): string => buildInvitationLink(baseURL, token, invitationLinkTarget(pages))

/**
 * A legible stand-in display name for an invitation issued without one.
 *
 * The address's local part with its separators turned into spaces — enough for
 * an operator to recognise the row in a directory, and never presented as a
 * name the person chose.
 */
const displayNameFromEmail = (email: string): string => {
  const local = email.split('@')[0] ?? email
  const spaced = local.replaceAll(/[._-]+/g, ' ').trim()
  return spaced.length > 0 ? spaced : email
}

/**
 * Validate the inviteUser request body.
 *
 * Returns a sanitized payload, or an error result the route can hand back
 * directly. Keeping validation here means the route handler stays focused
 * on HTTP plumbing.
 */
const validateInviteInput = (
  body: {
    readonly email?: unknown
    readonly name?: unknown
    readonly role?: unknown
    readonly password?: unknown
  },
  app: AdminRoleResolvable
): { readonly email: string; readonly name: string; readonly role: string } | InviteUserFailure => {
  if (typeof body.email !== 'string' || body.email.trim().length === 0) {
    return { status: 'invalid-input', message: 'email is required' }
  }
  const email = body.email.trim().toLowerCase()
  if (!isValidEmail(email)) {
    return { status: 'invalid-input', message: 'email must be a valid email address' }
  }
  // A display name is accepted but not demanded. The operator issuing an
  // invitation reliably knows the address and often not how the person spells
  // their own name, so requiring it puts a guess in front of the one fact that
  // is certain — and a guessed name is worse than none, since the invitee never
  // gets to correct it (the accept page asks only for a password). Falling back
  // to the address's local part gives the account a legible label until then.
  //
  // Strictly more permissive than the previous "name is required": a supplied
  // name still wins, so no caller that worked before behaves differently.
  const name =
    typeof body.name === 'string' && body.name.trim().length > 0
      ? body.name.trim()
      : displayNameFromEmail(email)
  if (typeof body.role !== 'string' || body.role.trim().length === 0) {
    return { status: 'invalid-input', message: 'role is required' }
  }
  // The invitation must carry a role this app actually knows.
  //
  // `invite-user` is a Sovrium-owned Hono route chained AHEAD of Better Auth, so
  // Better Auth's `before` hook — and therefore `validateAssignableRole`
  // (`admin-role-guards.ts`) — never runs on it. Without this check the
  // invitation path is a hole straight through the closed role vocabulary
  // `isAssignableRole` exists to enforce: a typo (`'custmer-member'`) is stored
  // verbatim and mints an account matching no permission rule, while an invented
  // name (`'superadmin'`) reads as privileged to a human auditor while
  // conferring nothing. Checked HERE, before any user record or token is minted,
  // so a refusal leaves no pending grant behind.
  //
  // Same predicate and same message shape as the Better Auth write boundary, so
  // the two paths cannot drift into disagreeing about what a valid role is.
  const role = body.role.trim()
  if (!isAssignableRole(role, app)) {
    const valid = [...assignableRoleNames(app)].toSorted().join(', ')
    return {
      status: 'invalid-input',
      message: `Role '${role}' is not assignable. Valid roles: ${valid}.`,
    }
  }
  // Reject any password field — invitation flow is passwordless by design.
  if (body.password !== undefined) {
    return {
      status: 'invalid-input',
      message: 'password is not accepted for invitations; the customer sets their own',
    }
  }
  return { email, name, role }
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
  readonly services: InvitationServices
  readonly authConfig: Auth | undefined
  readonly emailHandlers: InvitationMailer
  readonly baseURL: string
  readonly inviterName: string
  /**
   * The inviting operator's user id, recorded on the invitation so the pending
   * list can answer "who sent this?". Optional so a caller that has no session
   * to attribute (tooling) still issues a valid invitation rather than failing.
   */
  readonly inviterId?: string | undefined
  /**
   * The inviting caller's role. Present only when a session issued the
   * invitation. It answers one question: is this a SCOPED inviter, whose tenant
   * the invitee must inherit, or an admin-equivalent one, who has no tenant to
   * pass on? Absent, the invitation behaves exactly as it did before scoped
   * invitations existed.
   */
  readonly inviterRole?: string | undefined
  /**
   * The app whose role vocabulary the invitation's `role` must belong to, and
   * whose invitation page the emailed link opens.
   */
  readonly app: AdminRoleResolvable & { readonly pages?: readonly InvitationLinkPage[] }
  readonly body: {
    readonly email?: unknown
    readonly name?: unknown
    readonly role?: unknown
    readonly password?: unknown
  }
}): Promise<InviteUserResult> => {
  const validation = validateInviteInput(params.body, params.app)
  if ('status' in validation) {
    return validation
  }

  const findOrCreate = await findOrCreateInvitedUser(params.services, validation)
  if ('status' in findOrCreate) {
    return findOrCreate
  }
  const { user } = findOrCreate

  // A scoped inviter passes their tenant on; an admin-equivalent one has none to
  // pass. Gating on `isAdminEquivalent` keeps the long-standing admin-issued
  // invitation byte-identical to what it was: it never touched `user_access`, and
  // it still does not.
  if (
    params.inviterId !== undefined &&
    params.inviterRole !== undefined &&
    !isAdminEquivalent(params.inviterRole, params.app)
  ) {
    // eslint-disable-next-line functional/no-expression-statements -- scope inheritance is a side effect
    await params.services.store.inheritScopeAssignments({
      inviterId: params.inviterId,
      inviteeId: user.id,
      role: validation.role,
    })
  }

  const token = await mintInvitationToken(params, user.id)
  if (token === undefined) {
    return { status: 'internal-error', message: 'Failed to persist invitation token' }
  }

  // Fire-and-forget — the email handler swallows errors internally. We
  // await so that test fixtures observing mailpit don't race the response.
  await params.emailHandlers.invitation({
    email: user.email,
    name: user.name,
    url: buildAcceptInvitationUrl(params.baseURL, token, params.app.pages),
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
  store: InvitationStore,
  rowUserId: string,
  rowId: string
): Promise<
  { readonly id: string; readonly email: string; readonly name: string } | AcceptInvitationFailure
> => {
  const user = await store.findUserById(rowUserId)
  if (!user) {
    // eslint-disable-next-line functional/no-expression-statements -- best-effort cleanup
    await store.deleteInvitationToken(rowId).catch(() => undefined)
    return { status: 'invalid-token', message: 'Invitation token is invalid or already used' }
  }
  return user
}

/**
 * Hash a plain-text password with the auth engine's configured hasher, so the
 * credential row the flow links is verifiable by the engine's own sign-in.
 */
const hashWithAuthEngine = async (
  engine: InvitationAuthEngine,
  password: string
): Promise<string | undefined> => {
  try {
    return await engine.hashPassword(password)
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
  { store, engine }: InvitationServices,
  userId: string,
  password: string
): Promise<AcceptInvitationFailure | undefined> => {
  const hashed = await hashWithAuthEngine(engine, password)
  if (!hashed) {
    return { status: 'internal-error', message: 'Failed to set password' }
  }

  const linkResult = await store
    .insertCredentialAccount({
      id: crypto.randomUUID(),
      userId,
      hashedPassword: hashed,
    })
    .then(
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
  store: InvitationStore,
  userId: string,
  invitationRowId: string
): Promise<void> => {
  // eslint-disable-next-line functional/no-expression-statements -- best-effort verification flag
  await store.markUserEmailVerified(userId).catch(() => undefined)
  // eslint-disable-next-line functional/no-expression-statements -- best-effort token consumption
  await store.deleteInvitationToken(invitationRowId).catch(() => undefined)
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
  readonly services: InvitationServices
  readonly authConfig: Auth | undefined
  readonly body: { readonly token?: unknown; readonly password?: unknown }
}): Promise<AcceptInvitationResult> => {
  const validated = validateAcceptInput(params.body, params.authConfig)
  if ('status' in validated) {
    return validated
  }

  const row = await params.services.store.findInvitationToken(validated.token)
  if (!row) {
    return { status: 'invalid-token', message: 'Invitation token is invalid or already used' }
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    // eslint-disable-next-line functional/no-expression-statements -- best-effort cleanup
    await params.services.store.deleteInvitationToken(row.id).catch(() => undefined)
    return { status: 'expired-token', message: 'Invitation token has expired' }
  }

  const userOrFailure = await resolveTokenUser(params.services.store, row.userId, row.id)
  if ('status' in userOrFailure) {
    return userOrFailure
  }
  const user = userOrFailure

  // If a credential row already exists (race condition with a parallel
  // accept) we treat the token as consumed and return the same response.
  if (await params.services.store.userHasCredentialPassword(user.id)) {
    // eslint-disable-next-line functional/no-expression-statements -- best-effort cleanup
    await params.services.store.deleteInvitationToken(row.id).catch(() => undefined)
    return { status: 'invalid-token', message: 'Invitation token is invalid or already used' }
  }

  const linkFailure = await linkPassword(params.services, user.id, validated.password)
  if (linkFailure) return linkFailure

  await finalizeAcceptedInvitation(params.services.store, user.id, row.id)
  return { status: 'accepted', user }
}
