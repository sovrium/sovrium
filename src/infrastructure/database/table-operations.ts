/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { generateFieldPermissionGrants } from './field-permission-generators'
import { shouldCreateDatabaseColumn } from './field-utils'
import { createVolatileFormulaTriggers } from './formula-trigger-generators'
import { generateIndexStatements } from './index-generators'
import {
  shouldUseView,
  getBaseTableName,
  generateLookupViewSQL,
  generateLookupViewTriggers,
} from './lookup-view-generators'
import {
  generateRLSPolicyStatements,
  generateBasicTableGrants,
  generateAuthenticatedBasedGrants,
  generateRoleBasedGrants,
} from './rls-policy-generators'
import {
  generateAlterTableStatements,
  syncUniqueConstraints,
  syncForeignKeyConstraints,
  syncCheckConstraints,
  type BunSQLTransaction,
} from './schema-migration-helpers'
import {
  executeSQL,
  executeSQLStatements,
  executeSQLStatementsParallel,
  getExistingColumns,
  SQLExecutionError,
  type TransactionLike,
} from './sql-execution'
import { generateColumnDefinition, generateTableConstraints } from './sql-generators'
import {
  generateCreatedAtTriggers,
  generateAutonumberTriggers,
  generateUpdatedByTriggers,
  generateUpdatedAtTriggers,
} from './trigger-generators'
import { generateTableViewStatements, generateDropObsoleteViewsSQL } from './view-generators'
import type { Table } from '@/domain/models/app/table'

/**
 * Normalize PostgreSQL type names by removing size specifications
 */
const normalizeType = (type: string): string =>
  type
    .replace(/\(\d+\)/, '') // Remove (N) like varchar(255) -> varchar
    .replace(/\(\d+,\s*\d+\)/, '') // Remove (N,M) like numeric(10,2) -> numeric
    .trim()

/**
 * Type compatibility groups - types within a group can be safely copied between each other
 */
const TYPE_COMPATIBILITY_GROUPS: readonly (readonly string[])[] = [
  // Integer types (can be widened but not narrowed, but for recreation we allow same family)
  ['smallint', 'integer', 'bigint', 'int2', 'int4', 'int8'],
  // Text types
  ['text', 'varchar', 'character varying', 'char', 'character', 'bpchar'],
  // Boolean
  ['boolean', 'bool'],
  // Floating point
  ['real', 'double precision', 'float4', 'float8'],
  // Numeric/Decimal
  ['numeric', 'decimal'],
  // Date/Time
  ['timestamp', 'timestamp without time zone', 'timestamp with time zone', 'timestamptz'],
  ['date'],
  ['time', 'time without time zone', 'time with time zone', 'timetz'],
  // UUID
  ['uuid'],
  // JSON
  ['json', 'jsonb'],
]

/**
 * Check if two PostgreSQL data types are compatible for data copying
 * Returns true if data can be safely copied from oldType to newType
 */
const areTypesCompatible = (oldType: string, newType: string): boolean => {
  // Exact match is always compatible
  if (oldType === newType) return true

  const normalizedOld = normalizeType(oldType)
  const normalizedNew = normalizeType(newType)

  if (normalizedOld === normalizedNew) return true

  // Check if both types are in the same compatibility group
  return TYPE_COMPATIBILITY_GROUPS.some(
    (group) => group.includes(normalizedOld) && group.includes(normalizedNew)
  )
}

/**
 * Generate automatic id column definition based on primary key type
 * @param primaryKeyType - Type of primary key (uuid, bigserial, or default serial)
 * @param isPrimaryKey - Whether this id column is the primary key (adds PRIMARY KEY constraint inline)
 */
const generateIdColumn = (primaryKeyType: string | undefined, isPrimaryKey: boolean): string => {
  const pkConstraint = isPrimaryKey ? ' PRIMARY KEY' : ''
  if (primaryKeyType === 'uuid') {
    return `id UUID NOT NULL DEFAULT gen_random_uuid()${pkConstraint}`
  }
  if (primaryKeyType === 'bigserial') {
    return `id BIGSERIAL NOT NULL${pkConstraint}`
  }
  return `id SERIAL NOT NULL${pkConstraint}`
}

/**
 * Determine if table needs an automatic id column
 * Creates automatic id column if:
 * - No explicit id field is defined in the fields array
 * - Either: no primary key is defined OR primary key references the special 'id' field
 */
