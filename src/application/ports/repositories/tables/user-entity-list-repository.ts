/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'


export type EntityType = 'record' | 'page'

export interface FavoriteRow {
  readonly id: string
  readonly entityType: string
  readonly entityId: string
  readonly tableId: string | null
  readonly createdAt: Date | string
}

export interface RecentRow {
  readonly id: string
  readonly entityType: string
  readonly entityId: string
  readonly tableId: string | null
  readonly viewedAt: Date | string
}

export interface EntityRef {
  readonly entityType: string
  readonly entityId: string
  readonly tableId: string | null
}

export interface EntityMutation {
  readonly entityType: EntityType
  readonly entityId: string
  readonly tableName: string | null
}

export class UserEntityListDatabaseError extends Data.TaggedError('UserEntityListDatabaseError')<{
  readonly cause: unknown
}> {}

export class UserEntityListRepository extends Context.Tag('UserEntityListRepository')<
  UserEntityListRepository,
  {
    readonly listFavorites: (
      userId: string
    ) => Effect.Effect<readonly FavoriteRow[], UserEntityListDatabaseError>

    readonly findFavoriteId: (
      userId: string,
      entityType: EntityType,
      entityId: string
    ) => Effect.Effect<string | undefined, UserEntityListDatabaseError>

    readonly reviveFavorite: (
      id: string,
      tableName: string | null
    ) => Effect.Effect<void, UserEntityListDatabaseError>

    readonly insertFavorite: (
      userId: string,
      input: EntityMutation
    ) => Effect.Effect<void, UserEntityListDatabaseError>

    readonly softDeleteFavorite: (
      userId: string,
      entityType: EntityType,
      entityId: string
    ) => Effect.Effect<void, UserEntityListDatabaseError>

    readonly listRecent: (
      userId: string
    ) => Effect.Effect<readonly RecentRow[], UserEntityListDatabaseError>

    readonly findRecentId: (
      userId: string,
      entityType: EntityType,
      entityId: string
    ) => Effect.Effect<string | undefined, UserEntityListDatabaseError>

    readonly refreshRecent: (
      id: string,
      tableName: string | null
    ) => Effect.Effect<void, UserEntityListDatabaseError>

    readonly insertRecent: (
      userId: string,
      input: EntityMutation
    ) => Effect.Effect<void, UserEntityListDatabaseError>

    readonly pruneRecent: (
      userId: string,
      maxItems: number
    ) => Effect.Effect<void, UserEntityListDatabaseError>

    readonly recordStillExists: (entity: EntityRef) => Effect.Effect<boolean, never>
  }
>() {}
