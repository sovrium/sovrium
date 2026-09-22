/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Full-text index shapes for the command-palette record search
 * — the SQL that both the
 * boot-time reconciler and the runtime query are generated from.
 *
 * One module because the two sides must emit BYTE-IDENTICAL expressions. On
 * PostgreSQL that is not a style preference: the planner only uses a GIN
 * expression index when the `WHERE` expression matches the indexed expression,
 * so a stray space between the DDL and the query silently downgrades the whole
 * feature to the sequential scan it exists to replace — with no error, no test
 * failure, and no way to notice short of an `EXPLAIN`.
 *
 * ## Why the two engines take different shapes
 *
 * The contract (see the user story) is that a row written by RAW SQL is findable
 * by the very next palette request, with no application step in between. That
 * rules out the materialized `system.search_index` in `search/fts-manager.ts`,
 * which is populated by application code on write. Each engine reaches freshness
 * its own way:
 *
 *   PostgreSQL  a GIN index over `to_tsvector('simple', …)` of the row's OWN
 *               columns. The tsvector is computed at query time, so freshness is
 *               structural — there is nothing to keep in sync.
 *   SQLite      no expression-index equivalent exists, so an FTS5 virtual table
 *               plus AFTER INSERT/UPDATE/DELETE triggers on the base table. A
 *               raw `INSERT` fires the trigger, which is what makes it fresh.
 *
 * ## Why PostgreSQL gets an INDEX and not a generated column
 *
 * A `GENERATED ALWAYS AS (…) STORED` tsvector column would also be fresh, and it
 * was the obvious first design. It adds a column to a USER table, though, and
 * every projection that is not an explicit column list — `SELECT *`, CSV export,
 * a record-shape response — would then carry a large internal blob the schema
 * author never declared. An expression index has identical freshness, is
 * invisible to every read path, and needs no `ALTER TABLE` on user data.
 *
 * ## `'simple'`, not `'english'`
 *
 * `simple` folds case and nothing else. `english` would stem (`quarterly` →
 * `quarter`) and drop stop words, which changes which rows are CANDIDATES and
 * would make the palette's behaviour depend on the text's language. The FTS side
 * is a candidate gate, not the semantic authority — the escaped `LIKE` is — so
 * the tokenizer's only job is to be predictable.
 */

import { escapeLikeMetacharacters } from '@/domain/kernel/sql/sql-formatting'

/** Prefix of every per-table FTS5 virtual table (SQLite). Reserved namespace. */
const SQLITE_FTS_PREFIX = 'fts__'

/**
 * {@link SQLITE_FTS_PREFIX} escaped for use in a `LIKE … ESCAPE '\'` pattern.
 *
 * `_` is a single-character wildcard, so the unescaped prefix would also match
 * names this feature never created — and the one query that uses it builds a
 * DROP list. Escaped through the canonical helper rather than a local
 * `.replace(/_/g, …)`, which covers `%` and `\` too and so stays correct if the
 * prefix ever gains one.
 */
export const SQLITE_FTS_PREFIX_LIKE = escapeLikeMetacharacters(SQLITE_FTS_PREFIX)

/** Prefix of every per-table GIN expression index (PostgreSQL). Reserved namespace. */
const PG_FTS_INDEX_PREFIX = 'cs_fts_'

/**
 * {@link PG_FTS_INDEX_PREFIX} escaped for a SQL `LIKE … ESCAPE '\'`, so the
 * pre-migration sweep matches the namespace and nothing adjacent.
 */
export const PG_FTS_INDEX_PREFIX_LIKE = escapeLikeMetacharacters(PG_FTS_INDEX_PREFIX)

/** The unindexed FTS5 column carrying the base row's primary key, as TEXT. */
export const SQLITE_FTS_RECORD_ID_COLUMN = 'record_id'

/** The text-search configuration both the index and the query are built with. */
const TS_CONFIG = 'simple'

/** PostgreSQL's identifier length limit — an over-long index name is truncated. */
const PG_IDENTIFIER_MAX = 63

/**
 * A column name safe to inline into raw DDL.
 *
 * Field names are already constrained to `^[a-z][a-z0-9_]*$` by
 * `FieldNameSchema`, and table names by `sanitizeTableName`, so this never
 * rejects a real identifier. It is here so that a future path which reaches this
 * module with an unvalidated name fails closed instead of concatenating it into
 * a DDL string.
 */
export const isSafeIdentifier = (name: string): boolean => /^[a-z][a-z0-9_]*$/.test(name)

/** The FTS5 virtual-table name mirroring `relation` (SQLite). */
export const sqliteFtsTableName = (relation: string): string => `${SQLITE_FTS_PREFIX}${relation}`

