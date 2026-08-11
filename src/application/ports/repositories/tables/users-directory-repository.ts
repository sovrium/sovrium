/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Users Directory Repository Port
 *
 * Type-safe data access backing the admin Data-tab **Utilisateurs** account
 * directory (`GET /api/admin/users`). A single raw read over the Better Auth
 * `user` table:
 *
 *   - `listAllUsers` — every HUMAN `auth.user` `{ id, email, role, banned }` row
 *     (operators AND app users alike — the directory is the single console for
 *     the whole account population). Accounts mirrored from `app.agents[]` are
 *     excluded: they live in `auth.user` only so an agent inherits RBAC, and
 *     `AgentPermissionsSchema` states they are omitted from a user list by
 *     default.
 *
 * This is the row-data sibling of the {@link UsersOverviewRepository} aggregate
 * read: both decouple from the Better Auth literal-`admin` plugin gate and read
 * the auth `user` table directly via the dialect-aware `authUsersTable()`
 * selector, so a custom top-role operator (e.g. the partner app's `engineer`)
 * reaches the directory just as it reaches the overview.
 *
 * Implementation lives in the infrastructure layer
 * (users-directory-repository-live.ts). This port must not import infrastructure
 * — the row type below is defined here (decoupled from Drizzle) so the
 * application layer stays free of an infrastructure dependency.
 */

/**
 * A raw `auth.user` row needed by the directory. `role` is the raw column value
 * (NULL is coalesced to the app default role by the use case); `banned` is the
 * raw nullable ban flag (NULL → not banned).
 */
export interface DirectoryUserRow {
  readonly id: string
  readonly email: string
  readonly role: string | null
  readonly banned: boolean | null
}

/**
 * Database error for users-directory operations.
 */
export class UsersDirectoryDatabaseError extends Data.TaggedError('UsersDirectoryDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Users Directory Repository Port.
 *
 * The single method maps to one raw read; all projection / role-coalescing
 * lives in the use case.
 */
export class UsersDirectoryRepository extends Context.Tag('UsersDirectoryRepository')<
  UsersDirectoryRepository,
  {
    /**
     * Load every human `auth.user` `{ id, email, role, banned }` row. The only
     * server-side predicate excludes agent-mirrored accounts (an agent is not a
     * person); the table is otherwise small — the whole account population of
     * one self-hosted app — and the directory filters client-side.
     */
    readonly listAllUsers: () => Effect.Effect<
      readonly DirectoryUserRow[],
      UsersDirectoryDatabaseError
    >
  }
>() {}
