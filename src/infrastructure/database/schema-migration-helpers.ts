/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines */

import { Effect } from 'effect'
import { shouldCreateDatabaseColumn } from './field-utils'
import {
  getExistingTableNames,
  executeSQLStatements,
  type TransactionLike,
  type SQLExecutionError,
} from './sql-execution'
import { mapFieldTypeToPostgres, generateColumnDefinition, isFieldNotNull } from './sql-generators'
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
 * Note: Better Auth tables use _sovrium_auth_ prefix for namespace isolation
 */
const PROTECTED_SYSTEM_TABLES = new Set([
  // Better Auth tables (with _sovrium_auth_ prefix)
  '_sovrium_auth_users',
  '_sovrium_auth_sessions',
  '_sovrium_auth_accounts',
  '_sovrium_auth_verifications',
  '_sovrium_auth_organizations',
  '_sovrium_auth_members',
  '_sovrium_auth_invitations',
  '_sovrium_auth_api_keys',
  '_sovrium_auth_two_factors',
  // Migration system tables
  '_sovrium_migration_history',
  '_sovrium_migration_log',
  '_sovrium_schema_checksum',
  // Activity and comment tables
  '_sovrium_activity_logs',
  '_sovrium_record_comments',
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
 * Check if id column needs to be recreated due to type mismatch
 */
const needsIdColumnRecreation = (
  existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >,
  shouldProtectIdColumn: boolean
): boolean => {
  if (!shouldProtectIdColumn) return false
  if (!existingColumns.has('id')) return false

  const idType = normalizeDataType(existingColumns.get('id')!.dataType)
  return idType !== 'integer' && idType !== 'serial'
}

/**
 * Find columns that should be added to the table
 */
const findColumnsToAdd = (
  table: Table,
  existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >,
  renamedNewNames: ReadonlySet<string>
): readonly Fields[number][] =>
  table.fields.filter((field) => {
    if (!shouldCreateDatabaseColumn(field)) return false // Skip UI-only fields
    if (renamedNewNames.has(field.name)) return false // Skip renamed fields
    if (!existingColumns.has(field.name)) return true // New column
    const existing = existingColumns.get(field.name)!
    return !doesColumnTypeMatch(field, existing.dataType) // Type mismatch
  })

/**
 * Find columns that should be dropped from the table
 */
const findColumnsToDrop = (
  existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >,
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

    // Drop if type doesn't match (will be recreated with correct type)
    const existing = existingColumns.get(columnName)!
    return !doesColumnTypeMatch(field, existing.dataType)
  })

/**
 * Filter fields that should be checked for schema modifications
 * Excludes UI-only fields, renamed fields, and fields not in the database
 */
const filterModifiableFields = (
  fields: readonly Fields[number][],
  existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >,
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
 * Find columns that need nullability changes
 * Returns ALTER COLUMN statements for SET NOT NULL / DROP NOT NULL
 */
const findNullabilityChanges = (
  table: Table,
  existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >,
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
      return [`ALTER TABLE ${table.name} ALTER COLUMN ${field.name} SET NOT NULL`]
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
const findDefaultValueChanges = (
  table: Table,
  existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >,
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
      const defaultMatch = columnDef.match(/DEFAULT (.+?)(?:\s|$)/)
      if (defaultMatch) {
        const defaultClause = defaultMatch[1]
        return [`ALTER TABLE ${table.name} ALTER COLUMN ${field.name} SET DEFAULT ${defaultClause}`]
      }
    }

    return []
  })
}

/**
 * Generate ALTER TABLE statements for schema changes (ADD/DROP columns, nullability changes)
 */
/**
 * Generate statements to add created_at column if not present
 * Uses DEFAULT NOW() to populate existing rows during ALTER TABLE
 */
const generateCreatedAtStatement = (
  table: Table,
  existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >
): readonly string[] => {
  const hasCreatedAtField = table.fields.some((field) => field.name === 'created_at')
  const hasCreatedAtColumn = existingColumns.has('created_at')
  return !hasCreatedAtField && !hasCreatedAtColumn
    ? [`ALTER TABLE ${table.name} ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`]
    : []
}

/**
 * Generate statements to add updated_at column if not present
 * Uses DEFAULT NOW() to populate existing rows during ALTER TABLE
 */
const generateUpdatedAtStatement = (
  table: Table,
  existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >
): readonly string[] => {
  const hasUpdatedAtField = table.fields.some((field) => field.name === 'updated_at')
  const hasUpdatedAtColumn = existingColumns.has('updated_at')
  return !hasUpdatedAtField && !hasUpdatedAtColumn
    ? [`ALTER TABLE ${table.name} ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`]
    : []
}

