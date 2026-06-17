/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export interface UserViewResponse {
  readonly id: string
  readonly name: string
  readonly tableName: string
  readonly isDefault: boolean
  readonly filters?: unknown
  readonly sorts?: unknown
  readonly fields?: unknown
  readonly groupBy?: unknown
  readonly baseViewId?: string | number | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreateUserViewInput {
  readonly userId: string
  readonly tableName: string
  readonly name: string
  readonly filters?: unknown
  readonly sorts?: unknown
  readonly fields?: unknown
  readonly groupBy?: unknown
  readonly baseViewId?: string | number
  readonly isDefault?: boolean
}

export interface UpdateUserViewInput {
  readonly userId: string
  readonly tableName: string
  readonly viewId: string
  readonly name?: string
  readonly isDefault?: boolean
  readonly filters?: unknown
  readonly sorts?: unknown
  readonly fields?: unknown
  readonly groupBy?: unknown
  readonly baseViewId?: string | number | null
}

export interface GetSharedViewRow {
  readonly viewId: string
}

export class UserViewNotFoundError extends Data.TaggedError('UserViewNotFoundError')<{
  readonly viewId?: string
}> {}

export class UserViewConflictError extends Data.TaggedError('UserViewConflictError')<{
  readonly message: string
}> {}

export class UserViewDbError extends Data.TaggedError('UserViewDbError')<{
  readonly cause: unknown
}> {}

export class UserViewRepository extends Context.Tag('UserViewRepository')<
  UserViewRepository,
  {
    readonly list: (input: {
      readonly userId: string
      readonly tableName: string
    }) => Effect.Effect<readonly UserViewResponse[], UserViewDbError>

    readonly create: (
      input: CreateUserViewInput
    ) => Effect.Effect<
      UserViewResponse,
      UserViewConflictError | UserViewDbError | UserViewNotFoundError
    >

    readonly update: (
      input: UpdateUserViewInput
    ) => Effect.Effect<
      UserViewResponse,
      UserViewConflictError | UserViewDbError | UserViewNotFoundError
    >

    readonly delete: (input: {
      readonly userId: string
      readonly tableName: string
      readonly viewId: string
    }) => Effect.Effect<void, UserViewDbError | UserViewNotFoundError>

    readonly getShared: (
      input: GetSharedViewRow
    ) => Effect.Effect<UserViewResponse, UserViewDbError | UserViewNotFoundError>
  }
>() {}
