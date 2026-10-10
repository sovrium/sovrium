/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import type { WordSearchTerm } from '@/domain/models/app/tables/word-search-service'
import type { SQL } from 'drizzle-orm'

/**
 * The SQL shapes of the word search on a `long-text` field declared
 * `fullTextSearch` — the PostgreSQL index expression, and the query string each
 * engine is asked with.
 *
 * ## One expression for the index and the query (PostgreSQL)
 *
 * The planner uses an expression index only when the predicate repeats the
 * indexed expression, so the migration generator's `CREATE INDEX` takes
 * {@link pgWordSearchVectorExpression} and the records query's `@@` takes
 * {@link pgWordSearchVectorSql}, both built from the same text. A stray
 * difference between the two would silently downgrade every search to a
 * sequential scan.
 *
 * - `'simple'`: no stemming and no stop words, as SQLite's `unicode61` does not
 *   stem either — the two engines must find the same rows.
 * - `regexp_replace(…, '[^[:alnum:]]+', ' ', 'g')`: PostgreSQL's parser keeps an
 *   address, a path or `user_id` as ONE token, where SQLite splits on every
 *   non-alphanumeric. Replacing those runs by a space first makes PostgreSQL
 *   index the same words SQLite does. `[:alnum:]` follows the database's
 *   `LC_CTYPE`; under a UTF-8 locale it keeps accented letters.
 * - `coalesce`: a NULL field indexes as no word rather than nulling the vector.
 *
 * ## The SQLite side has no DDL here
 *
 * The full-text mirror `fts__<table>` the command palette keeps already holds
 * one column per long-text field (`command-search-fts-ddl.ts`); the word search
 * reads it through a column filter.
 */

/** The text-search configuration the index and the query are both built with. */
const TS_CONFIG = 'simple'

/** The text before the column in the `to_tsvector(...)` expression. */
const PG_VECTOR_OPEN = `to_tsvector('${TS_CONFIG}', regexp_replace(coalesce(`

/** The text after the column: the run of non-alphanumerics becomes a space. */
const PG_VECTOR_CLOSE = `, ''), '[^[:alnum:]]+', ' ', 'g'))`

/** The GIN expression index of a declared field (PostgreSQL). */
export const pgWordSearchIndexName = (sanitizedTable: string, field: string): string =>
  `idx_${sanitizedTable}_${field}_fulltext`

/**
 * The `to_tsvector(...)` expression over `column`, EXACTLY as both the index
 * and the query predicate spell it. `column` is a validated field name
 * (`^[a-z][a-z0-9_]*$`).
 */
export const pgWordSearchVectorExpression = (column: string): string =>
  `${PG_VECTOR_OPEN}"${column}"${PG_VECTOR_CLOSE}`

/**
 * The same expression as a query fragment: the constant text around the column
 * is shared with {@link pgWordSearchVectorExpression}, and the column itself is
 * quoted by `sql.identifier`, which renders a validated name exactly as the
 * index spells it.
 */
export const pgWordSearchVectorSql = (column: string): Readonly<SQL> =>
  // sql-literal: ddl -- module constants shared with the index expression; the column is an identifier
  sql`${sql.raw(PG_VECTOR_OPEN)}${sql.identifier(column)}${sql.raw(PG_VECTOR_CLOSE)}`

/** A word quoted as a `to_tsquery` lexeme: `'` doubled, `\` escaped. */
const pgLexeme = (word: string): string => `'${word.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`

/**
 * The `to_tsquery('simple', …)` argument for `terms`: prefix words (`'w':*`) and
 * phrases (`'a' <-> 'b'`), all ANDed. Bound as a parameter, never spliced.
 */
export const toPgWordTsQuery = (terms: readonly WordSearchTerm[]): string =>
  terms
    .map((term) =>
      term.kind === 'prefix'
        ? `${pgLexeme(term.word)}:*`
        : `(${term.words.map(pgLexeme).join(' <-> ')})`
    )
    .join(' & ')

/** A string quoted for FTS5, embedded quotes doubled. */
const fts5String = (text: string): string => `"${text.replace(/"/g, '""')}"`

/**
 * The FTS5 `MATCH` expression for `terms` over `columns`: every term in the
 * same column — `{"body"} : ("timeout"* AND "invoice lock")` — and, with
 * several columns, any one of them. Every token is quoted, so no input can be
 * read as FTS5 syntax. Bound as a parameter, never spliced.
 */
export const toSqliteWordMatch = (
  terms: readonly WordSearchTerm[],
  columns: readonly string[]
): string => {
  const expression = terms
    .map((term) =>
      term.kind === 'prefix' ? `${fts5String(term.word)}*` : fts5String(term.words.join(' '))
    )
    .join(' AND ')
  return columns.map((column) => `({${fts5String(column)}} : (${expression}))`).join(' OR ')
}
