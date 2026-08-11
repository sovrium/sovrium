/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Upsert the caller's preferences for one table (PATCH merge semantics).
 *
 * Phase 9 Cycle 5 — thin orchestrator over the
 * `UserTablePreferencesRepository` port. The load-merge-upsert flow, the
 * dialect JSON codec, and the `created` flag (200 update vs 201 insert) live
 * in the repository's live implementation.
 */

import { Effect } from 'effect'
import {
  UserTablePreferencesRepository,
  type UpdatePreferencesResult,
  type UpdateUserTablePreferencesInput,
  type UserPreferencesDbError,
  type UserPreferencesWriteError,
} from '@/application/ports/repositories/tables/user-table-preferences-repository'

export type { UpdatePreferencesResult } from '@/application/ports/repositories/tables/user-table-preferences-repository'

export const updateUserTablePreferences = (
  input: UpdateUserTablePreferencesInput
): Effect.Effect<
  UpdatePreferencesResult,
  UserPreferencesDbError | UserPreferencesWriteError,
  UserTablePreferencesRepository
> =>
  Effect.gen(function* () {
    const repo = yield* UserTablePreferencesRepository
    return yield* repo.update(input)
  })
