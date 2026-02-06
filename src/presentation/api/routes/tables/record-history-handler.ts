/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { runEffect } from '@/presentation/api/utils'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Error types for record history
 */
class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly recordId: string
}> {}

class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Check if record has any activity logs
 */
async function checkRecordExists(tableName: string, recordId: string) {
  const { db } = await import('@/infrastructure/database/drizzle')
  const { activityLogs } = await import('@/infrastructure/database/drizzle/schema/activity-log')
  const { eq, and } = await import('drizzle-orm')

  const result = await db
    .select({ count: activityLogs.id })
    .from(activityLogs)
    .where(and(eq(activityLogs.tableName, tableName), eq(activityLogs.recordId, recordId)))
    .limit(1)

  return result.length > 0
}

/**
 * Fetch total count of activities within retention period
 */
async function fetchTotalCount(tableName: string, recordId: string) {
  const { db } = await import('@/infrastructure/database/drizzle')
  const { activityLogs } = await import('@/infrastructure/database/drizzle/schema/activity-log')
  const { eq, and, gte } = await import('drizzle-orm')

  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const result = await db
    .select({ count: activityLogs.id })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.tableName, tableName),
        eq(activityLogs.recordId, recordId),
        gte(activityLogs.createdAt, oneYearAgo)
      )
    )

  return result.length
}

/**
 * Fetch activity history from database
 */
async function fetchActivities(tableName: string, recordId: string, limit: number, offset: number) {
  const { db } = await import('@/infrastructure/database/drizzle')
  const { activityLogs } = await import('@/infrastructure/database/drizzle/schema/activity-log')
  const { users } = await import('@/infrastructure/auth/better-auth/schema')
  const { eq, and, gte } = await import('drizzle-orm')

  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const activities = await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      changes: activityLogs.changes,
      createdAt: activityLogs.createdAt,
      userId: activityLogs.userId,
      userName: users.name,
      userEmail: users.email,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(
      and(
        eq(activityLogs.tableName, tableName),
        eq(activityLogs.recordId, recordId),
        gte(activityLogs.createdAt, oneYearAgo)
      )
    )
    .orderBy(activityLogs.createdAt)
    .limit(limit)
    .offset(offset)

  return activities
}

/**
 * Handle GET /api/tables/:tableId/records/:recordId/history
 *
 * Retrieves the complete change history for a specific record.
 *
 * Features:
 * - Chronological ordering (oldest to newest)
 * - User metadata for each activity
 * - Pagination support (limit/offset)
 * - 1-year retention policy enforcement
 *
 * Authentication: Always required (activity APIs require auth)
 */
export async function handleGetRecordHistory(c: Context, app: App) {
  const { tableName } = getTableContext(c)
  const tableId = c.req.param('tableId')
  const recordId = c.req.param('recordId')

  // Parse pagination params
  const limitParam = c.req.query('limit')
  const offsetParam = c.req.query('offset')
  const limit = limitParam ? parseInt(limitParam, 10) : 100
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0

  // Validate table exists
  const table = app.tables?.find((t) => t.id === parseInt(tableId, 10))
  if (!table) {
    return c.json(
      {
        success: false,
        message: 'Table not found',
        code: 'TABLE_NOT_FOUND',
      },
      404
    )
  }

  const program = Effect.gen(function* () {
    const exists = yield* Effect.tryPromise({
      try: () => checkRecordExists(tableName, String(recordId)),
      catch: (error) => new DatabaseError({ message: 'Failed to check record', cause: error }),
    })

    if (!exists) {
      return yield* Effect.fail(new NotFoundError({ recordId: String(recordId) }))
    }

    const total = yield* Effect.tryPromise({
      try: () => fetchTotalCount(tableName, String(recordId)),
      catch: (error) => new DatabaseError({ message: 'Failed to fetch total', cause: error }),
    })

    const activities = yield* Effect.tryPromise({
      try: () => fetchActivities(tableName, String(recordId), limit, offset),
      catch: (error) => new DatabaseError({ message: 'Failed to fetch activities', cause: error }),
    })

    return {
      history: activities.map((activity) => ({
        id: activity.id,
        action: activity.action,
        changes: activity.changes,
        createdAt: activity.createdAt.toISOString(),
        user: activity.userId
          ? {
              id: activity.userId,
              name: activity.userName ?? 'Unknown',
              email: activity.userEmail ?? '',
            }
          : undefined,
      })),
      pagination: { limit, offset, total },
    }
  })

  return runEffect(c, program)
}
