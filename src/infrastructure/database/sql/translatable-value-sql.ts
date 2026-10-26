/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'

/**
 * The text of a translatable column as a query reads it — the dialect seam of
 * [internal ref] D8 and D9. A translatable field holds a map from language code to
 * text (`jsonb` on PostgreSQL, JSON text on SQLite); a filter or a sort reads
 * ONE language's value out of it, and a search reads every value at once.
 *
 * The language code is spliced as text, never bound: the per-language index is
 * an expression index over `col->>'en'` (PostgreSQL) or
 * `json_extract(col, '$."en"')` (SQLite), and the planner serves a predicate
 * from it only when the predicate spells the same expression. So the code is
 * checked against the shape every declared language code has (two lowercase
 * letters), and anything else throws before it reaches a statement (S3).
 */

/** The shape of a declared language code. */
const LANGUAGE_CODE = /^[a-z]{2}$/

/** `code`, refused unless it is a language code. */
const checkedCode = (code: string): string => {
  if (!LANGUAGE_CODE.test(code)) {
    throw new Error(`translatable value: "${code}" is not a language code`)
  }
  return code
}

/**
 * One language's value of a translatable column: the text, or NULL when the
 * map holds none for that language. The same expression the field's
 * per-language index is built over. `alias` qualifies the column with a row
 * alias of the query (`o.slug`).
 */
export const languageValueSql = (column: string, code: string, alias?: string): SQL => {
  const checked = checkedCode(code)
  const identifier =
    alias === undefined
      ? sql.identifier(column)
      : sql`${sql.identifier(alias)}.${sql.identifier(column)}`
  return isSqliteRuntime()
    ? // sql-literal: identifier -- a language code checked against /^[a-z]{2}$/
      sql`json_extract(${identifier}, ${sql.raw(`'$."${checked}"'`)})`
    : // sql-literal: identifier -- a language code checked against /^[a-z]{2}$/
      sql`(${identifier}->>${sql.raw(`'${checked}'`)})`
}

/**
 * {@link languageValueSql} as statement text, for a database view's SQL, which
 * cannot bind parameters: the same expression, so the per-language index
 * serves it. `quotedColumn` is an already quoted identifier.
 */
export const languageValueDdl = (quotedColumn: string, code: string): string => {
  const checked = checkedCode(code)
  return isSqliteRuntime()
    ? `json_extract(${quotedColumn}, '$."${checked}"')`
    : `(${quotedColumn}->>'${checked}')`
}

/**
 * Every value of a translatable column, joined by spaces, in no particular
 * order: the text a search reads, so a word of any language finds the record.
 * Only the values — never the language codes the map is keyed by. NULL when
 * the map holds no value.
 */
export const allLanguagesTextSql = (column: string): SQL => {
  const identifier = sql.identifier(column)
  return isSqliteRuntime()
    ? sql`(SELECT group_concat(value, ' ') FROM json_each(${identifier}))`
    : sql`(SELECT string_agg(value, ' ') FROM jsonb_each_text(${identifier}))`
}

/**
 * {@link allLanguagesTextSql} for a PostgreSQL index expression, which may not
 * hold a subquery: the map's values as one JSON array, read as text. Only the
 * values reach it, so a language code is never a word of the content.
 * `quotedColumn` is an already quoted identifier.
 */
export const pgAllLanguagesTextDdl = (quotedColumn: string): string =>
  `jsonb_path_query_array(${quotedColumn}, '$.*')::text`
