/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { languageTextsOf } from '@/domain/models/app/tables/translatable-field-service'
import { isLanguageMerge } from '@/domain/models/app/tables/translatable-write-service'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

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
 * One language's value of a translatable column on `dialect`: the text, or
 * NULL when the map holds none for that language. The same expression the
 * field's per-language index is built over. `alias` qualifies the column with
 * a row alias of the query (`o.slug`).
 */
export const languageValueSqlOn = (
  dialect: DatabaseDialect,
  column: string,
  code: string,
  alias?: string
): SQL => {
  const checked = checkedCode(code)
  const identifier =
    alias === undefined
      ? sql.identifier(column)
      : sql`${sql.identifier(alias)}.${sql.identifier(column)}`
  return dialect === 'sqlite'
    ? // sql-literal: identifier -- a language code checked against /^[a-z]{2}$/
      sql`json_extract(${identifier}, ${sql.raw(`'$."${checked}"'`)})`
    : // sql-literal: identifier -- a language code checked against /^[a-z]{2}$/
      sql`(${identifier}->>${sql.raw(`'${checked}'`)})`
}

/**
 * {@link languageValueSqlOn} as statement text, for a database view's SQL,
 * which cannot bind parameters: the same expression, so the per-language
 * index serves it. `quotedColumn` is an already quoted identifier.
 */
export const languageValueDdlOn = (
  dialect: DatabaseDialect,
  quotedColumn: string,
  code: string
): string => {
  const checked = checkedCode(code)
  return dialect === 'sqlite'
    ? `json_extract(${quotedColumn}, '$."${checked}"')`
    : `(${quotedColumn}->>'${checked}')`
}

/**
 * Every value of a translatable column on `dialect`, joined by spaces, in no
 * particular order: the text a search reads, so a word of any language finds
 * the record. Only the values — never the language codes the map is keyed by.
 * NULL when the map holds no value.
 */
export const allLanguagesTextSqlOn = (dialect: DatabaseDialect, column: string): SQL => {
  const identifier = sql.identifier(column)
  return dialect === 'sqlite'
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

/**
 * The predicate a column equals `value` on `dialect`, as a lookup by merge key
 * reads it. A language map matches per language, one `= text` per language it
 * names, each over the expression the per-language unique index is built on:
 * the map itself is never bound, since SQLite would compare it to the stored
 * JSON text byte for byte, key order included, and PostgreSQL to a `jsonb`
 * the binding does not produce. A record write hands the map over as the
 * languages it sets (`LanguageMerge`), which match the same way. A map, or a
 * merge, that names no language's text identifies no row — as a `null` key
 * never equals anything — so it matches none, never every row. Any other
 * value is bound as itself.
 */
export const mergeKeyEqualsSqlOn = (
  dialect: DatabaseDialect,
  column: string,
  value: unknown
): SQL => {
  const texts = languageTextsOf(isLanguageMerge(value) ? value.set : value)
  if (texts === undefined && !isLanguageMerge(value)) {
    return sql`${sql.identifier(column)} = ${value}`
  }
  const named = Object.entries(texts ?? {})
  return named.length === 0
    ? sql`1 = 0`
    : sql.join(
        named.map(([code, text]) => sql`${languageValueSqlOn(dialect, column, code)} = ${text}`),
        sql.raw(' AND ')
      )
}