/**
 * Generate statements to add deleted_at column if not present
 */
const generateDeletedAtStatement = (
  table: Table,
  existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >
): readonly string[] => {
  const hasDeletedAtField = table.fields.some((field) => field.name === 'deleted_at')
  const hasDeletedAtColumn = existingColumns.has('deleted_at')
  return !hasDeletedAtField && !hasDeletedAtColumn
    ? [`ALTER TABLE ${table.name} ADD COLUMN deleted_at TIMESTAMPTZ`]
    : []
}

/**
 * Build drop/add column statements from the computed columns to modify
 */
const buildColumnStatements = (options: {
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

/**
 * Generate ALTER TABLE statements for schema migrations
 */
/* eslint-disable-next-line max-lines-per-function */
export const generateAlterTableStatements = (
  table: Table,
  existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >,
  previousSchema?: { readonly tables: readonly object[] }
): readonly string[] => {
  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []
  const hasIdField = table.fields.some((field) => field.name === 'id')
  const hasCustomPrimaryKey = table.primaryKey && primaryKeyFields.length > 0
  const shouldProtectIdColumn = !hasIdField && !hasCustomPrimaryKey

  // If id column has wrong type, return empty array - table will be dropped and recreated
  if (needsIdColumnRecreation(existingColumns, shouldProtectIdColumn)) return []

  // Detect field renames via ID tracking
  const fieldRenames = detectFieldRenames(table.name, table.fields, previousSchema)
  const renameStatements = Array.from(fieldRenames.entries()).map(
    ([oldName, newName]) => `ALTER TABLE ${table.name} RENAME COLUMN ${oldName} TO ${newName}`
  )

  // Build sets for efficient lookups
  const renamedOldNames = new Set(fieldRenames.keys())
  const renamedNewNames = new Set(fieldRenames.values())
  const schemaFieldsByName = new Map(table.fields.map((field) => [field.name, field]))

  // Find columns to add/drop and nullability changes
  const columnsToAdd = findColumnsToAdd(table, existingColumns, renamedNewNames)
  const columnsToDrop = findColumnsToDrop(
    existingColumns,
    schemaFieldsByName,
    shouldProtectIdColumn,
    renamedOldNames
  )

  // Validate destructive operations (column drops) require explicit confirmation
  if (columnsToDrop.length > 0 && !table.allowDestructive) {
    const droppedColumns = columnsToDrop.join(', ')
    /* eslint-disable-next-line functional/no-throw-statements */
    throw new Error(
      `Destructive operation detected: Dropping column(s) [${droppedColumns}] from table '${table.name}' requires confirmation. Set allowDestructive: true to proceed with data loss, or keep the field(s) in the schema to preserve data.`
    )
  }

  const nullabilityChanges = findNullabilityChanges(
    table,
    existingColumns,
    renamedNewNames,
    primaryKeyFields
  )

  const defaultValueChanges = findDefaultValueChanges(
    table,
    existingColumns,
    renamedNewNames,
    previousSchema
  )

  // Build column modification statements
  const { dropStatements, addStatements } = buildColumnStatements({
    tableName: table.name,
    columnsToDrop,
    columnsToAdd,
    primaryKeyFields,
    allFields: table.fields,
  })

  // Add automatic special fields if not present (APP-TABLES-SPECIAL-FIELDS-007)
  return [
    ...renameStatements,
    ...dropStatements,
    ...addStatements,
    ...generateCreatedAtStatement(table, existingColumns),
    ...generateUpdatedAtStatement(table, existingColumns),
    ...generateDeletedAtStatement(table, existingColumns),
    ...nullabilityChanges,
    ...defaultValueChanges,
  ]
}

/**
 * Get drop statements for removed unique constraints
 */
const getUniqueConstraintDropStatements = (
  table: Table,
  previousSchema: { readonly tables: readonly object[] } | undefined,
  currentUniqueFields: readonly string[]
): readonly string[] => {
  if (!previousSchema) return []

  const previousTable = previousSchema.tables.find(
    (t: object) => 'name' in t && t.name === table.name
  ) as
    | {
        name: string
        fields?: readonly { name?: string; unique?: boolean }[]
        uniqueConstraints?: readonly { name: string }[]
      }
    | undefined

  if (!previousTable) return []

  // Single-field constraints that were removed
  const previousUniqueFields =
    previousTable.fields?.filter((f) => f.name && 'unique' in f && f.unique).map((f) => f.name!) ??
    []

  const removedFields = previousUniqueFields.filter(
    (fieldName) => !currentUniqueFields.includes(fieldName)
  )

  const singleFieldDrops = removedFields.map((fieldName) => {
    const constraintName = `${table.name}_${fieldName}_key`
    return `ALTER TABLE ${table.name} DROP CONSTRAINT IF EXISTS ${constraintName}`
  })

  // Composite constraints that were removed
  const previousCompositeNames = previousTable.uniqueConstraints?.map((c) => c.name) ?? []
  const currentCompositeNames = table.uniqueConstraints?.map((c) => c.name) ?? []

  const removedComposites = previousCompositeNames.filter(
    (name) => !currentCompositeNames.includes(name)
  )

  const compositeDrops = removedComposites.map(
    (constraintName) => `ALTER TABLE ${table.name} DROP CONSTRAINT IF EXISTS ${constraintName}`
  )

  return [...singleFieldDrops, ...compositeDrops]
}

/**
 * Build SQL statements to add unique constraints (single-field and composite)
 */
const buildUniqueConstraintAddStatements = (
  table: Table,
  uniqueFields: readonly string[]
): readonly string[] => {
  // Single-field constraints
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

  // Composite constraints
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

  return [...singleFieldStatements, ...compositeStatements]
}

/**
 * Sync unique constraints for existing table
 * Adds named UNIQUE constraints for:
 * 1. Single-field constraints (fields with unique property)
 * 2. Composite unique constraints (table.uniqueConstraints)
 * Removes constraints that are no longer in the schema
 * Uses PostgreSQL default naming convention: {table}_{column}_key for single fields
 */
export const syncUniqueConstraints = (
  tx: TransactionLike,
  table: Table,
  previousSchema?: { readonly tables: readonly object[] }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const uniqueFields = table.fields.filter((f) => 'unique' in f && f.unique).map((f) => f.name)
    const dropStatements = getUniqueConstraintDropStatements(table, previousSchema, uniqueFields)
    const addStatements = buildUniqueConstraintAddStatements(table, uniqueFields)

    yield* executeSQLStatements(tx, [...dropStatements, ...addStatements])
  })

/**
 * Sync foreign key constraints for existing table
 * Drops and recreates FK constraints to ensure referential actions (ON DELETE, ON UPDATE) are up-to-date
 * This is needed when table schema is updated with new referential actions
 *
 * NOTE: After RENAME COLUMN, PostgreSQL preserves FK constraints but doesn't rename them.
 * We need to drop old constraints by column name, not just by expected constraint name.
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
      // Extract column name from the constraint SQL
      // Format: "CONSTRAINT {constraintName} FOREIGN KEY ({columnName}) REFERENCES ..."
      const match = constraint.match(/CONSTRAINT\s+\w+\s+FOREIGN KEY\s+\((\w+)\)/)
      if (!match) return []

      const columnName = match[1]

      // Drop ALL existing FK constraints on this column (handles renamed columns)
      // PostgreSQL doesn't rename constraints when column is renamed, so we need to drop by column
      const dropStatement = `
        DO $$
        DECLARE
          constraint_rec RECORD;
        BEGIN
          FOR constraint_rec IN
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.table_name = '${table.name}'
              AND tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = '${columnName}'
          LOOP
            EXECUTE 'ALTER TABLE ${table.name} DROP CONSTRAINT ' || constraint_rec.constraint_name;
          END LOOP;
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
 * Validate existing data against new CHECK constraint before applying
 * Returns validation query that will throw error if data violates constraint
 */
const generateConstraintValidationQuery = (
  tableName: string,
  constraint: string
): string | undefined => {
  // Extract constraint condition from the constraint SQL
  // Format: "CONSTRAINT {constraintName} CHECK ({condition})"
  const match = constraint.match(/CHECK\s*\((.+)\)$/)
  if (!match) return undefined

  const condition = match[1]

  // Generate query that will fail if any row violates the new constraint
  // Using NOT ({condition}) to find rows that violate the constraint
  return `
    DO $$
    DECLARE
      violation_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO violation_count
      FROM ${tableName}
      WHERE NOT (${condition});

      IF violation_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: existing data violates check constraint. % row(s) in table "${tableName}" violate the new constraint condition.', violation_count;
      END IF;
    END$$;
  `
}

/**
 * Sync CHECK constraints for existing table
 * Adds CHECK constraints for fields with validation requirements (enum values, ranges, formats, etc.)
 * Drops and recreates constraints when they are modified (e.g., min/max value changes)
 * This is needed when fields are added via ALTER TABLE and need their CHECK constraints
 *
 * CRITICAL: Validates existing data before applying new constraints
 * Migration will FAIL if any existing data violates the new constraint
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

    // Build statements to drop existing constraints and add new ones
    // This ensures constraints are updated when validation rules change (e.g., max value increases)
    const statements = checkConstraints.flatMap((constraint) => {
      // Extract constraint name from the constraint SQL
      // Format: "CONSTRAINT {constraintName} CHECK ..."
      const match = constraint.match(/CONSTRAINT\s+(\w+)\s+CHECK/)
      if (!match) return []

      const constraintName = match[1]

      // Generate validation query to check if existing data violates new constraint
      const validationQuery = generateConstraintValidationQuery(table.name, constraint)

      // Drop existing constraint if it exists, validate data, then add the new constraint
      // This handles both new constraints and modified constraints
      return [
        `
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM information_schema.table_constraints
              WHERE table_name = '${table.name}'
                AND constraint_type = 'CHECK'
                AND constraint_name = '${constraintName}'
            ) THEN
              ALTER TABLE ${table.name} DROP CONSTRAINT ${constraintName};
            END IF;
          END$$;
        `,
        ...(validationQuery ? [validationQuery] : []),
        `ALTER TABLE ${table.name} ADD ${constraint}`,
      ]
    })

    // Execute all statements sequentially (drop, validate, then add for each constraint)
    yield* executeSQLStatements(tx, statements)
  })

/**
 * Helper to generate DROP INDEX statements for indexes that need to be removed
 */
const generateDropIndexStatements = (
  table: Table,
  previousTable:
    | {
        readonly name: string
        readonly fields?: readonly { name?: string; indexed?: boolean }[]
        readonly indexes?: readonly { name: string }[]
      }
    | undefined
): readonly string[] => {
  if (!previousTable) return []

  // Drop indexes for fields that no longer have indexed: true
  const previousIndexedFields =
    previousTable.fields
      ?.filter((f) => f.name && 'indexed' in f && f.indexed)
      .map((f) => f.name!) ?? []

  const currentIndexedFields = new Set(
    table.fields.filter((f) => 'indexed' in f && f.indexed).map((f) => f.name)
  )

  const removedIndexedFields = previousIndexedFields.filter(
    (fieldName) => !currentIndexedFields.has(fieldName)
  )

  const fieldIndexDrops = removedIndexedFields.map((fieldName) => {
    const indexName = `idx_${table.name}_${fieldName}`
    return `DROP INDEX IF EXISTS ${indexName}`
  })

  // Drop indexes for fields that changed from indexed to unique
  const currentUniqueFields = new Set(
    table.fields.filter((f) => 'unique' in f && f.unique).map((f) => f.name)
  )

  const indexToUniqueFields = previousIndexedFields.filter((fieldName) =>
    currentUniqueFields.has(fieldName)
  )

  const indexToUniqueDrops = indexToUniqueFields.map((fieldName) => {
    const indexName = `idx_${table.name}_${fieldName}`
    return `DROP INDEX IF EXISTS ${indexName}`
  })

  // Drop custom indexes that were removed
  const previousCustomIndexes = previousTable.indexes?.map((idx) => idx.name) ?? []
  const currentCustomIndexes = table.indexes?.map((idx) => idx.name) ?? []

  const removedCustomIndexes = previousCustomIndexes.filter(
    (name) => !currentCustomIndexes.includes(name)
  )

  const customIndexDrops = removedCustomIndexes.map((name) => `DROP INDEX IF EXISTS ${name}`)

  return [...fieldIndexDrops, ...indexToUniqueDrops, ...customIndexDrops]
}

/**
 * Sync indexes for existing table
 * Drops indexes that are no longer needed and creates new indexes
 * This is needed when field indexed property changes or custom indexes are added/removed
 */
export const syncIndexes = (
  tx: TransactionLike,
  table: Table,
  previousSchema?: { readonly tables: readonly object[] }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { generateIndexStatements } = yield* Effect.promise(() => import('./index-generators'))

    // Get previous table definition
    const previousTable = previousSchema?.tables.find(
      (t: object) => 'name' in t && t.name === table.name
    ) as
      | {
          name: string
          fields?: readonly { name?: string; indexed?: boolean }[]
          indexes?: readonly { name: string }[]
        }
      | undefined

    // Determine which indexes should be dropped
    const dropStatements = generateDropIndexStatements(table, previousTable)

    // Generate CREATE INDEX statements for all current indexes
    const createStatements = generateIndexStatements(table)

    // Execute drop statements first, then create statements
    yield* executeSQLStatements(tx, [...dropStatements, ...createStatements])
  })
