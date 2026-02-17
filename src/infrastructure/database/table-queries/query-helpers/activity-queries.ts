/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq, and, asc } from 'drizzle-orm'
import { Effect } from 'effect'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { SessionContextError } from '@/infrastructure/database'
import { db } from '@/infrastructure/database/drizzle'
import { activityLogs } from '@/infrastructure/database/drizzle/schema/activity-log'
import type {
  ActivityHistoryEntry,
  ActivityDetails,
} from '@/application/ports/repositories/activity-repository'
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
        .where(and(eq(activityLogs.tableName, tableName), eq(activityLogs.recordId, recordId)))
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

/**
 * Format activity details row to ActivityDetails type
 */
function formatActivityDetailsRow(row: {
  readonly id: string
  readonly userId: string | null
  readonly action: string
  readonly tableName: string
  readonly recordId: string
  readonly changes: unknown
  readonly createdAt: Date
  readonly userName: string | null
  readonly userEmail: string | null
  readonly userImage: string | null
}): ActivityDetails {
  return {
    id: row.id,
    userId: row.userId,
    action: row.action,
    tableName: row.tableName,
    recordId: row.recordId,
    changes: row.changes,
    createdAt: row.createdAt,
    user:
      row.userId && row.userName && row.userEmail
        ? {
            id: row.userId,
            name: row.userName,
            email: row.userEmail,
            image: row.userImage,
          }
        : undefined,
  }
}

/**
 * Fetch single activity by ID
 */
export function getActivityById(config: {
  readonly session: Readonly<Session>
  readonly activityId: string
}): Effect.Effect<ActivityDetails, SessionContextError> {
  const { activityId } = config

  return Effect.gen(function* () {
    const results = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: activityLogs.id,
            userId: activityLogs.userId,
            action: activityLogs.action,
            tableName: activityLogs.tableName,
            recordId: activityLogs.recordId,
            changes: activityLogs.changes,
            createdAt: activityLogs.createdAt,
            userName: users.name,
            userEmail: users.email,
            userImage: users.image,
          })
          .from(activityLogs)
          .leftJoin(users, eq(activityLogs.userId, users.id))
          .where(eq(activityLogs.id, activityId))
          .limit(1),
      catch: (error) => new SessionContextError('Failed to fetch activity', error),
    })

    if (results.length === 0) {
      return yield* Effect.fail(new SessionContextError('Activity not found', { activityId }))
    }

    return formatActivityDetailsRow(results[0])
  })
}
