/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a `page.invitation` page may print about the invitation its token
 * names: the inviter's name, the invitee's address and role, the expiry,
 * whether the address already has a password, and whether the link is still
 * live. Never the token, and nothing at all for a token that matches no
 * outstanding invitation (accepted and revoked ones are deleted rows).
 */

import { findUserByEmail, userHasCredentialPassword } from './invitation-account-queries'
import { findInvitationToken, listPendingInvitations } from './invitation-queries'
import type { InvitationFacts } from '@/domain/models/app/pages/invitation-vars-service'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'

/**
 * The facts for `token`, read over `db`, or `undefined` when it names no
 * outstanding invitation.
 */
export const readInvitationFactsIn =
  (db: PortableDb) =>
  async (token: string): Promise<InvitationFacts | undefined> => {
    const row = await findInvitationToken(db, token)
    if (row === undefined) return undefined
    const pending = (await listPendingInvitations(db)).find((item) => item.id === row.id)
    if (pending === undefined) return undefined
    const [inviter, accountExists] = await Promise.all([
      // `invitedBy` on a pending row is the inviter's current address.
      pending.invitedBy === undefined
        ? Promise.resolve(undefined)
        : findUserByEmail(db, pending.invitedBy),
      userHasCredentialPassword(db, row.userId),
    ])
    return {
      inviterName: inviter?.name ?? '',
      inviterImage: '',
      email: pending.email,
      role: pending.role ?? '',
      expiresAt: row.expiresAt.toISOString(),
      accountExists,
      status: row.expiresAt.getTime() > Date.now() ? 'pending' : 'expired',
    }
  }
