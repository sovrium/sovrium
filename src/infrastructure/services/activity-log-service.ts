/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { desc, and, eq, gte, sql } from 'drizzle-orm'
import { Context, Data, Effect, Layer } from 'effect'
import { db } from '@/infrastructure/database'
import { users } from '@/infrastructure/database/drizzle/schema'
import {
  activityLogs,
  type ActivityLog,
  type ActivityLogWithUser,
} from '@/infrastructure/database/drizzle/schema/activity-log'

/**
 * Database error for activity log operations
 */
export class ActivityLogDatabaseError extends Data.TaggedError('ActivityLogDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Filters for activity log queries
 */
export interface ActivityLogQueryFilters {
  readonly page: number
  readonly pageSize: number
  readonly action?: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName?: string
  readonly userId?: string
  readonly startDate?: string
}

/**
 * Activity logs with pagination result
 */
export interface ActivityLogsWithPaginationResult {
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
    readonly listWithFilters: (
      filters: ActivityLogQueryFilters
    ) => Effect.Effect<ActivityLogsWithPaginationResult, ActivityLogDatabaseError>
    readonly create: (log: {
      readonly userId: string
      readonly action: 'create' | 'update' | 'delete' | 'restore'
      readonly tableName: string
      readonly tableId?: string
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
 * Build WHERE conditions for activity log filtering
 */
function buildWhereConditions(filters: ActivityLogQueryFilters) {
  const baseConditions = [
    // Retention policy: only show logs from last year
    gte(activityLogs.createdAt, sql`NOW() - INTERVAL '1 year'`),
  ]

  const actionCondition = filters.action ? [eq(activityLogs.action, filters.action)] : []
  const tableNameCondition = filters.tableName
    ? [eq(activityLogs.tableName, filters.tableName)]
    : []
  const userIdCondition = filters.userId ? [eq(activityLogs.userId, filters.userId)] : []
  const startDateCondition = filters.startDate
    ? [gte(activityLogs.createdAt, new Date(filters.startDate))]
    : []

  return [
    ...baseConditions,
    ...actionCondition,
    ...tableNameCondition,
    ...userIdCondition,
    ...startDateCondition,
  ]
}

/**
 * Map database result to ActivityLogWithUser type
 */
function mapToActivityLogWithUser(log: {
  readonly id: string
  readonly userId: string | null
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName: string
  readonly tableId: string | null
  readonly recordId: string
  readonly changes: Record<string, unknown>
  readonly sessionId: string | null
  readonly ipAddress: string | null
  readonly userAgent: string | null
  readonly createdAt: Date
  readonly user: {
    readonly id: string | null
    readonly name: string | null
    readonly email: string | null
  }
}): Readonly<ActivityLogWithUser> {
  return {
    id: log.id,
    userId: log.userId,
    action: log.action,
    tableName: log.tableName,
    tableId: log.tableId,
    recordId: log.recordId,
    changes: log.changes,
    sessionId: log.sessionId,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt,
    user:
      log.user.id && log.user.email
        ? {
            id: log.user.id,
            name: log.user.name,
            email: log.user.email,
          }
        : // eslint-disable-next-line unicorn/no-null -- ActivityLogWithUser type requires null, not undefined
          null,
  } as const
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
   * List activity logs with filters and pagination
   */
  listWithFilters: (filters) =>
    Effect.tryPromise({
      try: async () => {
        const conditions = buildWhereConditions(filters)
        const whereClause = and(...conditions)

        // Count total matching records
        const countResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(activityLogs)
          .where(whereClause)

        const total = countResult[0]?.count ?? 0

        // Calculate offset
        const offset = (filters.page - 1) * filters.pageSize

        // Query with pagination and user join
        const logs = await db
          .select({
            id: activityLogs.id,
            userId: activityLogs.userId,
            action: activityLogs.action,
            tableName: activityLogs.tableName,
            tableId: activityLogs.tableId,
            recordId: activityLogs.recordId,
            changes: activityLogs.changes,
            sessionId: activityLogs.sessionId,
            ipAddress: activityLogs.ipAddress,
            userAgent: activityLogs.userAgent,
            createdAt: activityLogs.createdAt,
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
            },
          })
          .from(activityLogs)
          .leftJoin(users, eq(activityLogs.userId, users.id))
          .where(whereClause)
          .orderBy(desc(activityLogs.createdAt))
          .limit(filters.pageSize)
          .offset(offset)

        return {
          logs: logs.map(mapToActivityLogWithUser),
          total,
        } as const
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
