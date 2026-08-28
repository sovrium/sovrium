/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// eslint-disable-next-line no-restricted-syntax -- Per-user entity lists are a cross-cutting concern, not phase-specific
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
import { SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'

/**
 * Use cases for the per-user entity-list APIs (`/api/favorites`, `/api/recent`).
 *
 * The application layer owns all orchestration and pure logic:
 *   - the revive-vs-insert branch (so re-favoriting / re-visiting never
 *     accumulates duplicate rows),
 *   - the existence fan-out that hides entries whose backing record was since
 *     deleted ({@link filterLiveEntities}, calling the port's `recordStillExists`),
 *   - the `?limit=` clamp and date serialization.
 *
 * Only the raw queries live in the infrastructure repository.
 */

/** Default cap on the number of recent items returned (and stored) per user. */
export const MAX_RECENT_ITEMS = 20

/** A favorite serialized for the API response (newest first). */
export interface FavoriteOutput {
  readonly id: string
  readonly entityType: string
  readonly entityId: string
  readonly tableId: string | null
  readonly createdAt: string
}

/** A recent item serialized for the API response (most recently viewed first). */
export interface RecentOutput {
  readonly id: string
  readonly entityType: string
  readonly entityId: string
  readonly tableId: string | null
  readonly viewedAt: string
}

/** Serialize a `Date | string` timestamp to an ISO string. */
const toIso = (value: Readonly<Date> | string): string =>
  typeof value === 'string' ? value : value.toISOString()

/**
 * Filter a list of entity rows down to those whose backing record still
 * exists, preserving order. Each row is probed via the port's
 * `recordStillExists`. The existence flags are resolved concurrently to keep
 * the fan-out fast, matching the original `Promise.all` behavior.
 */
const filterLiveEntities = <T extends EntityRef>(
  repo: UserEntityListRepository['Service'],
  rows: readonly T[]
): Effect.Effect<readonly T[], never> =>
  Effect.gen(function* () {
    const existenceFlags = yield* Effect.all(
      rows.map((row) => repo.recordStillExists(row)),
      { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
    )
    return rows.filter((_, index) => existenceFlags[index])
  })

/**
 * List the caller's favorites, newest first. Soft-deleted favorites are
 * excluded by the repository; favorites whose backing record was since deleted
 * are filtered out here.
 */
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
    return visible.map((row: Readonly<FavoriteRow>): FavoriteOutput => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      tableId: row.tableId,
      createdAt: toIso(row.createdAt),
    }))
  })

/**
 * Add an entity to the caller's favorites. Reviving a soft-deleted row keeps a
 * single row per (user, entity) pair and resets `created_at` so the favorite
 * sorts to the top of the list.
 */
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

/**
 * Soft-delete an entity from the caller's favorites.
 */
export const RemoveFavorite = (
  userId: string,
  input: EntityMutation
): Effect.Effect<void, UserEntityListDatabaseError, UserEntityListRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserEntityListRepository
    yield* repo.softDeleteFavorite(userId, input.entityType, input.entityId)
  })

/**
 * List the caller's recent items, most recently viewed first. Items whose
 * backing record was since deleted are filtered out, then the result is clamped
 * to `limit`.
 */
export const ListRecent = (
  userId: string,
  limit: number
): Effect.Effect<readonly RecentOutput[], UserEntityListDatabaseError, UserEntityListRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserEntityListRepository
    const rows = yield* repo.listRecent(userId)
    const visible = yield* filterLiveEntities(repo, rows)
    return visible.slice(0, limit).map((row: Readonly<RecentRow>): RecentOutput => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      tableId: row.tableId,
      viewedAt: toIso(row.viewedAt),
    }))
  })

/**
 * Record a view of an entity for the caller. Re-visiting an entity refreshes
 * the existing row's `viewed_at` so the recent list keeps a single row per
 * (user, entity) pair. Inserting also prunes rows beyond `MAX_RECENT_ITEMS`.
 */
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

/**
 * Application layer for the per-user entity-list use cases.
 */
export const UserEntityListsLayer = Layer.mergeAll(UserEntityListRepositoryLive)
