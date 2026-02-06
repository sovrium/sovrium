/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, gte, count, sql } from 'drizzle-orm'
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
 */
export interface ActivityLogWithUser {
  readonly id: string
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly changes:
    | {
        readonly before?: Record<string, unknown>
        readonly after?: Record<string, unknown>
      }
    | null
    | undefined
  readonly createdAt: Date
  readonly userId: string | undefined
  readonly userName: string | undefined
  readonly userEmail: string | undefined
  readonly userImage: string | undefined
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
    readonly getRecordHistory: (params: {
      readonly tableName: string
      readonly recordId: string
      readonly limit?: number
      readonly offset?: number
      readonly checkRecordExists?: boolean
    }) => Effect.Effect<
      { readonly logs: readonly ActivityLogWithUser[]; readonly total: number },
      ActivityLogDatabaseError
    >
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
   * Get record history with user metadata
   */
  getRecordHistory: (params) =>
    Effect.gen(function* () {
      // One year ago for retention policy
      const oneYearAgo = new Date(new Date().setFullYear(new Date().getFullYear() - 1))

      // Build where conditions
      const conditions = [
        eq(activityLogs.tableName, params.tableName),
        eq(activityLogs.recordId, params.recordId),
        gte(activityLogs.createdAt, oneYearAgo),
      ]

      // Count total matching records
      const countResult = yield* Effect.tryPromise({
        try: () =>
          db
            .select({ count: count() })
            .from(activityLogs)
            .where(and(...conditions)),
        catch: (error) => new ActivityLogDatabaseError({ cause: error }),
      })

      const total = countResult[0]?.count ?? 0

      // If checkRecordExists is true and no logs found, verify record exists in table
      if (params.checkRecordExists && total === 0) {
        // Check if record exists in the dynamic table using raw SQL
        // Note: This is safe because tableName comes from app schema, not user input
        const recordExists = yield* Effect.tryPromise({
          try: () =>
            db.execute<{ exists: number }>(
              sql`SELECT 1 as exists FROM ${sql.identifier(params.tableName)} WHERE id = ${params.recordId} LIMIT 1`
            ),
          catch: (error) => new ActivityLogDatabaseError({ cause: error }),
        })

        // If no record found in table and no activity logs, record doesn't exist
        if (!recordExists || recordExists.length === 0) {
          return yield* Effect.fail(
            new ActivityLogDatabaseError({ cause: new Error('Record not found') })
          )
        }
      }

      // Fetch paginated activity logs with user metadata
      const logs = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              id: activityLogs.id,
              action: activityLogs.action,
              changes: activityLogs.changes,
              createdAt: activityLogs.createdAt,
              userId: activityLogs.userId,
              userName: users.name,
              userEmail: users.email,
              userImage: users.image,
            })
            .from(activityLogs)
            .leftJoin(users, eq(activityLogs.userId, users.id))
            .where(and(...conditions))
            .orderBy(activityLogs.createdAt)
            .limit(params.limit ?? 1000)
            .offset(params.offset ?? 0),
        catch: (error) => new ActivityLogDatabaseError({ cause: error }),
      })

      return {
        logs: logs.map((log) => ({
          id: log.id,
          action: log.action,
          changes: log.changes,
          createdAt: log.createdAt,
          userId: log.userId ?? undefined,
          userName: log.userName ?? undefined,
          userEmail: log.userEmail ?? undefined,
          userImage: log.userImage ?? undefined,
        })),
        total,
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
