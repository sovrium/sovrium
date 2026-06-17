/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  UserEntityListRepository,
  type EntityMutation,
  type EntityRef,
  type FavoriteRow,
  type RecentRow,
  type UserEntityListDatabaseError,
} from '@/application/ports/repositories/tables/user-entity-list-repository'
import { UserEntityListRepositoryLive } from '@/infrastructure/database/repositories/tables/user-entity-list-repository-live'
import type { Context } from 'effect'


export const MAX_RECENT_ITEMS = 20

export interface FavoriteOutput {
  readonly id: string
  readonly entityType: string
  readonly entityId: string
  readonly tableId: string | null
  readonly createdAt: string
}

export interface RecentOutput {
  readonly id: string
  readonly entityType: string
  readonly entityId: string
  readonly tableId: string | null
  readonly viewedAt: string
}

const toIso = (value: Readonly<Date> | string): string =>
  typeof value === 'string' ? value : value.toISOString()

const filterLiveEntities = <T extends EntityRef>(
  repo: Context.Tag.Service<UserEntityListRepository>,
  rows: readonly T[]
): Effect.Effect<readonly T[], never> =>
  Effect.gen(function* () {
    const existenceFlags = yield* Effect.all(
      rows.map((row) => repo.recordStillExists(row)),
      { concurrency: 'unbounded' }
    )
    return rows.filter((_, index) => existenceFlags[index])
  })

export const ListFavorites = (
  userId: string
): Effect.Effect<
  readonly FavoriteOutput[],
  UserEntityListDatabaseError,
  UserEntityListRepository
> =>
  Effect.gen(function* () {
    const repo = yield* UserEntityListRepository
    const rows = yield* repo.listFavorites(userId)
    const visible = yield* filterLiveEntities(repo, rows)
    return visible.map(
      (row: Readonly<FavoriteRow>): FavoriteOutput => ({
        id: row.id,
        entityType: row.entityType,
        entityId: row.entityId,
        tableId: row.tableId,
        createdAt: toIso(row.createdAt),
      })
    )
  })

export const AddFavorite = (
  userId: string,
  input: EntityMutation
): Effect.Effect<void, UserEntityListDatabaseError, UserEntityListRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserEntityListRepository
    const existingId = yield* repo.findFavoriteId(userId, input.entityType, input.entityId)
    if (existingId !== undefined) {
      yield* repo.reviveFavorite(existingId, input.tableName)
      return
    }
    yield* repo.insertFavorite(userId, input)
  })

export const RemoveFavorite = (
  userId: string,
  input: EntityMutation
): Effect.Effect<void, UserEntityListDatabaseError, UserEntityListRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserEntityListRepository
    yield* repo.softDeleteFavorite(userId, input.entityType, input.entityId)
  })

export const ListRecent = (
  userId: string,
  limit: number
): Effect.Effect<readonly RecentOutput[], UserEntityListDatabaseError, UserEntityListRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserEntityListRepository
    const rows = yield* repo.listRecent(userId)
    const visible = yield* filterLiveEntities(repo, rows)
    return visible.slice(0, limit).map(
      (row: Readonly<RecentRow>): RecentOutput => ({
        id: row.id,
        entityType: row.entityType,
        entityId: row.entityId,
        tableId: row.tableId,
        viewedAt: toIso(row.viewedAt),
      })
    )
  })

export const RecordRecent = (
  userId: string,
  input: EntityMutation
): Effect.Effect<void, UserEntityListDatabaseError, UserEntityListRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserEntityListRepository
    const existingId = yield* repo.findRecentId(userId, input.entityType, input.entityId)
    if (existingId !== undefined) {
      yield* repo.refreshRecent(existingId, input.tableName)
      return
    }
    yield* repo.insertRecent(userId, input)
    yield* repo.pruneRecent(userId, MAX_RECENT_ITEMS)
  })

export const UserEntityListsLayer = Layer.mergeAll(UserEntityListRepositoryLive)
