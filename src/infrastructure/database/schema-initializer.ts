/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { Config, Effect, Console, Data, type ConfigError } from 'effect'
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
 * Field type to PostgreSQL type mapping
 */
const fieldTypeToPostgresMap: Record<string, string> = {
  integer: 'INTEGER',
  autonumber: 'INTEGER',
  decimal: 'DECIMAL',
  'single-line-text': 'VARCHAR(255)',
  'long-text': 'TEXT',
  email: 'VARCHAR(255)',
  url: 'VARCHAR(255)',
  'phone-number': 'VARCHAR(255)',
  'rich-text': 'TEXT',
  checkbox: 'BOOLEAN',
  date: 'TIMESTAMP',
  'single-select': 'VARCHAR(255)',
  status: 'VARCHAR(255)',
  'multi-select': 'TEXT[]',
  currency: 'DECIMAL',
  percentage: 'DECIMAL',
  rating: 'INTEGER',
  duration: 'INTEGER',
  color: 'VARCHAR(7)',
  progress: 'DECIMAL',
  json: 'JSONB',
  geolocation: 'POINT',
  barcode: 'VARCHAR(255)',
  'single-attachment': 'TEXT',
  'multiple-attachments': 'TEXT',
  relationship: 'TEXT',
  lookup: 'TEXT',
  rollup: 'TEXT',
  formula: 'TEXT',
  user: 'TEXT',
  'created-by': 'TEXT',
  'updated-by': 'TEXT',
  'created-at': 'TIMESTAMP',
  'updated-at': 'TIMESTAMP',
  button: 'TEXT',
}

/**
 * Map field type to PostgreSQL column type
 */
const mapFieldTypeToPostgres = (field: Fields[number]): string => {
  if (field.type === 'array') {
    const itemType = 'itemType' in field && field.itemType ? field.itemType : 'text'
    return `${itemType.toUpperCase()}[]`
  }

  // Handle decimal with precision
  if (field.type === 'decimal' && 'precision' in field && field.precision) {
    return `NUMERIC(${field.precision},2)`
  }

  return fieldTypeToPostgresMap[field.type] ?? 'TEXT'
}

/**
 * Format default value for SQL
 */
const formatDefaultValue = (defaultValue: unknown): string =>
  typeof defaultValue === 'boolean' ? String(defaultValue) : `'${defaultValue}'`

/**
 * Generate SERIAL column definition for auto-increment fields
 */
const generateSerialColumn = (fieldName: string): string => `${fieldName} SERIAL NOT NULL`

/**
 * Check if field should use SERIAL type
 */
const shouldUseSerial = (field: Fields[number], isPrimaryKey: boolean): boolean =>
  field.type === 'autonumber' || (field.type === 'integer' && isPrimaryKey)

/**
 * Generate NOT NULL constraint
 */
const generateNotNullConstraint = (field: Fields[number], isPrimaryKey: boolean): string =>
  isPrimaryKey || ('required' in field && field.required) ? ' NOT NULL' : ''

/**
 * Generate UNIQUE constraint
 */
const generateUniqueConstraint = (field: Fields[number]): string =>
  'unique' in field && field.unique ? ' UNIQUE' : ''

/**
 * Generate DEFAULT clause
 */
const generateDefaultClause = (field: Fields[number]): string => {
  // Auto-timestamp fields get CURRENT_TIMESTAMP default
  if (field.type === 'created-at' || field.type === 'updated-at') {
    return ' DEFAULT CURRENT_TIMESTAMP'
  }

  // Explicit default values
  return 'default' in field && field.default !== undefined
    ? ` DEFAULT ${formatDefaultValue(field.default)}`
    : ''
}

/**
 * Generate column definition with constraints
 */
const generateColumnDefinition = (field: Fields[number], isPrimaryKey: boolean): string => {
  // SERIAL columns for auto-increment fields
  if (shouldUseSerial(field, isPrimaryKey)) {
    return generateSerialColumn(field.name)
  }

  const columnType = mapFieldTypeToPostgres(field)
  const notNull = generateNotNullConstraint(field, isPrimaryKey)
  const unique = generateUniqueConstraint(field)
  const defaultValue = generateDefaultClause(field)
  return `${field.name} ${columnType}${notNull}${unique}${defaultValue}`
}

/**
 * Generate CHECK constraints for array fields with maxItems
 */
const generateArrayConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'array'; maxItems: number } =>
        field.type === 'array' && 'maxItems' in field && typeof field.maxItems === 'number'
    )
    .map(
      (field) =>
        `CONSTRAINT check_${field.name}_max_items CHECK (array_length(${field.name}, 1) IS NULL OR array_length(${field.name}, 1) <= ${field.maxItems})`
    )

/**
 * Generate CHECK constraints for numeric fields with min/max values
 */
const generateNumericConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'integer' | 'decimal' } =>
        (field.type === 'integer' || field.type === 'decimal') &&
        (('min' in field && typeof field.min === 'number') ||
          ('max' in field && typeof field.max === 'number'))
    )
    .map((field) => {
      const hasMin = 'min' in field && typeof field.min === 'number'
      const hasMax = 'max' in field && typeof field.max === 'number'

      const conditions = [
        ...(hasMin ? [`${field.name} >= ${field.min}`] : []),
        ...(hasMax ? [`${field.name} <= ${field.max}`] : []),
      ]

      const constraintName = `check_${field.name}_range`
      const constraintCondition = conditions.join(' AND ')
      return `CONSTRAINT ${constraintName} CHECK (${constraintCondition})`
    })

