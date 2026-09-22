/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Get the caller's preferences for one table.
 *
 * Phase 9 Cycle 5 — thin orchestrator over the
 * `UserTablePreferencesRepository` port. The canonical
 * `emptyPreferencesResponse` fallback for a never-set row lives in the
 * repository's live implementation.
 */

import { Effect } from 'effect'
import {
  UserTablePreferencesRepository,
  type UserPreferencesDbError,
  type UserTablePreferencesResponse,
} from '@/application/ports/repositories/tables/user-table-preferences-repository'

export interface GetUserPreferencesInput {
  readonly userId: string
  readonly tableName: string
}

export const getUserTablePreferences = (
  input: GetUserPreferencesInput
): Effect.Effect<
  UserTablePreferencesResponse,
  UserPreferencesDbError,
  UserTablePreferencesRepository
> =>
  Effect.gen(function* () {
    const repo = yield* UserTablePreferencesRepository
    return yield* repo.get(input)
  }).pipe(Effect.withSpan('tables.get-user-table-preferences'))
