/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  userFavorites as favoritesPg,
  userRecentItems as recentPg,
} from '@/infrastructure/database/drizzle/schema/favorites'
import {
  userFavorites as favoritesSqlite,
  userRecentItems as recentSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/favorites'
import type { AccountEntityLists } from '@/application/ports/repositories/auth/account-repository'

/**
 * The favorites-and-recent half of the GDPR export: the caller's rows of
 * `system.user_favorites` she has not removed, and of `system.user_recent_items`
 * — both tables erasure hard-deletes with her account. Every column is named:
 * what she kept (type, table, id, time), never a copy of the entity. Values are
 * bound by Drizzle on SQLite and PostgreSQL alike.
 */

const favoritesOf = (userId: string) => {
  const favorites = resolveDialectSchema(favoritesPg, favoritesSqlite)
  return db
    .select({
      entityType: favorites.entityType,
      tableName: favorites.tableId,
      entityId: favorites.entityId,
      createdAt: favorites.createdAt,
    })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), isNull(favorites.deletedAt)))
    .orderBy(desc(favorites.createdAt), desc(favorites.id))
}

const recentItemsOf = (userId: string) => {
  const recent = resolveDialectSchema(recentPg, recentSqlite)
  return db
    .select({
      entityType: recent.entityType,
      tableName: recent.tableId,
      entityId: recent.entityId,
      viewedAt: recent.viewedAt,
    })
    .from(recent)
    .where(eq(recent.userId, userId))
    .orderBy(desc(recent.viewedAt), desc(recent.id))
}

/**
 * Read the caller's favorites and recent items, one query after the other, as
 * the export's other reads run. Rejects on a database error; the repository
 * wraps it.
 */
export const readEntityLists = async (userId: string): Promise<AccountEntityLists> => ({
  favorites: await favoritesOf(userId),
  recentItems: await recentItemsOf(userId),
})
