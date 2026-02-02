/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { db, SessionContextError } from '@/infrastructure/database'
import { activityLogs } from '@/infrastructure/database/drizzle/schema/activity-log'
import type { App } from '@/domain/models/app'
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
  readonly action: 'create' | 'update' | 'delete' | 'restore'
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
      catch: (error) => new SessionContextError('Failed to log activity', error),
    })
  )
}
