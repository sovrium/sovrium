/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import {
  bansAnAdmin,
  lastAdminRemovalMessage,
  leavesNoAdmin,
  otherActiveAdmins,
  type AdminCandidate,
} from '@/domain/models/app/auth/roles/role-write-validation'
import { authUsersTable } from './drizzle/dialect-schema'
import { executeRaw } from './sql/dialect-execute'
import { authTableRef } from './sql/dialect-sql'
import { isSqliteRuntime } from './unsupported-in-sqlite'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'
import type { DrizzleDB, DrizzleTransaction } from '@/infrastructure/database'

/**
 * The last-admin rail as the account erasure runs it (`purgeAccount` in
 * `account-purge.ts`): inside the erasure's own transaction, before any write.
 */

/** How one erasure ended. */
export type PurgeOutcome =
  /** Every personal-data row of the account is gone. */
  | { readonly _tag: 'Erased' }
  /** Nothing was written: the account is the last one that can administer the app. */
  | { readonly _tag: 'Refused'; readonly message: string }

const ERASED: PurgeOutcome = { _tag: 'Erased' }

/** The account being erased, as the erasure reads it before writing anything. */
export interface ErasureSubject {
  readonly email: string | undefined
  readonly role: string | undefined
  readonly banned: boolean
}

/**
 * The three steps of an erasure under the last-admin rail. Production binds
 * them to one transaction; tests record them.
 */
interface GuardedErasureSteps {
  /** The account itself, or `undefined` when it no longer exists. */
  readonly readSubject: () => Promise<ErasureSubject | undefined>
  /** Every account that can administer the app, held until the erasure commits. */
  readonly lockAdminCandidates: () => Promise<readonly AdminCandidate[]>
  /** Every write of the erasure. */
  readonly erase: (subject: ErasureSubject | undefined) => Promise<void>
}

/**
 * The last-admin rail, run by the erasure itself.
 *
 * An erasure cannot be undone, so it cannot count after it writes, the way a
 * demotion recounts and puts itself back. It counts first, holding the rows it
 * counted: every account that can administer the app is locked, and the ones
 * left once `userId` is gone are counted. None left: nothing is written and the
 * rail's refusal is returned. Otherwise the erasure runs while the lock holds,
 * so a demotion or a ban of another admin waits for it to commit — and then
 * finds, in its own recount, that the erased admin is no longer there.
 *
 * An account that is not an admin who can sign in takes no admin away, so it
 * is erased without a count.
 */
export async function eraseUnderLastAdminRail(
  userId: string,
  app: AdminRoleResolvable,
  steps: GuardedErasureSteps
): Promise<PurgeOutcome> {
  const subject = await steps.readSubject()
  if (subject !== undefined && bansAnAdmin(subject.role, subject.banned, app)) {
    const remaining = otherActiveAdmins(await steps.lockAdminCandidates(), userId, app)
    if (leavesNoAdmin(remaining)) return { _tag: 'Refused', message: lastAdminRemovalMessage(app) }
  }
  await steps.erase(subject)
  return ERASED
}

/**
 * The accounts holding one of `adminRoles` and not banned — the rows the
 * erasure locks and counts. Values are bound parameters; the ban test is
 * `IS NULL OR = false`, never `<> true`, which drops NULL rows on both dialects.
 */
export const selectAdminCandidates = (
  runner: Readonly<Pick<DrizzleDB, 'select'>>,
  users: ReturnType<typeof authUsersTable>,
  adminRoles: readonly string[]
) =>
  runner
    .select({ id: users.id, role: users.role, banned: users.banned })
    .from(users)
    .where(
      and(inArray(users.role, [...adminRoles]), or(isNull(users.banned), eq(users.banned, false)))
    )
    .orderBy(users.id)

/**
 * The PostgreSQL row lock the erasure takes on the admin candidates.
 *
 * `FOR NO KEY UPDATE`, not `FOR UPDATE`: it conflicts with everything the rail
 * must hold off — a demotion or a ban (an `UPDATE` of a non-key column), a
 * delete, another erasure's same lock — but not with `FOR KEY SHARE`, which a
 * foreign-key insert takes on the row it references. So an admin signing in or
 * writing an audit entry while the erasure runs is not stalled behind it, and
 * cannot close a lock cycle with it (the erasure later updates rows such a
 * writer may hold). The rows are locked in `id` order, so two erasures queue
 * rather than deadlock.
 */
export const ADMIN_CANDIDATE_LOCK = 'no key update'

/**
 * Lock and read the admin candidates inside the erasure transaction.
 *
 * PostgreSQL: `SELECT … FOR NO KEY UPDATE` ({@link ADMIN_CANDIDATE_LOCK}), held
 * until the erasure commits. SQLite has
 * no row locks and a single writer; the read runs inside the erasure's
 * transaction as far as the driver keeps one open, which `bun:sqlite` does not
 * past the transaction's first `await` — so on SQLite the count is taken but
 * not held against a concurrent demotion.
 */
export async function lockAdminCandidates(
  tx: Readonly<DrizzleTransaction>,
  adminRoles: readonly string[]
): Promise<readonly AdminCandidate[]> {
  if (adminRoles.length === 0) return []
  const query = selectAdminCandidates(tx as unknown as DrizzleDB, authUsersTable(), adminRoles)
  return isSqliteRuntime() ? await query : await query.for(ADMIN_CANDIDATE_LOCK)
}

/** The account's address, role and ban flag, read inside the erasure transaction. */
export async function readErasureSubject(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<ErasureSubject | undefined> {
  const rows = (await executeRaw(
    tx,
    sql`SELECT email, role, banned FROM ${authTableRef('user')} WHERE id = ${userId}`
  )) as readonly {
    email: string | null
    role: string | null
    banned: boolean | number | null
  }[]
  const row = rows[0]
  if (row === undefined) return undefined
  // SQLite stores the flag as an INTEGER; the raw read does not map it back.
  return {
    email: row.email ?? undefined,
    role: row.role ?? undefined,
    banned: row.banned === true || row.banned === 1,
  }
}
