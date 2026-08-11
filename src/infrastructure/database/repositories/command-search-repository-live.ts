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
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { userFavorites as userFavoritesPg } from '@/infrastructure/database/drizzle/schema/favorites'
import { userFavorites as userFavoritesSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/favorites'
import {
  pgSearchVectorExpression,
  SQLITE_FTS_RECORD_ID_COLUMN,
  sqliteFtsTableName,
  toFtsTokens,
  toPgTsQuery,
  toSqliteFtsMatch,
} from '@/infrastructure/database/schema/command-search-fts-ddl'
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
 * The FTS candidate predicate for `query`, or `undefined` when there is none to
 * apply.
 *
 * `undefined` is returned for a query that tokenizes to NOTHING — a
 * punctuation-only search such as `%%%`. That case has two natural and opposite
 * wrong answers, and both are silent: an empty `to_tsquery('')` matches nothing,
 * so every punctuation search returns empty; a degenerate match-all candidate
 * set makes the acceleration a no-op. Neither is what the reader asked for. The
 * right answer is to drop the gate and let the escaped `LIKE` — which already
 * matches `%` and `_` literally — answer alone. Such a query is rare and
 * inherently unselective, so paying one scan for it is the correct trade.
 */
const ftsCandidatePredicate = (
  physicalTable: string,
  columns: readonly string[],
  query: string
): Readonly<SQL> | undefined => {
  const tokens = toFtsTokens(query)
  if (tokens.length === 0) return undefined

  if (parseDatabaseDialectConfig().dialect === 'sqlite') {
    // Expressed as `id IN (SELECT …)` rather than a JOIN on purpose: the FTS5
    // mirror carries columns of the SAME NAMES as the base table, so a joined
    // shape would make every unqualified reference in the label expression
    // ambiguous. A semi-join keeps the outer query — and `labelExpression` —
    // byte-identical to the unaccelerated one.
    //
    // `CAST(id AS TEXT)` because `record_id` is TEXT (a Sovrium primary key may
    // be an integer or a string, and SQLite does not compare across storage
    // classes in `IN`).
    const ftsTable = sqliteFtsTableName(physicalTable)
    return sql`CAST(id AS TEXT) IN (
      SELECT ${sql.identifier(SQLITE_FTS_RECORD_ID_COLUMN)}
      FROM ${sql.identifier(ftsTable)}
      WHERE ${sql.identifier(ftsTable)} MATCH ${toSqliteFtsMatch(tokens)}
    )`
  }

  // Postgres: the expression MUST be byte-identical to the one the GIN index was
  // built over, or the planner silently falls back to a sequential scan — which
  // is the exact cost this predicate exists to remove. Both come from
  // `pgSearchVectorExpression`; do not inline it here.
  return sql`${sql.raw(pgSearchVectorExpression(columns))} @@ to_tsquery('simple', ${toPgTsQuery(tokens)})`
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
        //
        // This stays the SEMANTIC AUTHORITY under the hybrid below. The FTS
        // candidate set only narrows what this predicate is asked to verify, so
        // the literal-metacharacter contract is inherited rather than
        // re-derived.
        const likePredicate = sql.join(
          columns.map((column) => containsInsensitive(sql.identifier(column), query)),
          sql` OR `
        )

        const run = async (
          candidate: Readonly<SQL> | undefined
        ): Promise<ReadonlyArray<Record<string, unknown>>> =>
          executeRaw(
            db,
            sql`SELECT id, ${labelExpression(columns)} AS __label
                FROM ${sql.identifier(physicalTable)}
                WHERE ${candidate === undefined ? likePredicate : sql`${candidate} AND (${likePredicate})`}
                LIMIT 25`
          )

        const candidate = ftsCandidatePredicate(physicalTable, columns, query)
        // The index is an ACCELERATOR, so its absence is not a failure: a table
        // created before this feature shipped, one whose reconciliation was
        // skipped, and a view-backed relation the index cannot serve all land in
        // the `catch`. Re-running without the candidate gate returns the SAME
        // rows this table has always returned, just by an unindexed scan.
        //
        // The unaccelerated query is never wrapped, so ITS failure still reaches
        // the error channel for `orElseSucceed` to absorb per-table — a real
        // database problem is not disguised as an empty search.
        const rows =
          candidate === undefined
            ? await run(undefined)
            : await run(candidate).catch(() => run(undefined))

        return rows.map((row) => ({
          id: String(row['id']),
          label: typeof row['__label'] === 'string' ? row['__label'] : String(row['id']),
        }))
      },
      catch: (error) => new CommandSearchDatabaseError({ cause: error }),
    }).pipe(Effect.orElseSucceed((): readonly TableSearchMatch[] => [])),
})
