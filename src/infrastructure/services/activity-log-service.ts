/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { desc, and, eq, gte, sql } from 'drizzle-orm'
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
  readonly user:
    | {
        readonly id: string
        readonly name: string
        readonly email: string
      }
    | undefined
}

/**
 * Query filters for activity logs
 */
export interface ActivityLogFilters {
  readonly page?: number
  readonly pageSize?: number
  readonly tableName?: string
  readonly action?: ActivityAction
  readonly userId?: string
  readonly startDate?: string
}

/**
 * Paginated result for activity logs
 */
export interface PaginatedActivityLogs {
  readonly logs: readonly ActivityLogWithUser[]
  readonly total: number
}

/**
 * Build WHERE conditions for activity log queries
 */
function buildFilterConditions(filters: Readonly<ActivityLogFilters>) {
  const baseConditions = [gte(activityLogs.createdAt, sql`NOW() - INTERVAL '1 year'`)]

  const tableNameCondition = filters.tableName
    ? [eq(activityLogs.tableName, filters.tableName)]
    : []

  const actionCondition = filters.action ? [eq(activityLogs.action, filters.action)] : []

  const userIdCondition = filters.userId ? [eq(activityLogs.userId, filters.userId)] : []

  const startDateCondition = filters.startDate
    ? [gte(activityLogs.createdAt, new Date(filters.startDate))]
    : []

  return [
    ...baseConditions,
    ...tableNameCondition,
    ...actionCondition,
    ...userIdCondition,
    ...startDateCondition,
  ]
}

/**
 * Query activity logs with user metadata
 */
async function queryActivityLogs(
  conditions: readonly ReturnType<typeof buildFilterConditions>[number][],
  pageSize: number,
  offset: number
) {
  return db
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
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(activityLogs.createdAt))
    .limit(pageSize)
    .offset(offset)
}

/**
 * Get total count of activity logs matching filters
 */
async function queryActivityLogCount(
  conditions: readonly ReturnType<typeof buildFilterConditions>[number][]
) {
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityLogs)
    .where(and(...conditions))

  return countResult?.count ?? 0
}

/**
 * Map activity log with user to include only defined user data
 */
function mapActivityLogWithUser(
  log: Readonly<{
    readonly id: string
    readonly createdAt: Date
    readonly userId: string | null
    readonly sessionId: string | null
    readonly action: ActivityAction
    readonly tableName: string
    readonly tableId: string
    readonly recordId: string
    readonly changes: unknown
    readonly ipAddress: string | null
    readonly userAgent: string | null
    readonly user: {
      readonly id: string
      readonly name: string
      readonly email: string
    }
  }>
): Readonly<ActivityLogWithUser> {
  return {
    ...log,
    user: log.user.id ? log.user : undefined,
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
    readonly listWithFilters: (
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
        const page = filters.page ?? 1
        const pageSize = filters.pageSize ?? 50
        const offset = (page - 1) * pageSize

        const conditions = buildFilterConditions(filters)
        const logs = await queryActivityLogs(conditions, pageSize, offset)
        const total = await queryActivityLogCount(conditions)

        return {
          logs: logs.map(mapActivityLogWithUser),
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
