/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { isPhysicalColumnField, shouldCreateDatabaseColumn } from '../sql/sql-field-predicates'
import { generateColumnDefinition, isFieldNotNull } from '../sql/sql-generators'
import { isTranslatableToggle, withTranslatableToggle } from '../sql/sql-translatable-columns'
import { resolvePrimaryKeyColumnType } from '../table-operations/column-generators'
import {
  normalizeDataType,
  doesColumnTypeMatch,
  generateAlterColumnTypeStatement,
  isGatedTimestamptzConversion,
} from './type-utils'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

/**
 * The DEFAULT expression of `field`'s column as a per-column reshape writes it,
 * or `undefined`. Reshapes run on PostgreSQL only (`generateColumnReshapeStatements`
 * returns none on SQLite, which rebuilds the table instead). Handles a quoted
 * string (`'value'`), an unquoted value (`42`) and a function (`NOW()`).
 */
const reshapeDefaultExpression = (table: Table, field: Fields[number]): string | undefined =>
  generateColumnDefinition(field, { dialect: 'postgres', allFields: table.fields }).match(
    /DEFAULT\s+('(?:[^']|'')*'|[^\s]+)/
  )?.[1]

/** Column info from database */
export type ExistingColumnInfo = {
  dataType: string
  isNullable: string
  columnDefault: string | null
}

/**
 * Canonical form of a primary-key column type, additionally collapsing each
 * sequence-backed spelling onto the plain integer type it stores.
 *
 * `SERIAL` / `BIGSERIAL` are DDL shorthands for an INTEGER / BIGINT column plus
 * a sequence default; `information_schema` reports the underlying `integer` /
 * `bigint`. Collapsing them keeps the declared side (which speaks the shorthand)
 * comparable with the live side (which does not).
 */
const normalizePrimaryKeyType = (dataType: string): string => {
  const normalized = normalizeDataType(dataType)
  if (normalized === 'serial') return 'integer'
  if (normalized === 'bigserial') return 'bigint'
  return normalized
}

/**
 * Whether the protected automatic `id` column disagrees with the primary-key
 * type the config DECLARES, and so must be rebuilt.
 *
 * The declared type is the reference, not a hardcoded integer: a table declaring
 * `primaryKey: { type: 'text' }` (or granted a TEXT id through `auth.scopeTables`)
 * keeps its TEXT id instead of being recreated on every migrating boot.
 *
 * @param declaredPrimaryKeyType - the table's `primaryKey.type` (`undefined` ⇒
 *   the default serial id). Resolved through the same
 *   {@link resolvePrimaryKeyColumnType} the DDL generator uses, so the two can
 *   never drift apart.
 * @param dialect - the engine of the live table
 */
export const needsIdColumnRecreation = (
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  shouldProtectIdColumn: boolean,
  declaredPrimaryKeyType: string | undefined,
  dialect: DatabaseDialect
): boolean => {
  if (!shouldProtectIdColumn) return false
  if (!existingColumns.has('id')) return false

  const liveType = normalizePrimaryKeyType(existingColumns.get('id')!.dataType)
  const declaredType = normalizePrimaryKeyType(
    resolvePrimaryKeyColumnType(declaredPrimaryKeyType, dialect)
  )
  return liveType !== declaredType
}

/**
 * Find columns that should be added to the table (an existing column whose type
 * mismatches is altered, not added)
 * Only STORED fields qualify ({@link isPhysicalColumnField}): a lookup, rollup
 * or view-computed formula is produced by the view body, so it is never missing
 * from the base table no matter what the live column list says.
 */
export const findColumnsToAdd = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  renamedNewNames: ReadonlySet<string>
): readonly Fields[number][] =>
  table.fields.filter((field) => {
    if (!isPhysicalColumnField(field, table.fields)) return false // UI-only or view-computed
    if (renamedNewNames.has(field.name)) return false // Skip renamed fields
    if (!existingColumns.has(field.name)) return true // New column (needs ADD COLUMN)
    // Existing columns with type mismatches will be handled by ALTER COLUMN TYPE
    return false
  })

