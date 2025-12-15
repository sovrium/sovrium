/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { shouldCreateDatabaseColumn } from './field-utils'
import {
  getExistingTableNames,
  executeSQLStatements,
  type TransactionLike,
  type SQLExecutionError,
} from './sql-execution'
import { mapFieldTypeToPostgres, generateColumnDefinition } from './sql-generators'
import type { Table } from '@/domain/models/app/table'
import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Type definition for Bun SQL transaction
 * Re-exported from sql-execution.ts for backward compatibility
 */
export type BunSQLTransaction = TransactionLike

/**
 * System tables that should never be dropped
 * These tables are managed by Better Auth/Drizzle migrations or migration system, not by runtime schema
 */
const PROTECTED_SYSTEM_TABLES = new Set([
  // Better Auth tables
  'users',
  'sessions',
  'accounts',
  'verifications',
  'organizations',
  'members',
  'invitations',
  // Migration system tables
  '_sovrium_migration_history',
  '_sovrium_migration_log',
  '_sovrium_schema_checksum',
])

/**
 * Drop tables that exist in database but are not defined in schema
 *
 * SECURITY NOTE: Table names are validated before reaching this function.
 * This is SAFE because:
 * 1. existingTableNames comes from pg_tables system catalog (trusted source)
 * 2. schemaTableNames comes from validated Effect Schema objects
 * 3. Only tables not in schema are dropped (explicit comparison)
 * 4. Better Auth system tables are protected and never dropped
 */
export const dropObsoleteTables = (
  tx: BunSQLTransaction,
  tables: readonly Table[]
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const existingTableNames = yield* getExistingTableNames(tx)
    const schemaTableNames = new Set(tables.map((table) => table.name))
    const tablesToDrop = existingTableNames.filter(
      (tableName) => !schemaTableNames.has(tableName) && !PROTECTED_SYSTEM_TABLES.has(tableName)
    )

    // Drop all obsolete tables sequentially
    const dropStatements = tablesToDrop.map((tableName) => `DROP TABLE ${tableName} CASCADE`)
    yield* executeSQLStatements(tx, dropStatements)
  })

/**
 * Normalize PostgreSQL data type for comparison
 * Maps similar types to a canonical form (e.g., 'varchar' and 'character varying' both map to 'varchar')
 * Strips length specifiers and precision for type matching
 */
const normalizeDataType = (dataType: string): string => {
  const normalized = dataType.toLowerCase().trim()

  // Map 'character varying' to 'varchar' for easier comparison
  if (normalized.startsWith('character varying')) return 'varchar'
  if (normalized.startsWith('timestamp')) return 'timestamp'
  if (normalized.startsWith('numeric') || normalized.startsWith('decimal')) return 'numeric'

  // Strip length specifiers for varchar, char, etc.
  // varchar(255) → varchar, char(10) → char, numeric(10,2) → numeric
  const withoutLength = normalized.replace(/\([^)]*\)/, '')

  return withoutLength
}

/**
 * Check if column data type matches the expected type from schema
 */
const doesColumnTypeMatch = (field: Fields[number], existingDataType: string): boolean => {
  const expectedType = mapFieldTypeToPostgres(field)
  const normalizedExpected = normalizeDataType(expectedType)
  const normalizedExisting = normalizeDataType(existingDataType)

  // For varchar/text types, check if both are string types
  if (
    (normalizedExpected === 'varchar' || normalizedExpected === 'text') &&
    (normalizedExisting === 'varchar' || normalizedExisting === 'text')
  ) {
    // Match if both are string types (varchar/text are interchangeable for our purposes)
    return normalizedExpected === normalizedExisting
  }

  // For other types, exact match required
  return normalizedExpected === normalizedExisting
}

/**
 * Detect field renames by comparing field IDs between previous and current schema
 * Returns a map of old field name to new field name for renamed fields
 */
export const detectFieldRenames = (
  tableName: string,
  currentFields: readonly Fields[number][],
  previousSchema?: { readonly tables: readonly object[] }
): ReadonlyMap<string, string> => {
  if (!previousSchema) return new Map()

  // Find previous table definition
  const previousTable = previousSchema.tables.find(
    (t: object) => 'name' in t && t.name === tableName
  ) as { name: string; fields?: readonly { id?: number; name?: string }[] } | undefined

  if (!previousTable || !previousTable.fields) return new Map()

  // Build map of field ID to field name for both schemas
  const previousFieldsById = new Map(
    previousTable.fields
      .filter((f) => f.id !== undefined && f.name !== undefined)
      .map((f) => [f.id!, f.name!])
  )

  const currentFieldsById = new Map(
    currentFields.filter((f) => f.id !== undefined).map((f) => [f.id, f.name])
  )

  // Detect renames: same ID, different name
  const renames = new Map<string, string>()
  currentFieldsById.forEach((newName, fieldId) => {
    const oldName = previousFieldsById.get(fieldId)
    if (oldName && oldName !== newName) {
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements
      renames.set(oldName, newName)
    }
  })

  return renames
}

