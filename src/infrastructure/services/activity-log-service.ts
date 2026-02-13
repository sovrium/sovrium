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
  type ActivityAction,
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
    readonly email: string
    readonly name: string
  } | null
}

/**
 * Filters for listing activity logs
 */
export interface ActivityLogFilters {
  readonly tableName?: string
  readonly action?: ActivityAction
  readonly userId?: string
  readonly startDate?: Date
  readonly endDate?: Date
  readonly page?: number
  readonly pageSize?: number
}

/**
 * Paginated result for activity logs
 */
export interface PaginatedActivityLogs {
  readonly activities: readonly ActivityLogWithUser[]
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
    readonly list: (
      filters: ActivityLogFilters
    ) => Effect.Effect<PaginatedActivityLogs, ActivityLogDatabaseError>
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
 * Build WHERE clause conditions for activity log filtering
 */
function buildWhereConditions(filters: ActivityLogFilters) {
  // Calculate 1-year retention policy cutoff using functional pattern
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

  return [
    // 1-year retention policy: exclude activities older than 1 year
    gte(activityLogs.createdAt, oneYearAgo),
    ...(filters.tableName ? [eq(activityLogs.tableName, filters.tableName)] : []),
    ...(filters.action ? [eq(activityLogs.action, filters.action)] : []),
    ...(filters.userId ? [eq(activityLogs.userId, filters.userId)] : []),
    ...(filters.startDate ? [gte(activityLogs.createdAt, filters.startDate)] : []),
    ...(filters.endDate
      ? [sql`${activityLogs.createdAt} <= ${filters.endDate.toISOString()}::timestamptz`]
      : []),
  ]
}

/**
 * Get total count of activity logs matching filters
 */
async function getTotalCount(
  // eslint-disable-next-line functional/prefer-immutable-types -- Drizzle ORM's and() returns mutable type, Readonly wrapper causes TypeScript errors
  whereClause: ReturnType<typeof and> | undefined
): Promise<number> {
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityLogs)
    .where(whereClause)

  return Number(countResult[0]?.count ?? 0)
}

/**
 * Query activity logs with pagination and user metadata
 */
async function queryActivitiesWithUsers(
  // eslint-disable-next-line functional/prefer-immutable-types -- Drizzle ORM's and() returns mutable type, Readonly wrapper causes TypeScript errors
  whereClause: ReturnType<typeof and> | undefined,
  page: number,
  pageSize: number
): Promise<readonly ActivityLogWithUser[]> {
  const offset = (page - 1) * pageSize

  return db
    .select({
      id: activityLogs.id,
      createdAt: activityLogs.createdAt,
      userId: activityLogs.userId,
      action: activityLogs.action,
      tableName: activityLogs.tableName,
      tableId: activityLogs.tableId,
      recordId: activityLogs.recordId,
      changes: activityLogs.changes,
      sessionId: activityLogs.sessionId,
      ipAddress: activityLogs.ipAddress,
      userAgent: activityLogs.userAgent,
      // User metadata (nullable for system activities)
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
      },
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(whereClause)
    .orderBy(desc(activityLogs.createdAt))
    .limit(pageSize)
    .offset(offset)
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
   * List activity logs with filtering and pagination
   */
  list: (filters) =>
    Effect.tryPromise({
      try: async () => {
        // Build WHERE conditions
        const conditions = buildWhereConditions(filters)
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined

        // Get total count
        const total = await getTotalCount(whereClause)

        // Calculate pagination
        const page = filters.page ?? 1
        const pageSize = filters.pageSize ?? 50

        // Query with join to users table for user metadata
        const activities = await queryActivitiesWithUsers(whereClause, page, pageSize)

        return {
          activities,
          total,
        }
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
