/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/utils/database/sql-formatting'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  shouldUseView,
  generateLookupViewSQL,
  generateLookupViewTriggers,
} from '../lookup/lookup-view-generators'
import {
  generateAlterTableStatements,
  syncUniqueConstraints,
  syncForeignKeyConstraints,
  syncCheckConstraints,
  syncIndexes,
  type BunSQLTransaction,
} from '../schema/schema-migration-helpers'
import {
  executeSQL,
  executeSQLStatements,
  getExistingColumns,
  SQLExecutionError,
  type TransactionLike,
} from '../sql/sql-execution'
import { generateTableViewStatements, generateReadOnlyViewTrigger } from '../views/view-generators'
import { generateCreateTableSQL } from './create-table-sql'
import { recreateTableWithDataEffect } from './migration-utils'
import { applyTableFeatures, applyTableFeaturesWithoutIndexes } from './table-features'
import type { Table } from '@/domain/models/app/tables'

type TableView = NonNullable<Table['views']>[number]

export type MigrationConfig = {
  readonly tableUsesView?: ReadonlyMap<string, boolean>
  readonly previousSchema?: { readonly tables: readonly object[] }
}

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

    if (alterStatements.length === 0) {
      yield* recreateTableWithDataEffect(tx, table, existingColumns, tableUsesView)
    } else {
      yield* executeSQLStatements(tx, alterStatements)
    }

    yield* syncUniqueConstraints(tx, table, previousSchema)

    yield* syncForeignKeyConstraints(tx, table, tableUsesView)

    yield* syncCheckConstraints(tx, table)

    yield* syncIndexes(tx, table, previousSchema)

    yield* applyTableFeaturesWithoutIndexes(tx, table)
  })

export const createNewTableEffect = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  readonly tableUsesView?: ReadonlyMap<string, boolean>
  readonly skipForeignKeys?: boolean
  readonly hasAuthConfig?: boolean
  readonly tablePrimaryKeyTypes?: ReadonlyMap<string, string | undefined>
}): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const {
      tx,
      table,
      tableUsesView,
      skipForeignKeys,
      hasAuthConfig = true,
      tablePrimaryKeyTypes,
    } = params
    const createTableSQL = yield* Effect.try({
      try: () =>
        generateCreateTableSQL(
          table,
          tableUsesView,
          skipForeignKeys,
          hasAuthConfig,
          tablePrimaryKeyTypes
        ),
      catch: (error) =>
        new SQLExecutionError({
          message: `Failed to generate CREATE TABLE DDL: ${String(error)}`,
          cause: error,
        }),
    })
    yield* executeSQL(tx, createTableSQL)

    yield* applyTableFeatures(tx, table)
  })

export const createLookupViewsEffect = (
  tx: TransactionLike,
  table: Table,
  allTables: readonly Table[] = []
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (shouldUseView(table)) {
      const createViewSQL = generateLookupViewSQL(table, allTables)
      if (createViewSQL) {
        const cascadeSuffix = isSqliteRuntime() ? '' : ' CASCADE'
        yield* executeSQL(tx, `DROP TABLE IF EXISTS ${table.name}${cascadeSuffix}`)

        yield* executeSQL(tx, createViewSQL)

        const triggerStatements = generateLookupViewTriggers(table)
        yield* executeSQLStatements(tx, triggerStatements)
      }
    }
  })

const dropExistingView = (
  tx: TransactionLike,
  view: TableView,
  viewIdStr: string
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const quotedId = quoteSqlIdentifier(viewIdStr)
    const cascadeSuffix = isSqliteRuntime() ? '' : ' CASCADE'
    if (view.materialized) {
      yield* executeSQL(tx, `DROP MATERIALIZED VIEW IF EXISTS ${quotedId}${cascadeSuffix}`)
    } else {
      yield* executeSQL(tx, `DROP VIEW IF EXISTS ${quotedId}${cascadeSuffix}`)
    }
  })

const addReadOnlyTriggers = (
  tx: TransactionLike,
  viewId: TableView['id']
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const readOnlyTriggerSQL = generateReadOnlyViewTrigger(viewId)
    for (const triggerSQL of readOnlyTriggerSQL) {
      yield* executeSQL(tx, triggerSQL)
    }
  })

const maybeRefreshMaterializedView = (
  tx: TransactionLike,
  view: TableView,
  viewIdStr: string
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (view.materialized && view.refreshOnMigration) {
      yield* executeSQL(tx, `REFRESH MATERIALIZED VIEW ${quoteSqlIdentifier(viewIdStr)}`)
    }
  })

export const createTableViewsEffect = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {

    if (!table.views || table.views.length === 0) {
      return
    }

    const sqlViews = table.views.filter((v) => v.query || typeof v.id !== 'number')
    const viewSQL = generateTableViewStatements(table)

    for (const view of sqlViews) {
      const viewIdStr = String(view.id)

      yield* dropExistingView(tx, view, viewIdStr)

      const createSQL = viewSQL.find((sql) => sql.includes(viewIdStr))
      if (createSQL) {
        yield* executeSQL(tx, createSQL)

        if (!view.materialized) {
          yield* addReadOnlyTriggers(tx, view.id)
        }

        yield* maybeRefreshMaterializedView(tx, view, viewIdStr)
      }
    }
  })

export const createOrMigrateTableEffect = (params: {
  readonly tx: BunSQLTransaction
  readonly table: Table
  readonly exists: boolean
  readonly tableUsesView?: ReadonlyMap<string, boolean>
  readonly previousSchema?: { readonly tables: readonly object[] }
  readonly skipForeignKeys?: boolean
  readonly hasAuthConfig?: boolean
  readonly tablePrimaryKeyTypes?: ReadonlyMap<string, string | undefined>
}): Effect.Effect<void, SQLExecutionError> =>
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
        tablePrimaryKeyTypes,
      })
    }
  })
