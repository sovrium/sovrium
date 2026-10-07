/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { desc, eq, sql } from 'drizzle-orm'
import { Effect, Layer, Result, Schema } from 'effect'
import {
  AdminDigestSnapshotDatabaseError,
  AdminDigestSnapshotRepository,
  type AdminDigestSnapshot,
} from '@/application/ports/repositories/admin/admin-digest-snapshot-repository'
import {
  weeklyDigestSchema,
  type WeeklyDigest,
} from '@/domain/models/api/admin/notifications/weekly-digest'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { adminDigestSnapshots as adminDigestSnapshotsPg } from '@/infrastructure/database/drizzle/schema/admin-digest'
import { adminDigestSnapshots as adminDigestSnapshotsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/admin-digest'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRawTyped } from '@/infrastructure/database/sql/dialect-execute'
import { logWarning } from '@/infrastructure/logging/logger'

/**
 * Drizzle implementation of the weekly-summary store, on either dialect: the
 * PG variant is `system.admin_digest_snapshots`, the SQLite one the flat
 * `system_admin_digest_snapshots`, both resolved once at module init.
 *
 * The stored document is decoded through `weeklyDigestSchema` on the way out,
 * so a row the current build cannot read surfaces as `metrics: undefined`
 * rather than as a shape the comparison would trust.
 */
const snapshots = resolveDialectSchema(adminDigestSnapshotsPg, adminDigestSnapshotsSqlite)

/** Wrap a DB promise, adapting failures to `AdminDigestSnapshotDatabaseError`. */
const wrap = makeDbWrap((cause) => new AdminDigestSnapshotDatabaseError({ cause }))

const decodeDigest = Schema.decodeUnknownResult(weeklyDigestSchema)

/**
 * A stored JSON document. `jsonb` and the SQLite `json` mode both hand back an
 * object; a driver that returned the raw text still reads.
 */
const parseStored = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

/** The stored document as a version-1 digest, or `undefined` when it is not one. */
export const decodeStoredDigest = (value: unknown): WeeklyDigest | undefined => {
  const decoded = decodeDigest(parseStored(value))
  return Result.isSuccess(decoded) ? decoded.success : undefined
}

/**
 * A stored instant, on either dialect, or `undefined` when the value does not
 * parse. An Invalid Date must never leave this module: it poisons every
 * comparison it meets (`Math.max` answers `NaN`) and `.toISOString()` throws on
 * it, which is how one unreadable row once stopped the weekly summary for good.
 */
const toInstant = (value: unknown): Readonly<Date> | undefined => {
  if (value === null || value === undefined) return undefined
  const instant =
    value instanceof Date ? value : new Date(typeof value === 'number' ? value : String(value))
  return Number.isFinite(instant.getTime()) ? instant : undefined
}

/**
 * One stored row, or `undefined` when its period cannot be read. An
 * unreadable `sentAt` reads as "not delivered" rather than rejecting the row:
 * the period is what the next summary needs.
 */
const decodeRow = (row: Readonly<Record<string, unknown>>): AdminDigestSnapshot | undefined => {
  const periodStart = toInstant(row['periodStart'])
  const periodEnd = toInstant(row['periodEnd'])
  if (periodStart === undefined || periodEnd === undefined) return undefined
  return {
    id: String(row['id']),
    periodStart,
    periodEnd,
    sentAt: toInstant(row['sentAt']),
    recipientCount: Number(row['recipientCount'] ?? 0),
    metrics: decodeStoredDigest(row['metrics']),
  }
}

/**
 * How many of the newest rows `latest` looks through for a readable one. On
 * SQLite a TEXT value in the period-end column sorts ABOVE every integer under
 * `DESC`, so a single bad row would otherwise shadow every good one forever.
 */
const LATEST_CANDIDATES = 5

/**
 * The first row that decodes, logging each one skipped on the way. Skipping is
 * a deliberate swallow: an unreadable summary row must not stop next week's.
 */
export const pickLatestSnapshot = (
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>
): AdminDigestSnapshot | undefined =>
  rows.reduce<{ readonly found: AdminDigestSnapshot | undefined; readonly done: boolean }>(
    (state, row) => {
      if (state.done) return state
      const decoded = decodeRow(row)
      if (decoded !== undefined) return { found: decoded, done: true }

      logWarning(`[weekly-digest] ignoring undecodable snapshot row ${String(row['id'])}`)
      return state
    },
    { found: undefined, done: false }
  ).found

export const AdminDigestSnapshotRepositoryLive = Layer.succeed(AdminDigestSnapshotRepository, {
  // SQLite rows are stamped by this process (`$defaultFn`), so its clock IS the
  // database's; PostgreSQL stamps with its own `now()`.
  clock: wrap(async () => {
    if (parseDatabaseDialectConfig().dialect !== 'postgres') return new Date()
    const rows = await executeRawTyped<{ readonly now: unknown }>(db, sql`SELECT now() AS now`)
    // A driver value that does not parse falls back to this process's clock.
    return new Date((toInstant(rows[0]?.now) ?? new Date()).getTime())
  }),

  latest: wrap(() =>
    db.select().from(snapshots).orderBy(desc(snapshots.periodEnd)).limit(LATEST_CANDIDATES)
  ).pipe(
    Effect.map((rows) =>
      pickLatestSnapshot(rows as ReadonlyArray<Readonly<Record<string, unknown>>>)
    )
  ),

  insert: (snapshot) =>
    wrap(async () => {
      const id = crypto.randomUUID()
      await db.insert(snapshots).values({
        id,
        periodStart: snapshot.periodStart,
        periodEnd: snapshot.periodEnd,
        sentAt: snapshot.sentAt ?? null,
        recipientCount: snapshot.recipientCount,
        metrics: snapshot.metrics,
      })
      return id
    }),

  markSent: ({ id, sentAt, recipientCount }) =>
    wrap(async () => {
      await db.update(snapshots).set({ sentAt, recipientCount }).where(eq(snapshots.id, id))
    }),
})
