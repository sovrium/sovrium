/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * UserTablePreferencesRepository port — data-access contract for the
 * Personal Table Preferences feature (PG-03 / [internal ref],
 * [internal ref]).
 *
 * Phase 9 Cycle 5 — extracted from the use-case programs that previously
 * injected the `Database` Context.Tag directly and ran inline Drizzle
 * queries. The live implementation
 * (`@/infrastructure/database/repositories/tables/user-table-preferences-repository-live`)
 * owns ALL Drizzle queries plus the dialect-aware JSON codec and the DB-row →
 * wire-response transform; the use-cases became thin orchestrators.
 *
 * The repository returns the JSON-serializable `UserTablePreferencesResponse`
 * wire shape directly. The route layer validates the result through
 * `userTablePreferencesResponseSchema` for OpenAPI contract enforcement (S4).
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Wire representation of a user's table preferences row. The `undefined`
 * markers on each preference key are intentional — clients distinguish
 * "never set" from "explicitly cleared".
 */
export interface UserTablePreferencesResponse {
  readonly tableName: string
  readonly columnWidths?: unknown
  readonly columnOrder?: unknown
  readonly rowDensity?: string
  readonly defaultViewId?: string
  readonly frozenColumns?: number
  readonly updatedAt?: string
}

/** Build the canonical "no preferences yet" response for a table. */
export const emptyPreferencesResponse = (tableName: string): UserTablePreferencesResponse => ({
  tableName,
})

/** PATCH input — every field is optional (upsert + merge semantics). */
export interface UpdateUserTablePreferencesInput {
  readonly userId: string
  readonly tableName: string
  readonly columnWidths?: unknown
  readonly columnOrder?: unknown
  readonly rowDensity?: string
  readonly defaultViewId?: string
  readonly frozenColumns?: number
}

/** Return shape — `created: true` when the row was inserted (HTTP 201). */
export interface UpdatePreferencesResult {
  readonly response: UserTablePreferencesResponse
  readonly created: boolean
}

/** DB-side failure (connection / unexpected SQL error). Route maps to 500. */
export class UserPreferencesDbError extends Data.TaggedError('UserPreferencesDbError')<{
  readonly cause: unknown
}> {}

/**
 * Insert/update returned zero rows — should not normally happen but signals
 * an invariant violation the route maps to a 400 envelope (the pre-Cycle-2
 * handler's "Failed to create/update preferences" path).
 */
export class UserPreferencesWriteError extends Data.TaggedError('UserPreferencesWriteError')<{
  readonly message: string
}> {}

/**
 * UserTablePreferencesRepository port.
 *
 * Backs `system.user_table_preferences`. All operations are strictly
 * per-user (scoped to `userId`). `update` has upsert semantics: PATCH merge
 * over the existing row, INSERT when none exists.
 */
export class UserTablePreferencesRepository extends Context.Service<
  UserTablePreferencesRepository,
  {
    /**
     * Read the caller's preferences for one table. Returns the canonical
     * `emptyPreferencesResponse` when no row exists yet (first-paint
     * defaults rely on this).
     */
    readonly get: (input: {
      readonly userId: string
      readonly tableName: string
    }) => Effect.Effect<UserTablePreferencesResponse, UserPreferencesDbError>

    /**
     * Upsert the caller's preferences for one table (PATCH merge). Returns
     * the persisted row plus a `created` flag so the route can pick 200
     * (update) vs 201 (insert). A zero-row write surfaces as
     * `UserPreferencesWriteError`.
     */
    readonly update: (
      input: UpdateUserTablePreferencesInput
    ) => Effect.Effect<UpdatePreferencesResult, UserPreferencesDbError | UserPreferencesWriteError>

    /**
     * Delete the caller's preferences row for one table. Idempotent — a
     * no-op when no row exists (matches the route's `emptyPreferencesResponse`
     * success envelope).
     */
    readonly delete: (input: {
      readonly userId: string
      readonly tableName: string
    }) => Effect.Effect<void, UserPreferencesDbError>
  }
>()('UserTablePreferencesRepository') {}
