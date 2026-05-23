/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { desc, eq, gte, sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  ActivityLogRepository,
  ActivityLogDatabaseError,
} from '@/application/ports/repositories/activity-log-repository'
import { db } from '@/infrastructure/database'
import {
  authUsersTable,
  resolveDialectSchema,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { activityLogs as activityLogsPg } from '@/infrastructure/database/drizzle/schema/activity-log'
import { activityLogs as activityLogsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/activity-log'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { dateIntervalAgo } from '@/infrastructure/database/sql/dialect-sql-helpers'

const activityLogs = resolveDialectSchema(activityLogsPg, activityLogsSqlite)

const wrap = makeDbWrap((error) => new ActivityLogDatabaseError({ cause: error }))

export const ActivityLogRepositoryLive = Layer.succeed(ActivityLogRepository, {
  listAll: () =>
    wrap(async () => {
      const users = authUsersTable()
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
        .where(gte(activityLogs.createdAt, dateIntervalAgo(1, 'year')))
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
            :
              null,
      }))
    }),

  create: (log) =>
    wrap(async () => {
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
    }),
})