const needsAutomaticIdColumn = (table: Table, primaryKeyFields: readonly string[]): boolean => {
  const hasIdField = table.fields.some((field) => field.name === 'id')
  const primaryKeyReferencesId = primaryKeyFields.includes('id')
  const hasNonIdPrimaryKey = primaryKeyFields.length > 0 && !primaryKeyReferencesId
  return !hasIdField && !hasNonIdPrimaryKey
}

/**
 * Generate created_at column definition if not explicitly defined
 * Note: No DEFAULT clause - value will be set by trigger to avoid volatility issues with formulas
 */
const generateCreatedAtColumn = (table: Table): readonly string[] => {
  const hasCreatedAtField = table.fields.some((field) => field.name === 'created_at')
  return !hasCreatedAtField ? ['created_at TIMESTAMPTZ NOT NULL'] : []
}

/**
 * Generate updated_at column definition if not explicitly defined
 * Note: No DEFAULT clause - value will be set by trigger to avoid volatility issues with formulas
 */
const generateUpdatedAtColumn = (table: Table): readonly string[] => {
  const hasUpdatedAtField = table.fields.some((field) => field.name === 'updated_at')
  return !hasUpdatedAtField ? ['updated_at TIMESTAMPTZ NOT NULL'] : []
}

/**
 * Generate deleted_at column definition if not explicitly defined
 */
const generateDeletedAtColumn = (table: Table): readonly string[] => {
  const hasDeletedAtField = table.fields.some((field) => field.name === 'deleted_at')
  return !hasDeletedAtField ? ['deleted_at TIMESTAMPTZ'] : []
}

/**
 * Generate primary key constraint if needed
 */
const generatePrimaryKeyConstraintIfNeeded = (
  table: Table,
  primaryKeyFields: readonly string[]
): readonly string[] =>
  needsAutomaticIdColumn(table, primaryKeyFields) && primaryKeyFields.length === 0
    ? ['PRIMARY KEY (id)']
    : []

/**
 * Generate CREATE TABLE statement
 * When table has lookup fields, creates a base table (_base suffix) and will later create a VIEW
 *
 * @param table - Table definition
 * @param tableUsesView - Map of table names to whether they use a VIEW
 * @param skipForeignKeys - Skip foreign key constraints (for circular dependencies)
 */
export const generateCreateTableSQL = (
  table: Table,
  tableUsesView?: ReadonlyMap<string, boolean>,
  skipForeignKeys?: boolean
): string => {
  // Determine table name (add _base suffix if using VIEW for lookup fields)
  const tableName = shouldUseView(table) ? getBaseTableName(table.name) : table.name

  // Identify primary key fields
  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []

  // Generate automatic id column based on primary key type
  // Add PRIMARY KEY inline if the primary key is on the 'id' field
  const primaryKeyOnId = primaryKeyFields.length === 1 && primaryKeyFields[0] === 'id'
  const idColumnDefinition = needsAutomaticIdColumn(table, primaryKeyFields)
    ? [generateIdColumn(table.primaryKey?.type, primaryKeyOnId)]
    : []

  // Filter out UI-only fields (like button), lookup fields, and rollup fields (handled by VIEW)
  // Lookup and rollup fields don't exist as columns in the base table
  const columnDefinitions = table.fields
    .filter(
      (field) =>
        shouldCreateDatabaseColumn(field) && field.type !== 'lookup' && field.type !== 'rollup'
    )
    .map((field) => {
      // Only add inline PRIMARY KEY for single-field composite keys (handled by generateSerialColumn)
      // Multi-field composite keys must have PRIMARY KEY at table level to avoid "multiple primary keys" error
      const isPrimaryKey = primaryKeyFields.includes(field.name) && primaryKeyFields.length === 1
      return generateColumnDefinition(field, isPrimaryKey, table.fields)
    })

  // Add PRIMARY KEY constraint on id if no custom primary key is defined
  const tableConstraints = generateTableConstraints(table, tableUsesView, skipForeignKeys)

  const allDefinitions = [
    ...idColumnDefinition,
    ...generateCreatedAtColumn(table),
    ...generateUpdatedAtColumn(table),
    ...generateDeletedAtColumn(table),
    ...columnDefinitions,
    ...tableConstraints,
    ...generatePrimaryKeyConstraintIfNeeded(table, primaryKeyFields),
  ]

  return `CREATE TABLE IF NOT EXISTS ${tableName} (
  ${allDefinitions.join(',\n  ')}
)`
}

