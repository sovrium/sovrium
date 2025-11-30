/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { Config, Effect, Console, Data, type ConfigError } from 'effect'
import {
  mapFieldTypeToPostgres,
  generateColumnDefinition,
  generateTableConstraints,
  isUserReferenceField,
} from './sql-generators'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/table'
import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Schema initialization error types
 */
export class SchemaInitializationError extends Data.TaggedError('SchemaInitializationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class NoDatabaseUrlError extends Data.TaggedError('NoDatabaseUrlError')<{
  readonly message: string
}> {}

/**
 * Check if field should create a database column
 * Some field types are UI-only and don't need database columns
 */
const shouldCreateDatabaseColumn = (field: Fields[number]): boolean => field.type !== 'button'

/**
 * Generate CREATE TABLE statement
 */
const generateCreateTableSQL = (table: Table): string => {
  // Identify primary key fields
  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []

  // Check if an 'id' field already exists in the fields array
  const hasIdField = table.fields.some((field) => field.name === 'id')

  // Check if a custom primary key is defined
  const hasCustomPrimaryKey = table.primaryKey && primaryKeyFields.length > 0

  // Add automatic id column only if not explicitly defined AND no custom primary key
  const idColumnDefinition = hasIdField || hasCustomPrimaryKey ? [] : ['id SERIAL NOT NULL']

  // Filter out UI-only fields (like button) that don't need database columns
  const columnDefinitions = table.fields
    .filter(shouldCreateDatabaseColumn)
    .map((field) => {
      const isPrimaryKey = primaryKeyFields.includes(field.name)
      return generateColumnDefinition(field, isPrimaryKey)
    })

  // Add PRIMARY KEY constraint on id if no custom primary key is defined
  const tableConstraints = generateTableConstraints(table)

  // If no explicit primary key is defined, add PRIMARY KEY on id
  const primaryKeyConstraint = !hasCustomPrimaryKey && !hasIdField ? ['PRIMARY KEY (id)'] : []

  const allDefinitions = [
    ...idColumnDefinition,
    ...columnDefinitions,
    ...tableConstraints,
    ...primaryKeyConstraint,
  ]

  return `CREATE TABLE IF NOT EXISTS ${table.name} (
  ${allDefinitions.join(',\n  ')}
)`
}

/**
 * Generate CREATE INDEX statements for indexed fields and autonumber fields
 */
const generateIndexStatements = (table: Table): readonly string[] => {
  const indexedFields = table.fields
    .filter(
      (field): field is Fields[number] & { indexed: true } => 'indexed' in field && !!field.indexed
    )
    .map((field) => {
      const indexName = `idx_${table.name}_${field.name}`
      const indexType = field.type === 'array' ? 'USING gin' : 'USING btree'
      return `CREATE INDEX IF NOT EXISTS ${indexName} ON public.${table.name} ${indexType} (${field.name})`
    })

  // Create unique indexes for autonumber fields
  const autonumberIndexes = table.fields
    .filter((field) => field.type === 'autonumber')
    .map((field) => {
      const indexName = `idx_${table.name}_${field.name}_unique`
      return `CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON public.${table.name} (${field.name})`
    })

  // Create custom indexes from table.indexes configuration
  const customIndexes =
    table.indexes?.map((index) => {
      const uniqueClause = index.unique ? 'UNIQUE ' : ''
      const fields = index.fields.join(', ')
      return `CREATE ${uniqueClause}INDEX IF NOT EXISTS ${index.name} ON public.${table.name} (${fields})`
    }) ?? []

  return [...indexedFields, ...autonumberIndexes, ...customIndexes]
}

/**
 * Generate trigger to prevent updates to created-at fields (immutability)
 */
const generateCreatedAtTriggers = (table: Table): readonly string[] => {
  const createdAtFields = table.fields.filter((field) => field.type === 'created-at')

  if (createdAtFields.length === 0) return []

  const fieldNames = createdAtFields.map((f) => f.name)
  const triggerFunctionName = `prevent_${table.name}_created_at_update`
  const triggerName = `trigger_${table.name}_created_at_immutable`

  return [
    // Create trigger function
    `CREATE OR REPLACE FUNCTION ${triggerFunctionName}()
RETURNS TRIGGER AS $$
BEGIN
  ${fieldNames.map((name) => `NEW.${name} = OLD.${name};`).join('\n  ')}
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    // Create trigger
    `DROP TRIGGER IF EXISTS ${triggerName} ON ${table.name}`,
    `CREATE TRIGGER ${triggerName}
BEFORE UPDATE ON ${table.name}
FOR EACH ROW
EXECUTE FUNCTION ${triggerFunctionName}()`,
  ]
}

/**
 * Type definition for Bun SQL transaction
 */
interface BunSQLTransaction {
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
const getExistingColumns = async (
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
const tableExists = async (tx: BunSQLTransaction, tableName: string): Promise<boolean> => {
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
const getExistingTableNames = async (tx: BunSQLTransaction): Promise<readonly string[]> => {
  const result = (await tx.unsafe(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  `)) as readonly TableNameResult[]
  return result.map((row) => row.tablename)
}

