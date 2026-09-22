/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

/** Database error for admin-invitation token lookups. */
export class InvitationTokenDatabaseError extends Data.TaggedError('InvitationTokenDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * One live invitation, resolved from its single-use token.
 *
 * Sovrium reuses Better Auth's `auth.verification` table as a token store,
 * namespaced by an `invitation:` identifier prefix, and encodes the invitee
 * (and, on newer rows, the inviter) into the `value` column. Both the prefix
 * and the encoding are storage details that stop at this boundary: what the
 * accept flow needs is a user id and a deadline.
 */
export interface InvitationTokenRecord {
  readonly id: string
  readonly token: string
  readonly userId: string
  readonly expiresAt: Date
}

/**
 * Read port over the admin-invitation token store.
 *
 * ### Why only one method
 *
 * The invitation flow has a dozen queries — issue, resend, revoke, list, accept
 * — and they are NOT all here. The other eleven are called from
 * `better-auth`-adjacent infrastructure that legitimately holds a database
 * handle; exactly one is called from an HTTP route, the accept handler, and a
 * port exists to move THAT one across the line.
 *
 * A port is sized by what crosses the boundary, not by what the concern
 * contains. Lifting all twelve would have produced an interface whose eleven
 * unused methods are a claim nothing tests, and it would have made the
 * invitation store look like an application concept when it is a Better Auth
 * table Sovrium borrows. Add a method here when a second route needs one.
 */
export class InvitationTokenRepository extends Context.Service<
  InvitationTokenRepository,
  {
    /**
     * The invitation bearing this token, or `undefined` when there is none —
     * never issued, already consumed, or deleted.
     *
     * EXPIRY IS NOT APPLIED. An expired invitation still resolves, because the
     * accept handler distinguishes "this link has lapsed, ask for another" from
     * "this link was never valid", and the two are different messages to a
     * customer. Filtering here would collapse them.
     */
    readonly findByToken: (
      token: string
    ) => Effect.Effect<InvitationTokenRecord | undefined, InvitationTokenDatabaseError>
  }
>()('InvitationTokenRepository') {}
