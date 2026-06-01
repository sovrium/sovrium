/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import {
  UserTablePreferencesRepository,
  type UserPreferencesDbError,
} from '@/application/ports/repositories/user-table-preferences-repository'

export interface DeleteUserPreferencesInput {
  readonly userId: string
  readonly tableName: string
}

export const deleteUserTablePreferences = (
  input: DeleteUserPreferencesInput
): Effect.Effect<void, UserPreferencesDbError, UserTablePreferencesRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserTablePreferencesRepository
    return yield* repo.delete(input)
  })
