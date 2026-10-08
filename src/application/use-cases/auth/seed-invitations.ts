/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect, Result } from 'effect'
import { InvitationIssuer } from '@/application/ports/services/invitation-issuer'
import { buildAcceptInvitationUrl } from './admin-invitation'
import { issueInvitation } from './invitation-issuance'
import type { App } from '@/domain/models/app'

/** The issuance itself rejected — the store or the engine was unreachable. */
export class InvitationIssueError extends Data.TaggedError('InvitationIssueError')<{
  readonly cause: unknown
}> {}

/** One pending invitation a seed run issues. */
export interface SeedInvitee {
  readonly email: string
  readonly name: string
  readonly role: string
  /** The id of the account the invitation is from, when the file names one. */
  readonly inviterId?: string | undefined
}

/** What became of one invitee: the link to hand over, or why there is none. */
export type SeedInvitationOutcome =
  | { readonly ok: true; readonly email: string; readonly link: string }
  | { readonly ok: false; readonly email: string; readonly message: string }

/**
 * Issue the pending invitations a seed run lists, sending nothing.
 *
 * Each invitee gets the account with no credential and the stored token an
 * emailed invitation would create, and the link that email would carry — the
 * app's invitation page, under `origin` (empty for a path-only link). The
 * caller prints the link once; it is never written anywhere.
 */
export const issueSeedInvitations = (input: {
  readonly app: Readonly<App>
  readonly invitees: readonly SeedInvitee[]
  readonly origin: string
}): Effect.Effect<readonly SeedInvitationOutcome[], never, InvitationIssuer> =>
  Effect.gen(function* () {
    const services = yield* InvitationIssuer
    return yield* Effect.forEach(input.invitees, (invitee) =>
      Effect.tryPromise({
        try: () =>
          issueInvitation({
            services,
            authConfig: input.app.auth,
            invitee,
            inviterId: invitee.inviterId,
          }),
        catch: (cause) => new InvitationIssueError({ cause }),
      }).pipe(
        Effect.result,
        Effect.map((issued): SeedInvitationOutcome => {
          if (Result.isFailure(issued)) {
            const { cause } = issued.failure
            return {
              ok: false,
              email: invitee.email,
              message: cause instanceof Error ? cause.message : String(cause),
            }
          }
          const result = issued.success
          return result.status === 'invited'
            ? {
                ok: true,
                email: invitee.email,
                link: buildAcceptInvitationUrl(input.origin, result.token, input.app.pages),
              }
            : { ok: false, email: invitee.email, message: result.message }
        })
      )
    )
  }).pipe(Effect.withSpan('auth.issue-seed-invitations'))
