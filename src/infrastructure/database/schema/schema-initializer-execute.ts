/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { Effect, Runtime } from 'effect'
import { shouldUseView } from '@/infrastructure/database/lookup/lookup-view-generators'
import { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import { logDebug } from '@/infrastructure/logging/logger'
import {
  openSqliteDdlDatabase,
  runSqliteSchemaTransaction,
  sqliteTransactionLike,
} from '../sql/dialect-ddl'
import { logRollbackOperation } from './migration-audit-trail'
import type { TransactionLike } from '../sql/sql-execution'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables'
import type { DatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'


export type RunMigrationSteps = (
  tx: TransactionLike,
  tables: readonly Table[],
  app: App
) => Effect.Effect<void, never, never> | Effect.Effect<void, unknown, never>

interface SchemaInitJob {
  readonly config: DatabaseDialectConfig
  readonly tables: readonly Table[]
  readonly app: App
  readonly runMigrationSteps: RunMigrationSteps
  readonly runtime: Runtime.Runtime<never>
}

export const logRollbackError = (
  config: DatabaseDialectConfig,
  errorMessage: string,
  runtime: Runtime.Runtime<never>
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    logDebug(`[executeSchemaInit] CATCH HANDLER - Error caught: ${errorMessage}`)

    const runLogged = (logTx: TransactionLike): Promise<void> =>
      Runtime.runPromise(runtime)(
        logRollbackOperation(logTx, errorMessage).pipe(
          Effect.catchAll((logError) => {
            logDebug(`[executeSchemaInit] Failed to log rollback: ${logError.message}`)
            return Effect.void
          })
        )
      )

    if (config.dialect === 'sqlite') {
      const logDb = openSqliteDdlDatabase(config.path)
      yield* Effect.tryPromise({
        try: () => runSqliteSchemaTransaction(logDb, runLogged),
        catch: () => undefined,
      }).pipe(Effect.ensuring(Effect.sync(() => logDb.close())), Effect.ignore)
      return
    }

    const logDb = new SQL(config.databaseUrl)
    yield* Effect.tryPromise({
      try: async () => {
        await logDb.begin(async (logTx) => {
          await runLogged(logTx)
        })
      },
      catch: () => undefined,
    }).pipe(Effect.ensuring(Effect.promise(() => logDb.close())), Effect.ignore)
  })

const executeSchemaInitSqlite = (
  job: Readonly<SchemaInitJob> & {
    readonly config: Extract<DatabaseDialectConfig, { dialect: 'sqlite' }>
  }
): Effect.Effect<void, SchemaInitializationError, never> =>
  Effect.gen(function* () {
    const { config, tables, app, runMigrationSteps, runtime } = job
    const db = openSqliteDdlDatabase(config.path)
    try {
      yield* Effect.tryPromise({
        try: () =>
          runSqliteSchemaTransaction(db, async (tx) => {
            await Runtime.runPromise(runtime)(
              runMigrationSteps(tx, tables, app) as Effect.Effect<void, never, never>
            )
            logDebug('[executeSchemaInit] SQLite transaction committed successfully')
          }),
        catch: (error) =>
          new SchemaInitializationError({
            message: `Schema initialization failed: ${String(error)}`,
            cause: error,
          }),
      }).pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* logRollbackError(config, error.message, runtime)
            return yield* error
          })
        )
      )
    } finally {
      db.close()
    }
  })

const executeSchemaInitPostgres = (
  job: Readonly<SchemaInitJob> & {
    readonly config: Extract<DatabaseDialectConfig, { dialect: 'postgres' }>
  }
): Effect.Effect<void, SchemaInitializationError, never> =>
  Effect.gen(function* () {
    const { config, tables, app, runMigrationSteps, runtime } = job
    const db = new SQL({ url: config.databaseUrl, max: 1 })
    try {
      yield* Effect.tryPromise({
        try: async () => {
          await db.begin(async (tx) => {
            await Runtime.runPromise(runtime)(
              runMigrationSteps(tx, tables, app) as Effect.Effect<void, never, never>
            )
            logDebug('[executeSchemaInit] Transaction completed successfully (auto-commit)')
          })
        },
        catch: (error) =>
          new SchemaInitializationError({
            message: `Schema initialization failed: ${String(error)}`,
            cause: error,
          }),
      }).pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* logRollbackError(config, error.message, runtime)
            return yield* error
          })
        )
      )
    } finally {
      yield* Effect.promise(() => db.close())
    }
  })

