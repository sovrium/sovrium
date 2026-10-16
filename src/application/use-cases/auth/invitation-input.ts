/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isValidEmail } from '@/domain/kernel/sanitize/email-validation'
import { assignableRoleNames, isAssignableRole } from '@/domain/models/app/auth/roles'
import type { InviteUserFailure } from './invitation-issuance'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'

/**
 * Reading an invitation request — the console's `invite-user` body and an
 * automation step's props alike — into the address, display name and role an
 * invitation is issued for, or the refusal that issues nothing.
 */

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
export const validateInviteInput = (
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