/**
 * Escape single quotes in SQL string literals to prevent SQL injection
 * PostgreSQL escapes single quotes by doubling them: ' becomes ''
 */
const escapeSQLString = (value: string): string => value.replace(/'/g, "''")

/**
 * Generate CHECK constraints for single-select fields with enum options
 *
 * SECURITY NOTE: Enum options come from validated Effect Schema (SingleSelectFieldSchema).
 * While options are constrained to be strings, we still escape single quotes
 * to prevent SQL injection in case malicious data bypasses schema validation.
 * This follows defense-in-depth security principles.
 */
const generateEnumConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'single-select'; options: readonly string[] } =>
        field.type === 'single-select' && 'options' in field && Array.isArray(field.options)
    )
    .map((field) => {
      const values = field.options.map((opt) => `'${escapeSQLString(opt)}'`).join(', ')
      const constraintName = `check_${field.name}_enum`
      return `CONSTRAINT ${constraintName} CHECK (${field.name} IN (${values}))`
    })

/**
 * Generate UNIQUE constraints for fields with unique property
 */
const generateUniqueConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { unique: true } => 'unique' in field && !!field.unique
    )
    .map((field) => `UNIQUE (${field.name})`)

/**
 * Generate primary key constraint if defined
 */
const generatePrimaryKeyConstraint = (table: Table): readonly string[] => {
  if (table.primaryKey?.type === 'composite' && table.primaryKey.fields) {
    return [`PRIMARY KEY (${table.primaryKey.fields.join(', ')})`]
  }
  return []
}

/**
 * Generate table constraints (CHECK constraints, UNIQUE constraints, primary key, etc.)
 */
const generateTableConstraints = (table: Table): readonly string[] => [
  ...generateArrayConstraints(table.fields),
  ...generateNumericConstraints(table.fields),
  ...generateEnumConstraints(table.fields),
  ...generateUniqueConstraints(table.fields),
  ...generatePrimaryKeyConstraint(table),
]

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

  const columnDefinitions = table.fields.map((field) => {
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
      const indexType = field.type === 'array' ? 'USING gin ' : ''
      return `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table.name} ${indexType}(${field.name})`
    })

  // Create unique indexes for autonumber fields
  const autonumberIndexes = table.fields
    .filter((field) => field.type === 'autonumber')
    .map((field) => {
      const indexName = `idx_${table.name}_${field.name}_unique`
      return `CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${table.name} (${field.name})`
    })

  // Create custom indexes from table.indexes configuration
  const customIndexes =
    table.indexes?.map((index) => {
      const uniqueClause = index.unique ? 'UNIQUE ' : ''
      const fields = index.fields.join(', ')
      return `CREATE ${uniqueClause}INDEX IF NOT EXISTS ${index.name} ON ${table.name} (${fields})`
    }) ?? []

  return [...indexedFields, ...autonumberIndexes, ...customIndexes]
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
const doesColumnTypeMatch = (
  field: Fields[number],
  existingDataType: string
): boolean => {
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
  const columnsToAdd = table.fields.filter((field) => {
    if (!existingColumns.has(field.name)) return true // New column
    const existing = existingColumns.get(field.name)!
    return !doesColumnTypeMatch(field, existing.dataType) // Type mismatch
  })

  // Columns to drop: exist in database but not in schema OR have wrong type
  const columnsToDrop = Array.from(existingColumns.keys()).filter((columnName) => {
    // Never drop protected id column (it's already the correct type at this point)
    if (shouldProtectIdColumn && columnName === 'id') return false

    // Drop if not in schema
    if (!schemaFieldsByName.has(columnName)) return true

    // Drop if type doesn't match (will be recreated with correct type)
    const field = schemaFieldsByName.get(columnName)!
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
 * Execute schema initialization using bun:sql with transaction support
 * Uses Bun's native SQL driver for optimal performance
 *
 * Now supports incremental schema migrations:
 * - For new tables: CREATE TABLE
 * - For existing tables: ALTER TABLE ADD COLUMN for new fields
 *
 * Note: This function intentionally uses imperative patterns for database I/O.
 * Side effects are unavoidable when executing DDL statements against PostgreSQL.
 */
/* eslint-disable functional/no-expression-statements, functional/no-loop-statements */
const executeSchemaInit = async (databaseUrl: string, tables: readonly Table[]): Promise<void> => {
  const db = new SQL(databaseUrl)

  try {
    /**
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
    await db.begin(async (tx) => {
      for (const table of tables) {
        const exists = await tableExists(tx, table.name)

        if (exists) {
          // Table exists - perform incremental migration
          const existingColumns = await getExistingColumns(tx, table.name)
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

          // Always create indexes (IF NOT EXISTS prevents errors)
          for (const indexSQL of generateIndexStatements(table)) {
            await tx.unsafe(indexSQL)
          }
        } else {
          // Table doesn't exist - create it
          const createTableSQL = generateCreateTableSQL(table)
          await tx.unsafe(createTableSQL)

          for (const indexSQL of generateIndexStatements(table)) {
            await tx.unsafe(indexSQL)
          }
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
