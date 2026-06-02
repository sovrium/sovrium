/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, isNull, sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  CommandSearchRepository,
  CommandSearchDatabaseError,
  type TableSearchMatch,
} from '@/application/ports/repositories/command-search-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { userFavorites as userFavoritesPg } from '@/infrastructure/database/drizzle/schema/favorites'
import { userFavorites as userFavoritesSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/favorites'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'

const userFavorites = resolveDialectSchema(userFavoritesPg, userFavoritesSqlite)

const wrap = makeDbWrap((error) => new CommandSearchDatabaseError({ cause: error }))

export const CommandSearchRepositoryLive = Layer.succeed(CommandSearchRepository, {
  loadFavoriteIds: (userId) =>
    wrap(async () => {
      const rows = await db
        .select({ entityId: userFavorites.entityId })
        .from(userFavorites)
        .where(
          and(
            eq(userFavorites.userId, userId),
            eq(userFavorites.entityType, 'record'),
            isNull(userFavorites.deletedAt)
          )
        )
      return new Set(rows.map((row) => row.entityId))
    }),

  searchTable: ({ physicalTable, columns, query }) =>
    Effect.promise(async (): Promise<readonly TableSearchMatch[]> => {
      const pattern = `%${query}%`

      const predicate = sql.join(
        columns.map((column) => sql`LOWER(${sql.identifier(column)}) LIKE LOWER(${pattern})`),
        sql` OR `
      )
      const labelExpr = sql.join(
        columns.map((column) => sql.identifier(column)),
        sql`, `
      )

      const rows = await executeRaw(
        db,
        sql`SELECT id, COALESCE(${labelExpr}) AS __label
            FROM ${sql.identifier(physicalTable)}
            WHERE ${predicate}
            LIMIT 25`
      )
      return rows.map((row) => ({
        id: String(row['id']),
        label: typeof row['__label'] === 'string' ? row['__label'] : String(row['id']),
      }))
    }).pipe(Effect.orElseSucceed((): readonly TableSearchMatch[] => [])),
})
