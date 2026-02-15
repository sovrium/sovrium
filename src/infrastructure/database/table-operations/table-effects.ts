/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  shouldUseView,
  generateLookupViewSQL,
  generateLookupViewTriggers,
} from '../lookup-view-generators'
import {
  generateAlterTableStatements,
  syncUniqueConstraints,
  syncForeignKeyConstraints,
  syncCheckConstraints,
  syncIndexes,
  type BunSQLTransaction,
} from '../schema-migration-helpers'
import {
  executeSQL,
  executeSQLStatements,
  getExistingColumns,
  SQLExecutionError,
  type TransactionLike,
} from '../sql-execution'
import { generateTableViewStatements, generateReadOnlyViewTrigger } from '../view-generators'
import { generateCreateTableSQL } from './create-table-sql'
import { recreateTableWithDataEffect } from './migration-utils'
import { applyTableFeatures, applyTableFeaturesWithoutIndexes } from './table-features'
import type { Table } from '@/domain/models/app/table'

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
    yield* syncUniqueConstraints(tx, table, previousSchema)

    // Always sync foreign key constraints to ensure referential actions are up-to-date
    yield* syncForeignKeyConstraints(tx, table, tableUsesView)

    // Always sync CHECK constraints for fields with validation requirements
    yield* syncCheckConstraints(tx, table)

    // Always sync indexes when field indexed property changes or custom indexes are modified
    yield* syncIndexes(tx, table, previousSchema)

    // Apply table features (triggers, RLS) - indexes handled by syncIndexes above
    yield* applyTableFeaturesWithoutIndexes(tx, table)
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
export const createNewTableEffect = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  readonly tableUsesView?: ReadonlyMap<string, boolean>
  readonly skipForeignKeys?: boolean
  readonly hasAuthConfig?: boolean
}): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, tableUsesView, skipForeignKeys, hasAuthConfig = true } = params
    // Wrap DDL generation in Effect.try to catch synchronous errors (e.g., unknown field types)
    const createTableSQL = yield* Effect.try({
      try: () => generateCreateTableSQL(table, tableUsesView, skipForeignKeys, hasAuthConfig),
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
    // Views are dropped globally in schema-initializer.ts before this function is called
    // This ensures all obsolete views are removed before creating new ones

    // Only create views if table has views defined
    if (!table.views || table.views.length === 0) {
      return
    }

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

        // For regular (non-materialized) views, add read-only triggers
        // PostgreSQL views can be automatically updatable, so we need triggers to prevent modifications
        if (!view.materialized) {
          const readOnlyTriggerSQL = generateReadOnlyViewTrigger(view.id)
          /* eslint-disable functional/no-loop-statements */
          for (const triggerSQL of readOnlyTriggerSQL) {
            yield* executeSQL(tx, triggerSQL)
          }
          /* eslint-enable functional/no-loop-statements */
        }

        // Refresh materialized view if requested
        if (view.materialized && view.refreshOnMigration) {
          yield* executeSQL(tx, `REFRESH MATERIALIZED VIEW ${viewIdStr}`)
        }
      }
    }
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
  readonly hasAuthConfig?: boolean
}): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, exists, tableUsesView, previousSchema, skipForeignKeys, hasAuthConfig } =
      params
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
      yield* createNewTableEffect({
        tx,
        table,
        tableUsesView,
        skipForeignKeys,
        hasAuthConfig: hasAuthConfig ?? true,
      })
    }
  })
