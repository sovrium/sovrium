/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { translateFormula } from '../formula/formula-translation'
import {
  castFormulaDivisionOperands,
  isFormulaVolatile,
  getFormulaFieldsNeedingTrigger,
  isFormulaReturningArray,
  isViewComputedFormula,
} from '../formula/formula-utils'
import { resolvePrimaryKeyColumnType } from '../table-operations/column-generators'
import { SQLITE_ISO_NOW } from './dialect-ddl'
import { isAutoTimestampField, isFieldNotNull, shouldUseSerial } from './sql-field-predicates'
import { mapFieldTypeToDialect, mapFormulaResultTypeToDialect } from './sql-type-mappings'
import { escapeSqlString } from './sql-utils'
import type { Fields } from '@/domain/models/app/tables/fields'

/**
 * Format default value for SQL
 * Numbers and booleans are unquoted, strings are quoted and escaped
 */
const formatDefaultValue = (defaultValue: unknown): string => {
  if (typeof defaultValue === 'boolean') {
    return String(defaultValue)
  }
  if (typeof defaultValue === 'number') {
    return String(defaultValue)
  }
  return `'${escapeSqlString(String(defaultValue))}'`
}

/**
 * Generate auto-increment column definition.
 *
 * PostgreSQL uses `SERIAL`. SQLite has no `SERIAL`: an auto-incrementing
 * integer key is `INTEGER PRIMARY KEY AUTOINCREMENT`, and a non-primary-key
 * auto-increment field degrades to a plain `INTEGER` (SQLite cannot
 * auto-increment a non-rowid column).
 */
const generateSerialColumn = (fieldName: string, isPrimaryKey: boolean = false): string => {
  if (isSqliteRuntime()) {
    return isPrimaryKey
      ? `${fieldName} INTEGER PRIMARY KEY AUTOINCREMENT`
      : `${fieldName} INTEGER NOT NULL`
  }
  return isPrimaryKey ? `${fieldName} SERIAL PRIMARY KEY` : `${fieldName} SERIAL NOT NULL`
}

/**
 * Generate NOT NULL constraint
 */
const generateNotNullConstraint = (
  field: Fields[number],
  isPrimaryKey: boolean,
  hasAuthConfig: boolean = true
): string => {
  return isFieldNotNull(field, isPrimaryKey, hasAuthConfig) ? ' NOT NULL' : ''
}

/**
 * Format an array default value.
 *
 * PostgreSQL uses a native `ARRAY[...]` literal. SQLite stores array columns
 * as JSON text, so the default is a single-quoted JSON-array string literal.
 */
const formatArrayDefault = (defaultValue: readonly unknown[]): string => {
  if (isSqliteRuntime()) {
    // @effect-diagnostics effect/preferSchemaOverJson:off
    return ` DEFAULT '${escapeSqlString(JSON.stringify(defaultValue))}'`
  }
  const arrayValues = defaultValue.map((val) => `'${escapeSqlString(String(val))}'`).join(', ')
  return ` DEFAULT ARRAY[${arrayValues}]`
}

/**
 * Format special default values (date/time functions, INTERVAL, arrays).
 *
 * SQLite differences:
 *   - `CURRENT_DATE` works on SQLite unchanged.
 *   - `NOW()` is Postgres-only — SQLite's equivalent is `CURRENT_TIMESTAMP`.
 *   - Duration fields store a count of seconds as an `INTEGER`, so the default
 *     is the raw number (no `INTERVAL` literal).
 */
const formatSpecialDefault = (field: Fields[number], defaultValue: unknown): string | undefined => {
  // CURRENT_DATE is portable across both dialects.
  if (typeof defaultValue === 'string' && defaultValue.toUpperCase() === 'CURRENT_DATE') {
    return ' DEFAULT CURRENT_DATE'
  }
  // NOW() — Postgres function; SQLite's CURRENT_TIMESTAMP yields a non-ISO
  // "YYYY-MM-DD HH:MM:SS" string that fails the ISO-8601 response validator, so
  // SQLite uses the ISO-emitting strftime form (SQLITE_ISO_NOW) instead.
  if (typeof defaultValue === 'string' && defaultValue.toUpperCase() === 'NOW()') {
    return isSqliteRuntime() ? ` DEFAULT (${SQLITE_ISO_NOW})` : ' DEFAULT NOW()'
  }
  // Duration fields: Postgres uses INTERVAL; SQLite stores seconds as INTEGER.
  if (field.type === 'duration' && typeof defaultValue === 'number') {
    return isSqliteRuntime()
      ? ` DEFAULT ${defaultValue}`
      : ` DEFAULT INTERVAL '${defaultValue} seconds'`
  }
  // Array fields (multi-select): native array literal vs JSON text.
  if (Array.isArray(defaultValue)) {
    return formatArrayDefault(defaultValue)
  }
  return undefined
}