// executeSQLStatements is now imported from sql-execution.ts as executeSQLStatementsAsync

/**
 * Apply table features (indexes, triggers, RLS policies, field permissions)
 * Shared by both createNewTable and migrateExistingTable
 * Note: Triggers and policies are applied to the base table, not the VIEW
 *
 * Performance optimization: Operations are grouped by dependency:
 * - Group 1 (parallel): indexes, triggers (created-at, autonumber, updated-by, formula)
 * - Group 2 (sequential): RLS policies (depends on table existing)
 * - Group 3 (parallel): grants (basic, authenticated, role-based, field-level)
 */
const applyTableFeatures = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // Determine actual table name (base table if using VIEW)
    const physicalTableName = shouldUseView(table) ? getBaseTableName(table.name) : table.name

    // Create table object with physical table name for trigger/policy generation
    const physicalTable = shouldUseView(table) ? { ...table, name: physicalTableName } : table

    // Group 1: Indexes and triggers (can run in parallel - all independent)
    // These create IF NOT EXISTS so order doesn't matter
    yield* Effect.all(
      [
        executeSQLStatementsParallel(tx, generateIndexStatements(physicalTable)),
        executeSQLStatements(tx, generateCreatedAtTriggers(physicalTable)),
        executeSQLStatements(tx, generateAutonumberTriggers(physicalTable)),
        executeSQLStatements(tx, generateUpdatedByTriggers(physicalTable)),
        executeSQLStatements(tx, generateUpdatedAtTriggers(physicalTable)),
        Effect.promise(() => createVolatileFormulaTriggers(tx, physicalTableName, table.fields)),
      ],
      { concurrency: 'unbounded' }
    )

    // Group 2: RLS policies (sequential - must run after table is fully set up)
    // RLS policies depend on the table existing with all columns
    yield* executeSQLStatements(tx, generateRLSPolicyStatements(physicalTable))

    // Group 3: Grants (can run in parallel - all independent)
    // Grant operations don't depend on each other
    yield* Effect.all(
      [
        executeSQLStatementsParallel(tx, generateBasicTableGrants(physicalTable)),
        executeSQLStatementsParallel(tx, generateAuthenticatedBasedGrants(physicalTable)),
        executeSQLStatementsParallel(tx, generateRoleBasedGrants(physicalTable)),
        executeSQLStatementsParallel(tx, generateFieldPermissionGrants(physicalTable)),
      ],
      { concurrency: 'unbounded' }
    )
  })

/**
 * Get compatible columns between existing and new table for data migration
 */
const getCompatibleColumns = (
  existingColumns: ReadonlyMap<string, { dataType: string; isNullable: string }>,
  newColumnInfo: ReadonlyMap<string, { columnDefault: string | null; dataType: string }>
): readonly string[] =>
  Array.from(existingColumns.keys()).filter((col) => {
    const newColInfo = newColumnInfo.get(col)
    if (!newColInfo) return false
    const oldType = existingColumns.get(col)?.dataType.toLowerCase() ?? ''
    return areTypesCompatible(oldType, newColInfo.dataType.toLowerCase())
  })

interface CopyDataParams {
  readonly tx: TransactionLike
  readonly tempTableName: string
  readonly physicalTableName: string
  readonly commonColumns: readonly string[]
  readonly newColumnInfo: ReadonlyMap<string, { columnDefault: string | null; dataType: string }>
}

/**
 * Copy data and reset SERIAL sequences for migration
 */
const copyDataAndResetSequences = (
  params: CopyDataParams
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, tempTableName, physicalTableName, commonColumns, newColumnInfo } = params
    if (commonColumns.length === 0) return

    const columnList = commonColumns.join(', ')
    yield* executeSQL(
      tx,
      `INSERT INTO ${tempTableName} (${columnList}) SELECT ${columnList} FROM ${physicalTableName}`
    )

    // Reset SERIAL sequences to max value + 1 to avoid conflicts
    const serialColumns = commonColumns.filter((col) =>
      newColumnInfo.get(col)?.columnDefault?.includes('nextval')
    )
    yield* Effect.forEach(serialColumns, (col) =>
      executeSQL(
        tx,
        `SELECT setval(pg_get_serial_sequence('${tempTableName}', '${col}'), COALESCE((SELECT MAX(${col}) FROM ${tempTableName}), 1), true)`
      )
    )
  })

