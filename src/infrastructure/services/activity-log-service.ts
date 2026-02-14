/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { desc, eq, and, gte, sql } from 'drizzle-orm'
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
export interface ActivityLogWithUser extends ActivityLog {
  readonly user: {
    readonly id: string
    readonly name: string
    readonly email: string
  } | null
}

/**
 * Pagination result for activity logs
 */
export interface PaginatedActivityLogs {
  readonly logs: readonly ActivityLogWithUser[]
  readonly total: number
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
    readonly getRecordHistory: (params: {
      readonly tableName: string
      readonly recordId: string
      readonly limit?: number
      readonly offset?: number
    }) => Effect.Effect<PaginatedActivityLogs, ActivityLogDatabaseError>
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

  /**
   * Get record history with pagination and user metadata
   *
   * Returns activity logs for a specific record with:
   * - 1 year retention policy (activities older than 365 days excluded)
   * - Chronological order (oldest to newest)
   * - User metadata joined from users table
   * - Pagination support
   */
  getRecordHistory: (params) =>
    Effect.tryPromise({
      try: async () => {
        const { tableName, recordId, limit = 50, offset = 0 } = params

        // Calculate retention cutoff (1 year ago)
        const oneYearAgo = new Date()
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

        // Build where clause: match table + record + retention policy
        const whereClause = and(
          eq(activityLogs.tableName, tableName),
          eq(activityLogs.recordId, String(recordId)),
          gte(activityLogs.createdAt, oneYearAgo)
        )

        // Get total count for pagination
        const countResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(activityLogs)
          .where(whereClause)

        const total = countResult[0]?.count ?? 0

        // Get paginated logs with user metadata
        const logs = await db
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
          .where(whereClause)
          .orderBy(activityLogs.createdAt) // Oldest to newest (chronological)
          .limit(limit)
          .offset(offset)

        // Map to ActivityLogWithUser format
        const logsWithUser: ActivityLogWithUser[] = logs.map((log) => ({
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
          user: log.userId
            ? {
                id: log.userId,
                name: log.userName ?? 'Unknown User',
                email: log.userEmail ?? '',
              }
            : /* eslint-disable-next-line unicorn/no-null -- ActivityLogWithUser interface requires null for missing user */
              null,
        }))

        return {
          logs: logsWithUser,
          total,
        }
      },
      catch: (error) => new ActivityLogDatabaseError({ cause: error }),
    }),
})
