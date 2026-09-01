/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The tenant half of a scoped invitation.
 *
 * A scoped invitation is only "scoped" because the invitee lands inside the
 * inviter's tenant, and in Sovrium a tenant IS a `system.user_access` row: the
 * scope-table assignments `$currentUser.assignments.<table>` resolves against.
 * Notably NOT a Better Auth organization — Sovrium is single-org by construction
 * (`allowUserToCreateOrganization: false`, one hard-coded organization id, every
 * user auto-enrolled), so an organization filter ranges over exactly one value
 * and scopes nothing.
 *
 * Kept beside the other invitation queries rather than behind the
 * `UserAccessRepository` port because the invitation flow is plain `async`
 * throughout; reaching for an Effect Layer here would make this one step the
 * only Effect boundary in an otherwise promise-shaped use-case.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { userAccess as userAccessPg } from '@/infrastructure/database/drizzle/schema/user-access'
import { userAccess as userAccessSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/user-access'
import { logError } from '@/infrastructure/logging/logger'

const userAccess = resolveDialectSchema(userAccessPg, userAccessSqlite)

/**
 * Copy the inviter's scope assignments onto the invited user, so the invitee
 * lands inside the inviter's tenant and nowhere else.
 *
 * Three properties are load-bearing:
 *
 * - **The inviter's grants are the ceiling.** Every row is a verbatim copy of a
 *   row the inviter already holds, so an inviter can never place someone in a
 *   scope they cannot themselves reach. The grant confers no ability to widen.
 * - **The ROLE recorded is the INVITEE's, not the inviter's.** The row says "this
 *   user may reach these records, as this role"; copying the inviter's role would
 *   silently promote the invitee inside the scope.
 * - **Additive and idempotent.** A scope table the invitee already has a row for
 *   is skipped rather than overwritten, so re-issuing an invitation to a pending
 *   user cannot duplicate grants, and an assignment an operator set by hand is
 *   never clobbered.
 *
 * Failures are logged and swallowed, returning 0. This is deliberate and it fails
 * CLOSED: an app that declares no `auth.scopeTables` has no `user_access` table
 * at all, so the first read throws — and a scoped invitation is not worth turning
 * every unscoped app's invitation into a 500. An invitee who inherits nothing
 * sees nothing, which is the safe direction to fail in.
 *
 * @returns how many scope grants were inherited.
 */
export const inheritScopeAssignments = async (params: {
  readonly inviterId: string
  readonly inviteeId: string
  readonly role: string
}): Promise<number> => {
  try {
    const inviterGrants = await db
      .select()
      .from(userAccess)
      .where(eq(userAccess.userId, params.inviterId))
    if (inviterGrants.length === 0) return 0

    const inviteeGrants = await db
      .select({ tableSlug: userAccess.tableSlug })
      .from(userAccess)
      .where(eq(userAccess.userId, params.inviteeId))
    const alreadyScoped = new Set(inviteeGrants.map((row) => row.tableSlug))

    const values = inviterGrants
      .filter((grant) => !alreadyScoped.has(grant.tableSlug))
      .map((grant) => ({
        userId: params.inviteeId,
        tableSlug: grant.tableSlug,
        recordIds: [...grant.recordIds],
        role: params.role,
        createdBy: params.inviterId,
      }))
    if (values.length === 0) return 0

    // eslint-disable-next-line functional/no-expression-statements -- DB insert is a side effect
    await db.insert(userAccess).values(values)
    return values.length
  } catch (error) {
    logError('[admin-invitation] Failed to inherit inviter scope assignments', error, {
      inviterId: params.inviterId,
      inviteeId: params.inviteeId,
    })
    return 0
  }
}
