/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { db, DatabaseError } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { activityLogs as activityLogsPg } from '@/infrastructure/database/drizzle/schema/activity-log'
import { activityLogs as activityLogsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/activity-log'
import type { App } from '@/domain/models/app'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * The audit table for the active dialect — `system.activity_logs` on Postgres,
 * the flat `system_activity_logs` on SQLite. This write is wrapped in
 * `Effect.ignore` below, so a dialect mismatch here is invisible: the audited
 * operation still succeeds and the trail is simply never written.
 */
const activityLogs = resolveDialectSchema(activityLogsPg, activityLogsSqlite)

/**
 * Common activity logging helper
 *
 * Logs database operations (create, update, delete) for audit trail.
 * This is a non-critical operation that should not fail the main operation.
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
  return Effect.ignore(
    Effect.tryPromise({
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
    })
  )
}
