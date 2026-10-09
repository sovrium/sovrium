/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { Effect, type Context } from 'effect'
import { readSovriumDevClock } from '@/domain/models/process-env/dev-clock'
import { DEV_CLOCK_MARKER } from '@/infrastructure/database/formula/formula-dev-clock'
import {
  getPhysicalTableName,
  shouldUseView,
} from '@/infrastructure/database/lookup/lookup-view-generators'
import { postgresClientOptions } from '@/infrastructure/database/sql/postgres-client-options'
import { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import { logDebug, logWarning } from '@/infrastructure/logging/logger'
import { BetterAuthUsersTableRequired } from '../auth/auth-validation'
import { findDriftedFormulaColumns } from '../schema-migration/type-utils'
import {
  openSqliteDdlDatabase,
  runSqliteSchemaTransaction,
  sqliteTransactionLike,
} from '../sql/dialect-ddl'
import { postgresTransactionLike } from '../sql/sql-execution'
import { sqliteCheckClausesCurrent } from '../table-operations/sqlite-check-drift'
import { sqliteLegacyDateValuesQuery } from '../table-operations/sqlite-date-normalisation'
import { storedFormulaEngineCurrent, type StoredChecksumRow } from './formula-engine-recompute'
import { logRollbackOperation } from './migration-audit-trail'
import { findStaleViewDefinition } from './view-definition-drift'
import type { SQLExecutionError, TransactionLike } from '../sql/sql-execution'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables'
import type { DatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'

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

/**
 * The unit of migration work run inside a transaction, supplied by the caller.
 *
 * The failure is named rather than erased. A UNION of an infallible and an
 * `unknown`-failing effect defeats inference at every call site and invites
 * re-asserting it as `Effect<void, never, never>` — claiming migration steps
 * cannot fail, when failing is exactly what they do when a statement is
 * rejected. `runPromiseWith` accepts any error channel, so such an assertion
 * would buy nothing and hide the one fact worth stating.
 */
export type RunMigrationSteps = (
  tx: TransactionLike,
  tables: readonly Table[],
  app: App
) => Effect.Effect<void, SQLExecutionError | BetterAuthUsersTableRequired, never>

/**
 * Turn a rejected transaction into the error the operator should see.
 *
 * `runMigrationSteps` runs through `Effect.runPromiseWith` so that a failure
 * rejects the driver callback and the transaction rolls back. Effect 4 rejects
 * with the ERROR VALUE ITSELF rather than a `FiberFailure` wrapper (measured on
 * `4.0.0` for a typed fail, a thrown defect, and a failure nested in
 * `Effect.gen` alike), so the designed error is recoverable here by identity.
 *
 * That matters because {@link BetterAuthUsersTableRequired} is a CONFIGURATION
 * error — "configure Better Auth before using user fields" — and flattening it
 * into `Schema initialization failed: …` told the operator a migration broke
 * when nothing had. It is the one failure worth keeping apart; everything else
 * genuinely is a schema initialization failure.
 */
const asSchemaInitFailure = (error: unknown) =>
  error instanceof BetterAuthUsersTableRequired
    ? error
    : new SchemaInitializationError({
        message: `Schema initialization failed: ${String(error)}`,
        cause: error,
      })

/** Everything one `executeSchemaInit` invocation needs, bundled to keep arity low. */
interface SchemaInitJob {
  readonly config: DatabaseDialectConfig
  readonly tables: readonly Table[]
  readonly app: App
  readonly runMigrationSteps: RunMigrationSteps
  readonly runtime: Context.Context<never>
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
  runtime: Context.Context<never>
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    logDebug('[schema] schema init failed — recording rollback')

    const runLogged = (logTx: TransactionLike): Promise<void> =>
      Effect.runPromiseWith(runtime)(
        logRollbackOperation(logTx, errorMessage).pipe(
          Effect.catch(() => {
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
        // effect-swallow: the rollback AUDIT ROW is best-effort by design — this runs only because schema init already failed, and the real error is on its way to the operator. Failing here would replace a diagnosable migration error with a bookkeeping one.
      }).pipe(Effect.ensuring(Effect.sync(() => logDb.close())), Effect.ignore)
      return
    }

    const logDb = new SQL(postgresClientOptions(config.databaseUrl, { max: 1 }))
    // effect-promise: total -- `SQL.close()` resolves once the pool is drained and has no rejection path; it also runs under `Effect.ensuring`, where a failure would mask the audit-write outcome it is cleaning up after.
    const closeLogDb = Effect.promise(() => logDb.close())
    // effect-swallow: as in the SQLite arm above — the rollback audit row is best-effort, and the schema-init error it describes is already propagating.
    yield* Effect.tryPromise({
      try: async () => {
        await logDb.begin(async (logTx) => {
          await runLogged(logTx)
        })
      },
      catch: () => undefined, // Non-fatal
    }).pipe(Effect.ensuring(closeLogDb), Effect.ignore)
  })

/** Run the migration steps inside a SQLite explicit-transaction boundary. */
const executeSchemaInitSqlite = (
  job: Readonly<SchemaInitJob> & {
    readonly config: Extract<DatabaseDialectConfig, { dialect: 'sqlite' }>
  }
): Effect.Effect<void, SchemaInitializationError | BetterAuthUsersTableRequired, never> =>
  Effect.gen(function* () {
    const { config, tables, app, runMigrationSteps, runtime } = job
    const db = openSqliteDdlDatabase(config.path)
    // `Effect.ensuring`, not a `finally` around `yield*`: `Effect.gen` abandons
    // its generator on failure, so a `finally` would never close a failed run's
    // handle. Closed before the rollback is logged, on a connection of its own.
    yield* Effect.tryPromise({
      try: () =>
        runSqliteSchemaTransaction(db, async (tx) => {
          await Effect.runPromiseWith(runtime)(runMigrationSteps(tx, tables, app))
        }),
      catch: asSchemaInitFailure,
    }).pipe(
      Effect.ensuring(Effect.sync(() => db.close())),
      Effect.catch((error) =>
        Effect.gen(function* () {
          yield* logRollbackError(config, error.message, runtime)
          return yield* error
        })
      )
    )
  })

/** Run the migration steps in a PostgreSQL transaction; close it before logging a rollback (one maintenance connection at a time). */
const executeSchemaInitPostgres = (
  job: Readonly<SchemaInitJob> & {
    readonly config: Extract<DatabaseDialectConfig, { dialect: 'postgres' }>
  }
): Effect.Effect<void, SchemaInitializationError | BetterAuthUsersTableRequired, never> =>
  Effect.gen(function* () {
    const { config, tables, app, runMigrationSteps, runtime } = job
    const db = new SQL(postgresClientOptions(config.databaseUrl, { max: 1 }))
    yield* Effect.tryPromise({
      try: async () => {
        await db.begin(async (tx) => {
          await Effect.runPromiseWith(runtime)(runMigrationSteps(tx, tables, app))
        })
      },
      catch: asSchemaInitFailure,
    }).pipe(
      // effect-promise: total -- `SQL.close()` resolves once the pool is drained and has no rejection path; this is the `ensuring` arm, where a teardown failure would displace the schema-init error the caller needs to see.
      Effect.ensuring(Effect.promise(() => db.close())),
      Effect.catch((error) =>
        Effect.gen(function* () {
          yield* logRollbackError(config, error.message, runtime)
          return yield* error
        })
      )
    )
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
): Effect.Effect<void, SchemaInitializationError | BetterAuthUsersTableRequired, never> =>
  Effect.gen(function* () {
    const runtime = yield* Effect.context<never>()
    yield* config.dialect === 'sqlite'
      ? executeSchemaInitSqlite({ config, tables, app, runMigrationSteps, runtime })
      : executeSchemaInitPostgres({ config, tables, app, runMigrationSteps, runtime })
  })

/** A fast read-only connection plus its dialect-specific catalog queries. */
interface QuickConnection {
  readonly isSqlite: boolean
  readonly checksumSql: string
  readonly tableExistsSql: (name: string) => string
  readonly viewExistsSql: (name: string) => string
  /** Whether a formula trigger was written against a pinned dev clock (`formula-dev-clock.ts`). */
  readonly pinnedClockSql: string
  /** The first installed view whose definition is not the generated one (see `view-definition-drift.ts`). */
  readonly staleViewDefinition: (tables: readonly Table[]) => Promise<string | undefined>
  /** Table name → column name → the `data_type` the catalog reports. Empty on SQLite. */
  readonly liveColumnTypes: () => Promise<ReadonlyMap<string, ReadonlyMap<string, string>>>
  readonly tx: TransactionLike
  readonly close: () => unknown
}

/**
 * Open a fast read-only connection for the checksum fast-path, with the
 * dialect-correct catalog queries:
 *   - Postgres → `new SQL(...)`; `system.schema_checksum` + `information_schema`.
 *   - SQLite   → a `bun:sqlite` database; `system_schema_checksum` + `sqlite_master`.
 */
/** Every public table's columns and the `data_type` the catalog reports for each. */
const readPostgresColumnTypes = async (
  pgDb: Readonly<SQL>
): Promise<ReadonlyMap<string, ReadonlyMap<string, string>>> => {
  const rows = (await pgDb.unsafe(
    `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'`
  )) as readonly { table_name: string; column_name: string; data_type: string }[]
  const tableNames = [...new Set(rows.map((row) => row.table_name))]
  return new Map(
    tableNames.map((tableName) => [
      tableName,
      new Map(
        rows
          .filter((row) => row.table_name === tableName)
          .map((row) => [row.column_name, row.data_type] as const)
      ),
    ])
  )
}

const openQuickConnection = (config: DatabaseDialectConfig): QuickConnection => {
  if (config.dialect === 'sqlite') {
    const sqliteDb = openSqliteDdlDatabase(config.path)
    return {
      isSqlite: true,
      checksumSql: `SELECT checksum, formula_engine_version FROM system_schema_checksum WHERE id = 'singleton'`,
      // A view answers too: a view-backed table's rows stand behind the view of
      // its name, as PostgreSQL's `information_schema.tables` (which lists
      // views) already answers. Asking for a TABLE only sent every boot of an
      // app whose first table is view-backed down the full migration.
      tableExistsSql: (name: string) =>
        `SELECT EXISTS (
           SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name = '${name}'
         ) as "exists"`,
      viewExistsSql: (name: string) =>
        `SELECT EXISTS (
           SELECT 1 FROM sqlite_master WHERE type = 'view' AND name = '${name}'
         ) as "exists"`,
      pinnedClockSql: `SELECT EXISTS (
           SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND sql LIKE '%${DEV_CLOCK_MARKER}%'
         ) as "exists"`,
      staleViewDefinition: (tables) =>
        findStaleViewDefinition(sqliteTransactionLike(sqliteDb), tables, 'sqlite'),
      // No version ever converted a SQLite column: there is no drift to find.
      liveColumnTypes: async () => new Map(),
      tx: sqliteTransactionLike(sqliteDb),
      close: () => sqliteDb.close(),
    }
  }
  // The maintenance slot: one connection. The view checks below queue on it.
  const pgDb = new SQL(postgresClientOptions(config.databaseUrl, { max: 1 }))
  return {
    isSqlite: false,
    checksumSql: `SELECT checksum, formula_engine_version FROM system.schema_checksum WHERE id = 'singleton'`,
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
    pinnedClockSql: `SELECT EXISTS (
       SELECT 1 FROM pg_proc WHERE prosrc LIKE '%${DEV_CLOCK_MARKER}%'
     ) as "exists"`,
    // One connection: the probe's temporary views live in their session.
    staleViewDefinition: (tables) =>
      pgDb.begin((tx) => findStaleViewDefinition(postgresTransactionLike(tx), tables, 'postgres')),
    liveColumnTypes: () => readPostgresColumnTypes(pgDb),
    tx: postgresTransactionLike(pgDb),
    close: () => pgDb.close(),
  }
}

/**
 * Whether the formula triggers were written against the clock this boot runs
 * on. The checksum hashes the config alone, so without this a boot with
 * `SOVRIUM_DEV_CLOCK` set would keep triggers written on the real clock, and a
 * boot after it was unset would keep the pinned day. A pinned boot always
 * rebuilds (the pinned instant may have moved); an unpinned one rebuilds only
 * when a trigger still carries the pinned-clock marker.
 */
const clockMatchesTriggers = async (quick: Readonly<QuickConnection>): Promise<boolean> => {
  if (readSovriumDevClock() !== undefined) {
    logDebug('[schema] development clock pinned — full migration')
    return false
  }
  const rows = (await quick.tx.unsafe(quick.pinnedClockSql)) as readonly {
    exists: boolean | number
  }[]
  if (rows[0]?.exists) {
    logDebug('[schema] a formula trigger still reads a pinned clock — full migration')
    return false
  }
  return true
}

/**
 * Whether the stored checksum on `quick` matches `currentChecksum`, stored by a
 * formula engine no older than this binary's (`formula-engine-recompute.ts`).
 */
const checksumMatches = async (
  quick: Readonly<QuickConnection>,
  currentChecksum: string
): Promise<boolean> => {
  const [row] = (await quick.tx.unsafe(quick.checksumSql)) as readonly StoredChecksumRow[]
  return row?.checksum === currentChecksum && storedFormulaEngineCurrent(row)
}

/**
 * Resolve whether migration can be skipped, given an open `QuickConnection`.
 *
 * Returns `true` only when the stored checksum matches, the first expected
 * table actually exists (defends against template databases that carry a
 * checksum but no tables), AND every auto-generated lookup/rollup/count view
 * (named `<tableName>`, sibling of `<tableName>_base`) is still present in
 * the catalog, AND each of those views (and SQLite's `INSTEAD OF` triggers) is
 * the one this binary generates (`view-definition-drift.ts`) — the checksum
 * hashes the config alone, so a view fix shipped in a binary would otherwise
 * never reach a deployment whose config did not move.
 *
 * The view-existence check is defensive: even with the
 * `dropAllObsoleteViews` fix that retains auto-generated views, if any are
 * missing (e.g. dropped manually via SQL, or by a buggy prior boot) the
 * skip path would leave the database in a state where API reads against
 * `<tableName>` fail with `no such table`. Forcing a full migration in
 * that case lets `executeMigrationSteps` recreate them.
 *
 * See a migration checksum view drift spec for the original failure mode.
 */
const resolveSkip = async (
  quick: Readonly<QuickConnection>,
  currentChecksum: string,
  tables: readonly Table[],
  sanitizeTableName: (name: string) => string
): Promise<boolean> => {
  if (!(await clockMatchesTriggers(quick))) return false
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
  // recreated. (Belt-and-suspenders against the original a view drift spec
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
  //     requests, which is the exact mechanism of a production pool-exhaustion incident
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

  return storedDataCurrent(quick, tables)
}

/**
 * Whether the stored objects and values are the ones THIS binary writes: the
 * checksum hashes the config alone, so a repair shipped in a binary — a view's
 * SQL, a formula column's type, a SQLite date's stored form — would otherwise
 * never reach a deployment whose config did not move.
 */
const storedDataCurrent = async (
  quick: Readonly<QuickConnection>,
  tables: readonly Table[]
): Promise<boolean> => {
  const current =
    (await viewDefinitionsCurrent(quick, tables)) &&
    (await formulaColumnTypesCurrent(quick, tables)) &&
    (await sqliteDateValuesStored(quick, tables)) &&
    (!quick.isSqlite || (await sqliteCheckClausesCurrent((sql) => quick.tx.unsafe(sql), tables)))
  if (current) {
    logDebug('[schema] checksum matches and tables verified — skipping migration (fast path)')
  }
  return current
}

/**
 * Whether no SQLite table still holds a datetime or time written before the
 * write path stored them in one form. The rewrite runs in the full migration
 * (`normaliseSqliteDateValues`); without this check a deployment that upgrades
 * without editing its config would take the fast path and keep its old text.
 * Each query stops at the first legacy row; a clean column is one scan.
 */
const sqliteDateValuesStored = async (
  quick: Readonly<QuickConnection>,
  tables: readonly Table[]
): Promise<boolean> => {
  if (!quick.isSqlite) return true
  const probes = tables.flatMap((table) => {
    const query = sqliteLegacyDateValuesQuery(getPhysicalTableName(table), table)
    return query === undefined ? [] : [{ table: table.name, query }]
  })
  const legacy = await probes.reduce<Promise<string | undefined>>(async (found, probe) => {
    const earlier = await found
    if (earlier !== undefined) return earlier
    const rows = (await quick.tx.unsafe(probe.query)) as readonly { exists: number | boolean }[]
    return rows[0]?.exists ? probe.table : undefined
  }, Promise.resolve(undefined))
  if (legacy === undefined) return true
  logDebug(
    '[schema] checksum matches but a table holds a datetime or time in its pre-upgrade form — full migration',
    { table: legacy }
  )
  return false
}

/**
 * Whether every formula column is of the type this version declares. An
 * earlier version converted numeric, date and boolean formula columns to TEXT
 * (see `findDriftedFormulaColumns`); the checksum hashes the config alone, so a
 * deployment it damaged would otherwise take the fast path on every boot and
 * never be repaired.
 */
const formulaColumnTypesCurrent = async (
  quick: Readonly<QuickConnection>,
  tables: readonly Table[]
): Promise<boolean> => {
  const withFormulas = tables.filter((table) => table.fields.some((f) => f.type === 'formula'))
  if (withFormulas.length === 0) return true
  const live = await quick.liveColumnTypes()
  const drifted = withFormulas.find(
    (table) =>
      findDriftedFormulaColumns(table.fields, live.get(getPhysicalTableName(table)) ?? new Map())
        .length > 0
  )
  if (drifted === undefined) return true
  logDebug(
    '[schema] checksum matches but a formula column is not of the type this version declares — full migration',
    { table: drifted.name }
  )
  return false
}

/**
 * Whether every installed view is the one THIS binary generates: the checksum
 * hashes the config alone, so an upgrade that changes a view's SQL would
 * otherwise never reach a deployment whose config stayed put.
 */
const viewDefinitionsCurrent = async (
  quick: Readonly<QuickConnection>,
  tables: readonly Table[]
): Promise<boolean> => {
  const outcome = await quick.staleViewDefinition(tables).then(
    (view) => ({ compared: true as const, view }),
    (error: unknown) => ({ compared: false as const, error })
  )
  if (!outcome.compared) {
    // The PostgreSQL comparison needs a TEMPORARY view, which a role without
    // the `TEMP` privilege on the database cannot create. Not being able to
    // compare must not stop the boot: it declines the fast path (the full
    // migration is idempotent and rebuilds every view), and says why, because
    // it costs every boot until the privilege is granted.
    logWarning(
      '[schema] could not compare the installed views with this version (does the database role have the TEMP privilege?) — full migration',
      { reason: outcome.error instanceof Error ? outcome.error.message : String(outcome.error) }
    )
    return false
  }
  if (outcome.view !== undefined) {
    logDebug(
      '[schema] checksum matches but a view is not the one this version writes — full migration',
      { view: outcome.view }
    )
    return false
  }
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
        await quick.close()
      }
    },
    catch: () =>
      new SchemaInitializationError({
        message: 'Failed to check schema checksum',
        cause: undefined,
      }),
    // effect-swallow: an unreadable checksum must mean "cannot prove the schema is unchanged", so the fast path is declined and the FULL migration runs. That is the safe direction — the migration steps are idempotent — and the `catch` arm above has already written the reason at debug level.
  }).pipe(Effect.orElseSucceed(() => false))
