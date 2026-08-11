/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Delete the caller's preferences row for one table.
 *
 * Phase 9 Cycle 5 — thin orchestrator over the
 * `UserTablePreferencesRepository` port. Resolves to `void`; deletion is
 * idempotent (no-op when no row exists) in the repository's live
 * implementation. The route handler returns the canonical
 * `emptyPreferencesResponse` envelope on success.
 */

import { Effect } from 'effect'
import {
  UserTablePreferencesRepository,
  type UserPreferencesDbError,
} from '@/application/ports/repositories/tables/user-table-preferences-repository'

export interface DeleteUserPreferencesInput {
  readonly userId: string
  readonly tableName: string
}

export const deleteUserTablePreferences = (
  input: DeleteUserPreferencesInput
): Effect.Effect<void, UserPreferencesDbError, UserTablePreferencesRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserTablePreferencesRepository
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- `repo.delete` is the port method; the `(userId, tableName)` scoping lives in the live impl's Drizzle `.where(...)`
    return yield* repo.delete(input)
  })
