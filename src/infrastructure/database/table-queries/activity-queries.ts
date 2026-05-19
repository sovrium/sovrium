/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { Database, activityLogs, users } from '@/infrastructure/database'

export interface ActivityLogWithUser {
  readonly id: string
  readonly userId: string
  readonly action: string
  readonly tableName: string
  readonly recordId: number
  readonly changes: Record<string, unknown> | null
  readonly createdAt: Date
  readonly user: {
    readonly id: string
    readonly name: string
    readonly email: string
  }
}

export class ActivityDatabaseError {
  readonly _tag = 'ActivityDatabaseError'
  constructor(readonly cause: unknown) {}
}

export class ActivityNotFoundError {
  readonly _tag = 'ActivityNotFoundError'
  constructor(readonly activityId: string) {}
}

export const getActivityById = (activityId: string) =>
  Effect.gen(function* () {
    const db = yield* Database

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
            userIdJoined: users.id,
          })
          .from(activityLogs)
          .leftJoin(users, eq(activityLogs.userId, users.id))
          .where(eq(activityLogs.id, activityId))
          .limit(1),
      catch: (error) => new ActivityDatabaseError(error),
    })

    if (result.length === 0 || !result[0]) {
      return yield* Effect.fail(new ActivityNotFoundError(activityId))
    }

    const row = result[0]

    const recordIdInt = parseInt(row.recordId, 10)
    const recordId = isNaN(recordIdInt) ? 0 : recordIdInt

    const changes = (row.changes as Record<string, unknown> | null) ?? null

    const activity: ActivityLogWithUser = {
      id: row.id,
      userId: row.userId ?? '',
      action: row.action,
      tableName: row.tableName,
      recordId,
      changes,
      createdAt: row.createdAt,
      user: {
        id: row.userIdJoined ?? '',
        name: row.userName ?? '',
        email: row.userEmail ?? '',
      },
    }

    return activity
  })
