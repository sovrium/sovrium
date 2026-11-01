/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { inReadWriteTransaction } from '@/infrastructure/database/read-write-sweep'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { logInfo } from '@/infrastructure/logging/logger'
import type { DatabaseService, Dialect } from './drizzle/layer'

/**
 * The sweep of expired sign-in rows: `auth.device_code` (a device sign-in
 * waiting for its user code) and `auth.verification` (a passkey challenge,
 * an emailed code, a link token, a pending sign-in step). Both are written by
 * requests that need no session, and Better Auth deletes such a row only when
 * the same code is presented again, so one never claimed would stay for ever.
 * The routes that write them anonymously are budgeted per client address
 * (`auth-route-utils.ts`); this removes what they leave behind.
 *
 * A row is due once its `expires_at` has passed: no flow accepts it any more,
 * so deleting it changes no answer. Daily (`register-auth-expired-rows-sweep.ts`),
 * and on demand through the internal trigger route.
 */

/** A table swept, by its bare Better Auth name. */
type SweptTable = 'device_code' | 'verification'

/** Rows deleted per table by one sweep. */
export interface ExpiredAuthRowsSwept {
  readonly deviceCodes: number
  readonly verifications: number
}

/**
 * The delete of `table`'s rows expired before `cutoff`, returning their ids so
 * the sweep can count them. The cutoff is bound in the column's own storage:
 * an instant on PostgreSQL (`timestamptz`), milliseconds since the epoch on
 * SQLite (an INTEGER column).
 */
export const expiredRowsDelete = (
  dialect: Dialect,
  table: SweptTable,
  cutoff: Readonly<Date>
): SQL => {
  const bound = dialect.kind === 'sqlite' ? cutoff.getTime() : cutoff.toISOString()
  return sql`DELETE FROM ${dialect.sql.authTableRef(table)} WHERE expires_at < ${bound} RETURNING id`
}

/** Delete one table's expired rows in a READ WRITE transaction; answers how many went. */
const sweepTable = async (
  database: DatabaseService,
  table: SweptTable,
  cutoff: Readonly<Date>
): Promise<number> =>
  (
    await inReadWriteTransaction(database, (tx) =>
      executeRawOn(database.dialect.kind, tx, expiredRowsDelete(database.dialect, table, cutoff))
    )
  ).length

/**
 * Run the sweep once.
 *
 * @param database - the database the rows are deleted in.
 * @param now - the reference instant, injected so the sweep is testable.
 * @returns the rows deleted from each table.
 */
export async function purgeExpiredAuthRows(
  database: DatabaseService,
  now: Readonly<Date> = new Date()
): Promise<ExpiredAuthRowsSwept> {
  const deviceCodes = await sweepTable(database, 'device_code', now)
  const verifications = await sweepTable(database, 'verification', now)
  logInfo(
    `[auth-expired-rows] Deleted ${String(deviceCodes)} device code(s) and ${String(verifications)} verification row(s) expired before ${now.toISOString()}`
  )
  return { deviceCodes, verifications }
}
