/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { desc, eq, gte, sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  ActivityLogRepository,
  ActivityLogDatabaseError,
} from '@/application/ports/repositories/activity-log-repository'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database'
import { activityLogs } from '@/infrastructure/database/drizzle/schema/activity-log'

/**
 * Activity Log Repository Implementation
 *
 * Uses Drizzle ORM query builder for type-safe, SQL-injection-proof queries.
 */
export const ActivityLogRepositoryLive = Layer.succeed(ActivityLogRepository, {
  /**
   * List all activity logs with user metadata
   */
  listAll: () =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
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
            userName: users.name,
            userEmail: users.email,
          })
          .from(activityLogs)
          .leftJoin(users, eq(activityLogs.userId, users.id))
          .where(gte(activityLogs.createdAt, sql`NOW() - INTERVAL '1 year'`))
          .orderBy(sql`(${activityLogs.userId} IS NULL) DESC`, desc(activityLogs.createdAt))

        return rows.map((row) => ({
          id: row.id,
          createdAt: row.createdAt,
          userId: row.userId,
          sessionId: row.sessionId,
          action: row.action,
          tableName: row.tableName,
          tableId: row.tableId,
          recordId: row.recordId,
          changes: row.changes,
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
          user:
            row.userId && row.userName && row.userEmail
              ? { id: row.userId, name: row.userName, email: row.userEmail }
              : // eslint-disable-next-line unicorn/no-null -- Null is intentional for system-logged activities (no user_id)
                null,
        }))
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