/**
 * Find columns that should be dropped from the table
 * Excludes columns with type mismatches (those will be altered, not dropped)
 */
export const findColumnsToDrop = (
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  schemaFieldsByName: ReadonlyMap<string, Fields[number]>,
  shouldProtectIdColumn: boolean,
  renamedOldNames: ReadonlySet<string>
): readonly string[] =>
  Array.from(existingColumns.keys()).filter((columnName) => {
    // Never drop protected id column (it's already the correct type at this point)
    if (shouldProtectIdColumn && columnName === 'id') return false

    // Never drop intrinsic special fields
    // These are automatic timestamp columns managed by triggers
    if (columnName === 'created_at') return false
    if (columnName === 'updated_at') return false
    if (columnName === 'deleted_at') return false

    // Don't drop if it's being renamed
    if (renamedOldNames.has(columnName)) return false

    // Drop if not in schema (but only if it's not a UI-only field)
    if (!schemaFieldsByName.has(columnName)) return true

    const field = schemaFieldsByName.get(columnName)!

    // If this is a UI-only field that shouldn't have a column, drop it
    if (!shouldCreateDatabaseColumn(field)) return true

    // Existing columns with type mismatches will be handled by ALTER COLUMN TYPE (not dropped)
    return false
  })

/**
 * Filter fields that should be checked for schema modifications
 * Excludes UI-only fields, renamed fields, and fields not in the database
 */
export const filterModifiableFields = (
  fields: readonly Fields[number][],
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  renamedNewNames: ReadonlySet<string>
): readonly Fields[number][] =>
  fields.filter((field) => {
    // Skip UI-only and view-computed fields (lookup, rollup, formulas over
    // them), renamed fields, and fields not in database
    if (!isPhysicalColumnField(field, fields)) return false
    if (renamedNewNames.has(field.name)) return false
    if (!existingColumns.has(field.name)) return false
    return true
  })

/** The live columns as they stand once each `old → new` field rename has run. */
export const columnsAfterRenames = (
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  fieldRenames: ReadonlyMap<string, string>
): ReadonlyMap<string, ExistingColumnInfo> =>
  new Map([...existingColumns].map(([name, info]) => [fieldRenames.get(name) ?? name, info]))

/**
 * ALTER COLUMN TYPE statements for type mismatches, each inside a translatable
 * toggle's steps. A renamed field is compared with its column as the rename leaves
 * it, and converted only when the same edit turns `translatable` on or off. Not
 * reported: the `timestamp → timestamptz` reshape of a declared `created-at` /
 * `updated-at` / `deleted-at` column, which rewrites the table under an `ACCESS
 * EXCLUSIVE` lock and preserves instants only under a server `TimeZone` no config
 * can establish; the boot-time reconciler owns it.
 */
export const findTypeChanges = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  fieldRenames: ReadonlyMap<string, string>,
  tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>
): readonly string[] => {
  const columns = columnsAfterRenames(existingColumns, fieldRenames)
  const renamed = new Set(fieldRenames.values())
  return filterModifiableFields(table.fields, columns, new Set()).flatMap((field) => {
    const existing = columns.get(field.name)!
    if (doesColumnTypeMatch(field, existing.dataType, tablePrimaryKeyTypes)) return []
    if (isGatedTimestamptzConversion(field, existing.dataType)) return []
    if (renamed.has(field.name) && !isTranslatableToggle(field, existing.dataType)) return []
    return withTranslatableToggle(
      table.name,
      field,
      existing.dataType,
      generateAlterColumnTypeStatement(table.name, field, existing.dataType, tablePrimaryKeyTypes)
    )
  })
}

/**
 * Generate validation query to check if existing data contains NULL values
 * Returns validation query that will throw error if NULL values exist
 */
