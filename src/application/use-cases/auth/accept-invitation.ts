/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Accepting an admin invitation: the token checked, the password set, the
 * address verified and the acceptance announced to the app's auth automations.
 * An Effect program over the {@link Invitations} services.
 */

import { Effect } from 'effect'
import {
  invitationCall,
  Invitations,
  type InvitationServiceError,
} from '@/application/ports/services/invitations'
import { resolvePasswordPolicy } from '@/domain/models/app/auth/password-policy'
import { logError } from '@/infrastructure/logging/logger'
import {
  claimAndSetPassword,
  markAcceptedAddressVerified,
  USED_TOKEN_MESSAGE,
} from './invitation-acceptance'
import type {
  InvitationServices,
  InvitationStore,
  InvitationTokenRow,
  InvitationUser,
} from '@/application/ports/contracts/invitation-services'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Result of a successful acceptInvitation call.
 */
export interface AcceptInvitationSuccess {
  readonly status: 'accepted'
  readonly user: { readonly id: string; readonly email: string; readonly name: string }
  /** The role the invitation granted, as the account now holds it. */
  readonly role: string | null
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
const resolveTokenUser = (
  store: InvitationStore,
  rowUserId: string,
  rowId: string
): Effect.Effect<InvitationUser | AcceptInvitationFailure, InvitationServiceError> =>
  Effect.gen(function* () {
    const user = yield* invitationCall('read the invitee', () => store.findUserById(rowUserId))
    if (!user) {
      yield* discardToken(store, rowId)
      return { status: 'invalid-token', message: USED_TOKEN_MESSAGE } as const
    }
    return user
  })

/**
 * Who sent the invitation, as the `invitationAccepted` trigger hands it on:
 * `null` when no sender was recorded or the account is gone, or the lookup failed.
 */
const inviterOf = (
  store: InvitationStore,
  invitedBy: string | undefined
): Effect.Effect<{ readonly id: string; readonly email: string; readonly name: string } | null> =>
  invitedBy === undefined
    ? Effect.succeed(null)
    : invitationCall('read the inviter', () => store.findUserById(invitedBy)).pipe(
        Effect.map((inviter) =>
          inviter === undefined
            ? null
            : { id: inviter.id, email: inviter.email, name: inviter.name }
        ),
        Effect.tapCause((cause) =>
          Effect.sync(() => logError('[admin-invitation] Failed to read the inviter', cause))
        ),
        // effect-swallow: logged above; the trigger hands on `invitedBy: null`, as for an invitation that recorded no sender.
        Effect.orElseSucceed(() => null)
      )

/**
 * Fire the auth events an acceptance caused, in their order: `emailVerified`
 * when the address was newly verified, then `invitationAccepted` (the route's
 * sign-in fires `signIn` after). The payload carries the account, its role, who
 * invited it and when — never the link token, never the password.
 */
const announceAcceptance = (
  services: InvitationServices,
  accepted: {
    readonly user: InvitationUser
    readonly row: InvitationTokenRow
    readonly newlyVerified: boolean
  }
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const dispatch = services.dispatchAuthEvent
    if (dispatch === undefined) return
    const { user, row } = accepted
    if (accepted.newlyVerified) {
      yield* announce(() => dispatch('emailVerified', { ...user, emailVerified: true }))
    }
    const invitedBy = yield* inviterOf(services.store, row.invitedBy)
    yield* announce(() =>
      dispatch(
        'invitationAccepted',
        { ...user },
        {
          role: user.role ?? null,
          invitedBy,
          invitationCreatedAt: row.createdAt?.toISOString() ?? null,
        }
      )
    )
  })

/**
 * Remove a token that can no longer be accepted (gone user, expired, already
 * answered). Best-effort: the refusal stands either way, and a row left behind
 * is unusable — it names no account, or it is past its expiry.
 */
const discardToken = (store: InvitationStore, rowId: string): Effect.Effect<void> =>
  invitationCall('discard the invitation token', () => store.deleteInvitationToken(rowId)).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[admin-invitation] Failed to discard the invitation token', cause)
      )
    ),
    // effect-swallow: logged above; the acceptance is refused either way, and the row left behind cannot be accepted.
    Effect.ignore
  )

/**
 * Hand one auth event to the app's automations. The dispatcher never rejects
 * (its contract); a rejection anyway is logged and the acceptance still stands.
 */
const announce = (dispatch: () => Promise<void>): Effect.Effect<void> =>
  invitationCall('start the auth automations', dispatch).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[admin-invitation] the auth automations failed to start', cause))
    ),
    // effect-swallow: logged above; an automation must never fail the acceptance it reacts to.
    Effect.ignore
  )

/**
 * The invitation a token names and the account it was issued for, when it can
 * still be accepted: known, not expired, the account still there and not yet
 * holding a password. Anything else answers the acceptance's refusal, and a
 * token that can no longer be accepted is discarded.
 */
const resolvePendingInvitation = (
  store: InvitationStore,
  token: string
): Effect.Effect<
  { readonly row: InvitationTokenRow; readonly user: InvitationUser } | AcceptInvitationFailure,
  InvitationServiceError
> =>
  Effect.gen(function* () {
    const row = yield* invitationCall('find the invitation token', () =>
      store.findInvitationToken(token)
    )
    if (!row) return { status: 'invalid-token', message: USED_TOKEN_MESSAGE } as const

    if (row.expiresAt.getTime() <= Date.now()) {
      yield* discardToken(store, row.id)
      return { status: 'expired-token', message: 'Invitation token has expired' } as const
    }

    const user = yield* resolveTokenUser(store, row.userId, row.id)
    if ('status' in user) return user

    // If a credential row already exists (race condition with a parallel
    // accept) we treat the token as consumed and return the same response.
    const hasPassword = yield* invitationCall('read the invitee credential', () =>
      store.userHasCredentialPassword(user.id)
    )
    if (hasPassword) {
      yield* discardToken(store, row.id)
      return { status: 'invalid-token', message: USED_TOKEN_MESSAGE } as const
    }
    return { row, user }
  })

/**
 * Accept an admin invitation: validate the token, set the customer's
 * password (linking a credential account row), mark their email verified,
 * consume the token, and fire the auth events the acceptance caused.
 *
 * The route handler is responsible for translating the success result into
 * a Better Auth sign-in (so the customer ends up with a valid session
 * cookie); this program focuses purely on the token + password setup.
 */
export const acceptInvitation = Effect.fn('auth.accept-invitation')(function* (params: {
  readonly authConfig: Auth | undefined
  readonly body: { readonly token?: unknown; readonly password?: unknown }
}): Effect.fn.Return<AcceptInvitationResult, InvitationServiceError, Invitations> {
  const validated = validateAcceptInput(params.body, params.authConfig)
  if ('status' in validated) {
    return validated
  }

  const services = yield* Invitations
  const pending = yield* resolvePendingInvitation(services.store, validated.token)
  if ('status' in pending) return pending
  const { row, user } = pending

  const setupFailure = yield* claimAndSetPassword(row, user.id, validated.password)
  if (setupFailure) return setupFailure

  yield* announceAcceptance(services, {
    user,
    row,
    newlyVerified: yield* markAcceptedAddressVerified(user.id),
  })
  return {
    status: 'accepted',
    user: { id: user.id, email: user.email, name: user.name },
    role: user.role ?? null,
  } satisfies AcceptInvitationResult
})
