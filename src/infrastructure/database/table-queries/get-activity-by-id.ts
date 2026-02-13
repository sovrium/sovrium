/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database'
import { activityLogs } from '@/infrastructure/database/drizzle/schema/activity-log'

export class ActivityNotFoundError {
  readonly _tag = 'ActivityNotFoundError'
  constructor(readonly activityId: string) {}
}

export class DatabaseError {
  readonly _tag = 'DatabaseError'
  constructor(
    readonly message: string,
    readonly cause: unknown
  ) {}
}

/**
 * Activity log output with user information
 */
export interface ActivityLogDetail {
  readonly id: string
  readonly userId: string | null
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName: string
  readonly recordId: number | string
  readonly changes: Record<string, unknown> | null
  readonly createdAt: string
  readonly user?: {
    readonly id: string
    readonly name: string | null
    readonly email: string
  }
}

/**
 * Get activity log by ID with user information
 *
 * Fetches a single activity log entry with optional user metadata.
 */
export function getActivityById(
  activityId: string
): Effect.Effect<ActivityLogDetail, ActivityNotFoundError | DatabaseError, never> {
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
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
          })
          .from(activityLogs)
          .leftJoin(users, eq(activityLogs.userId, users.id))
          .where(eq(activityLogs.id, activityId))
          .limit(1),
      catch: (error) => new DatabaseError('Failed to fetch activity log', error),
    })

    if (result.length === 0) {
      return yield* Effect.fail(new ActivityNotFoundError(activityId))
    }

    const log = result[0]!

    return {
      id: log.id,
      userId: log.userId,
      action: log.action,
      tableName: log.tableName,
      recordId: /^\d+$/.test(log.recordId) ? parseInt(log.recordId, 10) : log.recordId,
      changes: log.changes as Record<string, unknown> | null,
      createdAt: log.createdAt.toISOString(),
      ...(log.userId &&
        log.userEmail && {
          user: {
            id: log.userId,
            name: log.userName,
            email: log.userEmail,
          },
        }),
    }
  })
}
