/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  UserEntityListRepository,
  UserEntityListDatabaseError,
} from '@/application/ports/repositories/tables/user-entity-list-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  userFavorites as userFavoritesPg,
  userRecentItems as userRecentItemsPg,
} from '@/infrastructure/database/drizzle/schema/favorites'
import {
  userFavorites as userFavoritesSqlite,
  userRecentItems as userRecentItemsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/favorites'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'

const userFavorites = resolveDialectSchema(userFavoritesPg, userFavoritesSqlite)
const userRecentItems = resolveDialectSchema(userRecentItemsPg, userRecentItemsSqlite)

/**
 * The entry's table, as a condition: a record is kept per table, so the same id
 * in two tables is two entries; a page names none.
 */
const sameTable = (
  column: typeof userFavorites.tableId | typeof userRecentItems.tableId,
  tableName: string | null
) => (tableName === null ? isNull(column) : eq(column, tableName))

/** Wrap a DB promise, adapting failures to UserEntityListDatabaseError. */
const wrap = makeDbWrap((error) => new UserEntityListDatabaseError({ cause: error }))

/**
 * User Entity List Repository Implementation
 *
 * Uses the Drizzle ORM query builder for type-safe, SQL-injection-proof queries
 * against `system.user_favorites` / `system.user_recent_items`. The recent-item
 * prune is the one raw-SQL path (dialect-specific `OFFSET` semantics).
 */
export const UserEntityListRepositoryLive = Layer.succeed(UserEntityListRepository, {
  listFavorites: (userId) =>
    wrap(() =>
      db
        .select({
          id: userFavorites.id,
          entityType: userFavorites.entityType,
          entityId: userFavorites.entityId,
          tableId: userFavorites.tableId,
          createdAt: userFavorites.createdAt,
        })
        .from(userFavorites)
        .where(and(eq(userFavorites.userId, userId), isNull(userFavorites.deletedAt)))
        .orderBy(desc(userFavorites.createdAt))
    ),

  findFavoriteId: (userId, entityType, entityId, tableName) =>
    wrap(async () => {
      const existing = await db
        .select({ id: userFavorites.id })
        .from(userFavorites)
        .where(
          and(
            eq(userFavorites.userId, userId),
            eq(userFavorites.entityType, entityType),
            eq(userFavorites.entityId, entityId),
            sameTable(userFavorites.tableId, tableName)
          )
        )
        .limit(1)
      return existing[0]?.id
    }),

  reviveFavorite: (id, tableName) =>
    wrap(() =>
      db
        .update(userFavorites)
        .set({
          deletedAt: null,
          tableId: tableName,
          createdAt: new Date(),
        })
        .where(eq(userFavorites.id, id))
    ),

  insertFavorite: (userId, input) =>
    wrap(() =>
      db.insert(userFavorites).values({
        userId,
        entityType: input.entityType,
        entityId: input.entityId,
        tableId: input.tableName,
      })
    ),

  softDeleteFavorite: (userId, entityType, entityId, tableName) =>
    wrap(() =>
      db
        .update(userFavorites)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(userFavorites.userId, userId),
            eq(userFavorites.entityType, entityType),
            eq(userFavorites.entityId, entityId),
            sameTable(userFavorites.tableId, tableName),
            isNull(userFavorites.deletedAt)
          )
        )
    ),

  listRecent: (userId) =>
    wrap(() =>
      db
        .select({
          id: userRecentItems.id,
          entityType: userRecentItems.entityType,
          entityId: userRecentItems.entityId,
          tableId: userRecentItems.tableId,
          viewedAt: userRecentItems.viewedAt,
        })
        .from(userRecentItems)
        .where(eq(userRecentItems.userId, userId))
        .orderBy(desc(userRecentItems.viewedAt))
        .limit(20)
    ),

  findRecentId: (userId, entityType, entityId, tableName) =>
    wrap(async () => {
      const existing = await db
        .select({ id: userRecentItems.id })
        .from(userRecentItems)
        .where(
          and(
            eq(userRecentItems.userId, userId),
            eq(userRecentItems.entityType, entityType),
            eq(userRecentItems.entityId, entityId),
            sameTable(userRecentItems.tableId, tableName)
          )
        )
        .limit(1)
      return existing[0]?.id
    }),

  refreshRecent: (id, tableName) =>
    wrap(() =>
      db
        .update(userRecentItems)
        .set({ viewedAt: new Date(), tableId: tableName })
        .where(eq(userRecentItems.id, id))
    ),

  insertRecent: (userId, input) =>
    wrap(() =>
      db.insert(userRecentItems).values({
        userId,
        entityType: input.entityType,
        entityId: input.entityId,
        tableId: input.tableName,
      })
    ),

  pruneRecent: (userId, maxItems) =>
    wrap(async () => {
      // Prune rows beyond the per-user cap so the table never grows unbounded.
      // Routed through `executeRaw` so the raw DELETE runs on either dialect
      // (the SQLite client has no `.execute()`). `OFFSET` without a `LIMIT` is a
      // PostgreSQL extension — SQLite requires an explicit `LIMIT` before `OFFSET`,
      // where `LIMIT -1` means "no upper bound".
      const offsetClause = isSqliteRuntime()
        ? sql`LIMIT -1 OFFSET ${maxItems}`
        : sql`OFFSET ${maxItems}`
      await executeRaw(
        db,
        sql`DELETE FROM ${userRecentItems} WHERE id IN (
      SELECT id FROM ${userRecentItems}
      WHERE user_id = ${userId}
      ORDER BY viewed_at DESC
      ${offsetClause}
    )`
      )
    }),
})
