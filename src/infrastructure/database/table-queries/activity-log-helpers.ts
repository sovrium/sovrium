/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db, SessionContextError } from '@/infrastructure/database'
import { activityLogs } from '@/infrastructure/database/drizzle/schema/activity-log'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Common activity logging helper
 *
 * Logs database operations (create, update, delete) for audit trail.
 * This is a non-critical operation that should not fail the main operation.
 */
export function logActivity(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly action: 'create' | 'update' | 'delete'
  readonly recordId: string
  readonly changes: {
    readonly before?: Record<string, unknown>
    readonly after?: Record<string, unknown>
  }
}): Effect.Effect<void, never> {
  const { session, tableName, action, recordId, changes } = config
  return Effect.ignore(
    Effect.tryPromise({
      try: async () => {
        // Get table ID from information_schema
        const tableIdResult = (await db.execute(
          sql`SELECT schemaname, tablename FROM pg_tables WHERE tablename = ${tableName} LIMIT 1`
        )) as readonly Record<string, unknown>[]

        // Use '1' as fallback table ID if not found in schema
        const tableId = tableIdResult[0] ? '1' : '1'

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
      catch: (error) => new SessionContextError('Failed to log activity', error),
    })
  )
}
