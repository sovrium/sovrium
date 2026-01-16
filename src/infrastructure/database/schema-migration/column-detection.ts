/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { shouldCreateDatabaseColumn } from '../field-utils'
import { generateColumnDefinition, isFieldNotNull } from '../sql-generators'
import {
  normalizeDataType,
  doesColumnTypeMatch,
  generateAlterColumnTypeStatement,
} from './type-utils'
import type { Table } from '@/domain/models/app/table'
import type { Fields } from '@/domain/models/app/table/fields'

/** Column info from database */
export type ExistingColumnInfo = {
  dataType: string
  isNullable: string
  columnDefault: string | null
}

/**
 * Check if id column needs to be recreated due to type mismatch
 */
export const needsIdColumnRecreation = (
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  shouldProtectIdColumn: boolean
): boolean => {
  if (!shouldProtectIdColumn) return false
  if (!existingColumns.has('id')) return false

  const idType = normalizeDataType(existingColumns.get('id')!.dataType)
  return idType !== 'integer' && idType !== 'serial'
}

/**
 * Find columns that should be added to the table
 * Excludes columns that exist but have type mismatches (those will be altered, not dropped/added)
 */
export const findColumnsToAdd = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  renamedNewNames: ReadonlySet<string>
): readonly Fields[number][] =>
  table.fields.filter((field) => {
    if (!shouldCreateDatabaseColumn(field)) return false // Skip UI-only fields
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

    // Never drop intrinsic special fields (APP-TABLES-SPECIAL-FIELDS-007)
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
    // Skip UI-only fields, renamed fields, and fields not in database
    if (!shouldCreateDatabaseColumn(field)) return false
    if (renamedNewNames.has(field.name)) return false
    if (!existingColumns.has(field.name)) return false
    return true
  })

/**
 * Find columns that need type changes
 * Returns ALTER COLUMN TYPE statements for type mismatches
 */
export const findTypeChanges = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  renamedNewNames: ReadonlySet<string>
): readonly string[] =>
  filterModifiableFields(table.fields, existingColumns, renamedNewNames).flatMap((field) => {
    const existing = existingColumns.get(field.name)!
    if (doesColumnTypeMatch(field, existing.dataType)) return []

    // Type mismatch detected - generate ALTER COLUMN TYPE statement
    return [generateAlterColumnTypeStatement(table.name, field, existing.dataType)]
  })

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
    WHERE ${fieldName} IS NULL;

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
  const columnDef = generateColumnDefinition(field, false, table.fields)
  // Extract DEFAULT clause from column definition
  // Handle quoted strings (DEFAULT 'value'), unquoted values (DEFAULT 42), and functions (DEFAULT NOW())
  const defaultMatch = columnDef.match(/DEFAULT\s+('(?:[^']|'')*'|[^\s]+)/)
  if (!defaultMatch) {
    // This shouldn't happen if hasDefault is true, but handle gracefully
    return ''
  }

  const defaultClause = defaultMatch[1]
  return `UPDATE ${table.name} SET ${field.name} = ${defaultClause} WHERE ${field.name} IS NULL`
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
          `ALTER TABLE ${table.name} ALTER COLUMN ${field.name} SET NOT NULL`,
        ]
      }

      // If no default value, validate that existing data doesn't contain NULL
      // This prevents migration from failing with PostgreSQL's "column contains null values" error
      return [
        generateNotNullValidationQuery(table.name, field.name),
        `ALTER TABLE ${table.name} ALTER COLUMN ${field.name} SET NOT NULL`,
      ]
    }
    if (!shouldBeNotNull && currentlyNotNull && !isPrimaryKey) {
      // Only DROP NOT NULL if it's not a primary key or auto-managed field
      return [`ALTER TABLE ${table.name} ALTER COLUMN ${field.name} DROP NOT NULL`]
    }
    return []
  })

/**
 * Find columns that need default value changes
 * Returns ALTER COLUMN statements for SET DEFAULT or DROP DEFAULT
 */
export const findDefaultValueChanges = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  renamedNewNames: ReadonlySet<string>,
  previousSchema?: { readonly tables: readonly object[] }
): readonly string[] => {
  // Find previous table definition to compare default values
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
      return [`ALTER TABLE ${table.name} ALTER COLUMN ${field.name} DROP DEFAULT`]
    }

    // Case 2: Default added or modified (generate SET DEFAULT statement)
    if (currentDefault !== undefined) {
      const columnDef = generateColumnDefinition(field, false, table.fields)
      // Extract DEFAULT clause from column definition
      // Handle quoted strings (DEFAULT 'value'), unquoted values (DEFAULT 42), and functions (DEFAULT NOW())
      const defaultMatch = columnDef.match(/DEFAULT\s+('(?:[^']|'')*'|[^\s]+)/)
      if (defaultMatch) {
        const defaultClause = defaultMatch[1]
        return [`ALTER TABLE ${table.name} ALTER COLUMN ${field.name} SET DEFAULT ${defaultClause}`]
      }
    }

    return []
  })
}

/**
 * Build drop/add column statements from the computed columns to modify
 */
export const buildColumnStatements = (options: {
  readonly tableName: string
  readonly columnsToDrop: readonly string[]
  readonly columnsToAdd: readonly Fields[number][]
  readonly primaryKeyFields: readonly string[]
  readonly allFields: readonly Fields[number][]
}): { readonly dropStatements: readonly string[]; readonly addStatements: readonly string[] } => {
  const { tableName, columnsToDrop, columnsToAdd, primaryKeyFields, allFields } = options
  const dropStatements = columnsToDrop.map(
    (columnName) => `ALTER TABLE ${tableName} DROP COLUMN ${columnName} CASCADE`
  )
  const addStatements = columnsToAdd.map((field) => {
    const isPrimaryKey = primaryKeyFields.includes(field.name)
    const columnDef = generateColumnDefinition(field, isPrimaryKey, allFields)
    return `ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`
  })
  return { dropStatements, addStatements }
}