/**
 * Deterministic short digest of the searchable-column set, so a table whose
 * columns changed gets a DIFFERENT index name.
 *
 * That is what makes the PostgreSQL reconciler cheap: `CREATE INDEX IF NOT
 * EXISTS` on a name that encodes the expression can be a no-op on every boot
 * after the first, instead of dropping and rebuilding a GIN index each start.
 * FNV-1a, chosen because it needs no import and its output is stable across
 * runtimes — this value ends up in a persisted identifier.
 */
const columnSetDigest = (columns: readonly string[]): string => {
  const input = columns.join(',')
  const hash = [...input].reduce(
    (accumulator, character) =>
      Math.imul(accumulator ^ character.charCodeAt(0), 0x01_00_01_93) >>> 0,
    0x81_1c_9d_c5
  )
  return hash.toString(16).padStart(8, '0')
}

/** Prefix every per-table PG index name shares, used to find obsolete siblings. */
export const pgFtsIndexPrefixFor = (relation: string): string =>
  `${PG_FTS_INDEX_PREFIX}${relation.slice(0, 40)}_`

/** The GIN expression-index name for `relation` at this exact column set. */
export const pgFtsIndexName = (relation: string, columns: readonly string[]): string =>
  `${pgFtsIndexPrefixFor(relation)}${columnSetDigest(columns)}`.slice(0, PG_IDENTIFIER_MAX)

/**
 * The `to_tsvector(...)` expression over `columns`, EXACTLY as it must appear in
 * both the index definition and the query predicate.
 *
 * `coalesce(col, '')` per column because `NULL || ' ' || 'x'` is `NULL` in SQL —
 * a single null column would otherwise erase the whole row's searchable text.
 * Concatenating with a space keeps adjacent columns from fusing into one bogus
 * token (`…endStart…`).
 */
export const pgSearchVectorExpression = (columns: readonly string[]): string => {
  const parts = columns.map((column) => `coalesce("${column}", '')`).join(` || ' ' || `)
  return `to_tsvector('${TS_CONFIG}', ${parts})`
}

/**
 * Split a palette query into full-text tokens.
 *
 * Unicode-aware (`\p{L}\p{N}`) rather than `[a-z0-9]`, and that matters: an
 * ASCII-only split turns `Müller` into the tokens `m` and `ller`, neither of
 * which is a prefix of anything either engine indexed, so an accented search
 * would return nothing at all. Both engines fold `Müller` to a single token, so
 * a single token is what the query has to offer them.
 *
 * Returns an empty list for punctuation-only input — the caller's signal to skip
 * the candidate gate entirely and let the escaped `LIKE` answer alone.
 */
export const toFtsTokens = (query: string): readonly string[] =>
  query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0)

/**
 * The PostgreSQL `to_tsquery` argument for `tokens`, as a prefix-OR.
 *
 * ## Why OR and not AND
 *
 * AND is the more selective gate and was the first choice. It is also
 * unsafe here, because the two engines DISAGREE about where a token ends and the
 * query is tokenized by neither of them. `Draft_v2` is the measured case:
 * SQLite's `unicode61` splits it into `draft` + `v2`, while PostgreSQL's parser
 * can keep `draft_v2` as one token. Under AND the PostgreSQL row matches
 * `draft:*` but has nothing starting with `v2`, so it is not a candidate and the
 * palette returns nothing — silently breaking the literal-metacharacter contract
 * (`index.spec.ts` 005) on ONE engine only.
 *
 * OR is immune to that disagreement: a row is a candidate if ANY query token is
 * a prefix of ANY of its tokens, which holds however the engine chose to split.
 * The narrowing that [internal ref] actually asks for survives, because it comes from
 * prefix-vs-substring, not from token conjunction: `uarterl` is no token's
 * prefix under either tokenizer, so the row is not a candidate either way.
 *
 * The cost is a wider candidate set for multi-word queries. It is still served
 * by the index, still verified by the `LIKE`, and still bounded by `LIMIT` —
 * whereas an AND that drops real rows is a wrong answer.
 */
export const toPgTsQuery = (tokens: readonly string[]): string =>
  tokens.map((token) => `${token}:*`).join(' | ')

/**
 * The SQLite FTS5 `MATCH` expression for `tokens`, as a prefix-OR.
 *
 * Each token is double-quoted so FTS5 reads it as a string rather than as query
 * syntax, with any embedded quote doubled. `toFtsTokens` cannot currently
 * produce one, which is exactly why the escaping belongs here rather than in a
 * comment: the day the tokenizer widens, this stays correct.
 *
 * See {@link toPgTsQuery} for why the tokens are OR-ed.
 */
export const toSqliteFtsMatch = (tokens: readonly string[]): string =>
  tokens.map((token) => `"${token.replace(/"/g, '""')}"*`).join(' OR ')