export const generateNotNullValidationQuery = (tableName: string, fieldName: string): string => `
  DO $$
  DECLARE
    null_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO null_count
    FROM ${tableName}
    WHERE ${quoteSqlIdentifier(fieldName)} IS NULL;

    IF null_count > 0 THEN
      RAISE EXCEPTION 'Migration failed: cannot add NOT NULL constraint to column "${fieldName}" in table "${tableName}" because % existing row(s) contain null values. Either provide a default value or update existing rows first.', null_count;
    END IF;
  END$$;
`

/**
 * Generate backfill query to update NULL values with the default
 * Returns UPDATE statement that sets NULL values to the default value
 */
export const generateBackfillQuery = (table: Table, field: Fields[number]): string => {
  const defaultClause = reshapeDefaultExpression(table, field)
  // This shouldn't happen if hasDefault is true, but handle gracefully
  if (defaultClause === undefined) return ''
  return `UPDATE ${table.name} SET ${quoteSqlIdentifier(field.name)} = ${defaultClause} WHERE ${quoteSqlIdentifier(field.name)} IS NULL`
}

/**
 * Find columns that need nullability changes
 * Returns ALTER COLUMN statements for SET NOT NULL / DROP NOT NULL
 * CRITICAL: Validates existing data before applying NOT NULL constraint
 * Migration will FAIL if any existing data contains NULL values without a default
 *
 * When a default value is provided:
 * 1. Set the default value on the column (handled by findDefaultValueChanges)
 * 2. Backfill existing NULL values with the default
 * 3. Then set NOT NULL
 */
export const findNullabilityChanges = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  renamedNewNames: ReadonlySet<string>,
  primaryKeyFields: readonly string[]
): readonly string[] =>
  filterModifiableFields(table.fields, existingColumns, renamedNewNames).flatMap((field) => {
    const existing = existingColumns.get(field.name)!
    const isPrimaryKey = primaryKeyFields.includes(field.name)
    const shouldBeNotNull = isFieldNotNull(field, isPrimaryKey)
    const currentlyNotNull = existing.isNullable === 'NO'

    // If nullability differs, generate ALTER COLUMN statement
    if (shouldBeNotNull && !currentlyNotNull) {
      // Check if field has a default value
      const hasDefault = 'default' in field && field.default !== undefined

      if (hasDefault) {
        // If has default: backfill NULL values, then set NOT NULL
        const backfillQuery = generateBackfillQuery(table, field)
        return [
          ...(backfillQuery ? [backfillQuery] : []),
          `ALTER TABLE ${table.name} ALTER COLUMN ${quoteSqlIdentifier(field.name)} SET NOT NULL`,
        ]
      }

      // If no default value, validate that existing data doesn't contain NULL
      // This prevents migration from failing with PostgreSQL's "column contains null values" error
      return [
        generateNotNullValidationQuery(table.name, field.name),
        `ALTER TABLE ${table.name} ALTER COLUMN ${quoteSqlIdentifier(field.name)} SET NOT NULL`,
      ]
    }
    if (!shouldBeNotNull && currentlyNotNull && !isPrimaryKey) {
      // Only DROP NOT NULL if it's not a primary key or auto-managed field
      return [
        `ALTER TABLE ${table.name} ALTER COLUMN ${quoteSqlIdentifier(field.name)} DROP NOT NULL`,
      ]
    }
    return []
  })

/**
 * Find columns that need default value changes
 * Returns ALTER COLUMN statements for SET DEFAULT or DROP DEFAULT
 *
 * @param context.physicalTableName - the relation the statements ALTER
 *   (`<name>_base` for a view-backed table); defaults to the config name.
 */
