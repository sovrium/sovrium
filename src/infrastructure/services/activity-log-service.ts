/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { desc, eq } from 'drizzle-orm'
import { Context, Data, Effect, Layer } from 'effect'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database'
import {
  activityLogs,
  type ActivityLog,
} from '@/infrastructure/database/drizzle/schema/activity-log'

/**
 * Database error for activity log operations
 */
export class ActivityLogDatabaseError extends Data.TaggedError('ActivityLogDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Activity log with user metadata
 *
 * Enriches activity log with user information for display.
 */
export interface ActivityLogWithUser extends ActivityLog {
  readonly user: {
    readonly id: string
    readonly name: string
    readonly email: string
  } | null
}

/**
 * Activity Log Service
 *
 * Provides type-safe database operations for activity logs using Drizzle ORM.
 * Follows Sovrium patterns:
 * - Effect.ts for functional programming
 * - Drizzle ORM query builder (NO raw SQL)
 * - Context/Layer for dependency injection
 */
export class ActivityLogService extends Context.Tag('ActivityLogService')<
  ActivityLogService,
  {
    readonly listAll: () => Effect.Effect<readonly ActivityLog[], ActivityLogDatabaseError>
    readonly getById: (
      id: string
    ) => Effect.Effect<ActivityLogWithUser | null, ActivityLogDatabaseError>
    readonly create: (log: {
      readonly userId: string
      readonly action: 'create' | 'update' | 'delete' | 'restore'
      readonly tableName: string
      readonly tableId: string
      readonly recordId: string
      readonly changes: {
        readonly before?: Record<string, unknown>
        readonly after?: Record<string, unknown>
      }
      readonly sessionId?: string
      readonly ipAddress?: string
      readonly userAgent?: string
    }) => Effect.Effect<ActivityLog, ActivityLogDatabaseError>
  }
>() {}

/**
 * Helper to map database row to ActivityLogWithUser
 * @internal
 */
function mapRowToActivityLog(
  row: Readonly<{
    id: string
    createdAt: Date
    userId: string | null
    sessionId: string | null
    action: 'create' | 'update' | 'delete' | 'restore'
    tableName: string
    tableId: string
    recordId: string
    changes: ActivityLogChanges | null
    ipAddress: string | null
    userAgent: string | null
    userName: string | null
    userEmail: string | null
  }>
): Readonly<ActivityLogWithUser> {
  return {
    id: row.id,
    createdAt: row.createdAt,
    userId: row.userId,
    sessionId: row.sessionId,
    action: row.action,
    tableName: row.tableName,
    tableId: row.tableId,
    recordId: row.recordId,
    changes: row.changes,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    user:
      row.userId && row.userName && row.userEmail
        ? { id: row.userId, name: row.userName, email: row.userEmail }
        : null, // eslint-disable-line unicorn/no-null -- Database LEFT JOIN returns null for missing user
  }
}

/**
 * Activity Log Service Implementation
 *
 * Uses Drizzle ORM query builder for type-safe, SQL-injection-proof queries.
 */
export const ActivityLogServiceLive = Layer.succeed(ActivityLogService, {
  /**
   * List all activity logs
   */
  listAll: () =>
    Effect.tryPromise({
      try: () => db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)),
      catch: (error) => new ActivityLogDatabaseError({ cause: error }),
    }),

  /**
   * Get activity log by ID with user metadata
   *
   * Performs LEFT JOIN with users table to include user information.
   * Returns null if activity log not found.
   */
  getById: (id: string) =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            id: activityLogs.id,
            createdAt: activityLogs.createdAt,
            userId: activityLogs.userId,
            sessionId: activityLogs.sessionId,
            action: activityLogs.action,
            tableName: activityLogs.tableName,
            tableId: activityLogs.tableId,
            recordId: activityLogs.recordId,
            changes: activityLogs.changes,
            ipAddress: activityLogs.ipAddress,
            userAgent: activityLogs.userAgent,
            userName: users.name,
            userEmail: users.email,
          })
          .from(activityLogs)
          .leftJoin(users, eq(activityLogs.userId, users.id))
          .where(eq(activityLogs.id, id))
          .limit(1)

        // eslint-disable-next-line unicorn/no-null -- Database query returns null for not found
        return result.length === 0 ? null : mapRowToActivityLog(result[0]!)
      },
      catch: (error) => new ActivityLogDatabaseError({ cause: error }),
    }),

  /**
   * Create activity log entry
   */
  create: (log) =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .insert(activityLogs)
          .values({
            id: crypto.randomUUID(),
            userId: log.userId,
            action: log.action,
            tableName: log.tableName,
            tableId: log.tableId,
            recordId: log.recordId,
            changes: log.changes,
            sessionId: log.sessionId,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
          })
          .returning()

        return result[0]!
      },
      catch: (error) => new ActivityLogDatabaseError({ cause: error }),
    }),
})
