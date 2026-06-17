/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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