export const findDefaultValueChanges = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  renamedNewNames: ReadonlySet<string>,
  context: {
    readonly previousSchema?: { readonly tables: readonly object[] }
    readonly physicalTableName?: string
  } = {}
): readonly string[] => {
  const { previousSchema } = context
  const physicalTableName = context.physicalTableName ?? table.name
  // Find previous table definition to compare default values. Keyed by the
  // CONFIG name: the snapshot stores config tables, never `<name>_base`.
  const previousTable = previousSchema?.tables.find(
    (t: object) => 'name' in t && t.name === table.name
  ) as
    | {
        name: string
        fields?: readonly { id?: number; name?: string; default?: unknown }[]
      }
    | undefined

  const previousFieldsByName = new Map(
    previousTable?.fields?.filter((f) => f.name !== undefined).map((f) => [f.name!, f.default]) ??
      []
  )

  return filterModifiableFields(table.fields, existingColumns, renamedNewNames).flatMap((field) => {
    const currentDefault = 'default' in field ? field.default : undefined
    const previousDefault = previousFieldsByName.get(field.name)

    // Only generate ALTER statements if default value changed
    if (currentDefault === previousDefault) return []

    // Case 1: Default removed (was set, now undefined)
    if (previousDefault !== undefined && currentDefault === undefined) {
      return [
        `ALTER TABLE ${physicalTableName} ALTER COLUMN ${quoteSqlIdentifier(field.name)} DROP DEFAULT`,
      ]
    }

    // Case 2: Default added or modified (generate SET DEFAULT statement)
    if (currentDefault !== undefined) {
      const defaultClause = reshapeDefaultExpression(table, field)
      if (defaultClause !== undefined) {
        return [
          `ALTER TABLE ${physicalTableName} ALTER COLUMN ${quoteSqlIdentifier(field.name)} SET DEFAULT ${defaultClause}`,
        ]
      }
    }

    return []
  })
}

/**
 * One `DROP COLUMN` the migration plans, with the statement rendered for it, so a
 * caller that may withhold a drop (`planSqliteDrops`) knows which statement drops
 * which column without re-rendering and string-matching it.
 */
export interface ColumnDrop {
  readonly column: string
  readonly statement: string
}

/**
 * Build drop/add column statements from the computed columns to modify
 *
 * `tablePrimaryKeyTypes` is REQUIRED for the same reason it is on
 * `generateCreateTableSQL`: this is the generator behind `ADD COLUMN`, and an
 * omitted map silently sizes a `relationship` foreign key as INTEGER, which the
 * follow-on constraint sync then cannot build against a TEXT/UUID parent key.
 */
export const buildColumnStatements = (options: {
  readonly dialect: DatabaseDialect
  readonly tableName: string
  readonly columnsToDrop: readonly string[]
  readonly columnsToAdd: readonly Fields[number][]
  readonly primaryKeyFields: readonly string[]
  readonly allFields: readonly Fields[number][]
  readonly tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>
  readonly hasAuthConfig?: boolean
}): {
  readonly drops: readonly ColumnDrop[]
  readonly dropStatements: readonly string[]
  readonly addStatements: readonly string[]
} => {
  const { dialect, tableName, columnsToDrop, columnsToAdd, primaryKeyFields } = options
  // `CASCADE` is PostgreSQL-only. SQLite (3.35+) drops without it and refuses a
  // column a key, an index, a constraint, a trigger or a view still names; the
  // migration rebuilds the table for those instead.
  const cascade = dialect === 'sqlite' ? '' : ' CASCADE'
  const drops = columnsToDrop.map((column): ColumnDrop => ({
    column,
    statement: `ALTER TABLE ${tableName} DROP COLUMN ${quoteSqlIdentifier(column)}${cascade}`,
  }))
  const addStatements = columnsToAdd.map((field) => {
    const isPrimaryKey = primaryKeyFields.includes(field.name)
    // The context is the options themselves: engine, fields, auth flag and key types.
    const columnDef = generateColumnDefinition(field, { ...options, isPrimaryKey })
    return `ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`
  })
  return { drops, dropStatements: drops.map((drop) => drop.statement), addStatements }
}
