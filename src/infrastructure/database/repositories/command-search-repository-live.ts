/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, isNull, sql, type SQL } from 'drizzle-orm'
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
import { containsInsensitive } from '@/infrastructure/database/sql/dialect-sql-helpers'

const userFavorites = resolveDialectSchema(userFavoritesPg, userFavoritesSqlite)

/** Wrap a DB promise, adapting failures to CommandSearchDatabaseError. */
const wrap = makeDbWrap((error) => new CommandSearchDatabaseError({ cause: error }))

/**
 * The `__label` expression: the first non-empty searched column for the row.
 *
 * `COALESCE` needs an ARITY GUARD. At two or more columns it is
 * `COALESCE("title", "body")` and both engines accept it; at exactly one it is
 * `COALESCE("title")` — legal in PostgreSQL, and rejected outright by SQLite:
 *
 *     SQLiteError: wrong number of arguments to function COALESCE()
 *
 * So the whole palette answered 500 for any app whose only searchable table had
 * a single text column — on the zero-config DEFAULT engine, while the identical
 * config worked on Postgres. The classic 0/1/many gap: nothing is wrong at
 * "many", which is the only arity the query was ever exercised at. At one column
 * `COALESCE` has nothing to fall back TO, so the bare column is not a workaround
 * — it is what `COALESCE` of one argument means.
 *
 * The empty case is the caller's: `SearchCommandPalette` returns early when a
 * table has no searchable columns, so `searchTable` is never asked to build a
 * label out of nothing.
 */
const labelExpression = (columns: readonly string[]): Readonly<SQL> => {
  const [onlyColumn] = columns
  if (columns.length === 1 && onlyColumn !== undefined) return sql`${sql.identifier(onlyColumn)}`
  return sql`COALESCE(${sql.join(
    columns.map((column) => sql.identifier(column)),
    sql`, `
  )})`
}

/**
 * Command Search Repository Implementation
 *
 * Two raw query concerns for the command-palette search:
 *
 *   - `loadFavoriteIds` — Drizzle query-builder select of the caller's
 *     favorited `record` entity ids (soft-deleted excluded).
 *   - `searchTable` — a raw, portable case-insensitive text search across a
 *     table's text columns. A failing/unreadable table search resolves to `[]`
 *     (the error channel is `never`) so a broken table never aborts the search.
 */
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
    // Never fails, and now actually so. This was an `Effect.promise`, whose
    // rejection is a DEFECT rather than a typed error — `orElseSucceed` only
    // handles the error channel, so the "any DB failure resolves to []" comment
    // that sat here described a guarantee the code did not have, and a real
    // SQLite arity error escaped it as a 500. `tryPromise` routes both a
    // rejection AND a synchronous throw in the evaluator into the error channel,
    // which `orElseSucceed` then absorbs; an `async` body has no third way to
    // fail. A single bad table is skipped, the rest of the search proceeds.
    Effect.tryPromise({
      try: async (): Promise<readonly TableSearchMatch[]> => {
        // Build an OR of case-insensitive LIKE predicates across each text
        // column. Column names come from the validated schema (not user input),
        // and the query text is bound as a SQL parameter, so this is
        // injection-safe. `containsInsensitive` owns the portable spelling (PG
        // has `ILIKE`, SQLite does not) AND the metacharacter escaping, so a
        // reader searching for `50%` gets the rows containing `50%` rather than
        // every row containing `50`.
        const predicate = sql.join(
          columns.map((column) => containsInsensitive(sql.identifier(column), query)),
          sql` OR `
        )

        const rows = await executeRaw(
          db,
          sql`SELECT id, ${labelExpression(columns)} AS __label
              FROM ${sql.identifier(physicalTable)}
              WHERE ${predicate}
              LIMIT 25`
        )
        return rows.map((row) => ({
          id: String(row['id']),
          label: typeof row['__label'] === 'string' ? row['__label'] : String(row['id']),
        }))
      },
      catch: (error) => new CommandSearchDatabaseError({ cause: error }),
    }).pipe(Effect.orElseSucceed((): readonly TableSearchMatch[] => [])),
})
