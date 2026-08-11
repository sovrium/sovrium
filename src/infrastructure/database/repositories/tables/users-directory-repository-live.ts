/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import {
  UsersDirectoryRepository,
  UsersDirectoryDatabaseError,
} from '@/application/ports/repositories/tables/users-directory-repository'
import { db } from '@/infrastructure/database'
import { authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { notAnAgentAccount } from '@/infrastructure/database/sql/auth-user-predicates'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/** Wrap a DB promise, adapting failures to UsersDirectoryDatabaseError. */
const wrap = makeDbWrap((error) => new UsersDirectoryDatabaseError({ cause: error }))

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
  listAllUsers: () =>
    wrap(async () => {
      // One full scan of the secret-free directory subset. The auth.user table
      // is small (the whole account population of one self-hosted app), so a
      // single scan is cheap; the directory filters client-side.
      const usersTable = authUsersTable()
      return (await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          role: usersTable.role,
          banned: usersTable.banned,
        })
        .from(usersTable)
        .where(notAnAgentAccount(usersTable.email))) as ReadonlyArray<{
        id: string
        email: string
        role: string | null
        banned: boolean | null
      }>
    }),
})
