/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { Database } from '@/infrastructure/database'
import {
  authUsersTable,
  resolveDialectSchema,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { activityLogs as activityLogsPg } from '@/infrastructure/database/drizzle/schema/activity-log'
import { activityLogs as activityLogsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/activity-log'

/**
 * The audit table for the active dialect — `system.activity_logs` on Postgres,
 * the flat `system_activity_logs` on SQLite. Mirrors the resolution the sibling
 * `ActivityLogRepositoryLive` already performs; without it this read emits a
 * schema-qualified name SQLite has no table for.
 */
const activityLogs = resolveDialectSchema(activityLogsPg, activityLogsSqlite)

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

    // Resolve the dialect-correct auth users table per call — the user table
    // lives at `auth.user` on Postgres and `auth_user` on SQLite. Capturing it
    // locally keeps the leftJoin and the projection columns aligned.
    const users = authUsersTable()

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: activityLogs.id,
            userId: activityLogs.userId,
            action: activityLogs.action,
            tableName: activityLogs.tableName,
            recordId: activityLogs.recordId,
            changes: activityLogs.changes,
            createdAt: activityLogs.createdAt,
            userName: users.name,
            userEmail: users.email,
            userIdJoined: users.id,
          })
          .from(activityLogs)
          .leftJoin(users, eq(activityLogs.userId, users.id))
          .where(eq(activityLogs.id, activityId))
          .limit(1),
      catch: (error) => new ActivityDatabaseError(error),
    })

    if (result.length === 0 || !result[0]) {
      return yield* Effect.fail(new ActivityNotFoundError(activityId))
    }

    const row = result[0]

    // Parse recordId as integer (stored as text in DB)
    const recordIdInt = parseInt(row.recordId, 10)
    const recordId = isNaN(recordIdInt) ? 0 : recordIdInt

    // Changes is already JSONB (parsed by Drizzle), cast to expected type
    // eslint-disable-next-line unicorn/no-null -- Null is intentional for JSONB columns with no data
    const changes = (row.changes as Record<string, unknown> | null) ?? null

    const activity: ActivityLogWithUser = {
      id: row.id,
      userId: row.userId ?? '',
      action: row.action,
      tableName: row.tableName,
      recordId,
      changes,
      createdAt: row.createdAt,
      user: {
        id: row.userIdJoined ?? '',
        name: row.userName ?? '',
        email: row.userEmail ?? '',
      },
    }

    return activity
  })
