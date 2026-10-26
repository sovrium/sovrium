/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The DDL of a translatable text field: one value per declared language, in
 * the field's own column, as a map from language code to text.
 *
 * - PostgreSQL stores the map as `jsonb`; SQLite keeps a `TEXT` column with a
 *   `CHECK (json_valid(col))`.
 * - Turning the option ON wraps each stored value as `{ "<default>": value }`
 *   (PostgreSQL `ALTER … TYPE jsonb USING …`, SQLite a table rebuild).
 * - Turning it OFF keeps the default-language value, else the first non-empty
 *   one, behind `allowDestructive`.
 * - An `indexed` translatable field gets one expression index per language.
 *
 * Every builder reads the app's languages from the field itself: the schema
 * initializer stamps them under {@link RECORD_LANGUAGES} (`applySchemaDefaults`),
 * default language first. A symbol, so the stamp never reaches a serialised
 * config, a checksum or the stored schema snapshot.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import {
  TRANSLATABLE_FIELD_TYPES,
  declaresTranslatable,
  recordLanguageOrder,
  toLanguageMap,
  type RecordLanguages,
} from '@/domain/models/app/tables/translatable-field-service'
import { languageUniqueIndexName } from '@/domain/models/app/tables/translatable-unique-service'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { executeSQL, type SQLExecutionError, type TransactionLike } from './sql-execution'
import { escapeSqlString } from './sql-utils'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

/** The key under which a text field carries the app's language codes, default first. */
export const RECORD_LANGUAGES: unique symbol = Symbol('sovrium.recordLanguages')

/** A field as the schema initializer hands it to the generators. */
type FieldWithRecordLanguages = Fields[number] & {
  readonly [RECORD_LANGUAGES]?: readonly string[]
}

/** The language codes stamped on a field, default first; empty when none were. */
export const recordLanguagesOf = (field: object): readonly string[] =>
  (field as { readonly [RECORD_LANGUAGES]?: readonly string[] })[RECORD_LANGUAGES] ?? []

/**
 * Stamp `languages` (default first) on every text field that may be, or may
 * have been, translatable: the builders below need them to write a default,
 * wrap a value or collapse a map.
 */
export const stampRecordLanguages = (
  tables: readonly Table[],
  languages: readonly string[]
): readonly Table[] =>
  languages.length === 0
    ? tables
    : tables.map((table) => ({
        ...table,
        fields: table.fields.map((field) => {
          if (!TRANSLATABLE_FIELD_TYPES.has(field.type)) return field
          const stamped: FieldWithRecordLanguages = { ...field, [RECORD_LANGUAGES]: languages }
          return stamped
        }),
      }))

/**
 * The app's tables with its languages stamped ({@link stampRecordLanguages}):
 * what a table rebuild outside the schema initializer reads, so a translatable
 * field keeps its map DEFAULT there too.
 */
export const tablesWithRecordLanguages = (app: {
  readonly tables?: readonly Table[]
  readonly languages?: RecordLanguages
}): readonly Table[] => stampRecordLanguages(app.tables ?? [], recordLanguageOrder(app.languages))

/** A SQL string literal. */
const literal = (text: string): string => `'${escapeSqlString(text)}'`

/** The JSON path of one language's value, for SQLite's `json_extract`. */
const jsonPath = (code: string): string => literal(`$."${code}"`)

/**
 * The DEFAULT clause of a translatable field: its default as a map, a string
 * default being the default-language value. `''` when there is no default (or
 * no stamped language to file a string under); `undefined` for any field that
 * is not translatable, which keeps the generic clause.
 */
export const translatableDefaultClause = (field: Fields[number]): string | undefined => {
  if (!declaresTranslatable(field)) return undefined
  const declared = 'default' in field ? field.default : undefined
  const defaultLanguage = recordLanguagesOf(field)[0]
  if (typeof declared === 'string' && defaultLanguage === undefined) return ''
  const map = toLanguageMap(declared, defaultLanguage ?? '')
  if (map === undefined) return ''
  // @effect-diagnostics effect/preferSchemaOverJson:off
  const json = literal(JSON.stringify(map))
  return isSqliteRuntime() ? ` DEFAULT ${json}` : ` DEFAULT ${json}::jsonb`
}

/**
 * SQLite's CHECK that a translatable column holds JSON. PostgreSQL's `jsonb`
 * type refuses anything else on its own.
 */
