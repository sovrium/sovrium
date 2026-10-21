/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The audit trail's page and single-entry reads, done in the database.
 *
 * A page is a keyset read: the trail ordered newest first, ties on the instant
 * broken by the id (descending), starting strictly after the cursor's entry,
 * `LIMIT n + 1` so the extra row tells whether a next page exists. A page so
 * costs its own rows, never the whole trail.
 *
 * The order key is the instant TO THE MILLISECOND, because that is what an
 * entry answers (`timestamp` is an ISO string) and so what a cursor carries.
 * On SQLite the column holds the ISO string the pg-core column writes (whole
 * milliseconds, ordered as text); a PostgreSQL `timestamptz` holds
 * microseconds (a row written by `now()`), so there the key is
 * `date_trunc('milliseconds', created_at)`: two rows of one millisecond then
 * tie on the key and are ordered by id, exactly as the cursor compares them.
 *
 * Every value is bound as a parameter on both dialects.
 */

import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { auditLog } from '@/infrastructure/database/drizzle/schema/audit-log'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { logError } from '@/infrastructure/logging/logger'
import { buildAuditWhere, rowToEntry } from './drizzle-store'
import type {
  AuditPage,
  AuditPagePosition,
  AuditPageQuery,
} from '@/application/ports/repositories/admin/audit-log-repository'
import type { AuditLogEntry } from '@/domain/models/api/admin/audit-log/entry'

type AuditLogRow = typeof auditLog.$inferSelect

/** The instant a page is ordered by, to the millisecond on both engines. */
const orderInstant = (sqlite: boolean): SQL =>
  sqlite ? sql`${auditLog.createdAt}` : sql`date_trunc('milliseconds', ${auditLog.createdAt})`

/**
 * A cursor's instant as the order key compares it: the canonical ISO string on
 * SQLite (what the column stores), a `timestamptz` on PostgreSQL.
 */
const boundInstant = (timestamp: string, sqlite: boolean): SQL => {
  const iso = new Date(timestamp).toISOString()
  return sqlite ? sql`${iso}` : sql`CAST(${iso} AS timestamptz)`
}

/**
 * The entries strictly after `position` in the newest-first order: an older
 * instant, or the same instant and a smaller id. Exported for its test.
 */
export const afterPosition = (position: Readonly<AuditPagePosition>, sqlite: boolean): SQL => {
  const key = orderInstant(sqlite)
  const at = boundInstant(position.timestamp, sqlite)
  return sql`(${key} < ${at} OR (${key} = ${at} AND ${auditLog.id} < ${position.id}))`
}

/** The first `limit` rows, and whether the read found one more. Exported for its test. */
export const splitPage = <T>(
  rows: readonly T[],
  limit: number
): { readonly rows: readonly T[]; readonly hasMore: boolean } => ({
  rows: rows.slice(0, limit),
  hasMore: rows.length > limit,
})

/**
 * One page of the entries matching `query.filter`, newest first, after
 * `query.after` when given. A failed read answers an empty last page, with the
 * same boot-path tolerance as the trail's other reads.
 */
export async function listAuditPageFromDb(query: Readonly<AuditPageQuery>): Promise<AuditPage> {
  const sqlite = isSqliteRuntime()
  const conditions = [
    buildAuditWhere(query.filter),
    query.after === undefined ? undefined : afterPosition(query.after, sqlite),
  ].filter((c): c is NonNullable<typeof c> => c !== undefined)
  try {
    const rows = await db
      .select()
      .from(auditLog)
      .where(conditions.length === 0 ? undefined : and(...conditions))
      .orderBy(desc(orderInstant(sqlite)), desc(auditLog.id))
      .limit(query.limit + 1)
    const page = splitPage(rows, query.limit)
    return {
      entries: page.rows.map((row) => rowToEntry(row as AuditLogRow)),
      hasMore: page.hasMore,
    }
  } catch (error) {
    logError('[audit-log] failed to read a page of entries', error)
    return { entries: [], hasMore: false }
  }
}

/** The entry of `id`, or `undefined` when there is none or the read failed. */
export async function getAuditEntryFromDb(id: string): Promise<AuditLogEntry | undefined> {
  try {
    const rows = await db.select().from(auditLog).where(eq(auditLog.id, id)).limit(1)
    const row = rows[0]
    return row === undefined ? undefined : rowToEntry(row as AuditLogRow)
  } catch (error) {
    logError('[audit-log] failed to read an entry', error, { id })
    return undefined
  }
}
