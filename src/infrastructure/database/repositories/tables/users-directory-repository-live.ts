/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, type SQL } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  UsersDirectoryRepository,
  UsersDirectoryDatabaseError,
  type DirectoryFilters,
} from '@/application/ports/repositories/tables/users-directory-repository'
import { db } from '@/infrastructure/database'
import { authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { notAnAgentAccount } from '@/infrastructure/database/sql/auth-user-predicates'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { searchAnyColumn } from '@/infrastructure/database/sql/dialect-sql-helpers'

/** Wrap a DB promise, adapting failures to UsersDirectoryDatabaseError. */
const wrap = makeDbWrap((error) => new UsersDirectoryDatabaseError({ cause: error }))

/**
 * The `?q=` predicate: the term occurs in `email` OR `name`.
 *
 * `role` is deliberately NOT searched — a closed vocabulary rendered as a pill,
 * where typing `admin` would return every administrator rather than the person
 * meant. `id` is not searched either: an opaque identifier is looked up, not
 * searched for.
 *
 * {@link searchAnyColumn} owns the rest of the contract — the portable
 * `lower(col) LIKE lower(pattern)` spelling (bare `LIKE` is case-SENSITIVE on
 * Postgres and case-INSENSITIVE on SQLite; `ILIKE` does not exist on SQLite),
 * `%` and `_` escaped so `50%` finds the accounts containing `50%`, and — the
 * part that matters most here — an absent term contributing NO condition, so
 * clearing the search box restores the whole directory rather than emptying it.
 */
const buildSearchConditions = (filters: DirectoryFilters | undefined): ReadonlyArray<SQL> => {
  // Resolved here rather than passed in: `authUsersTable()` memoizes the dialect
  // lookup, so a second call is free, and taking the table as a parameter would
  // hand this helper a mutable upstream Drizzle object.
  const usersTable = authUsersTable()
  return searchAnyColumn(filters?.q, usersTable.email, usersTable.name)
}

/**
 * Users Directory Repository Implementation
 *
 * One dialect-aware raw read over the Better Auth `user` table — the row-data
 * sibling of the users-overview aggregate read. The dialect-correct table
 * object is resolved at call time (the `authUsersTable()` helper memoizes the
 * dialect lookup) — the auth `user` table is `auth.user` on Postgres and
 * `auth_user` on SQLite, so capturing the dialect-correct object per call is
 * what keeps the query targeting a table that actually exists.
 *
 * ONE predicate: {@link notAnAgentAccount}. This read goes to the auth table
 * directly rather than through the Better Auth admin plugin, which is what lets
 * a custom top-role operator reach it — and is also how it inherited none of
 * that plugin's filtering. Better Auth's own list-users strips agent-mirrored
 * accounts and `AgentPermissionsSchema` states the
 * contract outright, so for a while the Utilisateurs directory was the one
 * surface in the product that presented an app's automation as staff — each
 * agent shown with its synthetic address and its inherited role, indistinguishable
 * from a colleague, and ban/role affordances beside it.
 */
export const UsersDirectoryRepositoryLive = Layer.succeed(UsersDirectoryRepository, {
  listAllUsers: (filters) =>
    wrap(async () => {
      // One scan of the secret-free directory subset. The auth.user table is
      // small (the whole account population of one self-hosted app), so a single
      // scan is cheap. `?q=` narrows it HERE rather than in the client: `name`
      // is one of the two searchable fields, and a term that matches nothing
      // must return nothing — returning the unfiltered list would claim every
      // account matched.
      const usersTable = authUsersTable()
      const conditions = [notAnAgentAccount(usersTable.email), ...buildSearchConditions(filters)]
      return (await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          name: usersTable.name,
          role: usersTable.role,
          banned: usersTable.banned,
        })
        .from(usersTable)
        .where(and(...conditions))) as ReadonlyArray<{
        id: string
        email: string
        name: string | null
        role: string | null
        banned: boolean | null
      }>
    }),
})