export const generateTranslatableConstraints = (
  fields: readonly Fields[number][]
): readonly string[] =>
  isSqliteRuntime()
    ? fields
        .filter(declaresTranslatable)
        .map(
          (field) =>
            `CONSTRAINT check_${field.name}_languages CHECK (json_valid(${quoteSqlIdentifier(field.name)}))`
        )
    : []

/** Whether a normalised PostgreSQL type is a text type. */
const isTextType = (normalized: string): boolean =>
  normalized === 'varchar' || normalized === 'text'

/** The first non-empty value of a map column, in `order`, as SQL. */
const collapseExpression = (
  column: string,
  order: readonly string[],
  read: (code: string) => string
): string =>
  order.length === 0
    ? 'NULL'
    : `COALESCE(${order.map((code) => `NULLIF(${read(code)}, '')`).join(', ')})`

/** The wrap of a plain text value into a one-language map, or NULL when empty. */
const wrapExpression = (column: string, builder: string, defaultLanguage: string): string =>
  `CASE WHEN ${column} IS NULL OR ${column} = '' THEN NULL ELSE ${builder}(${literal(defaultLanguage)}, ${column}) END`

/**
 * The `USING` clause of a PostgreSQL type change that turns `translatable` on
 * (text → jsonb) or off (jsonb → text), or `undefined` when this is neither.
 */
export const translatableUsingClause = (
  field: Fields[number],
  columnName: string,
  normalizedExisting: string,
  normalizedTarget: string
): string | undefined => {
  const order = recordLanguagesOf(field)
  if (declaresTranslatable(field) && normalizedTarget === 'jsonb' && isTextType(normalizedExisting))
    return order[0] === undefined
      ? undefined
      : ` USING ${wrapExpression(columnName, 'jsonb_build_object', order[0])}`
  if (
    TRANSLATABLE_FIELD_TYPES.has(field.type) &&
    !declaresTranslatable(field) &&
    normalizedExisting === 'jsonb' &&
    isTextType(normalizedTarget)
  )
    return ` USING ${collapseExpression(columnName, order, (code) => `${columnName}->>${literal(code)}`)}`
  return undefined
}

/**
 * The expression that copies one column into SQLite's rebuilt table when the
 * field changed whether it is translatable, or `undefined` when it did not.
 *
 * @param wasMap - the live column holds maps (its CHECK reads `json_valid`)
 */
export const sqliteTranslatableCopyExpression = (
  field: Fields[number] | undefined,
  wasMap: boolean
): string | undefined => {
  if (field === undefined || !TRANSLATABLE_FIELD_TYPES.has(field.type)) return undefined
  const isMap = declaresTranslatable(field)
  if (isMap === wasMap) return undefined
  const column = quoteSqlIdentifier(field.name)
  const order = recordLanguagesOf(field)
  if (isMap) {
    return order[0] === undefined ? undefined : wrapExpression(column, 'json_object', order[0])
  }
  return collapseExpression(column, order, (code) => `json_extract(${column}, ${jsonPath(code)})`)
}

/** The columns of a SQLite table whose stored CHECK reads `json_valid`, from its CREATE text. */
export const sqliteMapColumns = (createSql: string): ReadonlySet<string> =>
  new Set(
    [...createSql.matchAll(/json_valid\(\s*"?([^")\s]+)"?\s*\)/g)].flatMap((match) =>
      match[1] === undefined ? [] : [match[1]]
    )
  )

/**
 * The copy expression of each column of `relation` whose field changed whether
 * it is translatable, for SQLite's rebuild: read from the CHECK clauses of the
 * live table, which say which columns hold maps today.
 */