/**
 * Drop tables that exist in database but are not defined in schema
 *
 * SECURITY NOTE: Table names are validated before reaching this function.
 * This is SAFE because:
 * 1. existingTableNames comes from pg_tables system catalog (trusted source)
 * 2. schemaTableNames comes from validated Effect Schema objects
 * 3. Only tables not in schema are dropped (explicit comparison)
 */
/* eslint-disable functional/no-expression-statements, functional/no-loop-statements */
const dropObsoleteTables = async (
  tx: BunSQLTransaction,
  tables: readonly Table[]
): Promise<void> => {
  const existingTableNames = await getExistingTableNames(tx)
  const schemaTableNames = new Set(tables.map((table) => table.name))
  const tablesToDrop = existingTableNames.filter((tableName) => !schemaTableNames.has(tableName))

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
const generateAlterTableStatements = (
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
    (columnName) => `ALTER TABLE ${table.name} DROP COLUMN ${columnName}`
  )

  const addStatements = columnsToAdd.map((field) => {
    const isPrimaryKey = primaryKeyFields.includes(field.name)
    const columnDef = generateColumnDefinition(field, isPrimaryKey)
    return `ALTER TABLE ${table.name} ADD COLUMN ${columnDef}`
  })

  // Return DROP statements first, then ADD statements
  // This ensures columns are dropped before adding new ones with correct types
  return [...dropStatements, ...addStatements]
}

/**
 * Sync unique constraints for existing table
 * Adds named UNIQUE constraints for fields with unique property
 */
/* eslint-disable functional/no-expression-statements, functional/no-loop-statements */
const syncUniqueConstraints = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  table: Table
): Promise<void> => {
  const uniqueFields = new Set(
    table.fields.filter((f) => 'unique' in f && f.unique).map((f) => f.name)
  )

  for (const fieldName of uniqueFields) {
    const constraintName = `${table.name}_${fieldName}_unique`
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
}
/* eslint-enable functional/no-expression-statements, functional/no-loop-statements */

/**
 * Migrate existing table (ALTER statements + constraints + indexes)
 */
/* eslint-disable functional/no-expression-statements, functional/no-loop-statements */
const migrateExistingTable = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  table: Table,
  existingColumns: ReadonlyMap<string, { dataType: string; isNullable: string }>
): Promise<void> => {
  const alterStatements = generateAlterTableStatements(table, existingColumns)

  // If alterStatements is empty, table has incompatible schema changes
  // (e.g., primary key type change) - drop and recreate
  if (alterStatements.length === 0) {
    await tx.unsafe(`DROP TABLE ${table.name} CASCADE`)
    const createTableSQL = generateCreateTableSQL(table)
    await tx.unsafe(createTableSQL)
  } else {
    // Apply incremental migrations
    for (const alterSQL of alterStatements) {
      await tx.unsafe(alterSQL)
    }
  }

  // Always add/update unique constraints for existing tables
  await syncUniqueConstraints(tx, table)

  // Always create indexes (IF NOT EXISTS prevents errors)
  for (const indexSQL of generateIndexStatements(table)) {
    await tx.unsafe(indexSQL)
  }

  // Always create/update triggers for created-at fields
  for (const triggerSQL of generateCreatedAtTriggers(table)) {
    await tx.unsafe(triggerSQL)
  }
}
/* eslint-enable functional/no-expression-statements, functional/no-loop-statements */

/**
 * Create new table (CREATE statement + indexes + triggers)
 */
/* eslint-disable functional/no-expression-statements, functional/no-loop-statements */
const createNewTable = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  table: Table
): Promise<void> => {
  const createTableSQL = generateCreateTableSQL(table)
  await tx.unsafe(createTableSQL)

  for (const indexSQL of generateIndexStatements(table)) {
    await tx.unsafe(indexSQL)
  }

  for (const triggerSQL of generateCreatedAtTriggers(table)) {
    await tx.unsafe(triggerSQL)
  }
}
/* eslint-enable functional/no-expression-statements, functional/no-loop-statements */

/**
 * Check if any table needs the users table for foreign keys
 */
const needsUsersTable = (tables: readonly Table[]): boolean =>
  tables.some((table) => table.fields.some(isUserReferenceField))

/**
 * Ensure users table exists for foreign key references
 * Creates a minimal users table if it doesn't exist
 * Safe to call even if Better Auth already created the users table
 */
/* eslint-disable functional/no-expression-statements */
const ensureUsersTable = async (
  tx: { unsafe: (sql: string) => Promise<unknown> }
): Promise<void> => {
  // Create users table if it doesn't exist
  // Explicitly specify public schema to avoid search path issues
  await tx.unsafe(`
    CREATE TABLE IF NOT EXISTS public.users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255)
    )
  `)
}
/* eslint-enable functional/no-expression-statements */

