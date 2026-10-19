/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The lock every write of an account's grants over one table takes — shared by
 * the user-access repository and the invitation flow, which writes an
 * invitee's inherited grants inside the same lock.
 */

import { sql } from 'drizzle-orm'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { UserAccessRecordGrant } from '@/application/ports/repositories/auth/user-access-repository'
import type { db } from '@/infrastructure/database'

/** The transaction a grant write runs in. */
export type GrantTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Hold the account's grants over one table until the transaction ends, so the
 * read-change-write of its `record_ids` is never interleaved with another.
 *
 * PostgreSQL: a transaction-scoped advisory lock keyed on the account and the
 * table — it serialises the changes even when no grant exists yet to lock as a
 * row (two first grants would otherwise both insert). SQLite: nothing to take,
 * the transaction itself is `BEGIN IMMEDIATE`, serialised against every other
 * statement on the one connection (`sqlite-serialized-client.ts`).
 */
export const lockGrantsOf = async (
  tx: GrantTransaction,
  grant: Readonly<Pick<UserAccessRecordGrant, 'userId' | 'tableSlug'>>
): Promise<void> => {
  if (isSqliteRuntime()) return
  const key = JSON.stringify(['user_access', grant.userId, grant.tableSlug])
  await executeRaw(tx, sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`)
}
