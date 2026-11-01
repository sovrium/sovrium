/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The admin-invitation flow's services, as the invitation use-cases require
 * them: the invitation and account rows (`InvitationStore`), the two things
 * only the auth engine can do (`InvitationAuthEngine`), the auth-event
 * dispatch an acceptance fires, and the invitation pages of what is mounted.
 *
 * One bundle per auth instance — the engine is that instance's — built by
 * `createInvitationServices` and provided to a use-case by its caller with
 * `Effect.provideService(Invitations, services)`. The use-cases are Effect
 * programs over this tag; each Promise-shaped adapter call is lifted into a
 * typed {@link InvitationServiceError} naming the operation.
 */

import { Context, Data, Effect } from 'effect'
import type { InvitationServices } from '@/application/ports/contracts/invitation-services'

/** A store, engine or mailer call that rejected. `operation` names it; `cause` is its own error. */
export class InvitationServiceError extends Data.TaggedError('InvitationServiceError')<{
  readonly operation: string
  readonly cause: unknown
}> {}

export class Invitations extends Context.Service<Invitations, InvitationServices>()(
  'Invitations'
) {}

/** Lift one Promise-shaped store, engine or mailer call into a typed failure. */
export const invitationCall = <A>(
  operation: string,
  call: () => Promise<A>
): Effect.Effect<A, InvitationServiceError> =>
  Effect.tryPromise({
    try: call,
    catch: (cause) => new InvitationServiceError({ operation, cause }),
  })