/**
 * Execute schema initialization using bun:sql with transaction support
 * Uses Bun's native SQL driver for optimal performance
 *
 * Now supports incremental schema migrations:
 * - For new tables: CREATE TABLE
 * - For existing tables: ALTER TABLE ADD COLUMN for new fields
 *
 * Note: This function intentionally uses imperative patterns for database I/O.
 * Side effects are unavoidable when executing DDL statements against PostgreSQL.
 *
 * SECURITY NOTE: tx.unsafe() is intentionally used here for DDL execution.
 *
 * This is SAFE because:
 * 1. SQL is generated from validated Effect Schema objects, not user input
 *    - Table names come from schema definitions validated at startup
 *    - Field names/types are constrained by the domain model (Fields type)
 * 2. DDL statements (CREATE TABLE, CREATE INDEX) cannot use parameterized queries
 *    - PostgreSQL does not support $1 placeholders in DDL statements
 *    - Table and column names must be interpolated directly
 * 3. All identifiers come from validated schema definitions
 *    - The App schema is validated via Effect Schema before reaching this code
 *    - Invalid identifiers would fail schema validation, not reach SQL execution
 * 4. Transaction boundary provides atomicity
 *    - If any statement fails, the entire transaction rolls back
 *    - No partial schema state is possible
 *
 * This pattern is standard for schema migration tools (Drizzle, Prisma, etc.)
 * which all generate and execute DDL strings directly.
 */
/* eslint-disable functional/no-expression-statements, functional/no-loop-statements */
const executeSchemaInit = async (databaseUrl: string, tables: readonly Table[]): Promise<void> => {
  const db = new SQL(databaseUrl)

  try {
    await db.begin(async (tx) => {
      // Step 0: Ensure users table exists if any table needs it for foreign keys
      if (needsUsersTable(tables)) {
        await ensureUsersTable(tx)
      }

      // Step 1: Drop tables that exist in database but not in schema
      await dropObsoleteTables(tx, tables)

      // Step 2: Create or migrate tables defined in schema
      for (const table of tables) {
        const exists = await tableExists(tx, table.name)

        if (exists) {
          const existingColumns = await getExistingColumns(tx, table.name)
          await migrateExistingTable(tx, table, existingColumns)
        } else {
          await createNewTable(tx, table)
        }
      }
    })
  } finally {
    // Close connection
    await db.close()
  }
}
/* eslint-enable functional/no-expression-statements, functional/no-loop-statements */

/**
 * Error type union for schema initialization
 */
export type SchemaError = SchemaInitializationError | NoDatabaseUrlError

/**
 * Initialize database schema from app configuration (internal with error handling)
 *
 * Uses Bun's native SQL driver (bun:sql) for:
 * - Zero-dependency PostgreSQL access
 * - Optimal performance on Bun runtime
 * - Built-in connection pooling
 * - Transaction support with automatic rollback
 *
 * Errors are logged and handled internally - returns Effect<void, never>
 * for simpler composition in application layer.
 *
 * @see docs/infrastructure/database/runtime-sql-migrations/04-migration-executor.md
 */
const initializeSchemaInternal = (
  app: App
): Effect.Effect<void, SchemaError | ConfigError.ConfigError> =>
  Effect.gen(function* () {
    // Skip if no tables defined
    if (!app.tables || app.tables.length === 0) {
      yield* Console.log('No tables defined, skipping schema initialization')
      return
    }

    // Get database URL from Effect Config (reads from environment)
    const databaseUrlConfig = yield* Config.string('DATABASE_URL').pipe(Config.withDefault(''))

    // Skip if no DATABASE_URL configured
    if (!databaseUrlConfig) {
      yield* Console.log('No DATABASE_URL found, skipping schema initialization')
      return
    }

    yield* Console.log('Initializing database schema...')

    // Execute schema initialization with bun:sql
    yield* Effect.tryPromise({
      try: () => executeSchemaInit(databaseUrlConfig, app.tables!),
      catch: (error) =>
        new SchemaInitializationError({
          message: `Schema initialization failed: ${String(error)}`,
          cause: error,
        }),
    })

    yield* Console.log('✓ Database schema initialized successfully')
  })

/**
 * Initialize database schema from app configuration
 *
 * Public API that handles errors internally to maintain backward compatibility.
 * Logs errors but doesn't propagate them - schema initialization failures
 * shouldn't prevent server startup (database may be optional).
 *
 * @param app - Application configuration with tables
 * @returns Effect that always succeeds (errors logged internally)
 */
export const initializeSchema = (app: App): Effect.Effect<void, never> =>
  initializeSchemaInternal(app).pipe(
    Effect.catchAll((error) =>
      Console.error(`Error initializing database schema: ${error._tag}`).pipe(
        Effect.flatMap(() => Effect.void)
      )
    )
  )
