/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { Database } from '@/infrastructure/database'
import { sql } from 'drizzle-orm'

/**
 * Activity log with user metadata
 */
export interface ActivityLogWithUser {
  readonly id: string
  readonly userId: string
  readonly action: string
  readonly tableName: string
  readonly recordId: number
  readonly changes: Record<string, unknown> | null
  readonly createdAt: Date
  readonly user: {
    readonly id: string
    readonly name: string
    readonly email: string
  }
}

/**
 * Database error for activity queries
 */
export class ActivityDatabaseError {
  readonly _tag = 'ActivityDatabaseError'
  constructor(readonly cause: unknown) {}
}

/**
 * Activity not found error
 */
export class ActivityNotFoundError {
  readonly _tag = 'ActivityNotFoundError'
  constructor(readonly activityId: string) {}
}

/**
 * Get activity log by ID with user metadata
 *
 * Fetches activity log details with a JOIN to the users table to include
 * user information (name, email).
 *
 * @param activityId - Activity log ID (UUID string)
 * @returns Effect program that resolves to activity with user metadata or fails with error
 */
export const getActivityById = (activityId: string) =>
  Effect.gen(function* () {
    const db = yield* Database

    const result = yield* Effect.tryPromise({
      try: async () => {
        const rows = await db.execute(sql`
          SELECT
            al.id,
            al.user_id AS "userId",
            al.action,
            al.table_name AS "tableName",
            CAST(al.record_id AS INTEGER) AS "recordId",
            al.changes,
            al.created_at AS "createdAt",
            u.id AS "user.id",
            u.name AS "user.name",
            u.email AS "user.email"
          FROM system.activity_logs al
          LEFT JOIN system.users u ON al.user_id = u.id
          WHERE al.id = ${activityId}
        `)
        return rows
      },
      catch: (error) => new ActivityDatabaseError(error),
    })

    if (!result || result.length === 0) {
      return yield* Effect.fail(new ActivityNotFoundError(activityId))
    }

    const row = result[0] as {
      id: string
      userId: string
      action: string
      tableName: string
      recordId: number
      changes: string | null
      createdAt: Date
      'user.id': string
      'user.name': string
      'user.email': string
    }

    // Parse changes if present
    const changes = row.changes ? (JSON.parse(row.changes) as Record<string, unknown>) : null

    const activity: ActivityLogWithUser = {
      id: row.id,
      userId: row.userId,
      action: row.action,
      tableName: row.tableName,
      recordId: row.recordId,
      changes,
      createdAt: row.createdAt,
      user: {
        id: row['user.id'],
        name: row['user.name'],
        email: row['user.email'],
      },
    }

    return activity
  })