/**
 * Auto-timestamp column DEFAULT clause.
 *
 * Postgres `CURRENT_TIMESTAMP` → timestamptz (driver serialises to ISO). SQLite
 * `CURRENT_TIMESTAMP` → bare "YYYY-MM-DD HH:MM:SS" TEXT (no T/Z/ms), which fails
 * the records-API ISO-8601 response validator, so SQLite uses the ISO-emitting
 * strftime form (mirrors `timestampDefaultClause()` for system columns).
 */
const autoTimestampDefaultClause = (): string =>
  isSqliteRuntime() ? ` DEFAULT (${SQLITE_ISO_NOW})` : ' DEFAULT CURRENT_TIMESTAMP'

/**
 * Generate DEFAULT clause
 */
const generateDefaultClause = (field: Fields[number]): string => {
  // Auto-timestamp fields (created-at, created-time, last-modified-time, …).
  if (isAutoTimestampField(field)) {
    return autoTimestampDefaultClause()
  }

  // Progress fields with required=true get DEFAULT 0 automatically
  if (field.type === 'progress' && field.required === true && !('default' in field)) {
    return ' DEFAULT 0'
  }

  // AI tag fields default to an empty JSON array (populated by AI computation
  // on insert/update). Postgres needs the `::jsonb` cast; SQLite stores JSON
  // as plain text so the bare string literal suffices.
  if (field.type === 'ai-tag') {
    return isSqliteRuntime() ? " DEFAULT '[]'" : " DEFAULT '[]'::jsonb"
  }

  // Explicit default values
  if ('default' in field && field.default !== undefined) {
    const defaultValue = field.default
    const specialDefault = formatSpecialDefault(field, defaultValue)
    if (specialDefault) {
      return specialDefault
    }
    return ` DEFAULT ${formatDefaultValue(defaultValue)}`
  }

  return ''
}

/**
 * The DB-side DEFAULT *expression* for a field's base column (the text after
 * `DEFAULT `), or `undefined` when the column carries no default.
 *
 * [internal ref]: a view-backed table's `INSTEAD OF INSERT` trigger inserts base
 * columns straight from the `NEW` row, so an omitted DEFAULT-bearing base
 * column (e.g. a `created-at` field) arrives as NULL instead of picking up the
 * base column's default. The trigger generator uses this expression to emit
 * `COALESCE(NEW.col, <default>)` so the default fires on omission while an
 * explicitly supplied value is still honoured. Reusing `generateDefaultClause`
 * keeps the COALESCE fallback byte-identical to the base column's own DEFAULT.
 */
export const getColumnDefaultExpression = (field: Fields[number]): string | undefined => {
  const clause = generateDefaultClause(field)
  return clause === '' ? undefined : clause.replace(/^ DEFAULT /, '')
}

/**
 * Generate formula column definition (GENERATED ALWAYS AS or trigger-based)
 *
 * NOTE: Formula fields with volatile functions (CURRENT_DATE, NOW(), etc.) cannot use
 * GENERATED ALWAYS AS because PostgreSQL requires generated columns to be immutable.
 * For volatile formulas, we create regular columns and handle computation via triggers.
 */
/**
 * Whether a formula must be emitted as a PLAIN column (no GENERATED ALWAYS AS,
 * no dialect translation) rather than a base-table computed column:
 *   - View-computed formula (references rollup/lookup/count) — computed in the
 *     VIEW, never a base-table column. Defensive guard: normally filtered out
 *     before reaching here, but a direct caller might pass one.
 */
const formulaEmitsPlainColumn = (
  field: Fields[number] & { readonly type: 'formula'; readonly formula: string },
  allFields?: readonly Fields[number][]
): boolean => (allFields ? isViewComputedFormula(field, allFields) : false)

/**
 * Storage class for a base-table generated column.
 *
 * PostgreSQL only implements `STORED`. SQLite implements both, but rejects
 * `ALTER TABLE … ADD COLUMN … STORED` ("cannot add a STORED column") while
 * accepting the same statement with `VIRTUAL`. `VIRTUAL` is therefore the only
 * spelling valid on BOTH the CREATE TABLE and the schema-evolution path, so a
 * formula added to an existing table keeps computing.
 */
const generatedColumnStorage = (): string => (isSqliteRuntime() ? 'VIRTUAL' : 'STORED')