/**
 * Recreate table with data preservation when schema changes are incompatible with ALTER TABLE
 * Used when primary key type changes or other incompatible schema modifications occur
 */
/* eslint-disable-next-line max-lines-per-function */
const recreateTableWithDataEffect = (
  tx: TransactionLike,
  table: Table,
  existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >,
  tableUsesView?: ReadonlyMap<string, boolean>
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const physicalTableName = shouldUseView(table) ? getBaseTableName(table.name) : table.name
    const tempTableName = `${physicalTableName}_migration_temp`

    // Create temporary table with new schema
    // Wrap DDL generation in Effect.try to catch synchronous errors (e.g., unknown field types)
    const createTableSQL = yield* Effect.try({
      try: () =>
        generateCreateTableSQL(table, tableUsesView).replace(
          `CREATE TABLE IF NOT EXISTS ${physicalTableName}`,
          `CREATE TABLE ${tempTableName}`
        ),
      catch: (error) =>
        new SQLExecutionError({
          message: `Failed to generate CREATE TABLE DDL for migration: ${String(error)}`,
          cause: error,
        }),
    })
    yield* executeSQL(tx, createTableSQL)

    // Get new table column info
    const newTableColumns = yield* executeSQL(
      tx,
      `SELECT column_name, column_default, data_type FROM information_schema.columns WHERE table_name = '${tempTableName}'`
    )
    const newColumnInfo = new Map(
      (
        newTableColumns as readonly {
          column_name: string
          column_default: string | null
          data_type: string
        }[]
      ).map((row) => [
        row.column_name,
        { columnDefault: row.column_default, dataType: row.data_type },
      ])
    )

    // Copy data from compatible columns
    const commonColumns = getCompatibleColumns(existingColumns, newColumnInfo)
    yield* copyDataAndResetSequences({
      tx,
      tempTableName,
      physicalTableName,
      commonColumns,
      newColumnInfo,
    })

    // Drop old table and rename temp table
    yield* executeSQL(tx, `DROP TABLE ${physicalTableName} CASCADE`)
    yield* executeSQL(tx, `ALTER TABLE ${tempTableName} RENAME TO ${physicalTableName}`)

    // Rename primary key constraint to match original table name (ignore if not exists)
    yield* executeSQL(
      tx,
      `DO $$ BEGIN ALTER TABLE ${physicalTableName} RENAME CONSTRAINT ${tempTableName}_pkey TO ${physicalTableName}_pkey; EXCEPTION WHEN undefined_object THEN NULL; END $$`
    )
  })

/**
 * Configuration for table migration operations
 */
export type MigrationConfig = {
  readonly tableUsesView?: ReadonlyMap<string, boolean>
  readonly previousSchema?: { readonly tables: readonly object[] }
}

/**
 * Migrate existing table (ALTER statements + constraints + indexes)
 */
export const migrateExistingTableEffect = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  readonly existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >
  readonly tableUsesView?: ReadonlyMap<string, boolean>
  readonly previousSchema?: { readonly tables: readonly object[] }
}): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, existingColumns, tableUsesView, previousSchema } = params
    const alterStatements = generateAlterTableStatements(table, existingColumns, previousSchema)

    // If alterStatements is empty, table has incompatible schema changes
    // (e.g., primary key type change) - need to recreate with data preservation
    if (alterStatements.length === 0) {
      yield* recreateTableWithDataEffect(tx, table, existingColumns, tableUsesView)
    } else {
      // Apply incremental migrations
      yield* executeSQLStatements(tx, alterStatements)
    }

    // Always add/update unique constraints for existing tables
    yield* syncUniqueConstraints(tx, table)

    // Always sync foreign key constraints to ensure referential actions are up-to-date
    yield* syncForeignKeyConstraints(tx, table, tableUsesView)

    // Always sync CHECK constraints for fields with validation requirements
    yield* syncCheckConstraints(tx, table)

    // Apply all table features (indexes, triggers, RLS)
    yield* applyTableFeatures(tx, table)
  })

