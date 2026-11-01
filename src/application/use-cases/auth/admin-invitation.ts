/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { InvitationIssuer } from '@/application/ports/services/invitation-issuer'
import {
  invitationCall,
  Invitations,
  type InvitationServiceError,
} from '@/application/ports/services/invitations'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  buildInvitationLink,
  invitationLinkTarget,
  type InvitationLinkPage,
} from '@/domain/models/app/pages/invitation-link-service'
import { validateInviteInput } from './invitation-input'
import {
  findOrCreateInvitedUser,
  mintInvitationToken,
  type InviteUserResult,
} from './invitation-issuance'
import type {
  InvitationMailer,
  InvitationServices,
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
 * The pages an invitation link may open: the app's own first, then the
 * invitation pages of what is mounted on this server (the console's).
 */
const linkPagesOf = (
  app: { readonly pages?: readonly InvitationLinkPage[] | undefined },
  services: InvitationServices
): readonly InvitationLinkPage[] => [...(app.pages ?? []), ...(services.linkPages ?? [])]

/** What issuing an admin invitation is handed, besides the {@link Invitations} services. */
export interface AdminInvitationInput {
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
  /** How long the link lives, overriding `auth.invitationTokenExpiry` (an automation step's `expiresIn`). */
  readonly expiresInMs?: number | undefined
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
}

/**
 * Issue an admin invitation: create or reuse the user, generate and store a
 * single-use token, and send the invitation email.
 *
 * Answers the token AND the placeholder user record so the route handler
 * can both build its JSON response AND surface the bare token in the
 * `Location` header for tooling (CI, automation) when needed.
 */
export const issueAdminInvitation = Effect.fn('auth.invite-user')(function* (
  params: AdminInvitationInput
): Effect.fn.Return<InviteUserResult, InvitationServiceError, Invitations> {
  const validation = validateInviteInput(params.body, params.app)
  if ('status' in validation) {
    return validation
  }

  const services = yield* Invitations
  const issuing = { store: services.store, engine: services.engine }
  const findOrCreate = yield* findOrCreateInvitedUser(validation).pipe(
    Effect.provideService(InvitationIssuer, issuing)
  )
  if ('status' in findOrCreate) {
    return findOrCreate
  }
  const { user, existed } = findOrCreate

  // A scoped inviter passes their tenant on; an admin-equivalent one has none to
  // pass. Gating on `isAdminEquivalent` keeps the long-standing admin-issued
  // invitation byte-identical to what it was: it never touched `user_access`, and
  // it still does not.
  const { inviterId, inviterRole } = params
  if (
    inviterId !== undefined &&
    inviterRole !== undefined &&
    !isAdminEquivalent(inviterRole, params.app)
  ) {
    yield* invitationCall('inherit the inviter scope', () =>
      services.store.inheritScopeAssignments({
        inviterId,
        inviteeId: user.id,
        role: validation.role,
      })
    )
  }

  const token = yield* mintInvitationToken(params, user.id).pipe(
    Effect.provideService(InvitationIssuer, issuing)
  )
  if (token === undefined) {
    return {
      status: 'internal-error',
      message: 'Failed to persist invitation token',
    } satisfies InviteUserResult
  }

  // The email handler swallows its own errors. Awaited so that test fixtures
  // observing mailpit don't race the response.
  yield* invitationCall('send the invitation', () =>
    params.emailHandlers.invitation({
      email: user.email,
      name: user.name,
      url: buildAcceptInvitationUrl(params.baseURL, token, linkPagesOf(params.app, services)),
      inviterName: params.inviterName,
    })
  )

  return { status: 'invited', user, token, existed } satisfies InviteUserResult
})

/**
 * {@link issueAdminInvitation} for a caller that is still Promise-shaped —
 * the automation step `auth.inviteUser`. The program runs on the `run` the
 * infrastructure built beside the services it is handed, so no use-case
 * starts a fiber itself. A transitional adapter: it goes once that step
 * composes the program into its own.
 */
export const inviteUser = (
  params: AdminInvitationInput & { readonly services: InvitationServices }
): Promise<InviteUserResult> => {
  const { services, ...input } = params
  return services.run(issueAdminInvitation(input))
}