export const sqliteTranslatableCopyExpressions = (
  tx: TransactionLike,
  table: Table,
  relation: string
): Effect.Effect<ReadonlyMap<string, string>, SQLExecutionError> =>
  Effect.gen(function* () {
    const rows = yield* executeSQL(
      tx,
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = $1`,
      [relation]
    )
    const createSql = (rows[0] as { readonly sql?: unknown } | undefined)?.sql
    const wasMaps = sqliteMapColumns(typeof createSql === 'string' ? createSql : '')
    return new Map(
      table.fields.flatMap((field) => {
        const expression = sqliteTranslatableCopyExpression(field, wasMaps.has(field.name))
        return expression === undefined ? [] : [[field.name, expression] as const]
      })
    )
  })

/** The name of the per-language index of a translatable field. */
const languageIndexName = (tableName: string, fieldName: string, code: string): string =>
  `idx_${sanitizeTableName(tableName)}_${fieldName}_${code}`

/**
 * The indexes of an `indexed` translatable field: one expression index per
 * declared language, and the drop of the plain index the field had before it
 * was translatable.
 *
 * @param plainIndexName - the name the field's plain index carries
 */
export const translatableIndexStatements = (
  tableName: string,
  field: Fields[number],
  plainIndexName: string
): readonly string[] => {
  const sanitized = sanitizeTableName(tableName)
  const column = quoteSqlIdentifier(field.name)
  const sqlite = isSqliteRuntime()
  return [
    `DROP INDEX IF EXISTS ${plainIndexName}`,
    ...recordLanguagesOf(field).map((code) => {
      const name = languageIndexName(tableName, field.name, code)
      return sqlite
        ? `CREATE INDEX IF NOT EXISTS ${name} ON ${sanitized} (json_extract(${column}, ${jsonPath(code)}))`
        : `CREATE INDEX IF NOT EXISTS ${name} ON public.${sanitized} USING btree ((${column}->>${literal(code)}))`
    }),
  ]
}

/**
 * The drops of every index an `indexed` translatable field would have, for a
 * field whose per-language UNIQUE indexes serve its lookups instead.
 */
export const translatableIndexDrops = (
  tableName: string,
  field: Fields[number],
  plainIndexName: string
): readonly string[] => [
  `DROP INDEX IF EXISTS ${plainIndexName}`,
  ...recordLanguagesOf(field).map(
    (code) => `DROP INDEX IF EXISTS ${languageIndexName(tableName, field.name, code)}`
  ),
]

/**
 * The value a translatable column collapses to when the option is turned off
 * (the default language's, else the first non-empty one), as a read of the
 * stored map: what a unique field's turned-off values are probed with.
 */
export const collapsedValueDdl = (field: Fields[number]): string => {
  const column = quoteSqlIdentifier(field.name)
  return isSqliteRuntime()
    ? collapseExpression(
        column,
        recordLanguagesOf(field),
        (code) => `json_extract(${column}, ${jsonPath(code)})`
      )
    : collapseExpression(column, recordLanguagesOf(field), (code) => `${column}->>${literal(code)}`)
}

/** Whether a PostgreSQL type change turns `translatable` on or off for this field. */
const isTranslatableToggle = (field: Fields[number], existingDataType: string): boolean =>
  TRANSLATABLE_FIELD_TYPES.has(field.type) &&
  declaresTranslatable(field) !== (existingDataType.toLowerCase() === 'jsonb')

/** A column's DEFAULT expression in its new shape: a map when translatable, else the text. */
const toggledDefaultExpression = (field: Fields[number]): string | undefined => {
  const clause = translatableDefaultClause(field)
  if (clause !== undefined) return clause === '' ? undefined : clause.replace(/^ DEFAULT /, '')
  const declared = 'default' in field ? field.default : undefined
  return typeof declared === 'string' ? literal(declared) : undefined
}

/**
 * A PostgreSQL type change, inside the statements it needs when it turns
 * `translatable` on or off. Before it: the column's default is dropped (a text
 * default cannot be cast to `jsonb`, nor a map to text) and, when collapsing,
 * the per-language indexes, plain and unique, whose `col->>'en'` cannot
 * follow the column to text. After it: the default is set again in the new
 * shape. Any other type change is returned alone.
 *
 * @param alter - the `ALTER … TYPE …` statement itself
 */
export const withTranslatableToggle = (
  relation: string,
  field: Fields[number],
  existingDataType: string,
  alter: string
): readonly string[] => {
  if (!isTranslatableToggle(field, existingDataType)) return [alter]
  const column = `ALTER TABLE ${relation} ALTER COLUMN ${quoteSqlIdentifier(field.name)}`
  const indexDrops = declaresTranslatable(field)
    ? []
    : recordLanguagesOf(field).flatMap((code) => [
        `DROP INDEX IF EXISTS ${languageIndexName(relation, field.name, code)}`,
        `DROP INDEX IF EXISTS ${languageUniqueIndexName(relation, field.name, code)}`,
      ])
  const restored = toggledDefaultExpression(field)
  return [
    ...indexDrops,
    `${column} DROP DEFAULT`,
    alter,
    ...(restored === undefined ? [] : [`${column} SET DEFAULT ${restored}`]),
  ]
}
