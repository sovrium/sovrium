/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { shouldCreateDatabaseColumn } from './field-utils'
import { mapFieldTypeToPostgres, generateColumnDefinition } from './sql-generators'
import type { Table } from '@/domain/models/app/table'
import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Type definition for Bun SQL transaction
 */
export interface BunSQLTransaction {
  readonly unsafe: (sql: string) => Promise<readonly unknown[]>
}

/**
 * Type definition for information_schema.columns row
 */
interface ColumnInfo {
  readonly column_name: string
  readonly data_type: string
  readonly is_nullable: string
}

/**
 * Get existing columns from a table
 *
 * SECURITY NOTE: String interpolation is used for tableName.
 * This is SAFE because:
 * 1. tableName comes from validated Effect Schema (Table.name field)
 * 2. Table names are defined in schema configuration, not user input
 * 3. The App schema is validated before reaching this code
 * 4. Bun SQL's tx.unsafe() does not support parameterized queries ($1 placeholders)
 * 5. information_schema queries are read-only (no data modification risk)
 */
export const getExistingColumns = async (
  tx: BunSQLTransaction,
  tableName: string
): Promise<ReadonlyMap<string, { dataType: string; isNullable: string }>> => {
  const result = (await tx.unsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = '${tableName}'
      AND table_schema = 'public'
  `)) as readonly ColumnInfo[]

  // Use Array.from() with map to build immutable Map (functional approach)
  return new Map(
    result.map((row) => [
      row.column_name,
      {
        dataType: row.data_type,
        isNullable: row.is_nullable,
      },
    ])
  )
}

/**
 * Type definition for table existence query result
 */
interface TableExistsResult {
  readonly exists: boolean
}

/**
 * Check if a table exists in the database
 *
 * SECURITY NOTE: String interpolation is used for tableName.
 * This is SAFE because:
 * 1. tableName comes from validated Effect Schema (Table.name field)
 * 2. Table names are defined in schema configuration, not user input
 * 3. The App schema is validated before reaching this code
 * 4. Bun SQL's tx.unsafe() does not support parameterized queries ($1 placeholders)
 * 5. information_schema queries are read-only (no data modification risk)
 */
export const tableExists = async (tx: BunSQLTransaction, tableName: string): Promise<boolean> => {
  const result = (await tx.unsafe(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_name = '${tableName}'
        AND table_schema = 'public'
    ) as exists
  `)) as readonly TableExistsResult[]
  return result[0]?.exists ?? false
}

/**
 * Type definition for table name query result
 */
interface TableNameResult {
  readonly tablename: string
}

/**
 * Get all existing table names in the public schema
 *
 * SECURITY NOTE: This query is read-only and uses information_schema.
 * This is SAFE because:
 * 1. No user input is involved (queries all tables in public schema)
 * 2. information_schema queries are read-only (no data modification risk)
 * 3. Only returns table names (no sensitive data)
 */
