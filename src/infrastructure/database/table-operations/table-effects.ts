/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { getPhysicalTableName } from '../lookup/lookup-view-generators'
import { type BunSQLTransaction } from '../schema-migration'
import {
  executeSQL,
  getExistingColumns,
  SQLExecutionError,
  type TransactionLike,
} from '../sql/sql-execution'
import { generateCreateTableSQL, type TableDdlOptions } from './create-table-sql'
import { applyTableFeatures } from './table-features'
import { migrateExistingTableEffect } from './table-migrate-effects'
import type { Table } from '@/domain/models/app/tables'

/**
 * Create new table (CREATE statement + indexes + triggers)
 *
 * VIEWs are NOT created here: they are created in a separate phase once all
 * base tables exist, because a lookup/rollup view body references relations
 * this table may be declared before.
 */
export const createNewTableEffect = (
  params: TableDdlOptions & {
    readonly tx: TransactionLike
    readonly table: Table
  }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const {
      tx,
      table,
      tableUsesView,
      skipForeignKeys,
      hasAuthConfig = true,
      tablePrimaryKeyTypes,
    } = params
    // Wrap DDL generation in Effect.try to catch synchronous errors (e.g., unknown field types)
    const createTableSQL = yield* Effect.try({
      try: () =>
        generateCreateTableSQL(table, {
          dialect: tx.dialect,
          tablePrimaryKeyTypes,
          tableUsesView,
          skipForeignKeys,
          hasAuthConfig,
        }),
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
 * Attribute a schema-init failure to the table being created or migrated.
 *
 * The driver reports only its own text — `SQLiteError: NOT NULL constraint
 * failed` — so an operator with twenty tables was told a migration failed but
 * not WHICH one, even though this frame has `table.name` in hand and logs it one
 * line above the error site. The original message is preserved verbatim (it
 * carries the actual reason) and prefixed with the table, so existing greps for
 * the driver text still match.
 */
const withTableContext = (
  error: Readonly<SQLExecutionError>,
  tableName: string
): Readonly<SQLExecutionError> =>
  error.message.includes(`table '${tableName}'`)
    ? error
    : new SQLExecutionError({
        message: `Failed to migrate table '${tableName}': ${error.message}`,
        ...(error.sql === undefined ? {} : { sql: error.sql }),
        cause: error.cause ?? error,
      })

/**
 * Create or migrate table based on existence
 */
export const createOrMigrateTableEffect = (
  params: TableDdlOptions & {
    readonly tx: BunSQLTransaction
    readonly table: Table
    readonly exists: boolean
    readonly previousSchema?: { readonly tables: readonly object[] }
  }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const {
      tx,
      table,
      exists,
      tableUsesView,
      previousSchema,
      skipForeignKeys,
      hasAuthConfig,
      tablePrimaryKeyTypes,
    } = params
    if (exists) {
      // The BASE table's columns for a view-backed table: the view also lists
      // its computed fields, which would read as stored columns to the planner.
      const existingColumns = yield* getExistingColumns(tx, getPhysicalTableName(table))
      yield* migrateExistingTableEffect({
        tx,
        table,
        existingColumns,
        tableUsesView,
        previousSchema,
        skipForeignKeys,
        hasAuthConfig: hasAuthConfig ?? true,
        tablePrimaryKeyTypes,
      })
    } else {
      yield* createNewTableEffect({
        tx,
        table,
        tableUsesView,
        skipForeignKeys,
        hasAuthConfig: hasAuthConfig ?? true,
        tablePrimaryKeyTypes,
      })
    }
  }).pipe(Effect.mapError((error) => withTableContext(error, params.table.name)))
