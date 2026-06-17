/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export interface UserTablePreferencesResponse {
  readonly tableName: string
  readonly columnWidths?: unknown
  readonly columnOrder?: unknown
  readonly rowDensity?: string
  readonly defaultViewId?: string
  readonly frozenColumns?: number
  readonly updatedAt?: string
}

export const emptyPreferencesResponse = (tableName: string): UserTablePreferencesResponse => ({
  tableName,
})

export interface UpdateUserTablePreferencesInput {
  readonly userId: string
  readonly tableName: string
  readonly columnWidths?: unknown
  readonly columnOrder?: unknown
  readonly rowDensity?: string
  readonly defaultViewId?: string
  readonly frozenColumns?: number
}

export interface UpdatePreferencesResult {
  readonly response: UserTablePreferencesResponse
  readonly created: boolean
}

export class UserPreferencesDbError extends Data.TaggedError('UserPreferencesDbError')<{
  readonly cause: unknown
}> {}

export class UserPreferencesWriteError extends Data.TaggedError('UserPreferencesWriteError')<{
  readonly message: string
}> {}

export class UserTablePreferencesRepository extends Context.Tag('UserTablePreferencesRepository')<
  UserTablePreferencesRepository,
  {
    readonly get: (input: {
      readonly userId: string
      readonly tableName: string
    }) => Effect.Effect<UserTablePreferencesResponse, UserPreferencesDbError>

    readonly update: (
      input: UpdateUserTablePreferencesInput
    ) => Effect.Effect<UpdatePreferencesResult, UserPreferencesDbError | UserPreferencesWriteError>

    readonly delete: (input: {
      readonly userId: string
      readonly tableName: string
    }) => Effect.Effect<void, UserPreferencesDbError>
  }
>() {}
