/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * User Entity List Repository Port
 *
 * Type-safe data access for the per-user entity-list APIs (`/api/favorites`,
 * `/api/recent`). Backed by `system.user_favorites` / `system.user_recent_items`
 * with soft-delete + upsert semantics.
 *
 * Implementation lives in the infrastructure layer
 * (user-entity-list-repository-live.ts). This port must not import
 * infrastructure — the row types below are structurally compatible with the
 * Drizzle schema inference but defined here to keep the application layer
 * decoupled from the database.
 */

/** Entity types a favorite / recent item may point at. */
export type EntityType = 'record' | 'page'

/**
 * A favorite row as returned by the repository (newest first).
 *
 * `createdAt` is a `Date` (or a dialect-provided string for SQLite); the
 * use-case is responsible for serialization.
 */
export interface FavoriteRow {
  readonly id: string
  readonly entityType: string
  readonly entityId: string
  readonly tableId: string | null
  readonly createdAt: Date | string
}

/**
 * A recent-item row as returned by the repository (most recently viewed first).
 */
export interface RecentRow {
  readonly id: string
  readonly entityType: string
  readonly entityId: string
  readonly tableId: string | null
  readonly viewedAt: Date | string
}

/** The minimal entity shape the existence probe operates on. */
export interface EntityRef {
  readonly entityType: string
  readonly entityId: string
  readonly tableId: string | null
}

/** Parsed entity mutation input (favorites POST/DELETE, recent POST). */
export interface EntityMutation {
  readonly entityType: EntityType
  readonly entityId: string
  readonly tableName: string | null
}

/**
 * Database error for user entity-list operations.
 */
export class UserEntityListDatabaseError extends Data.TaggedError('UserEntityListDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * User Entity List Repository Port.
 *
 * Methods are intentionally granular — orchestration (revive-vs-insert,
 * existence-filtering) lives in the use-case; each method here maps to a single
 * raw query against `system.user_favorites` / `system.user_recent_items`.
 */
export class UserEntityListRepository extends Context.Tag('UserEntityListRepository')<
  UserEntityListRepository,
  {
    /** List the user's favorites, newest first (soft-deleted excluded). */
    readonly listFavorites: (
      userId: string
    ) => Effect.Effect<readonly FavoriteRow[], UserEntityListDatabaseError>

    /** Find an existing favorite row id for (user, entity), regardless of soft-delete. */
    readonly findFavoriteId: (
      userId: string,
      entityType: EntityType,
      entityId: string
    ) => Effect.Effect<string | undefined, UserEntityListDatabaseError>

    /**
     * Revive (or refresh) an existing favorite row: clears `deleted_at`, sets
     * `table_id`, and resets `created_at` so the favorite sorts to the top.
     */
    readonly reviveFavorite: (
      id: string,
      tableName: string | null
    ) => Effect.Effect<void, UserEntityListDatabaseError>

    /** Insert a new favorite row for the user. */
    readonly insertFavorite: (
      userId: string,
      input: EntityMutation
    ) => Effect.Effect<void, UserEntityListDatabaseError>

    /** Soft-delete the user's favorite for (entityType, entityId). */
    readonly softDeleteFavorite: (
      userId: string,
      entityType: EntityType,
      entityId: string
    ) => Effect.Effect<void, UserEntityListDatabaseError>

    /** List the user's recent items, most recently viewed first (capped). */
    readonly listRecent: (
      userId: string
    ) => Effect.Effect<readonly RecentRow[], UserEntityListDatabaseError>

    /** Find an existing recent-item row id for (user, entity). */
    readonly findRecentId: (
      userId: string,
      entityType: EntityType,
      entityId: string
    ) => Effect.Effect<string | undefined, UserEntityListDatabaseError>

    /** Refresh an existing recent-item row's `viewed_at` + `table_id`. */
    readonly refreshRecent: (
      id: string,
      tableName: string | null
    ) => Effect.Effect<void, UserEntityListDatabaseError>

    /** Insert a new recent-item row for the user. */
    readonly insertRecent: (
      userId: string,
      input: EntityMutation
    ) => Effect.Effect<void, UserEntityListDatabaseError>

    /**
     * Prune the user's recent items beyond the per-user cap. Uses a
     * dialect-specific raw DELETE.
     */
    readonly pruneRecent: (
      userId: string,
      maxItems: number
    ) => Effect.Effect<void, UserEntityListDatabaseError>

    /**
     * Probe whether a `record` entity still points at a live backing row.
     * Returns `false` on any DB failure (a dead/unreadable record is hidden,
     * never throws). Pages and entities without a known table are always-present.
     */
    readonly recordStillExists: (entity: EntityRef) => Effect.Effect<boolean, never>
  }
>() {}
