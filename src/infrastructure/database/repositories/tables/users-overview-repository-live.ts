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
import { notAnAgentAccount } from '@/infrastructure/database/sql/auth-user-predicates'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/** Wrap a DB promise, adapting failures to UsersOverviewDatabaseError. */
const wrap = makeDbWrap((error) => new UsersOverviewDatabaseError({ cause: error }))

/**
 * Users Overview Repository Implementation
 *
 * Three dialect-aware raw reads over the Better Auth `user` / `session` tables.
 * The dialect-correct table objects are resolved at call time (the helpers
 * memoize the dialect lookup) — the auth `user` table is `auth.user` on Postgres
 * and `auth_user` on SQLite, so capturing the dialect-correct object per call is
 * what keeps each query targeting a table that actually exists.
 */
export const UsersOverviewRepositoryLive = Layer.succeed(UsersOverviewRepository, {
  listUserRows: () =>
    wrap(async () => {
      // One full scan of auth.user.role + created_at. The auth.user table is
      // small (operators in the hundreds, not millions) so a per-row scan is
      // cheaper than three separate GROUP BY queries and keeps the
      // dialect-agnostic call site simple.
      //
      // Agent-mirrored accounts are excluded on the same predicate the sibling
      // DIRECTORY read uses. Filtering only one of the two would be worse than
      // filtering neither: the operator would read a total on the tile that does
      // not match the number of rows in the list directly beneath it, and the
      // discrepancy would silently equal the agent count.
      const usersTable = authUsersTable()
      return (await db
        .select({ role: usersTable.role, createdAt: usersTable.createdAt })
        .from(usersTable)
        .where(notAnAgentAccount(usersTable.email))) as ReadonlyArray<{
        role: string | null
        createdAt: Date | string | number
      }>
    }),

  countActiveUsersSince: (since) =>
    wrap(async () => {
      // active_24h — distinct user_id from auth.session rows in the window. Use
      // a COUNT(DISTINCT user_id) so the result is a single integer per dialect;
      // falls back gracefully to 0 when no sessions exist.
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
      // sessions_started source — fetch the createdAt list scoped to the window.
      const sessionsTable = authSessionsTable()
      return (await db
        .select({ createdAt: sessionsTable.createdAt })
        .from(sessionsTable)
        .where(gte(sessionsTable.createdAt, since))) as ReadonlyArray<{
        createdAt: Date | string | number
      }>
    }),
})
