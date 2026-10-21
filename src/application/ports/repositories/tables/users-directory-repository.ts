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
 * (NULL is coalesced to the app default role by the use case); `name` is the raw
 * nullable display name (NULL → empty string); `banned` is the raw nullable ban
 * flag (NULL → not banned).
 */
export interface DirectoryUserRow {
  readonly id: string
  readonly email: string
  readonly name: string | null
  readonly role: string | null
  readonly banned: boolean | null
  /** When the account was created, as the dialect returns it. */
  readonly createdAt: Readonly<Date> | string | null
  /** The raw nullable second-factor flag (NULL → off). */
  readonly twoFactorEnabled: boolean | null
}

/**
 * What an account's sessions and linked sign-in accounts say about it, read
 * for the page's accounts in one pass. Facts only: no token, address or agent
 * string of any session leaves the repository.
 */
export interface DirectoryAccountFacts {
  /** The newest session's creation instant, ever; `null` when it never signed in. */
  readonly lastSignInAt: Readonly<Date> | string | null
  /** How many of its sessions have not expired at the read instant. */
  readonly activeSessionCount: number
  /** The provider ids of its linked accounts (`credential`, `google`, …), distinct. */
  readonly signInMethods: readonly string[]
}

/**
 * Database error for users-directory operations.
 */
export class UsersDirectoryDatabaseError extends Data.TaggedError('UsersDirectoryDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Read filters for the directory scan.
 *
 * `q` is the operator's free-text term, already trimmed and length-checked by
 * `searchTermSchema` — absent means "no search", never "match nothing".
 * Matching is a case-insensitive literal substring over `email` AND `name`, and
 * it runs in SQL rather than over the returned rows: `name` was not even sent to
 * the client before this contract, so no in-memory filter could ever have found
 * an account by the name its operator knows it by.
 */
export interface DirectoryFilters {
  readonly q?: string | undefined
}

/**
 * Users Directory Repository Port.
 *
 * The single method maps to one raw read; all projection / role-coalescing
 * lives in the use case.
 */
export class UsersDirectoryRepository extends Context.Service<
  UsersDirectoryRepository,
  {
    /**
     * Load the human `auth.user` `{ id, email, name, role, banned }` rows.
     *
     * Two server-side predicates, AND-ed: agent-mirrored accounts are always
     * excluded (an agent is not a person), and — when `filters.q` is present —
     * the term must occur in `email` or `name`. The table is small (the whole
     * account population of one self-hosted app), so the scan stays unpaginated;
     * `q` narrows the body rather than paginating it.
     */
    readonly listAllUsers: (
      filters?: DirectoryFilters
    ) => Effect.Effect<readonly DirectoryUserRow[], UsersDirectoryDatabaseError>
    /**
     * The session and sign-in facts of `userIds`, keyed by user id, in two
     * grouped reads. An id with no session and no linked account is absent.
     */
    readonly readAccountFacts: (
      userIds: readonly string[],
      now: Readonly<Date>
    ) => Effect.Effect<ReadonlyMap<string, DirectoryAccountFacts>, UsersDirectoryDatabaseError>
  }
>()('UsersDirectoryRepository') {}
