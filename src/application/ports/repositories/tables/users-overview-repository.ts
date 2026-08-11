/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Users Overview Repository Port
 *
 * Type-safe data access backing the admin users-overview tile
 * (`GET /api/admin/users/overview`). Three raw read concerns over the Better
 * Auth `user` / `session` tables:
 *
 *   - `listUserRows`           — every `auth.user` `{ role, createdAt }` row
 *     (the auth.user table is small — operators in the hundreds, not millions —
 *     so a single scan is cheaper than three separate GROUP BY queries and keeps
 *     the dialect-agnostic call site simple).
 *   - `countActiveUsersSince`  — distinct `user_id` from `auth.session` rows
 *     created on/after a date (`COUNT(DISTINCT user_id)`).
 *   - `listSessionRowsSince`   — every `auth.session` `{ createdAt }` row
 *     created on/after a date.
 *
 * Implementation lives in the infrastructure layer
 * (users-overview-repository-live.ts). This port must not import infrastructure
 * — the row types below are defined here (decoupled from Drizzle) so the
 * application layer stays free of an infrastructure dependency.
 */

/**
 * A raw `auth.user` row needed by the overview. `role` is the raw column value
 * (NULL / unknown is classified to `member` by the use case); `createdAt` is the
 * dialect-native timestamp shape (PG returns `Date`; SQLite's drizzle adapter
 * usually returns `Date` too, but a raw bigint may slip through the cast).
 */
export interface UserOverviewRow {
  readonly role: string | null
  readonly createdAt: Date | string | number
}

/**
 * A raw `auth.session` row needed by the overview series bucketing.
 */
export interface SessionOverviewRow {
  readonly createdAt: Date | string | number
}

/**
 * Database error for users-overview operations.
 */
export class UsersOverviewDatabaseError extends Data.TaggedError('UsersOverviewDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Users Overview Repository Port.
 *
 * Methods map to a single raw read each; all orchestration (dense-series
 * bucketing, role classification/serialization, audit emit) lives in the use
 * case.
 */
export class UsersOverviewRepository extends Context.Tag('UsersOverviewRepository')<
  UsersOverviewRepository,
  {
    /**
     * Load every `auth.user` `{ role, createdAt }` row (no filter — the table is
     * small and a full scan feeds both `totals.users`, `by_role`, and the
     * in-period signup bucketing in a single read).
     */
    readonly listUserRows: () => Effect.Effect<
      readonly UserOverviewRow[],
      UsersOverviewDatabaseError
    >

    /**
     * Count distinct `user_id`s with an `auth.session` row created on/after
     * `since`. Backs `totals.active_24h`.
     */
    readonly countActiveUsersSince: (
      since: Date
    ) => Effect.Effect<number, UsersOverviewDatabaseError>

    /**
     * List `auth.session` `{ createdAt }` rows created on/after `since`. Backs
     * the `sessions_started` series buckets.
     */
    readonly listSessionRowsSince: (
      since: Date
    ) => Effect.Effect<readonly SessionOverviewRow[], UsersOverviewDatabaseError>
  }
>() {}
