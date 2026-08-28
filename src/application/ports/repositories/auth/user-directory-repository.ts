/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * User Directory Repository Port.
 *
 * Type-safe data access for `GET /api/users/directory` — the candidate source
 * behind a `user` field picker. One raw query concern: read a bounded, ordered
 * page of pickable accounts, optionally narrowed by a search term.
 *
 * The route that consumes this used to hold the live `db` handle and build the
 * query inline. It was the ONLY file under `src/presentation/` importing the raw
 * handle: every other route reaches its data through a port and provides a
 * `…RepositoryLive` Layer at the composition seam. ESLint permitted the import
 * (an API route is a composition root), but permission is not precedent — a lone
 * exception is what a boundary looks like just before it stops being one.
 *
 * Implementation lives in the infrastructure layer
 * (`auth/user-directory-repository-live.ts`). The row/input types below are
 * defined here so the application layer stays decoupled from Drizzle.
 */

/**
 * A directory entry, as read from the store.
 *
 * Deliberately WITHOUT `email`. The exclusion is enforced here, in the port's
 * type, and not only in the route's response mapping: a field the repository
 * never selects cannot be leaked by a later caller that forgets to strip it.
 * `name` is user-supplied and non-unique, so `image` is the disambiguator — it
 * fails SOFT (two identical names with no avatars are merely ambiguous) where an
 * address would fail HARD and permanently.
 */
export interface UserDirectoryEntry {
  readonly id: string
  readonly name: string
  readonly image: string | null
}

/**
 * A directory page request.
 *
 * `limit` is already resolved and bounded by the caller. It is PERFORMANCE, not
 * a confidentiality control — a caller who may read one page may read every page
 * by asking again — and must never be cited as one.
 *
 * `term`, when present, is a case-insensitive substring match on the display
 * name. Search is net-neutral for exposure: it trades bulk dumping for targeted
 * probing.
 */
export interface UserDirectoryQuery {
  readonly term?: string | undefined
  readonly limit: number
}

/** Database error for user-directory reads. */
export class UserDirectoryDatabaseError extends Data.TaggedError('UserDirectoryDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * User Directory Repository Port.
 *
 * A single method mapping to a single query. Which accounts are PICKABLE — the
 * agent-account and banned-account exclusions — is part of that query and lives
 * with the implementation, because both predicates are statements about the
 * store's own rows rather than orchestration the caller could reasonably vary.
 */
export class UserDirectoryRepository extends Context.Service<
  UserDirectoryRepository,
  {
    /**
     * Read one ordered page of pickable accounts.
     *
     * Ordered by name so the same query returns the same page to every caller,
     * and so an unsearched picker opens on a stable, readable list.
     */
    readonly listPickableUsers: (
      query: UserDirectoryQuery
    ) => Effect.Effect<readonly UserDirectoryEntry[], UserDirectoryDatabaseError>
  }
>()('UserDirectoryRepository') {}