/**
 * Create new table (CREATE statement + indexes + triggers)
 * Note: VIEWs are created in a separate phase after all base tables exist
 *
 * @param tx - Transaction object
 * @param table - Table definition
 * @param tableUsesView - Map of table names to whether they use a VIEW
 * @param skipForeignKeys - Skip foreign key constraints (for circular dependencies)
 */
export const createNewTableEffect = (
  tx: TransactionLike,
  table: Table,
  tableUsesView?: ReadonlyMap<string, boolean>,
  skipForeignKeys?: boolean
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // Wrap DDL generation in Effect.try to catch synchronous errors (e.g., unknown field types)
    const createTableSQL = yield* Effect.try({
      try: () => generateCreateTableSQL(table, tableUsesView, skipForeignKeys),
      catch: (error) =>
        new SQLExecutionError({
          message: `Failed to generate CREATE TABLE DDL: ${String(error)}`,
          cause: error,
        }),
    })
    yield* executeSQL(tx, createTableSQL)

    // Apply all table features (indexes, triggers, RLS)
    yield* applyTableFeatures(tx, table)
  })

/**
 * Create lookup VIEWs for tables with lookup fields
 * Called after all base tables have been created to avoid dependency issues
 */
export const createLookupViewsEffect = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (shouldUseView(table)) {
      const createViewSQL = generateLookupViewSQL(table)
      if (createViewSQL) {
        // Drop existing table if it exists (to allow VIEW creation)
        // This handles the transition from TABLE to VIEW when rollup/lookup fields are added
        yield* executeSQL(tx, `DROP TABLE IF EXISTS ${table.name} CASCADE`)

        yield* executeSQL(tx, createViewSQL)

        // Create INSTEAD OF triggers to make the VIEW writable
        const triggerStatements = generateLookupViewTriggers(table)
        yield* executeSQLStatements(tx, triggerStatements)
      }
    }
  })

/**
 * Create table views (user-defined VIEWs from table.views configuration)
 * Called after all tables and lookup views have been created
 */
export const createTableViewsEffect = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // Only process tables that have views defined
    if (!table.views || table.views.length === 0) {
      return
    }

    // Drop obsolete views first
    yield* Effect.promise(() => generateDropObsoleteViewsSQL(tx, table))

    // Drop and recreate each view (PostgreSQL doesn't support IF NOT EXISTS for views)
    const viewSQL = generateTableViewStatements(table)

    // Process each view sequentially (views may depend on each other)
    /* eslint-disable functional/no-loop-statements */
    for (const view of table.views) {
      // Convert view.id to string (ViewId can be number or string)
      const viewIdStr = String(view.id)

      // Drop existing view or materialized view (if any)
      // Try both types since we don't know what exists in the database
      if (view.materialized) {
        yield* executeSQL(tx, `DROP MATERIALIZED VIEW IF EXISTS ${viewIdStr} CASCADE`)
      } else {
        yield* executeSQL(tx, `DROP VIEW IF EXISTS ${viewIdStr} CASCADE`)
      }

      // Create view (regular or materialized)
      const createSQL = viewSQL.find((sql) => sql.includes(viewIdStr))
      if (createSQL) {
        yield* executeSQL(tx, createSQL)

        // Refresh materialized view if requested
        if (view.materialized && view.refreshOnMigration) {
          yield* executeSQL(tx, `REFRESH MATERIALIZED VIEW ${viewIdStr}`)
        }
      }
    }
    /* eslint-enable functional/no-loop-statements */
  })

/**
 * Create or migrate table based on existence
 */
export const createOrMigrateTableEffect = (params: {
  readonly tx: BunSQLTransaction
  readonly table: Table
  readonly exists: boolean
  readonly tableUsesView?: ReadonlyMap<string, boolean>
  readonly previousSchema?: { readonly tables: readonly object[] }
  readonly skipForeignKeys?: boolean
}): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, exists, tableUsesView, previousSchema, skipForeignKeys } = params
    if (exists) {
      const existingColumns = yield* getExistingColumns(tx, table.name)
      yield* migrateExistingTableEffect({
        tx,
        table,
        existingColumns,
        tableUsesView,
        previousSchema,
      })
    } else {
      yield* createNewTableEffect(tx, table, tableUsesView, skipForeignKeys)
    }
  })