export const getExistingTableNames = async (tx: BunSQLTransaction): Promise<readonly string[]> => {
  const result = (await tx.unsafe(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  `)) as readonly TableNameResult[]
  return result.map((row) => row.tablename)
}

/**
 * Better Auth system tables that should never be dropped
 * These tables are managed by Better Auth/Drizzle migrations, not by runtime schema
 */
const PROTECTED_SYSTEM_TABLES = new Set([
  'users',
  'sessions',
  'accounts',
  'verifications',
  'organizations',
  'members',
  'invitations',
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
/* eslint-disable functional/no-expression-statements, functional/no-loop-statements */
export const dropObsoleteTables = async (
  tx: BunSQLTransaction,
  tables: readonly Table[]
): Promise<void> => {
  const existingTableNames = await getExistingTableNames(tx)
  const schemaTableNames = new Set(tables.map((table) => table.name))
  const tablesToDrop = existingTableNames.filter(
    (tableName) => !schemaTableNames.has(tableName) && !PROTECTED_SYSTEM_TABLES.has(tableName)
  )

  for (const tableName of tablesToDrop) {
    await tx.unsafe(`DROP TABLE ${tableName} CASCADE`)
  }
}
/* eslint-enable functional/no-expression-statements, functional/no-loop-statements */

/**
 * Normalize PostgreSQL data type for comparison
 * Maps similar types to a canonical form (e.g., 'varchar' and 'character varying' both map to 'varchar')
 */
const normalizeDataType = (dataType: string): string => {
  const normalized = dataType.toLowerCase().trim()
  // Map 'character varying' to 'varchar' for easier comparison
  if (normalized.startsWith('character varying')) return 'varchar'
  if (normalized.startsWith('timestamp')) return 'timestamp'
  if (normalized.startsWith('numeric') || normalized.startsWith('decimal')) return 'numeric'
  return normalized
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
 * Generate ALTER TABLE statements for schema changes (ADD/DROP columns)
 */
export const generateAlterTableStatements = (
  table: Table,
  existingColumns: ReadonlyMap<string, { dataType: string; isNullable: string }>
): readonly string[] => {
  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []

  // Check if an 'id' field already exists in the fields array
  const hasIdField = table.fields.some((field) => field.name === 'id')

  // Check if a custom primary key is defined
  const hasCustomPrimaryKey = table.primaryKey && primaryKeyFields.length > 0

  // Protect 'id' column if it's auto-generated (no custom PK and no explicit id field)
  const shouldProtectIdColumn = !hasIdField && !hasCustomPrimaryKey

  // Build sets for efficient lookups
  const schemaFieldsByName = new Map(table.fields.map((field) => [field.name, field]))

  // Check if auto-generated id column should exist and if it has wrong type
  const needsAutoId = shouldProtectIdColumn
  const hasIdColumn = existingColumns.has('id')
  const idColumnHasWrongType =
    hasIdColumn &&
    needsAutoId &&
    !(
      normalizeDataType(existingColumns.get('id')!.dataType) === 'integer' ||
      normalizeDataType(existingColumns.get('id')!.dataType) === 'serial'
    )

  // If id column has wrong type (e.g., TEXT from Better Auth), we need to recreate the table
  // because you can't change a column from TEXT PRIMARY KEY to SERIAL PRIMARY KEY with ALTER
  if (idColumnHasWrongType) {
    // Return empty array - table will be dropped and recreated
    return []
  }

  // Columns to add: not in database OR exist but have wrong type
  // Filter out UI-only fields (like button) that don't need database columns
  const columnsToAdd = table.fields.filter((field) => {
    if (!shouldCreateDatabaseColumn(field)) return false // Skip UI-only fields
    if (!existingColumns.has(field.name)) return true // New column
    const existing = existingColumns.get(field.name)!
    return !doesColumnTypeMatch(field, existing.dataType) // Type mismatch
  })

  // Columns to drop: exist in database but not in schema OR have wrong type
  const columnsToDrop = Array.from(existingColumns.keys()).filter((columnName) => {
    // Never drop protected id column (it's already the correct type at this point)
    if (shouldProtectIdColumn && columnName === 'id') return false

    // Drop if not in schema (but only if it's not a UI-only field)
    if (!schemaFieldsByName.has(columnName)) return true

    const field = schemaFieldsByName.get(columnName)!

    // If this is a UI-only field that shouldn't have a column, drop it
    if (!shouldCreateDatabaseColumn(field)) return true

    // Drop if type doesn't match (will be recreated with correct type)
    const existing = existingColumns.get(columnName)!
    return !doesColumnTypeMatch(field, existing.dataType)
  })

  // Generate statements
  const dropStatements = columnsToDrop.map(
    (columnName) => `ALTER TABLE ${table.name} DROP COLUMN ${columnName} CASCADE`
  )

  const addStatements = columnsToAdd.map((field) => {
    const isPrimaryKey = primaryKeyFields.includes(field.name)
    const columnDef = generateColumnDefinition(field, isPrimaryKey, table.fields)
    return `ALTER TABLE ${table.name} ADD COLUMN ${columnDef}`
  })

  // Return DROP statements first, then ADD statements
  // This ensures columns are dropped before adding new ones with correct types
  return [...dropStatements, ...addStatements]
}

/**
 * Sync unique constraints for existing table
 * Adds named UNIQUE constraints for:
 * 1. Single-field constraints (fields with unique property)
 * 2. Composite unique constraints (table.uniqueConstraints)
 * Uses PostgreSQL default naming convention: {table}_{column}_key for single fields
 */
/* eslint-disable functional/no-expression-statements, functional/no-loop-statements */
export const syncUniqueConstraints = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  table: Table
): Promise<void> => {
  // Single-field unique constraints
  const uniqueFields = new Set(
    table.fields.filter((f) => 'unique' in f && f.unique).map((f) => f.name)
  )

  for (const fieldName of uniqueFields) {
    const constraintName = `${table.name}_${fieldName}_key`
    // Add constraint if it doesn't exist (using IF NOT EXISTS equivalent)
    await tx.unsafe(`
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
    `)
  }

  // Composite unique constraints from table.uniqueConstraints
  if (table.uniqueConstraints && table.uniqueConstraints.length > 0) {
    for (const constraint of table.uniqueConstraints) {
      const fields = constraint.fields.join(', ')
      await tx.unsafe(`
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
      `)
    }
  }
}
/* eslint-enable functional/no-expression-statements, functional/no-loop-statements */
