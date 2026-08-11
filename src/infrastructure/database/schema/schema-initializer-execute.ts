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

/**
 * Dialect-aware transaction plumbing for the schema-initializer.
 *
 * The schema-migration layer (`schema-initializer.ts` → `executeMigrationSteps`
 * and everything beneath) is uniformly written against the `TransactionLike`
 * interface. The *only* per-dialect difference is **how a transaction is
 * opened** — `bun:sql`'s `db.begin(tx => …)` on PostgreSQL versus an explicit
 * `BEGIN`/`COMMIT`/`ROLLBACK` over a `bun:sqlite` database. This module isolates
 * that plumbing so `schema-initializer.ts` stays focused on the migration
 * *steps* themselves.
 *
 * `executeMigrationSteps` lives in `schema-initializer.ts` (it depends on a web
 * of helpers there); it is passed in here as a callback so this module has no
 * cyclic import.
 */

/** The unit of migration work run inside a transaction, supplied by the caller. */
export type RunMigrationSteps = (
  tx: TransactionLike,
  tables: readonly Table[],
  app: App
) => Effect.Effect<void, never, never> | Effect.Effect<void, unknown, never>

/** Everything one `executeSchemaInit` invocation needs, bundled to keep arity low. */
interface SchemaInitJob {
  readonly config: DatabaseDialectConfig
  readonly tables: readonly Table[]
  readonly app: App
  readonly runMigrationSteps: RunMigrationSteps
  readonly runtime: Runtime.Runtime<never>
}

/**
 * Log a rollback operation in a separate transaction.
 *
 * Dialect-aware: PostgreSQL opens a fresh `bun:sql` connection and uses
 * `db.begin(...)`; SQLite opens a fresh `bun:sqlite` database and drives the
 * transaction via `runSqliteSchemaTransaction`. Both run `logRollbackOperation`
 * through the shared `TransactionLike` interface. The whole step is
 * best-effort (`Effect.ignore`).
 */
export const logRollbackError = (
  config: DatabaseDialectConfig,
  errorMessage: string,
  runtime: Runtime.Runtime<never>
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    logDebug('[schema] schema init failed — recording rollback')

    const runLogged = (logTx: TransactionLike): Promise<void> =>
      Runtime.runPromise(runtime)(
        logRollbackOperation(logTx, errorMessage).pipe(
          Effect.catchAll(() => {
            logDebug('[schema] failed to record rollback (non-fatal)')
            return Effect.void
          })
        )
      )

    if (config.dialect === 'sqlite') {
      const logDb = openSqliteDdlDatabase(config.path)
      yield* Effect.tryPromise({
        try: () => runSqliteSchemaTransaction(logDb, runLogged),
        catch: () => undefined, // Non-fatal
      }).pipe(Effect.ensuring(Effect.sync(() => logDb.close())), Effect.ignore)
      return
    }

    const logDb = new SQL(config.databaseUrl)
    yield* Effect.tryPromise({
      try: async () => {
        /* eslint-disable-next-line functional/no-expression-statements */
        await logDb.begin(async (logTx) => {
          /* eslint-disable-next-line functional/no-expression-statements */
          await runLogged(logTx)
        })
      },
      catch: () => undefined, // Non-fatal
    }).pipe(Effect.ensuring(Effect.promise(() => logDb.close())), Effect.ignore)
  })

/** Run the migration steps inside a SQLite explicit-transaction boundary. */
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
            /* eslint-disable-next-line functional/no-expression-statements */
            await Runtime.runPromise(runtime)(
              runMigrationSteps(tx, tables, app) as Effect.Effect<void, never, never>
            )
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