/**
 * Check if auto-generated id column has wrong type (requires table recreation)
 */
const checkIdColumnType = (
  existingColumns: ReadonlyMap<string, { dataType: string; isNullable: string }>,
  shouldProtectIdColumn: boolean
): boolean => {
  const needsAutoId = shouldProtectIdColumn
  const hasIdColumn = existingColumns.has('id')
  return (
    hasIdColumn &&
    needsAutoId &&
    !(
      normalizeDataType(existingColumns.get('id')!.dataType) === 'integer' ||
      normalizeDataType(existingColumns.get('id')!.dataType) === 'serial'
    )
  )
}

/**
 * Determine which columns to add (new columns or type mismatches)
 */
const getColumnsToAdd = (
  table: Table,
  existingColumns: ReadonlyMap<string, { dataType: string; isNullable: string }>,
  renamedNewNames: ReadonlySet<string>
): readonly Fields[number][] =>
  table.fields.filter((field) => {
    if (!shouldCreateDatabaseColumn(field)) return false
    if (renamedNewNames.has(field.name)) return false
    if (!existingColumns.has(field.name)) return true
    const existing = existingColumns.get(field.name)!
    return !doesColumnTypeMatch(field, existing.dataType)
  })

/**
 * Determine which columns to drop (removed from schema or type mismatches)
 */
const getColumnsToDrop = (
  existingColumns: ReadonlyMap<string, { dataType: string; isNullable: string }>,
  schemaFieldsByName: ReadonlyMap<string, Fields[number]>,
  shouldProtectIdColumn: boolean,
  renamedOldNames: ReadonlySet<string>
): readonly string[] =>
  Array.from(existingColumns.keys()).filter((columnName) => {
    if (shouldProtectIdColumn && columnName === 'id') return false
    if (renamedOldNames.has(columnName)) return false
    if (!schemaFieldsByName.has(columnName)) return true

    const field = schemaFieldsByName.get(columnName)!
    if (!shouldCreateDatabaseColumn(field)) return true

    const existing = existingColumns.get(columnName)!
    return !doesColumnTypeMatch(field, existing.dataType)
  })

/**
 * Generate ALTER TABLE statements for schema changes (ADD/DROP/RENAME columns)
 */
export const generateAlterTableStatements = (
  table: Table,
  existingColumns: ReadonlyMap<string, { dataType: string; isNullable: string }>,
  previousSchema?: { readonly tables: readonly object[] }
): readonly string[] => {
  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []
  const hasIdField = table.fields.some((field) => field.name === 'id')
  const hasCustomPrimaryKey = table.primaryKey && primaryKeyFields.length > 0
  const shouldProtectIdColumn = !hasIdField && !hasCustomPrimaryKey
  const schemaFieldsByName = new Map(table.fields.map((field) => [field.name, field]))

  // Check for id column type mismatch (requires table recreation)
  if (checkIdColumnType(existingColumns, shouldProtectIdColumn)) {
    return []
  }

  // Detect field renames and generate RENAME statements
  const fieldRenames = detectFieldRenames(table.name, table.fields, previousSchema)
  const renameStatements = Array.from(fieldRenames.entries()).map(
    ([oldName, newName]) => `ALTER TABLE ${table.name} RENAME COLUMN ${oldName} TO ${newName}`
  )

  const renamedOldNames = new Set(fieldRenames.keys())
  const renamedNewNames = new Set(fieldRenames.values())

  // Determine columns to add and drop
  const columnsToAdd = getColumnsToAdd(table, existingColumns, renamedNewNames)
  const columnsToDrop = getColumnsToDrop(
    existingColumns,
    schemaFieldsByName,
    shouldProtectIdColumn,
    renamedOldNames
  )

  // Generate DROP and ADD statements
  const dropStatements = columnsToDrop.map(
    (columnName) => `ALTER TABLE ${table.name} DROP COLUMN ${columnName} CASCADE`
  )
  const addStatements = columnsToAdd.map((field) => {
    const isPrimaryKey = primaryKeyFields.includes(field.name)
    const columnDef = generateColumnDefinition(field, isPrimaryKey, table.fields)
    return `ALTER TABLE ${table.name} ADD COLUMN ${columnDef}`
  })

  return [...renameStatements, ...dropStatements, ...addStatements]
}

