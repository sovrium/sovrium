/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { Client } from 'pg'
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
 * Create a PostgreSQL client effect with automatic cleanup
 * Note: Client type is from external pg library and cannot be made readonly
 */
const withClient = <A>(
  databaseUrl: string,
  // eslint-disable-next-line functional/prefer-immutable-types
  f: (client: Client) => Promise<A>
): Effect.Effect<A, Error> =>
  Effect.acquireUseRelease(
    Effect.tryPromise({
      try: async () => {
        const client = new Client({ connectionString: databaseUrl })
        // eslint-disable-next-line functional/no-expression-statements -- side effect required for database connection
        await client.connect()
        return client
      },
      catch: (error) => new Error(`Failed to connect: ${String(error)}`),
    }),
    (client) =>
      Effect.tryPromise({
        try: () => f(client),
        catch: (error) => new Error(`Query failed: ${String(error)}`),
      }),
    (client) => Effect.promise(() => client.end())
  )

/**
 * Execute a single table's schema initialization
 * Note: Client type is from external pg library and cannot be made readonly
 */
// eslint-disable-next-line functional/prefer-immutable-types
const initializeTable = (client: Client, table: Table): Promise<void> =>
  Promise.resolve()
    .then(() => client.query(generateCreateTableSQL(table)))
    .then(() =>
      generateIndexStatements(table).reduce(
        (promise, indexSQL) => promise.then(() => client.query(indexSQL)).then(() => undefined),
        Promise.resolve()
      )
    )

/**
 * Initialize database schema from app configuration
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

    // Execute schema initialization with proper resource management
    yield* withClient(databaseUrl, (client) =>
      app.tables!.reduce(
        (promise, table) => promise.then(() => initializeTable(client, table)),
        Promise.resolve()
      )
    ).pipe(
      Effect.catchAll((error) =>
        Console.error(`Error initializing database schema: ${error.message}`).pipe(
          Effect.flatMap(() => Effect.void)
        )
      )
    )

    yield* Console.log('✓ Database schema initialized successfully')
  })
