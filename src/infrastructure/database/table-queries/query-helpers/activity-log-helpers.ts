/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Effect } from 'effect'
import { db, DatabaseError } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { activityLogs as activityLogsPg } from '@/infrastructure/database/drizzle/schema/activity-log'
import { activityLogs as activityLogsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/activity-log'
import { logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * The audit table for the active dialect — `system.activity_logs` on Postgres,
 * the flat `system_activity_logs` on SQLite.
 *
 * The write below stays NON-FATAL — an audited operation must not be undone
 * because its trail could not be recorded — but it is no longer SILENT: a
 * dialect mismatch here used to leave no trace at all, so the trail was simply
 * absent and nothing said why. See {@link logActivity}.
 */
const activityLogs = resolveDialectSchema(activityLogsPg, activityLogsSqlite)

/**
 * Common activity logging helper
 *
 * Logs database operations (create, update, delete) for audit trail.
 * This is a non-critical operation that should not fail the main operation.
 *
 * Non-fatal is not the same as unobservable. The `DatabaseError` was being
 * constructed and then dropped by `Effect.ignore`, so a broken audit trail — a
 * dialect mismatch, a missing table, column drift — produced exactly nothing: no
 * failure, no log line, and a silently incomplete trail that surfaces only when
 * someone finally needs to read it. `Effect.tapCause` runs ahead of the ignore
 * and records the cause, so the operation still cannot fail while the reason
 * stays visible. It taps the CAUSE rather than the error so a defect thrown
 * inside the promise is logged too, not just the mapped `DatabaseError`.
 */
export function logActivity(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly action: 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
  readonly recordId: string
  readonly changes: {
    readonly before?: Record<string, unknown>
    readonly after?: Record<string, unknown>
  }
  readonly app?: App
}): Effect.Effect<void, never> {
  const { session, tableName, action, recordId, changes, app } = config
  return Effect.tryPromise({
    try: async () => {
      // Get table ID from app schema if available
      const table = app?.tables?.find((t) => t.name === tableName)
      const tableId = table?.id ? String(table.id) : '1'

      // eslint-disable-next-line functional/no-expression-statements -- Database insert for logging is an acceptable side effect
      await db.insert(activityLogs).values({
        id: crypto.randomUUID(),
        userId: session.userId,
        action,
        tableName,
        tableId,
        recordId,
        changes,
      })
    },
    catch: (error) => new DatabaseError('Failed to log activity', error),
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError('Failed to write the activity-log audit trail', Cause.squash(cause), {
          'sovrium.audit.table': tableName,
          'sovrium.audit.action': action,
        })
      })
    ),
    // The tap and the swallow are ONE pipe on purpose. Written as
    // `Effect.ignore(program.pipe(tapCause(…)))` the logging is just as real,
    // but it sits inside the swallow's argument rather than before it — which
    // reads to a reviewer, and to `sovrium/no-effect-swallow-without-log`, as an
    // unlogged discard.
    Effect.ignore
  )
}