/** Run the migration steps inside a PostgreSQL `db.begin` transaction. */
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
          /* eslint-disable-next-line functional/no-expression-statements */
          await db.begin(async (tx) => {
            /* eslint-disable-next-line functional/no-expression-statements */
            await Runtime.runPromise(runtime)(
              runMigrationSteps(tx, tables, app) as Effect.Effect<void, never, never>
            )
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

/**
 * Execute schema initialization within a dialect-appropriate transaction.
 *
 * Both dialects run `runMigrationSteps` through the shared `TransactionLike`
 * interface; the PostgreSQL arm runs exactly the historical bun:sql code path.
 *
 * SECURITY NOTE: the migration steps use `tx.unsafe()` for DDL execution. This
 * is safe because all SQL is generated from validated Effect Schema objects
 * (not user input), DDL statements cannot use parameter placeholders, and the
 * transaction boundary guarantees atomic rollback. This pattern is standard
 * for schema-migration tools (Drizzle, Prisma, …).
 */
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

/** A fast read-only connection plus its dialect-specific catalog queries. */
interface QuickConnection {
  readonly checksumSql: string
  readonly tableExistsSql: (name: string) => string
  readonly viewExistsSql: (name: string) => string
  readonly tx: TransactionLike
  readonly close: () => unknown
}

/**
 * Open a fast read-only connection for the checksum fast-path, with the
 * dialect-correct catalog queries:
 *   - Postgres → `new SQL(...)`; `system.schema_checksum` + `information_schema`.
 *   - SQLite   → a `bun:sqlite` database; `system_schema_checksum` + `sqlite_master`.
 */
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

/** Whether the stored checksum on `quick` matches `currentChecksum`. */
const checksumMatches = async (
  quick: Readonly<QuickConnection>,
  currentChecksum: string
): Promise<boolean> => {
  const result = (await quick.tx.unsafe(quick.checksumSql)) as readonly { checksum: string }[]
  return result.length > 0 && result[0]?.checksum === currentChecksum
}

/**
 * Resolve whether migration can be skipped, given an open `QuickConnection`.
 *
 * Returns `true` only when the stored checksum matches, the first expected
 * table actually exists (defends against template databases that carry a
 * checksum but no tables), AND every auto-generated lookup/rollup/count view
 * (named `<tableName>`, sibling of `<tableName>_base`) is still present in
 * the catalog.
 *
 * The view-existence check is defensive: even with the
 * `dropAllObsoleteViews` fix that retains auto-generated views, if any are
 * missing (e.g. dropped manually via SQL, or by a buggy prior boot) the
 * skip path would leave the database in a state where API reads against
 * `<tableName>` fail with `no such table`. Forcing a full migration in
 * that case lets `executeMigrationSteps` recreate them.
 *
 * for the original failure mode.
 */
const resolveSkip = async (
  quick: Readonly<QuickConnection>,
  currentChecksum: string,
  tables: readonly Table[],
  sanitizeTableName: (name: string) => string
): Promise<boolean> => {
  if (!(await checksumMatches(quick, currentChecksum))) {
    logDebug('[schema] checksum differs or missing — full migration')
    return false
  }

  const firstTableName = tables[0]?.name
  if (tables.length === 0 || !firstTableName) {
    logDebug('[schema] checksum matches, no tables to verify — skipping migration')
    return true
  }

  const sanitizedTableName = sanitizeTableName(firstTableName)
  const tableCheck = (await quick.tx.unsafe(quick.tableExistsSql(sanitizedTableName))) as readonly {
    exists: boolean
  }[]
  if (!tableCheck[0]?.exists) {
    logDebug('[schema] checksum matches but table missing — full migration', {
      table: sanitizedTableName,
    })
    return false
  }

  // Defensive: every auto-generated lookup/rollup/count view must still be in
  // the catalog. If any are missing, force a full migration so they get
  // recreated. (Belt-and-suspenders against the original [internal ref]
  // failure mode, plus future regressions or manual SQL tampering.)
  const expectedAutoViewNames = tables
    .filter((table) => shouldUseView(table))
    .map((table) => sanitizeTableName(table.name))

  // Note: SQLite returns `exists` as integer 0/1, Postgres as boolean. Both
  // are truthy/falsy correctly, so use `!rows[0]?.exists` (mirrors the
  // `tableExistsSql` check above) rather than strict equality against `true`.
  //
  // FAN-OUT WIDTH: deliberately UNBOUNDED, and this is the one place in the
  // database layer where that is defensible. Three independent reasons, all
  // required:
  //
  //  1. **Not the shared pool.** These probes run on `quick.tx`, a connection
  //     opened by `openQuickConnection` purely for this fast-path check — a
  //     dedicated `new SQL(...)` on Postgres, a dedicated `bun:sqlite` handle
  //     on SQLite. They cannot take a slot from the Drizzle pool that serves
  //     requests, which is the exact mechanism of the 2026-07-25 incident
  //     (see the QUERY BUDGET note in
  //     `repositories/tables/tables-overview-repository-live.ts`).
  //  2. **Not a request path.** `checkShouldSkipMigration` has exactly one
  //     caller chain — `schema-initializer.ts` → `initializeSchema` →
  //     `runDatabaseStartup` in `infrastructure/server/server.ts` — which runs
  //     during boot, before the HTTP listener accepts traffic. There is no
  //     concurrent request to starve, and no live config-publish path reaches
  //     here.
  //  3. **Config-bounded, and cheap.** Width is the number of view-backed
  //     tables, and each probe is a single indexed catalog lookup.
  //
  // If any of those three stops holding — in particular if schema init ever
  // becomes reachable while the server is serving — this needs a ceiling, the
  // same way every other fan-out in this layer now has one.
  // eslint-disable-next-line sovrium/no-unbounded-promise-fanout -- deliberately unbounded; the three conditions that make it safe (dedicated connection, boot-only, config-bounded single catalog lookups) and their invalidation triggers are stated in the FAN-OUT WIDTH note directly above.
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
    logDebug('[schema] checksum matches but auto-generated view missing — full migration', {
      view: missingView.viewName,
    })
    return false
  }

  logDebug('[schema] checksum matches and tables verified — skipping migration (fast path)')
  return true
}

/**
 * Check whether the schema checksum matches the stored checksum (fast-path
 * optimization) — dialect-aware. Returns `true` when migration may be skipped.
 *
 * Non-fatal: any failure (e.g. a first-run database with no checksum table)
 * resolves to `false` so the caller proceeds with a full migration.
 */
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
        logDebug('[schema] checksum table not found — full migration')
        return false
      } finally {
        /* eslint-disable-next-line functional/no-expression-statements */
        await quick.close()
      }
    },
    catch: () =>
      new SchemaInitializationError({
        message: 'Failed to check schema checksum',
        cause: undefined,
      }),
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))
