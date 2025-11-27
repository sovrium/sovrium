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
 * Generate column definition with constraints
 */
const generateColumnDefinition = (field: Fields[number], isPrimaryKey: boolean): string => {
  // Autonumber fields use SERIAL (auto-incrementing integer with sequence)
  if (field.type === 'autonumber') {
    return `${field.name} SERIAL NOT NULL`
  }

  // Integer primary key fields also use SERIAL for auto-increment
  if (field.type === 'integer' && isPrimaryKey) {
    return `${field.name} SERIAL NOT NULL`
  }

  const columnType = mapFieldTypeToPostgres(field)
  // Primary key fields must always be NOT NULL, otherwise use the required flag
  const notNull = isPrimaryKey || ('required' in field && field.required) ? ' NOT NULL' : ''
  return `${field.name} ${columnType}${notNull}`
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
  const primaryKeyConstraint =
    !hasCustomPrimaryKey && !hasIdField ? ['PRIMARY KEY (id)'] : []

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

  return [...indexedFields, ...autonumberIndexes]
}

/**
 * Execute schema initialization using bun:sql with transaction support
 * Uses Bun's native SQL driver for optimal performance
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
        const createTableSQL = generateCreateTableSQL(table)
        await tx.unsafe(createTableSQL)

        for (const indexSQL of generateIndexStatements(table)) {
          await tx.unsafe(indexSQL)
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
