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

import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { userAccess as userAccessPg } from '@/infrastructure/database/drizzle/schema/user-access'
import { userAccess as userAccessSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/user-access'
import {
  lockGrantsOf,
  type GrantTransaction,
} from '@/infrastructure/database/user-access-grant-lock'
import { logError } from '@/infrastructure/logging/logger'

const userAccess = resolveDialectSchema(userAccessPg, userAccessSqlite)

/**
 * Write the invitee's inherited grant over one scope table under its grant
 * lock, unless the invitee already holds one there; whether it was written.
 */
const inheritOne = async (
  tx: GrantTransaction,
  grant: {
    readonly inviterId: string
    readonly inviteeId: string
    readonly role: string
    readonly tableSlug: string
    readonly recordIds: readonly string[]
  }
): Promise<boolean> => {
  await lockGrantsOf(tx, { userId: grant.inviteeId, tableSlug: grant.tableSlug })
  const [held] = await tx
    .select({ id: userAccess.id })
    .from(userAccess)
    .where(and(eq(userAccess.userId, grant.inviteeId), eq(userAccess.tableSlug, grant.tableSlug)))
    .limit(1)
  if (held !== undefined) return false
  await tx.insert(userAccess).values({
    userId: grant.inviteeId,
    tableSlug: grant.tableSlug,
    recordIds: [...grant.recordIds],
    role: grant.role,
    createdBy: grant.inviterId,
  })
  return true
}

/**
 * Copy the inviter's scope assignments onto the invited user, so the invitee
 * lands inside the inviter's tenant and nowhere else.
 *
 * Three properties are load-bearing:
 *
 * - **The inviter's grants are the ceiling.** The invitee receives ONE grant per
 *   scope table, naming the union of the records the inviter's grants over it
 *   name, in the order those grants were made — never a record the inviter
 *   cannot reach. An inviter holding grants under two roles over one table gives
 *   one grant, not two: the invitee holds one role, so two rows would be two
 *   grants under the same role. The grant confers no ability to widen.
 * - **The ROLE recorded is the INVITEE's, not the inviter's.** The row says "this
 *   user may reach these records, as this role"; copying the inviter's role would
 *   silently promote the invitee inside the scope.
 * - **Additive and idempotent.** A scope table the invitee already has a row for
 *   is skipped rather than overwritten, so re-issuing an invitation to a pending
 *   user cannot duplicate grants, and an assignment an operator set by hand is
 *   never clobbered. Each table is checked and written under the invitee's grant
 *   lock over it, the one every other grant write takes, so a mint arriving at
 *   the same moment cannot leave a second grant beside the inherited one.
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
      .orderBy(asc(userAccess.createdAt))
    if (inviterGrants.length === 0) return 0

    const reachByTable = inviterGrants.reduce(
      (reach, grant) =>
        new Map(reach).set(grant.tableSlug, [
          ...new Set([...(reach.get(grant.tableSlug) ?? []), ...grant.recordIds]),
        ]),
      new Map<string, readonly string[]>()
    )
    return await db.transaction(async (tx) => {
      // One table after the other: a transaction's statements run in sequence.
      let written = 0
      for (const [tableSlug, recordIds] of reachByTable) {
        if (await inheritOne(tx, { ...params, tableSlug, recordIds })) written += 1
      }
      return written
    })
  } catch (error) {
    logError('[admin-invitation] Failed to inherit inviter scope assignments', error, {
      inviterId: params.inviterId,
      inviteeId: params.inviteeId,
    })
    return 0
  }
}
