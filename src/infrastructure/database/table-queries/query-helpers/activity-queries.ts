/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq, and, asc, gte, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { SessionContextError } from '@/infrastructure/database'
import { db } from '@/infrastructure/database/drizzle'
import { activityLogs } from '@/infrastructure/database/drizzle/schema/activity-log'
import { extractUserFromRow } from '../shared/user-join-helpers'
import type { ActivityHistoryEntry } from '@/application/ports/repositories/activity-repository'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Build where condition for activity log queries (with 1-year retention policy)
 */
function buildActivityWhereCondition(tableName: string, recordId: string) {
  const now = new Date()
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  return and(
    eq(activityLogs.tableName, tableName),
    eq(activityLogs.recordId, recordId),
    gte(activityLogs.createdAt, oneYearAgo)
  )
}

/**
 * Transform an activity log row into an ActivityHistoryEntry
 */
function transformActivityRow(row: {
  readonly action: string
  readonly createdAt: Date
  readonly changes: unknown
  readonly userId: string | null
  readonly userName: string | null
  readonly userEmail: string | null
  readonly userImage: string | null
}): ActivityHistoryEntry {
  return {
    action: row.action,
    createdAt: row.createdAt,
    changes: row.changes,
    user: extractUserFromRow(row),
  }
}

/**
 * Fetch activity history for a specific record with optional pagination
 */
export function getRecordHistory(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
  readonly limit?: number
  readonly offset?: number
}): Effect.Effect<
  {
    readonly entries: readonly ActivityHistoryEntry[]
    readonly total: number
  },
  SessionContextError
> {
  const { tableName, recordId, limit, offset } = config

  return Effect.tryPromise({
    try: async () => {
      const whereCondition = buildActivityWhereCondition(tableName, recordId)

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(activityLogs)
        .where(whereCondition)
      const total = countResult[0]?.count ?? 0

      const baseQuery = db
        .select({
          action: activityLogs.action,
          createdAt: activityLogs.createdAt,
          changes: activityLogs.changes,
          userId: activityLogs.userId,
          userName: users.name,
          userEmail: users.email,
          userImage: users.image,
        })
        .from(activityLogs)
        .leftJoin(users, eq(activityLogs.userId, users.id))
        .where(whereCondition)
        .orderBy(asc(activityLogs.createdAt))

      const paginatedQuery =
        limit !== undefined
          ? offset !== undefined
            ? baseQuery.limit(limit).offset(offset)
            : baseQuery.limit(limit)
          : baseQuery

      const results = await paginatedQuery
      return { entries: results.map(transformActivityRow), total }
    },
    catch: (error) => new SessionContextError('Failed to fetch activity history', error),
  })
}
