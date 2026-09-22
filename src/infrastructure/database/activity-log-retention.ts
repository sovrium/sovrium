/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lt } from 'drizzle-orm'
import { activityLogRetentionCutoff } from '@/domain/models/app/admin/activity-log-retention'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { activityLogs as activityLogsPg } from '@/infrastructure/database/drizzle/schema/activity-log'
import { activityLogs as activityLogsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/activity-log'
import { logInfo } from '@/infrastructure/logging/logger'

/**
 * The activity-log retention EXECUTOR.
 *
 * `system.activity_logs` documents a one-year retention and the published
 * privacy policy promises the audit log is deleted after a year. Only the READ
 * path implemented it, as a `gte(created_at, oneYearAgo)` filter: expired rows
 * were hidden from the record-history API and kept in the database forever.
 * They are not inert — `changes` holds the before/after field values of the
 * record, and `ip_address` / `user_agent` are available to any writer that
 * chooses to populate them.
 *
 * This is the missing half. The cutoff comes from the same pure
 * `activityLogRetentionCutoff` the read filter now uses, so the boundary that
 * hides and the boundary that deletes are one value.
 *
 * PHYSICAL delete, per standing rule S5 — a `deleted_at` tombstone would retain
 * exactly the data the promise says is gone.
 */

/**
 * The activity-log table for the active dialect — `system.activity_logs` on
 * Postgres, the flat `system_activity_logs` on SQLite.
 *
 * Resolved rather than hard-coded because the shipped default engine is SQLite:
 * a Postgres-spelled name here would throw on every self-hosted instance, and
 * the sweep's error is logged and swallowed, so the retention promise would go
 * back to being unimplemented — silently, and only off the default engine.
 */
const activityLogs = resolveDialectSchema(activityLogsPg, activityLogsSqlite)

/**
 * Delete every activity-log row older than the retention window.
 *
 * Uses the Drizzle query builder rather than raw SQL so the `created_at`
 * comparison is encoded per dialect for free — Postgres `timestamptz` takes the
 * `Date`, while the SQLite column is an INTEGER `timestamp_ms` whose Drizzle
 * decoder converts it. A hand-written `created_at < '<iso>'` would compare a
 * string to an integer on SQLite and silently match nothing, which is the
 * failure mode this executor exists to end.
 *
 * @param now - the reference instant, injected so the sweep is testable.
 * @returns the number of rows deleted.
 */
export async function purgeExpiredActivityLogs(now: Date = new Date()): Promise<number> {
  const cutoff = activityLogRetentionCutoff(now)
  const deleted = await db
    .delete(activityLogs)
    .where(lt(activityLogs.createdAt, cutoff))
    .returning({
      id: activityLogs.id,
    })

  if (deleted.length > 0) {
    logInfo(
      `[activity-log-retention] Deleted ${deleted.length} activity-log row(s) older than ${cutoff.toISOString()}`
    )
  }
  return deleted.length
}
