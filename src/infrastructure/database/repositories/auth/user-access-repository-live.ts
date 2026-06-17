/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asc, eq } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  UserAccessDatabaseError,
  UserAccessRepository,
  type UserAccessRow,
} from '@/application/ports/repositories/auth/user-access-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { userAccess as userAccessPg } from '@/infrastructure/database/drizzle/schema/user-access'
import { userAccess as userAccessSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/user-access'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const userAccess = resolveDialectSchema(userAccessPg, userAccessSqlite)

const wrap = makeDbWrap((cause) => new UserAccessDatabaseError({ cause }))

const shapeRow = (row: Readonly<typeof userAccess.$inferSelect>): UserAccessRow => ({
  id: row.id,
  userId: row.userId,
  tableSlug: row.tableSlug,
  recordIds: row.recordIds,
  role: row.role,
  createdAt: row.createdAt,
  createdBy: row.createdBy ?? undefined,
})

export const UserAccessRepositoryLive = Layer.succeed(UserAccessRepository, {
  insert: (input, createdBy) =>
    wrap(async () => {
      const [row] = await db
        .insert(userAccess)
        .values({
          userId: input.userId,
          tableSlug: input.tableSlug,
          recordIds: [...input.recordIds],
          role: input.role,
          createdAt: new Date(),
          createdBy,
        })
        .returning()
      if (!row) {
        throw new Error('user_access INSERT returned no rows')
      }
      return shapeRow(row)
    }),

  list: (filter) =>
    wrap(async () => {
      const rows =
        filter.userId === undefined
          ? await db.select().from(userAccess).orderBy(asc(userAccess.createdAt))
          : await db
              .select()
              .from(userAccess)
              .where(eq(userAccess.userId, filter.userId))
              .orderBy(asc(userAccess.createdAt))
      return rows.map((row) => shapeRow(row))
    }),
})
