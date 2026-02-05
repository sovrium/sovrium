/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { desc, eq } from 'drizzle-orm'
import { Context, Data, Effect, Layer } from 'effect'
import { db } from '@/infrastructure/database'
import {
  activityLogs,
  type ActivityLog,
} from '@/infrastructure/database/drizzle/schema/activity-log'
import { users } from '@/infrastructure/auth/better-auth/schema'

/**
 * Database error for activity log operations
 */
export class ActivityLogDatabaseError extends Data.TaggedError('ActivityLogDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Not found error when activity log doesn't exist
 */
export class ActivityLogNotFoundError extends Data.TaggedError('ActivityLogNotFoundError')<{
  readonly id: string
}> {}

/**
 * Activity log with user details
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
    readonly findById: (
      id: string
    ) => Effect.Effect<ActivityLogWithUser, ActivityLogDatabaseError | ActivityLogNotFoundError>
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
   * Find activity log by ID with user details
   */
  findById: (id) =>
    Effect.gen(function* () {
      const result = (yield* Effect.tryPromise({
        try: () =>
          db
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
              user: users,
            })
            .from(activityLogs)
            .leftJoin(users, eq(activityLogs.userId, users.id))
            .where(eq(activityLogs.id, id)),
        catch: (error) => new ActivityLogDatabaseError({ cause: error }),
      })) as Array<{
        id: string
        createdAt: Date
        userId: string | null
        sessionId: string | null
        action: 'create' | 'update' | 'delete' | 'restore'
        tableName: string
        tableId: string
        recordId: string
        changes:
          | import('@/infrastructure/database/drizzle/schema/activity-log').ActivityLogChanges
          | null
        ipAddress: string | null
        userAgent: string | null
        user: typeof users.$inferSelect | null
      }>

      if (result.length === 0) {
        return yield* new ActivityLogNotFoundError({ id })
      }

      const log = result[0]!

      return {
        id: log.id,
        createdAt: log.createdAt,
        userId: log.userId,
        sessionId: log.sessionId,
        action: log.action,
        tableName: log.tableName,
        tableId: log.tableId,
        recordId: log.recordId,
        changes: log.changes,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        user: log.user
          ? {
              id: log.user.id,
              name: log.user.name,
              email: log.user.email,
            }
          : null,
      }
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
