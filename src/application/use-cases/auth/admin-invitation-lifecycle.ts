/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use cases for the invitation LIFECYCLE — list / resend / revoke.
 *
 * Sovrium could already ISSUE an invitation and ACCEPT one; it could not show
 * an operator what was outstanding, send one again, or take one back. An
 * operator who invited someone and heard nothing had no way to tell whether the
 * invitation existed, expired, or had already been accepted.
 *
 * Two contracts hold across everything here:
 *
 *   1. **An invitation is identified by its row id, never by its token.** The
 *      token is the credential that ACCEPTS the invitation; the id merely names
 *      it. Keying the operator endpoints on the id is what lets the pending list
 *      stay token-free while remaining actionable — a list keyed on a credential
 *      would force every console row, log line and screenshot to carry one.
 *   2. **Expired invitations are listed, not hidden.** "It expired" and "it was
 *      never sent" are different operator problems with different next actions.
 *
 * Issue + accept live in the sibling `admin-invitation.ts`; this module is split
 * out only to keep both files within the module-size budget.
 */

import {
  buildAcceptInvitationUrl,
  resolveInvitationExpiryMs,
} from '@/application/use-cases/auth/admin-invitation'
import {
  deleteInvitationToken,
  findInvitationById,
  listPendingInvitations,
  refreshInvitationExpiry,
} from '@/infrastructure/auth/better-auth/invitation-queries'
import { logError } from '@/infrastructure/logging/logger'
import type { Auth } from '@/domain/models/app/auth'
import type { createEmailHandlers } from '@/infrastructure/auth/better-auth/email-handlers'
import type { PendingInvitationRow } from '@/infrastructure/auth/better-auth/invitation-queries'

type EmailHandlers = Readonly<ReturnType<typeof createEmailHandlers>>

/**
 * Lifecycle state of one invitation, derived from `expiresAt` rather than
 * stored. There is no third state on this surface: an ACCEPTED invitation has
 * had its row consumed by the accept flow, so it is absent rather than listed
 * with a status.
 */
export type InvitationStatus = 'pending' | 'expired'

/** One pending invitation as the operator surfaces see it — no token, ever. */
export interface InvitationListItem {
  readonly id: string
  readonly email: string
  readonly role: string
  readonly invitedBy: string | null
  readonly status: InvitationStatus
  readonly createdAt: string
  readonly expiresAt: string
}

/**
 * The role reported for an invitee whose `auth.user.role` column is NULL or
 * empty. Mirrors the platform default registration role and the same
 * coalescing the users directory applies, so the response's non-empty-role
 * invariant always holds.
 */
const DEFAULT_INVITATION_ROLE = 'member'

/**
 * Project one stored invitation into the operator-facing row.
 *
 * `invitedBy` stays `null` rather than becoming a placeholder string when no
 * inviter was recorded: `null` says "not recorded", which a reader can act on,
 * whereas a stand-in address would be indistinguishable from a real one.
 */
const projectInvitation = (
  row: Readonly<PendingInvitationRow>,
  // eslint-disable-next-line functional/prefer-immutable-types -- Date is structurally mutable; read-only here
  now: Date
): InvitationListItem => ({
  id: row.id,
  email: row.email,
  role: row.role !== null && row.role.length > 0 ? row.role : DEFAULT_INVITATION_ROLE,
  // eslint-disable-next-line unicorn/no-null -- the API contract distinguishes an explicit `null` ("inviter not recorded") from a real address; `undefined` would drop the key and make "no inviter" indistinguishable from "this build does not send inviters"
  invitedBy: row.invitedBy ?? null,
  status: row.expiresAt.getTime() <= now.getTime() ? 'expired' : 'pending',
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
})

/**
 * List every outstanding invitation as operator-facing rows.
 *
 * `now` is injected so the pending/expired boundary is testable without waiting
 * out a 72-hour TTL.
 */
export const listInvitations = async (
  now: Date = new Date()
): Promise<readonly InvitationListItem[]> => {
  const rows = await listPendingInvitations()
  return rows.map((row) => projectInvitation(row, now))
}

/**
 * Outcome of a resend or revoke attempt, keyed by the invitation row id.
 *
 * The success branch is generic over what the action has to hand back: a resend
 * returns the REFRESHED invitation (the console patches the row it already
 * renders), a revoke returns only the id it removed (the row is gone, and
 * returning its fields would invite the reading that revoke merely hid it).
 */
export type InvitationActionResult<T> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'not-found'; readonly message: string }
  | { readonly status: 'internal-error'; readonly message: string }

/**
 * Re-send an outstanding invitation and re-arm its expiry.
 *
 * **The token is REUSED, not rotated, and never leaves the server.** The
 * operator's intent when resending is "they did not receive it, send it again",
 * which the same link satisfies; rotating would additionally require handing the
 * new token back to the caller, putting a live credential into an API response,
 * a console and a log for no behavioural gain. Revoke already exists for the
 * case where the operator wants the outstanding link dead.
 *
 * The expiry IS re-armed, because a resend of an about-to-expire invitation that
 * kept the old deadline would deliver a link that dies moments later.
 */
export const resendInvitation = async (params: {
  readonly authConfig: Auth | undefined
  readonly emailHandlers: EmailHandlers
  readonly baseURL: string
  readonly inviterName: string
  readonly id: string
}): Promise<InvitationActionResult<InvitationListItem>> => {
  const invitation = await findInvitationById(params.id)
  if (!invitation) {
    return { status: 'not-found', message: 'Not Found' }
  }

  const rows = await listPendingInvitations()
  const listed = rows.find((row) => row.id === invitation.id)
  if (!listed) {
    // The row exists but its invitee account does not — nobody to resend to.
    return { status: 'not-found', message: 'Not Found' }
  }

  const expiresAt = new Date(Date.now() + resolveInvitationExpiryMs(params.authConfig))
  const refreshed = await refreshInvitationExpiry(invitation.id, expiresAt).then(
    () => true,
    (error: unknown) => {
      logError('[admin-invitation] Failed to refresh invitation expiry', error)
      return false
    }
  )
  if (!refreshed) {
    return { status: 'internal-error', message: 'Failed to resend invitation' }
  }

  const acceptUrl = buildAcceptInvitationUrl(params.baseURL, invitation.token)
  // Awaited so a fixture observing the mailbox cannot race the response.
  await params.emailHandlers.invitation({
    email: listed.email,
    name: listed.email,
    url: acceptUrl,
    inviterName: params.inviterName,
  })

  // Projected from the row we just refreshed rather than re-read: the `id` is
  // unchanged by construction (resend REFRESHES the row, it does not replace
  // it), so the console can patch the row it already renders.
  return {
    status: 'ok',
    value: projectInvitation({ ...listed, expiresAt }, new Date()),
  }
}

/**
 * Revoke an outstanding invitation.
 *
 * Deleting the verification row is what makes the emailed link INERT: the
 * accept flow resolves a token by looking that row up, so once it is gone the
 * link fails closed. A revoke that only cleared an operator list would leave a
 * standing grant the operator believes they cancelled.
 */
export const revokeInvitation = async (id: string): Promise<InvitationActionResult<string>> => {
  const invitation = await findInvitationById(id)
  if (!invitation) {
    return { status: 'not-found', message: 'Not Found' }
  }

  const deleted = await deleteInvitationToken(invitation.id).then(
    () => true,
    (error: unknown) => {
      logError('[admin-invitation] Failed to revoke invitation', error)
      return false
    }
  )
  return deleted
    ? { status: 'ok', value: invitation.id }
    : { status: 'internal-error', message: 'Failed to revoke invitation' }
}
