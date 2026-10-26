/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The DDL and the duplicate probes of a translatable `single-line-text` that is
 * `unique` ([internal ref] A1): unique within each language, never across languages.
 *
 * - One live-rows unique expression index per declared language,
 *   `<table>_<field>_<code>_key … WHERE deleted_at IS NULL`, over the same
 *   expression a filter reads one language with (`translatable-value-sql.ts`):
 *   `(col->>'fr')` on PostgreSQL, `json_extract(col, '$."fr"')` on SQLite. A
 *   missing language reads NULL, and both engines hold NULLs distinct, so a
 *   record with no value in a language never collides.
 * - Before an index is built over rows that exist, the rows are probed for a
 *   value two live records share in that language, and the edit is refused
 *   naming each value, its language and the ids holding it. The same probe
 *   reads the collapsed value when the option is turned off on a unique field.
 *
 * Every builder reads the field's languages from its stamp
 * ({@link recordLanguagesOf}), default language first.
 */

import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import {
  isUniqueInEachLanguage,
  languageUniqueIndexName,
} from '@/domain/models/app/tables/translatable-unique-service'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { LIVE_ROWS_PREDICATE } from './sql-key-constraints'
import { recordLanguagesOf } from './sql-translatable-columns'
import { languageValueDdl } from './translatable-value-sql'
import type { Table } from '@/domain/models/app/tables'

/** One per-language unique index a table declares. */
export interface DeclaredLanguageIndex {
  readonly name: string
  readonly field: string
  readonly code: string
}

/** Every per-language unique index `table` declares, named against `relation`. */
export const declaredLanguageIndexes = (
  table: Table,
  relation: string = table.name
): readonly DeclaredLanguageIndex[] =>
  table.fields.filter(isUniqueInEachLanguage).flatMap((field) =>
    recordLanguagesOf(field).map((code) => ({
      name: languageUniqueIndexName(relation, field.name, code),
      field: field.name,
      code,
    }))
  )

/** The `CREATE UNIQUE INDEX` of one language of one field, on `relation`. */
export const languageUniqueIndexStatement = (
  relation: string,
  index: Pick<DeclaredLanguageIndex, 'field' | 'code'>
): string => {
  const sanitized = sanitizeTableName(relation)
  const target = isSqliteRuntime() ? sanitized : `public.${sanitized}`
  const expression = languageValueDdl(quoteSqlIdentifier(index.field), index.code)
  return `CREATE UNIQUE INDEX IF NOT EXISTS ${languageUniqueIndexName(relation, index.field, index.code)} ON ${target} (${expression}) WHERE ${LIVE_ROWS_PREDICATE}`
}

/** The per-language unique indexes of every translatable unique field of `table`. */
export const generateLanguageUniqueIndexes = (table: Table): readonly string[] =>
  declaredLanguageIndexes(table).map((index) => languageUniqueIndexStatement(table.name, index))

/** How many duplicated values a refusal names. */
const MAX_LISTED = 3

/** How many characters of one duplicated value a refusal shows. */
const MAX_VALUE_LENGTH = 80

/** The ids of a group, as text, in id order. */
const groupIds = (): string =>
  isSqliteRuntime() ? `group_concat(id, ', ')` : `string_agg(id::text, ', ' ORDER BY id::text)`

/**
 * The values `expression` holds on two live records or more of `relation`,
 * each with the ids holding it — at most {@link MAX_LISTED}.
 */
export const sharedValuesQuery = (relation: string, expression: string): string =>
  `SELECT ${expression} AS dup_value, ${groupIds()} AS dup_ids FROM ${quoteSqlIdentifier(relation)} WHERE ${expression} IS NOT NULL AND ${LIVE_ROWS_PREDICATE} GROUP BY ${expression} HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC LIMIT ${MAX_LISTED}`

/** One language's value of `field`, as the per-language index reads it. */
export const languageValueExpression = (field: string, code: string): string =>
  languageValueDdl(quoteSqlIdentifier(field), code)

/** A shared value, as a probe returns it. */
export interface SharedValue {
  readonly value: string
  readonly ids: string
}

/** The shared values of a probe's rows. */
export const sharedValuesOf = (rows: readonly unknown[]): readonly SharedValue[] =>
  (rows as readonly Record<string, unknown>[]).map((row) => ({
    value: String(row['dup_value']),
    ids: String(row['dup_ids']),
  }))

/** A duplicated value as a refusal shows it: quoted, and cut to {@link MAX_VALUE_LENGTH}. */
const showValue = (value: string): string =>
  JSON.stringify(value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value)

/**
 * The refusal for a translatable field that cannot hold its values unique:
 * each shared value, with its language when the uniqueness is per language,
 * and the ids of the live records holding it.
 *
 * @param language - the language the values are compared in; absent for a collapse
 */
export const formatLanguageDuplicateRefusal = (params: {
  readonly tableName: string
  readonly field: string
  readonly language?: string
  readonly values: readonly SharedValue[]
}): string => {
  const { tableName, field, language, values } = params
  const where =
    language === undefined
      ? 'once each record keeps one value'
      : `within the language "${language}"`
  const tag = language === undefined ? '' : ` (${language})`
  return [
    `\`${tableName}.${field}\` cannot be unique ${where}: live records share a value`,
    '',
    ...values.map((entry) => `    ${showValue(entry.value)}${tag}: records ${entry.ids}`),
    '',
    'Give each record its own value, or leave unique off for this field.',
    'Nothing has been changed.',
  ].join('\n')
}
