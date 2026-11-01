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
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import type { UserAccessRecordGrant } from '@/application/ports/repositories/auth/user-access-repository'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'
import type { PortableTx } from '@/infrastructure/database'

/** The transaction a grant write runs in. */
export type GrantTransaction = Readonly<PortableTx>

/**
 * Hold the account's grants over one table until the transaction ends, on
 * `dialect`, so the read-change-write of its `record_ids` is never interleaved
 * with another.
 *
 * PostgreSQL: a transaction-scoped advisory lock keyed on the account and the
 * table — it serialises the changes even when no grant exists yet to lock as a
 * row (two first grants would otherwise both insert). SQLite: nothing to take,
 * the transaction itself is `BEGIN IMMEDIATE`, serialised against every other
 * statement on the one connection (`sqlite-serialized-client.ts`).
 */
export const lockGrantsOfOn = async (
  dialect: DatabaseDialect,
  tx: GrantTransaction,
  grant: Readonly<Pick<UserAccessRecordGrant, 'userId' | 'tableSlug'>>
): Promise<void> => {
  if (dialect === 'sqlite') return
  const key = JSON.stringify(['user_access', grant.userId, grant.tableSlug])
  await executeRawOn(dialect, tx, sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`)
}
