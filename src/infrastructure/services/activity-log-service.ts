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
 * Activity log not found error
 */
export class ActivityLogNotFoundError extends Data.TaggedError('ActivityLogNotFoundError')<{
  readonly activityId: string
}> {}

/**
 * Activity log with user metadata
 */
export interface ActivityLogWithUser extends ActivityLog {
  readonly user?: {
    readonly id: string
    readonly name: string
    readonly email: string
  }
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
    ) => Effect.Effect<ActivityLogWithUser, ActivityLogNotFoundError | ActivityLogDatabaseError>
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
   * Find activity log by ID with user metadata
   */
  findById: (id) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              activityLog: activityLogs,
              user: users,
            })
            .from(activityLogs)
            .leftJoin(users, eq(activityLogs.userId, users.id))
            .where(eq(activityLogs.id, id))
            .limit(1),
        catch: (error) => new ActivityLogDatabaseError({ cause: error }),
      })

      // Type assertion needed because Drizzle query builder return type is complex
      const queryResult = result as Array<{
        activityLog: ActivityLog
        user: {
          id: string
          name: string
          email: string
        } | null
      }>

      if (queryResult.length === 0) {
        return yield* new ActivityLogNotFoundError({ activityId: id })
      }

      const row = queryResult[0]!
      const activityLogWithUser: Readonly<ActivityLogWithUser> = {
        ...row.activityLog,
        user: row.user
          ? {
              id: row.user.id,
              name: row.user.name,
              email: row.user.email,
            }
          : undefined,
      }

      return activityLogWithUser
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