/**
 * Sync unique constraints for existing table
 * Adds named UNIQUE constraints for:
 * 1. Single-field constraints (fields with unique property)
 * 2. Composite unique constraints (table.uniqueConstraints)
 * Uses PostgreSQL default naming convention: {table}_{column}_key for single fields
 */
export const syncUniqueConstraints = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // Single-field unique constraints
    const uniqueFields = table.fields.filter((f) => 'unique' in f && f.unique).map((f) => f.name)

    // Build statements for single-field constraints
    const singleFieldStatements = uniqueFields.map((fieldName) => {
      const constraintName = `${table.name}_${fieldName}_key`
      return `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = '${table.name}'
              AND constraint_type = 'UNIQUE'
              AND constraint_name = '${constraintName}'
          ) THEN
            ALTER TABLE ${table.name} ADD CONSTRAINT ${constraintName} UNIQUE (${fieldName});
          END IF;
        END$$;
      `
    })

    // Build statements for composite constraints
    const compositeStatements =
      table.uniqueConstraints?.map((constraint) => {
        const fields = constraint.fields.join(', ')
        return `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints
              WHERE table_name = '${table.name}'
                AND constraint_type = 'UNIQUE'
                AND constraint_name = '${constraint.name}'
            ) THEN
              ALTER TABLE ${table.name} ADD CONSTRAINT ${constraint.name} UNIQUE (${fields});
            END IF;
          END$$;
        `
      }) ?? []

    // Execute all constraint statements
    yield* executeSQLStatements(tx, [...singleFieldStatements, ...compositeStatements])
  })

/**
 * Sync foreign key constraints for existing table
 * Drops and recreates FK constraints to ensure referential actions (ON DELETE, ON UPDATE) are up-to-date
 * This is needed when table schema is updated with new referential actions
 */
export const syncForeignKeyConstraints = (
  tx: TransactionLike,
  table: Table,
  tableUsesView?: ReadonlyMap<string, boolean>
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { generateForeignKeyConstraints } = yield* Effect.promise(
      () => import('./sql-generators')
    )
    const fkConstraints = generateForeignKeyConstraints(table.name, table.fields, tableUsesView)

    // Build drop and add statements for each FK constraint
    const statements = fkConstraints.flatMap((constraint) => {
      // Extract constraint name from the constraint SQL
      // Format: "CONSTRAINT {constraintName} FOREIGN KEY ..."
      const match = constraint.match(/CONSTRAINT\s+(\w+)\s+FOREIGN KEY/)
      if (!match) return []

      const constraintName = match[1]

      // Drop existing constraint if it exists
      const dropStatement = `
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = '${table.name}'
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name = '${constraintName}'
          ) THEN
            ALTER TABLE ${table.name} DROP CONSTRAINT ${constraintName};
          END IF;
        END$$;
      `

      // Add constraint with updated referential actions
      const addStatement = `ALTER TABLE ${table.name} ADD ${constraint}`

      return [dropStatement, addStatement]
    })

    // Execute all FK constraint statements sequentially
    yield* executeSQLStatements(tx, statements)
  })

/**
 * Sync CHECK constraints for existing table
 * Adds CHECK constraints for fields with validation requirements (enum values, ranges, formats, etc.)
 * This is needed when fields are added via ALTER TABLE and need their CHECK constraints
 */
export const syncCheckConstraints = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { generateTableConstraints } = yield* Effect.promise(() => import('./sql-generators'))
    const allConstraints = generateTableConstraints(table, undefined)

    // Filter only CHECK constraints (not UNIQUE, FK, or PRIMARY KEY)
    const checkConstraints = allConstraints.filter(
      (constraint) =>
        constraint.startsWith('CONSTRAINT') &&
        constraint.includes('CHECK') &&
        !constraint.includes('UNIQUE') &&
        !constraint.includes('FOREIGN KEY') &&
        !constraint.includes('PRIMARY KEY')
    )

    // Build statements to add CHECK constraints if they don't exist
    const statements = checkConstraints.map((constraint) => {
      // Extract constraint name from the constraint SQL
      // Format: "CONSTRAINT {constraintName} CHECK ..."
      const match = constraint.match(/CONSTRAINT\s+(\w+)\s+CHECK/)
      if (!match) return ''

      const constraintName = match[1]

      return `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = '${table.name}'
              AND constraint_type = 'CHECK'
              AND constraint_name = '${constraintName}'
          ) THEN
            ALTER TABLE ${table.name} ADD ${constraint};
          END IF;
        END$$;
      `
    })

    // Filter out empty statements and execute
    const validStatements = statements.filter((stmt) => stmt !== '')
    yield* executeSQLStatements(tx, validStatements)
  })
