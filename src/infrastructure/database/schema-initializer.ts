/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { Effect, Console } from 'effect'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/table'
import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Field type to PostgreSQL type mapping
 */
const fieldTypeToPostgresMap: Record<string, string> = {
  integer: 'INTEGER',
  autonumber: 'INTEGER',
  decimal: 'DECIMAL',
  'single-line-text': 'TEXT',
  'long-text': 'TEXT',
  email: 'TEXT',
  url: 'TEXT',
  'phone-number': 'TEXT',
  'rich-text': 'TEXT',
  checkbox: 'BOOLEAN',
  date: 'TIMESTAMP',
  'single-select': 'TEXT',
  status: 'TEXT',
  'multi-select': 'TEXT[]',
  currency: 'DECIMAL',
  percentage: 'DECIMAL',
  rating: 'INTEGER',
  duration: 'INTEGER',
  color: 'VARCHAR(7)',
  progress: 'DECIMAL',
  json: 'JSONB',
  geolocation: 'POINT',
  barcode: 'TEXT',
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
  return fieldTypeToPostgresMap[field.type] ?? 'TEXT'
}

/**
 * Generate column definition with constraints
 */
const generateColumnDefinition = (field: Fields[number]): string => {
  const columnType = mapFieldTypeToPostgres(field)
  const notNull = 'required' in field && field.required ? ' NOT NULL' : ''
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
 * Generate primary key constraint if defined
 */
const generatePrimaryKeyConstraint = (table: Table): readonly string[] => {
  if (table.primaryKey?.type === 'composite' && table.primaryKey.fields) {
    return [`PRIMARY KEY (${table.primaryKey.fields.join(', ')})`]
  }
  return []
}

/**
 * Generate table constraints (CHECK constraints, primary key, etc.)
 */
const generateTableConstraints = (table: Table): readonly string[] => [
  ...generateArrayConstraints(table.fields),
  ...generatePrimaryKeyConstraint(table),
]

/**
 * Generate CREATE TABLE statement
 */
const generateCreateTableSQL = (table: Table): string => {
  const columnDefinitions = table.fields.map(generateColumnDefinition)
  const tableConstraints = generateTableConstraints(table)
  const allDefinitions = [...columnDefinitions, ...tableConstraints]

  return `CREATE TABLE IF NOT EXISTS ${table.name} (
  ${allDefinitions.join(',\n  ')}
)`
}

/**
 * Generate CREATE INDEX statements for indexed fields
 */
const generateIndexStatements = (table: Table): readonly string[] =>
  table.fields
    .filter(
      (field): field is Fields[number] & { indexed: true } => 'indexed' in field && !!field.indexed
    )
    .map((field) => {
      const indexName = `idx_${table.name}_${field.name}`
      const indexType = field.type === 'array' ? 'USING gin ' : ''
      return `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table.name} ${indexType}(${field.name})`
    })

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
    // Execute all DDL in a single transaction for atomicity
    await db.begin(async (tx) => {
      for (const table of tables) {
        // Create table
        const createTableSQL = generateCreateTableSQL(table)
        await tx.unsafe(createTableSQL)

        // Create indexes
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
 * Initialize database schema from app configuration
 *
 * Uses Bun's native SQL driver (bun:sql) for:
 * - Zero-dependency PostgreSQL access
 * - Optimal performance on Bun runtime
 * - Built-in connection pooling
 * - Transaction support with automatic rollback
 *
 * @see docs/infrastructure/database/runtime-sql-migrations/04-migration-executor.md
 */
export const initializeSchema = (app: App): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // Skip if no tables defined
    if (!app.tables || app.tables.length === 0) {
      yield* Console.log('No tables defined, skipping schema initialization')
      return
    }

    // Get database URL from environment
    const databaseUrl = Bun.env.DATABASE_URL
    if (!databaseUrl) {
      yield* Console.log('No DATABASE_URL found, skipping schema initialization')
      return
    }

    yield* Console.log('Initializing database schema...')

    // Execute schema initialization with bun:sql
    yield* Effect.tryPromise({
      try: () => executeSchemaInit(databaseUrl, app.tables!),
      catch: (error) => new Error(`Schema initialization failed: ${String(error)}`),
    }).pipe(
      Effect.catchAll((error) =>
        Console.error(`Error initializing database schema: ${error.message}`).pipe(
          Effect.flatMap(() => Effect.void)
        )
      )
    )

    yield* Console.log('✓ Database schema initialized successfully')
  })
