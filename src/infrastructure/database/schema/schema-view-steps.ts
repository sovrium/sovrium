/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The view steps of schema initialization: creating every view inside the
 * migration transaction (Steps 9-11), and dropping obsolete views on the
 * checksum fast path, where no migration runs.
 *
 * Split out of `schema-initializer.ts`.
 */

import { SQL } from 'bun'
import { Effect } from 'effect'
import { SchemaInitializationError } from '@/domain/errors/schema-initialization-error'
import { postgresClientOptions } from '@/infrastructure/database/sql/postgres-client-options'
import { logDebug } from '@/infrastructure/logging/logger'
import { openSqliteDdlDatabase, runSqliteSchemaTransaction } from '../sql/dialect-ddl'
import {
  postgresTransactionLike,
  SQLExecutionError,
  type TransactionLike,
} from '../sql/sql-execution'
import { createLookupViewsEffect, createTableViewsEffect } from '../table-operations'
import * as viewGenerators from '../views/view-generators'
import { sortTablesByViewDependencies } from './schema-dependency-sorting'
import type { Table } from '@/domain/models/app/tables'
import type { DatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'

/** Drop obsolete views and create all views (lookup + user-defined) */
export const createAllViews = (
  tx: TransactionLike,
  sortedTables: readonly Table[],
  viewGeneratorsModule: typeof viewGenerators
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => viewGeneratorsModule.dropAllObsoleteViews(tx, sortedTables),
      catch: (error) =>
        new SQLExecutionError({
          message: `Dropping obsolete views failed: ${String(error)}`,
          cause: error,
        }),
    })
    // Lookup/rollup/count VIEWs must be created in VIEW-BODY dependency order,
    // NOT the FK-topological `sortedTables` order: a view-backed table that is a
    // lookup/rollup/count SOURCE for another view must exist before the view that
    // reads from it (Postgres validates the referenced relation at CREATE VIEW
    // time). Created sequentially (`concurrency: 1`) so that order is honoured on
    // the shared transaction connection.
    const viewOrderedTables = sortTablesByViewDependencies(sortedTables)
    yield* Effect.forEach(
      viewOrderedTables,
      (table) => createLookupViewsEffect(tx, table, sortedTables),
      { concurrency: 1 }
    )
    // One after the other: every statement runs on the one transaction connection.
    yield* Effect.forEach(sortedTables, (table) => createTableViewsEffect(tx, table), {
      discard: true,
    })
  })

/** The error a failed obsolete-view cleanup stops schema init with. */
const viewCleanupFailed = (error: unknown): SchemaInitializationError =>
  new SchemaInitializationError({
    message: `View cleanup failed: ${String(error)}`,
    cause: error,
  })

/**
 * Drop obsolete views when migration is skipped (checksum fast-path).
 *
 * Views may be created manually via SQL and still need cleanup even when the
 * schema is otherwise unchanged. Dialect-aware: Postgres uses `db.begin`,
 * SQLite uses the explicit BEGIN/COMMIT/ROLLBACK helper — both run
 * `dropAllObsoleteViews` through the shared `TransactionLike` interface.
 */
export const cleanupObsoleteViews = (
  dialectConfig: Readonly<DatabaseDialectConfig>,
  tables: readonly Table[]
): Effect.Effect<void, SchemaInitializationError> =>
  Effect.gen(function* () {
    // Each connection is closed by `Effect.ensuring`, never a `finally` around
    // `yield*`: `Effect.gen` abandons its generator on failure, so a `finally`
    // there never runs and a failed cleanup would leak the connection.
    if (dialectConfig.dialect === 'sqlite') {
      const sqliteDb = openSqliteDdlDatabase(dialectConfig.path)
      yield* Effect.tryPromise({
        try: () =>
          runSqliteSchemaTransaction(sqliteDb, (tx) =>
            viewGenerators.dropAllObsoleteViews(tx, tables)
          ),
        catch: viewCleanupFailed,
      }).pipe(Effect.ensuring(Effect.sync(() => sqliteDb.close())))
    } else {
      const db = new SQL(postgresClientOptions(dialectConfig.databaseUrl, { max: 1 }))
      yield* Effect.tryPromise({
        try: async () => {
          await db.begin(async (tx) => {
            await viewGenerators.dropAllObsoleteViews(postgresTransactionLike(tx), tables)
          })
        },
        catch: viewCleanupFailed,
      }).pipe(
        // effect-promise: total -- `SQL.close()` resolves once the pool is drained and has no rejection path; this is the `ensuring` arm, where a failure would replace the real view-cleanup error with a teardown one.
        Effect.ensuring(Effect.promise(() => db.close()))
      )
    }
    logDebug('[schema] obsolete views cleaned up (schema unchanged)')
  })
