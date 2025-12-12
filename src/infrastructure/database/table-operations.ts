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
  type BunSQLTransaction,
} from './schema-migration-helpers'
import {
  executeSQL,
  executeSQLStatements,
  executeSQLStatementsParallel,
  getExistingColumns,
  type TransactionLike,
  type SQLExecutionError,
} from './sql-execution'
import { generateColumnDefinition, generateTableConstraints } from './sql-generators'
import {
  generateCreatedAtTriggers,
  generateAutonumberTriggers,
  generateUpdatedByTriggers,
} from './trigger-generators'
import { generateTableViewStatements, generateDropObsoleteViewsSQL } from './view-generators'
import type { Table } from '@/domain/models/app/table'

/**
 * Generate automatic id column definition based on primary key type
 */
const generateIdColumn = (primaryKeyType: string | undefined): string => {
  if (primaryKeyType === 'uuid') {
    return 'id UUID NOT NULL DEFAULT gen_random_uuid()'
  }
  if (primaryKeyType === 'bigserial') {
    return 'id BIGSERIAL NOT NULL'
  }
  return 'id SERIAL NOT NULL'
}

/**
 * Determine if table needs an automatic id column
 */
const needsAutomaticIdColumn = (table: Table, primaryKeyFields: readonly string[]): boolean => {
  const hasIdField = table.fields.some((field) => field.name === 'id')
  const hasCustomPrimaryKey = primaryKeyFields.length > 0
  return !hasIdField && !hasCustomPrimaryKey
}

/**
 * Generate CREATE TABLE statement
 * When table has lookup fields, creates a base table (_base suffix) and will later create a VIEW
 */
export const generateCreateTableSQL = (
  table: Table,
  tableUsesView?: ReadonlyMap<string, boolean>
): string => {
  // Determine table name (add _base suffix if using VIEW for lookup fields)
  const tableName = shouldUseView(table) ? getBaseTableName(table.name) : table.name

  // Identify primary key fields
  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []

  // Generate automatic id column based on primary key type
  const idColumnDefinition = needsAutomaticIdColumn(table, primaryKeyFields)
    ? [generateIdColumn(table.primaryKey?.type)]
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
  const tableConstraints = generateTableConstraints(table, tableUsesView)

  // If no explicit primary key is defined, add PRIMARY KEY on id
  const primaryKeyConstraint = needsAutomaticIdColumn(table, primaryKeyFields)
    ? ['PRIMARY KEY (id)']
    : []

  const allDefinitions = [
    ...idColumnDefinition,
    ...columnDefinitions,
    ...tableConstraints,
    ...primaryKeyConstraint,
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
 * Migrate existing table (ALTER statements + constraints + indexes)
 */
export const migrateExistingTableEffect = (
  tx: TransactionLike,
  table: Table,
  existingColumns: ReadonlyMap<string, { dataType: string; isNullable: string }>,
  tableUsesView?: ReadonlyMap<string, boolean>
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const alterStatements = generateAlterTableStatements(table, existingColumns)

    // If alterStatements is empty, table has incompatible schema changes
    // (e.g., primary key type change) - drop and recreate
    if (alterStatements.length === 0) {
      yield* executeSQL(tx, `DROP TABLE ${table.name} CASCADE`)
      const createTableSQL = generateCreateTableSQL(table, tableUsesView)
      yield* executeSQL(tx, createTableSQL)
    } else {
      // Apply incremental migrations
      yield* executeSQLStatements(tx, alterStatements)
    }

    // Always add/update unique constraints for existing tables
    yield* Effect.promise(() => syncUniqueConstraints(tx, table))

    // Always sync foreign key constraints to ensure referential actions are up-to-date
    yield* Effect.promise(() => syncForeignKeyConstraints(tx, table, tableUsesView))

    // Apply all table features (indexes, triggers, RLS)
    yield* applyTableFeatures(tx, table)
  })

/**
 * Migrate existing table (async version for backward compatibility)
 * @deprecated Prefer using migrateExistingTableEffect directly
 */
/* eslint-disable functional/no-expression-statements */
export const migrateExistingTable = async (
  tx: TransactionLike,
  table: Table,
  existingColumns: ReadonlyMap<string, { dataType: string; isNullable: string }>,
  tableUsesView?: ReadonlyMap<string, boolean>
): Promise<void> => {
  await Effect.runPromise(migrateExistingTableEffect(tx, table, existingColumns, tableUsesView))
}
/* eslint-enable functional/no-expression-statements */

/**
 * Create new table (CREATE statement + indexes + triggers)
 * Note: VIEWs are created in a separate phase after all base tables exist
 */
export const createNewTableEffect = (
  tx: TransactionLike,
  table: Table,
  tableUsesView?: ReadonlyMap<string, boolean>
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const createTableSQL = generateCreateTableSQL(table, tableUsesView)
    yield* executeSQL(tx, createTableSQL)

    // Apply all table features (indexes, triggers, RLS)
    yield* applyTableFeatures(tx, table)
  })

/**
 * Create new table (async version for backward compatibility)
 * @deprecated Prefer using createNewTableEffect directly
 */
/* eslint-disable functional/no-expression-statements */
export const createNewTable = async (
  tx: TransactionLike,
  table: Table,
  tableUsesView?: ReadonlyMap<string, boolean>
): Promise<void> => {
  await Effect.runPromise(createNewTableEffect(tx, table, tableUsesView))
}
/* eslint-enable functional/no-expression-statements */

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
 * Create lookup VIEWs (async version for backward compatibility)
 * @deprecated Prefer using createLookupViewsEffect directly
 */
/* eslint-disable functional/no-expression-statements */
export const createLookupViews = async (tx: TransactionLike, table: Table): Promise<void> => {
  await Effect.runPromise(createLookupViewsEffect(tx, table))
}
/* eslint-enable functional/no-expression-statements */

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
 * Create table views (async version for backward compatibility)
 * @deprecated Prefer using createTableViewsEffect directly
 */
/* eslint-disable functional/no-expression-statements */
export const createTableViews = async (tx: TransactionLike, table: Table): Promise<void> => {
  await Effect.runPromise(createTableViewsEffect(tx, table))
}
/* eslint-enable functional/no-expression-statements */

/**
 * Create or migrate table based on existence
 */
export const createOrMigrateTableEffect = (
  tx: BunSQLTransaction,
  table: Table,
  exists: boolean,
  tableUsesView?: ReadonlyMap<string, boolean>
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (exists) {
      const existingColumns = yield* getExistingColumns(tx, table.name)
      yield* migrateExistingTableEffect(tx, table, existingColumns, tableUsesView)
    } else {
      yield* createNewTableEffect(tx, table, tableUsesView)
    }
  })

/**
 * Create or migrate table (async version for backward compatibility)
 * @deprecated Prefer using createOrMigrateTableEffect directly
 */
/* eslint-disable functional/no-expression-statements */
export const createOrMigrateTable = async (
  tx: BunSQLTransaction,
  table: Table,
  exists: boolean,
  tableUsesView?: ReadonlyMap<string, boolean>
): Promise<void> => {
  await Effect.runPromise(createOrMigrateTableEffect(tx, table, exists, tableUsesView))
}
/* eslint-enable functional/no-expression-statements */
