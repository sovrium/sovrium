/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { gte, sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  UsersOverviewRepository,
  UsersOverviewDatabaseError,
} from '@/application/ports/repositories/tables/users-overview-repository'
import { db } from '@/infrastructure/database'
import { authSessionsTable, authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const wrap = makeDbWrap((error) => new UsersOverviewDatabaseError({ cause: error }))

export const UsersOverviewRepositoryLive = Layer.succeed(UsersOverviewRepository, {
  listUserRows: () =>
    wrap(async () => {
      const usersTable = authUsersTable()
      return (await db
        .select({ role: usersTable.role, createdAt: usersTable.createdAt })
        .from(usersTable)) as ReadonlyArray<{
        role: string | null
        createdAt: Date | string | number
      }>
    }),

  countActiveUsersSince: (since) =>
    wrap(async () => {
      const sessionsTable = authSessionsTable()
      const rows = (await db
        .select({ count: sql<number>`COUNT(DISTINCT ${sessionsTable.userId})` })
        .from(sessionsTable)
        .where(gte(sessionsTable.createdAt, since))) as ReadonlyArray<{ count: number | string }>
      const raw = rows[0]?.count ?? 0
      return typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10) || 0
    }),

  listSessionRowsSince: (since) =>
    wrap(async () => {
      const sessionsTable = authSessionsTable()
      return (await db
        .select({ createdAt: sessionsTable.createdAt })
        .from(sessionsTable)
        .where(gte(sessionsTable.createdAt, since))) as ReadonlyArray<{
        createdAt: Date | string | number
      }>
    }),
})
