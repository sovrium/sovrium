/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq, and, asc, gte } from 'drizzle-orm'
import { Effect } from 'effect'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { SessionContextError } from '@/infrastructure/database'
import { db } from '@/infrastructure/database/drizzle'
import { activityLogs } from '@/infrastructure/database/drizzle/schema/activity-log'
import type { ActivityHistoryEntry } from '@/application/ports/repositories/activity-repository'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Fetch activity history for a specific record
 */
export function getRecordHistory(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
}): Effect.Effect<readonly ActivityHistoryEntry[], SessionContextError> {
  const { tableName, recordId } = config

  return Effect.tryPromise({
    try: async () => {
      // Retention policy: exclude activities older than 1 year
      const now = new Date()
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

      const results = await db
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
        .where(
          and(
            eq(activityLogs.tableName, tableName),
            eq(activityLogs.recordId, recordId),
            gte(activityLogs.createdAt, oneYearAgo)
          )
        )
        .orderBy(asc(activityLogs.createdAt))

      return results.map((row) => ({
        action: row.action,
        createdAt: row.createdAt,
        changes: row.changes,
        user:
          row.userId && row.userName && row.userEmail
            ? {
                id: row.userId,
                name: row.userName,
                email: row.userEmail,
                image: row.userImage,
              }
            : undefined,
      }))
    },
    catch: (error) => new SessionContextError('Failed to fetch activity history', error),
  })
}