/**
 * The idempotent SQLite DDL that creates the FTS5 mirror of `physicalTable`,
 * the three triggers that keep it in lock-step, and the initial backfill.
 *
 * NOT the external-content (`content=`/`content_rowid=`) pattern that
 * `lookup/admin-search-fts-ddl.ts` uses. External content couples the index to
 * the base table's `rowid`, and a Sovrium table may declare a TEXT primary key
 * (`auth.scopeTables` parents do so implicitly), for which no such coupling
 * exists. Storing `record_id` as an UNINDEXED TEXT column costs a copy of the
 * key and works at every primary-key type.
 *
 * The UPDATE trigger deletes-then-inserts because an FTS index has no in-place
 * update. The DELETE is a plain `DELETE FROM` — available here precisely because
 * this is an ordinary FTS5 table and not an external-content one, which would
 * have required the `'delete'` command-row incantation.
 *
 * @param queriedRelation the relation the palette SELECTs from — the view name
 *   for a view-backed table, otherwise the table itself. Names the FTS table so
 *   the runtime query can derive it from what it is already querying.
 * @param physicalTable the real TABLE the triggers attach to. Differs from
 *   `queriedRelation` for view-backed tables; a trigger cannot be hung on a view.
 */
export const sqliteFtsStatements = (input: {
  readonly queriedRelation: string
  readonly physicalTable: string
  readonly columns: readonly string[]
}): readonly string[] => {
  const { queriedRelation, physicalTable, columns } = input
  const fts = sqliteFtsTableName(queriedRelation)
  const quoted = columns.map((column) => `"${column}"`).join(', ')
  const newValues = columns.map((column) => `new."${column}"`).join(', ')
  const idColumns = `${SQLITE_FTS_RECORD_ID_COLUMN}, ${quoted}`

  return [
    `CREATE VIRTUAL TABLE IF NOT EXISTS "${fts}" USING fts5(
       ${SQLITE_FTS_RECORD_ID_COLUMN} UNINDEXED,
       ${quoted}
     )`,
    `CREATE TRIGGER IF NOT EXISTS "${fts}_ai"
       AFTER INSERT ON "${physicalTable}" BEGIN
         INSERT INTO "${fts}"(${idColumns})
         VALUES (CAST(new."id" AS TEXT), ${newValues});
       END`,
    `CREATE TRIGGER IF NOT EXISTS "${fts}_ad"
       AFTER DELETE ON "${physicalTable}" BEGIN
         DELETE FROM "${fts}" WHERE ${SQLITE_FTS_RECORD_ID_COLUMN} = CAST(old."id" AS TEXT);
       END`,
    `CREATE TRIGGER IF NOT EXISTS "${fts}_au"
       AFTER UPDATE ON "${physicalTable}" BEGIN
         DELETE FROM "${fts}" WHERE ${SQLITE_FTS_RECORD_ID_COLUMN} = CAST(old."id" AS TEXT);
         INSERT INTO "${fts}"(${idColumns})
         VALUES (CAST(new."id" AS TEXT), ${newValues});
       END`,
  ]
}

/** The statements that tear an existing SQLite FTS mirror down, in safe order. */
export const sqliteFtsDropStatements = (queriedRelation: string): readonly string[] => {
  const fts = sqliteFtsTableName(queriedRelation)
  return [
    `DROP TRIGGER IF EXISTS "${fts}_ai"`,
    `DROP TRIGGER IF EXISTS "${fts}_ad"`,
    `DROP TRIGGER IF EXISTS "${fts}_au"`,
    `DROP TABLE IF EXISTS "${fts}"`,
  ]
}

/**
 * Backfill the FTS mirror from the rows already in `physicalTable`.
 *
 * Run once, immediately after (re)creation. The triggers only see writes that
 * happen AFTER they exist, so without this every row predating the index — every
 * row in an existing deployment — would be permanently unfindable.
 */
export const sqliteFtsBackfillStatement = (input: {
  readonly queriedRelation: string
  readonly physicalTable: string
  readonly columns: readonly string[]
}): string => {
  const { queriedRelation, physicalTable, columns } = input
  const fts = sqliteFtsTableName(queriedRelation)
  const quoted = columns.map((column) => `"${column}"`).join(', ')
  return `INSERT INTO "${fts}"(${SQLITE_FTS_RECORD_ID_COLUMN}, ${quoted})
          SELECT CAST("id" AS TEXT), ${quoted} FROM "${physicalTable}"`
}

/** `CREATE INDEX IF NOT EXISTS` for the PostgreSQL GIN expression index. */
export const pgFtsIndexStatement = (input: {
  readonly relation: string
  readonly columns: readonly string[]
}): string => {
  const { relation, columns } = input
  return `CREATE INDEX IF NOT EXISTS "${pgFtsIndexName(relation, columns)}"
          ON "${relation}" USING GIN (${pgSearchVectorExpression(columns)})`
}
