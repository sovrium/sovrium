/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The writes an invitation acceptance makes once its token checked out:
 * consuming the token (the single-use gate concurrent acceptances race on),
 * setting the password, and marking the address verified.
 */

import { Effect } from 'effect'
import { invitationCall, Invitations } from '@/application/ports/services/invitations'
import { logError } from '@/infrastructure/logging/logger'
import type {
  InvitationAuthEngine,
  InvitationStore,
  InvitationTokenRow,
} from '@/application/ports/contracts/invitation-services'

/** What a token that is unknown, consumed or lost to a concurrent acceptance answers. */
export const USED_TOKEN_MESSAGE = 'Invitation token is invalid or already used'

/** Why an acceptance's writes did not go through (a case of the acceptance's failure). */
type AcceptanceWriteFailure = {
  readonly status: 'invalid-token' | 'internal-error'
  readonly message: string
}

/** Log a failed step with its cause, under the flow's prefix. */
const logStep = (message: string) => (cause: unknown) =>
  Effect.sync(() => logError(`[admin-invitation] ${message}`, cause))

/**
 * Hash a plain-text password with the auth engine's configured hasher, so the
 * credential row the flow links is verifiable by the engine's own sign-in.
 * `undefined` when the engine could not hash it (logged).
 */
const hashWithAuthEngine = (
  engine: InvitationAuthEngine,
  password: string
): Effect.Effect<string | undefined> =>
  invitationCall('hash the password', () => engine.hashPassword(password)).pipe(
    Effect.tapCause(logStep('Failed to hash password')),
    // effect-swallow: logged above; an unhashed password becomes the acceptance's `internal-error` result.
    Effect.orElseSucceed(() => undefined)
  )

/**
 * Hash + link a credential account row for the invited user. Answers the
 * appropriate failure result when either step fails so the orchestrator
 * can short-circuit without re-implementing error handling.
 */
const linkPassword = (
  { store, engine }: { readonly store: InvitationStore; readonly engine: InvitationAuthEngine },
  userId: string,
  password: string
): Effect.Effect<AcceptanceWriteFailure | undefined> =>
  Effect.gen(function* () {
    const hashed = yield* hashWithAuthEngine(engine, password)
    if (!hashed) return { status: 'internal-error', message: 'Failed to set password' } as const
    return yield* invitationCall('link the credential account', () =>
      store.insertCredentialAccount({ id: crypto.randomUUID(), userId, hashedPassword: hashed })
    ).pipe(
      Effect.as(undefined),
      Effect.tapCause(logStep('Failed to link credential account')),
      // effect-swallow: logged above; an unlinked credential becomes the acceptance's `internal-error` result, and the caller hands the token back.
      Effect.orElseSucceed((): AcceptanceWriteFailure => ({
        status: 'internal-error',
        message: 'Failed to set password',
      }))
    )
  })

/**
 * Best-effort post-acceptance bookkeeping: flip emailVerified=true (proven by
 * following the link). It does not block — a failure here does not invalidate
 * the already-set password. Answers whether the address was newly verified.
 */
export const markAcceptedAddressVerified = Effect.fn('auth.mark-invitee-verified')(function* (
  userId: string
) {
  const { store } = yield* Invitations
  return yield* invitationCall('mark the address verified', () =>
    store.markUserEmailVerified(userId)
  ).pipe(
    Effect.tapCause(logStep('Failed to mark the address verified')),
    // effect-swallow: logged above; the password is already set, so an unverified flag must not undo the acceptance.
    Effect.orElseSucceed(() => false)
  )
})

/**
 * Consume the invitation token BEFORE anything is written for it. The delete
 * is the single-use gate: when several acceptances of one token are in flight
 * together (a double click, a retried request), every one passes the reads
 * above, but only one removes the row — that one goes on to set the password
 * and fire the acceptance events; the others answer as a repeated acceptance
 * does. A failed delete stops the acceptance: without it single use cannot be
 * proven.
 */
const claimInvitation = (
  store: InvitationStore,
  rowId: string
): Effect.Effect<'claimed' | AcceptanceWriteFailure> =>
  invitationCall('consume the invitation token', () => store.deleteInvitationToken(rowId)).pipe(
    Effect.map((deleted): 'claimed' | AcceptanceWriteFailure =>
      deleted ? 'claimed' : { status: 'invalid-token', message: USED_TOKEN_MESSAGE }
    ),
    Effect.tapCause(logStep('Failed to consume the invitation token')),
    // effect-swallow: logged above; an unprovable single use refuses the acceptance with `internal-error`.
    Effect.orElseSucceed((): AcceptanceWriteFailure => ({
      status: 'internal-error',
      message: 'Failed to accept invitation',
    }))
  )

/**
 * Put a claimed token back when setting the password failed after the claim,
 * so the invitee can follow the same link again. Best-effort: when it fails
 * too, the invitation has to be resent, and the cause is logged.
 */
const restoreInvitation = (store: InvitationStore, row: InvitationTokenRow): Effect.Effect<void> =>
  invitationCall('restore the invitation token', () =>
    store.insertInvitationToken({
      id: row.id,
      token: row.token,
      userId: row.userId,
      expiresAt: row.expiresAt,
      invitedBy: row.invitedBy,
    })
  ).pipe(
    Effect.tapCause(logStep('Failed to restore the invitation token')),
    // effect-swallow: logged above; the acceptance already answers its failure, and a lost token means the invitation is resent.
    Effect.ignore
  )

/**
 * Claim the token, then set the password; a password that could not be set
 * hands the token back so the same link works again.
 */
export const claimAndSetPassword = Effect.fn('auth.claim-invitation')(function* (
  row: InvitationTokenRow,
  userId: string,
  password: string
) {
  const services = yield* Invitations
  const claim = yield* claimInvitation(services.store, row.id)
  if (claim !== 'claimed') return claim
  const linkFailure = yield* linkPassword(services, userId, password)
  if (linkFailure) yield* restoreInvitation(services.store, row)
  return linkFailure
})