export const executeSchemaInit = (
  config: DatabaseDialectConfig,
  tables: readonly Table[],
  app: App,
  runMigrationSteps: RunMigrationSteps
): Effect.Effect<void, SchemaInitializationError, never> =>
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<never>()
    yield* config.dialect === 'sqlite'
      ? executeSchemaInitSqlite({ config, tables, app, runMigrationSteps, runtime })
      : executeSchemaInitPostgres({ config, tables, app, runMigrationSteps, runtime })
  })

interface QuickConnection {
  readonly checksumSql: string
  readonly tableExistsSql: (name: string) => string
  readonly viewExistsSql: (name: string) => string
  readonly tx: TransactionLike
  readonly close: () => unknown
}

const openQuickConnection = (config: DatabaseDialectConfig): QuickConnection => {
  if (config.dialect === 'sqlite') {
    const sqliteDb = openSqliteDdlDatabase(config.path)
    return {
      checksumSql: `SELECT checksum FROM system_schema_checksum WHERE id = 'singleton'`,
      tableExistsSql: (name: string) =>
        `SELECT EXISTS (
           SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '${name}'
         ) as "exists"`,
      viewExistsSql: (name: string) =>
        `SELECT EXISTS (
           SELECT 1 FROM sqlite_master WHERE type = 'view' AND name = '${name}'
         ) as "exists"`,
      tx: sqliteTransactionLike(sqliteDb),
      close: () => sqliteDb.close(),
    }
  }
  const pgDb = new SQL(config.databaseUrl)
  return {
    checksumSql: `SELECT checksum FROM system.schema_checksum WHERE id = 'singleton'`,
    tableExistsSql: (name: string) =>
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = '${name}'
       )`,
    viewExistsSql: (name: string) =>
      `SELECT EXISTS (
         SELECT FROM information_schema.views
         WHERE table_schema = 'public' AND table_name = '${name}'
       )`,
    tx: { unsafe: (sql: string) => pgDb.unsafe(sql) },
    close: () => pgDb.close(),
  }
}

const checksumMatches = async (
  quick: Readonly<QuickConnection>,
  currentChecksum: string
): Promise<boolean> => {
  const result = (await quick.tx.unsafe(quick.checksumSql)) as readonly { checksum: string }[]
  return result.length > 0 && result[0]?.checksum === currentChecksum
}

const resolveSkip = async (
  quick: Readonly<QuickConnection>,
  currentChecksum: string,
  tables: readonly Table[],
  sanitizeTableName: (name: string) => string
): Promise<boolean> => {
  if (!(await checksumMatches(quick, currentChecksum))) {
    logDebug('[checkShouldSkipMigration] Schema checksum differs or missing - full migration')
    return false
  }

  const firstTableName = tables[0]?.name
  if (tables.length === 0 || !firstTableName) {
    logDebug('[checkShouldSkipMigration] Checksum matches, no tables to verify - skipping')
    return true
  }

  const sanitizedTableName = sanitizeTableName(firstTableName)
  const tableCheck = (await quick.tx.unsafe(quick.tableExistsSql(sanitizedTableName))) as readonly {
    exists: boolean
  }[]
  if (!tableCheck[0]?.exists) {
    logDebug(
      `[checkShouldSkipMigration] Checksum matches but '${sanitizedTableName}' missing - full migration`
    )
    return false
  }

  const expectedAutoViewNames = tables
    .filter((table) => shouldUseView(table))
    .map((table) => sanitizeTableName(table.name))

  const viewCheckResults = await Promise.all(
    expectedAutoViewNames.map(async (viewName) => {
      const rows = (await quick.tx.unsafe(quick.viewExistsSql(viewName))) as readonly {
        exists: boolean | number
      }[]
      return { viewName, exists: Boolean(rows[0]?.exists) }
    })
  )

  const missingView = viewCheckResults.find((r) => !r.exists)
  if (missingView) {
    logDebug(
      `[checkShouldSkipMigration] Checksum matches but auto-generated view '${missingView.viewName}' missing - full migration`
    )
    return false
  }

  logDebug('[checkShouldSkipMigration] Checksum matches and tables verified - skipping (fast path)')
  return true
}

export const checkShouldSkipMigration = (
  config: DatabaseDialectConfig,
  currentChecksum: string,
  tables: readonly Table[],
  sanitizeTableName: (name: string) => string
): Effect.Effect<boolean, SchemaInitializationError> =>
  Effect.tryPromise({
    try: async () => {
      const quick = openQuickConnection(config)
      try {
        return await resolveSkip(quick, currentChecksum, tables, sanitizeTableName)
      } catch {
        logDebug('[checkShouldSkipMigration] Checksum table not found - running full migration')
        return false
      } finally {
        await quick.close()
      }
    },
    catch: () =>
      new SchemaInitializationError({
        message: 'Failed to check schema checksum',
        cause: undefined,
      }),
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))
