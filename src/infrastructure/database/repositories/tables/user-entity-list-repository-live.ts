/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  UserEntityListRepository,
  UserEntityListDatabaseError,
} from '@/application/ports/repositories/tables/user-entity-list-repository'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
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

  findFavoriteId: (userId, entityType, entityId) =>
    wrap(async () => {
      const existing = await db
        .select({ id: userFavorites.id })
        .from(userFavorites)
        .where(
          and(
            eq(userFavorites.userId, userId),
            eq(userFavorites.entityType, entityType),
            eq(userFavorites.entityId, entityId)
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
          // eslint-disable-next-line unicorn/no-null -- nullable column requires SQL NULL
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

  softDeleteFavorite: (userId, entityType, entityId) =>
    wrap(() =>
      db
        .update(userFavorites)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(userFavorites.userId, userId),
            eq(userFavorites.entityType, entityType),
            eq(userFavorites.entityId, entityId),
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

  findRecentId: (userId, entityType, entityId) =>
    wrap(async () => {
      const existing = await db
        .select({ id: userRecentItems.id })
        .from(userRecentItems)
        .where(
          and(
            eq(userRecentItems.userId, userId),
            eq(userRecentItems.entityType, entityType),
            eq(userRecentItems.entityId, entityId)
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
      // eslint-disable-next-line functional/no-expression-statements -- DB side effect: raw prune DELETE
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

  recordStillExists: (entity) =>
    // Never fails: any DB failure resolves to `false` so a dead/unreadable
    // record is hidden rather than throwing. Pages and entities without a known
    // table are always-present (there is no row to probe).
    // effect-promise: total -- the only `await` in the thunk sits inside the try/catch three lines below, which returns `false`; the two early returns are pure. That is the "never fails" the comment above states, made checkable.
    Effect.promise(async () => {
      if (entity.entityType !== 'record' || entity.tableId === null) return true
      const physicalName = sanitizeTableName(entity.tableId)
      try {
        const rows = (await db.execute(
          sql`SELECT 1 FROM ${sql.identifier(physicalName)} WHERE id = ${entity.entityId} LIMIT 1`
        )) as unknown as readonly unknown[]
        return rows.length > 0
      } catch {
        return false
      }
    }),
})