const generateFormulaColumn = (
  field: Fields[number] & { readonly type: 'formula'; readonly formula: string },
  allFields?: readonly Fields[number][]
): string => {
  const baseResultType =
    'resultType' in field && field.resultType
      ? mapFormulaResultTypeToDialect(field.resultType)
      : 'TEXT'

  if (formulaEmitsPlainColumn(field, allFields)) {
    return `${field.name} ${baseResultType}`
  }

  // Auto-detect array return type for functions like STRING_TO_ARRAY
  // If formula returns an array but resultType doesn't specify array, append []
  const resultType =
    isFormulaReturningArray(field.formula) && !baseResultType.endsWith('[]')
      ? `${baseResultType}[]`
      : baseResultType

  // Translate formula to the active dialect's syntax with field type context.
  // Note: the Postgres arm handles ROUND with double precision by casting to NUMERIC
  // and converts date::TEXT to TO_CHAR(date, 'format') which is STABLE (not IMMUTABLE).
  // The SQLite arm raises at DDL time for functions that engine does not provide.
  const translatedFormula = translateFormula(field.formula, allFields)

  // Volatile formulas (contain CURRENT_DATE, NOW(), etc.) need trigger-based computation
  // because PostgreSQL GENERATED columns must be immutable
  // Check volatility on TRANSLATED formula since date::TEXT becomes TO_CHAR (STABLE)
  // Also check if formula is part of a formula-to-formula dependency chain - PostgreSQL
  // GENERATED columns cannot reference other generated columns
  const triggerFields = allFields ? getFormulaFieldsNeedingTrigger(allFields) : new Set<string>()
  if (isFormulaVolatile(translatedFormula) || triggerFields.has(field.name)) {
    // Create regular column - trigger will populate it
    return `${field.name} ${resultType}`
  }

  // Immutable formulas can use GENERATED ALWAYS AS. Cast numeric `/` division
  // operands to a numeric type so integer-by-integer division does not truncate
  // (`heures + minutes / 60` over INTEGER columns → 2.5, not 2) —
  // [internal ref]. Only division operands are cast, so
  // integer-arg functions (REPEAT/CHR) and EXTRACT keywords are unaffected.
  const castFormula = allFields
    ? castFormulaDivisionOperands(translatedFormula, allFields)
    : translatedFormula
  return `${field.name} ${resultType} GENERATED ALWAYS AS (${castFormula}) ${generatedColumnStorage()}`
}

/**
 * Resolve the column type for a `relationship` field.
 *
 * A `many-to-one` relationship field's column is a foreign key onto the related
 * table's primary key (`id`). The column type MUST match that referenced PK
 * type, NOT the hardcoded `INTEGER` from the field-type map — otherwise Postgres
 * rejects the FK with "incompatible types: integer and text" when the parent
 * table has a TEXT/UUID id (explicit `primaryKey: { type: 'text' }` or implicit
 * via `auth.scopeTables`). `tablePrimaryKeyTypes` maps a table name to its
 * `primaryKey.type` (undefined ⇒ default serial / INTEGER).
 *
 * Falls back to the standard field-type mapping when no map entry exists (e.g.
 * the related table is unknown), preserving the historical INTEGER default for
 * default-serial parents.
 */
const resolveRelationshipColumnType = (
  field: Fields[number] & { readonly type: 'relationship'; readonly relatedTable: string },
  tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined> | undefined
): string => {
  if (tablePrimaryKeyTypes?.has(field.relatedTable)) {
    return resolvePrimaryKeyColumnType(tablePrimaryKeyTypes.get(field.relatedTable))
  }
  return mapFieldTypeToDialect(field)
}

/**
 * Generate column definition with constraints
 *
 * NOTE: UNIQUE constraints are NOT generated inline. Named UNIQUE constraints
 * are generated at the table level via generateUniqueConstraints() to ensure
 * they appear in information_schema.table_constraints with queryable constraint names.
 *
 * @param tablePrimaryKeyTypes - Map of table name → `primaryKey.type`. Used to
 *   resolve a `relationship` field's FK column type to match the referenced
 *   table's primary-key type (TEXT/UUID/BIGINT/INTEGER) instead of a hardcoded
 *   INTEGER. Omitting it preserves the legacy INTEGER default.
 */
/* eslint-disable max-params -- extends an existing positional DDL-generator API; bundling into an options object would churn ~10 call sites */
export const generateColumnDefinition = (
  field: Fields[number],
  isPrimaryKey: boolean,
  allFields?: readonly Fields[number][],
  hasAuthConfig: boolean = true,
  tablePrimaryKeyTypes?: ReadonlyMap<string, string | undefined>
): string => {
  /* eslint-enable max-params */
  // SERIAL columns for auto-increment fields
  if (shouldUseSerial(field, isPrimaryKey)) {
    return generateSerialColumn(field.name, isPrimaryKey)
  }

  // Formula fields: check if formula is volatile
  if (field.type === 'formula' && 'formula' in field && field.formula) {
    return generateFormulaColumn(field, allFields)
  }

  // Relationship fields: FK column type must match the referenced table's PK type.
  const columnType =
    field.type === 'relationship' && 'relatedTable' in field && field.relatedTable
      ? resolveRelationshipColumnType(field, tablePrimaryKeyTypes)
      : mapFieldTypeToDialect(field)
  const notNull = generateNotNullConstraint(field, isPrimaryKey, hasAuthConfig)
  const defaultValue = generateDefaultClause(field)
  return `${field.name} ${columnType}${notNull}${defaultValue}`
}
