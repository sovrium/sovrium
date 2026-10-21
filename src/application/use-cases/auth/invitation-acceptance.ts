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

import { logError } from '@/infrastructure/logging/logger'
import type {
  InvitationAuthEngine,
  InvitationServices,
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
): Promise<AcceptanceWriteFailure | undefined> => {
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
 * Best-effort post-acceptance bookkeeping: flip emailVerified=true (proven by
 * following the link). It does not block — a failure here does not invalidate
 * the already-set password. Answers whether the address was newly verified.
 */
export const markAcceptedAddressVerified = async (
  store: InvitationStore,
  userId: string
): Promise<boolean> =>
  store.markUserEmailVerified(userId).catch((error: unknown) => {
    logError('[admin-invitation] Failed to mark the address verified', error)
    return false
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
const claimInvitation = async (
  store: InvitationStore,
  rowId: string
): Promise<'claimed' | AcceptanceWriteFailure> =>
  store.deleteInvitationToken(rowId).then(
    (deleted) =>
      deleted
        ? ('claimed' as const)
        : { status: 'invalid-token' as const, message: USED_TOKEN_MESSAGE },
    (error: unknown) => {
      logError('[admin-invitation] Failed to consume the invitation token', error)
      return { status: 'internal-error' as const, message: 'Failed to accept invitation' }
    }
  )

/**
 * Put a claimed token back when setting the password failed after the claim,
 * so the invitee can follow the same link again. Best-effort: when it fails
 * too, the invitation has to be resent, and the cause is logged.
 */
const restoreInvitation = async (store: InvitationStore, row: InvitationTokenRow): Promise<void> =>
  store
    .insertInvitationToken({
      id: row.id,
      token: row.token,
      userId: row.userId,
      expiresAt: row.expiresAt,
      invitedBy: row.invitedBy,
    })
    .catch((error: unknown) => {
      logError('[admin-invitation] Failed to restore the invitation token', error)
    })

/**
 * Claim the token, then set the password; a password that could not be set
 * hands the token back so the same link works again.
 */
export const claimAndSetPassword = async (
  services: InvitationServices,
  row: InvitationTokenRow,
  userId: string,
  password: string
): Promise<AcceptanceWriteFailure | undefined> => {
  const claim = await claimInvitation(services.store, row.id)
  if (claim !== 'claimed') return claim
  const linkFailure = await linkPassword(services, userId, password)
  if (linkFailure) await restoreInvitation(services.store, row)
  return linkFailure
}
