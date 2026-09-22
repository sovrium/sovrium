/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq, and, asc, gte, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { activityLogRetentionCutoff } from '@/domain/models/app/admin/activity-log-retention'
import { DatabaseError } from '@/infrastructure/database'
import { db } from '@/infrastructure/database/drizzle'
import {
  authUsersTable,
  resolveDialectSchema,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { activityLogs as activityLogsPg } from '@/infrastructure/database/drizzle/schema/activity-log'
import { activityLogs as activityLogsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/activity-log'
import { castToInt } from './aggregation-helpers'
import { extractUserFromRow } from './user-join-helpers'
import type { ActivityHistoryEntry } from '@/application/ports/repositories/analytics/activity-repository'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

const activityLogs = resolveDialectSchema(activityLogsPg, activityLogsSqlite)

/**
 * Build where condition for activity log queries (with 1-year retention policy).
 *
 * The cutoff comes from the shared `activityLogRetentionCutoff` rather than being
 * recomputed here. This filter used to BE the retention policy — it hid expired
 * rows while nothing deleted them, so the data was retained forever behind a
 * query that claimed otherwise. Now that `purgeExpiredActivityLogs` removes
 * them, the two must agree on one boundary: a filter that ran ahead of the sweep
 * would recreate the same gap, and a sweep that ran ahead of the filter would
 * silently shorten visible history.
 */
function buildActivityWhereCondition(tableName: string, recordId: string) {
  const oneYearAgo = activityLogRetentionCutoff(new Date())
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
  DatabaseError
> {
  const { tableName, recordId, limit, offset } = config

  return Effect.tryPromise({
    try: async () => {
      const whereCondition = buildActivityWhereCondition(tableName, recordId)

      const users = authUsersTable()
      const countResult = await db
        .select({ count: castToInt(sql`COUNT(*)`) })
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
    catch: (error) => new DatabaseError('Failed to fetch activity history', error),
  })
}
