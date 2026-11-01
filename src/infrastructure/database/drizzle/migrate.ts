/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Database as BunSqlite } from 'bun:sqlite'
import { drizzle as drizzlePg } from 'drizzle-orm/bun-sql'
import { migrate as migratePg } from 'drizzle-orm/bun-sql/migrator'
import { drizzle as drizzleSqlite } from 'drizzle-orm/bun-sqlite'
import { migrate as migrateSqlite } from 'drizzle-orm/bun-sqlite/migrator'
import { Effect } from 'effect'
import { DatabaseConnectionError } from '@/application/ports/services/database-migrator'
import { withCauseInMessage } from '@/infrastructure/database/drizzle/with-cause-in-message'
import { adminSearchFtsBootStatements } from '@/infrastructure/database/lookup/admin-search-fts-ddl'
import { probePostgresRuntimeSettings } from '@/infrastructure/database/sql/postgres-client-options'
import { openPrivateSqlite } from '@/infrastructure/filesystem/private-modes'
import { logDebug } from '@/infrastructure/logging/logger'
import { resetTableColumnCache } from '../sql/dialect-introspection'
import { acquireMaintenanceClient } from '../sql/postgres-connection-budget'
import { applySqlitePragmas, sqliteLockHint } from '../sql/sqlite-pragmas'
import {
  detectPostgresAccountCollisions,
  detectSqliteAccountCollisions,
  formatAccountCollisionMessage,
  type AccountCollisionRow,
} from './account-issuer-preflight'
import { MigrationError } from './migration-error'
import { resolveMigrationsFolder } from './migration-folder'
import {
  detectPostgresOauthClientIdCollisions,
  detectSqliteOauthClientIdCollisions,
  formatOauthClientIdCollisionMessage,
  type OauthClientIdCollisionRow,
} from './oauth-client-id-preflight'
import type { DatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'

/**
 * The driver's own words, not the wrapper's.
 *
 * No `catch:` below is a bare `String(error)`. On a `DrizzleQueryError` that
 * yields `Failed query: <sql>` and nothing else — the driver's message
 * (`relation "auth.oauth_resource" already exists`) lives on `.cause`, one hop
 * away and invisible. That defect class hid the v0.23.0 root cause from
 * everyone reading the logs.
 */
const driverMessage = (error: unknown): string => String(withCauseInMessage(error))

// Declared with the `DatabaseMigrator` port, which is how the boot sequence
// reaches the migrator; re-exported here for every existing importer.
export { DatabaseConnectionError }

// Declared in `migration-error.ts` so `migration-folder.ts` can name it too
// without an import cycle; re-exported here because this is where every
// existing importer looks for it.
export { MigrationError }

/**
 * Refuse the upgrade if the account table holds rows the new UNIQUE
 * (issuer, account_id) index would reject.
 *
 * Turns an opaque `UNIQUE constraint failed` into an actionable message naming
 * the offending rows. A no-op once the column exists, and on a fresh install.
 */
const guardAccountIdentity = (
  collisions: readonly AccountCollisionRow[]
): Effect.Effect<void, MigrationError> =>
  collisions.length > 0
    ? Effect.fail(new MigrationError({ message: formatAccountCollisionMessage(collisions) }))
    : Effect.void

/**
 * Refuse the upgrade if the OAuth client table holds rows the new UNIQUE
 * `client_id` constraint would reject.
 *
 * Same contract as {@link guardAccountIdentity}: name the offending rows rather
 * than emit a bare `duplicate key` error, and never de-duplicate. A no-op once
 * the constraint exists, and on a fresh install.
 */
const guardOauthClientIdentity = (
  collisions: readonly OauthClientIdCollisionRow[]
): Effect.Effect<void, MigrationError> =>
  collisions.length > 0
    ? Effect.fail(new MigrationError({ message: formatOauthClientIdCollisionMessage(collisions) }))
    : Effect.void

/**
 * Extra sentences appended to a failure message.
 *
 * The SQLite paths pass a {@link sqliteLockHint} closure so a lock refusal
 * that outlasted the busy timeout says so plainly and names the file; the
 * Postgres paths pass {@link noHint}, since none of this applies to them.
 */
type FailureHint = (error: unknown) => string

/** No extra sentences — the Postgres paths, and the default. */
const noHint: FailureHint = () => ''

/** The SQLite hint, bound to the database file a failure would be about. */
const sqliteHint =
  (path: string): FailureHint =>
  (error) =>
    sqliteLockHint(error, path)

/** Wrap a pre-flight probe failure as a migration failure. */
const preflightFailed = (error: unknown, hint: FailureHint = noHint) =>
  new MigrationError({
    message: `Account identity pre-flight check failed: ${driverMessage(error)}${hint(error)}`,
    cause: error,
  })

/** Wrap an OAuth-client pre-flight probe failure as a migration failure. */
const oauthPreflightFailed = (error: unknown, hint: FailureHint = noHint) =>
  new MigrationError({
    message: `OAuth client identity pre-flight check failed: ${driverMessage(error)}${hint(error)}`,
    cause: error,
  })

/**
 * Every identity pre-flight probe, run before the PostgreSQL migration set.
 *
 * All probes run before ANY migration DDL, so an operator holding more than one
 * kind of duplicate is refused on the first one found and fixes them one at a
 * time. The order between probes is arbitrary — what matters is that both come
 * before the migrator, since a refusal after partial DDL would not be the clean
 * "nothing has been changed" the messages promise.
 */
const postgresPreflight = (
  query: (sql: string) => Promise<unknown>
): Effect.Effect<void, MigrationError> =>
  Effect.gen(function* () {
    yield* guardAccountIdentity(
      yield* Effect.tryPromise({
        try: () => detectPostgresAccountCollisions(query),
        catch: preflightFailed,
      })
    )
    yield* guardOauthClientIdentity(
      yield* Effect.tryPromise({
        try: () => detectPostgresOauthClientIdCollisions(query),
        catch: oauthPreflightFailed,
      })
    )
  })

/**
 * The SQLite counterpart of {@link postgresPreflight}; `bun:sqlite` is
 * synchronous.
 *
 * Takes `path` only so a lock refusal can name the file. This is where the
 * boot-time crash surfaced: a probe reading `sqlite_master` is refused the
 * instant any other connection holds the database, and before the busy timeout
 * existed on this connection it was refused rather than delayed.
 */
const sqlitePreflight = (
  query: (sql: string) => readonly unknown[],
  path: string
): Effect.Effect<void, MigrationError> =>
  Effect.gen(function* () {
    const hint = sqliteHint(path)
    yield* guardAccountIdentity(
      yield* Effect.try({
        try: () => detectSqliteAccountCollisions(query),
        catch: (error) => preflightFailed(error, hint),
      })
    )
    yield* guardOauthClientIdentity(
      yield* Effect.try({
        try: () => detectSqliteOauthClientIdCollisions(query),
        catch: (error) => oauthPreflightFailed(error, hint),
      })
    )
  })

/**
 * Apply the PostgreSQL migration set (`drizzle/`).
 *
 * Enables `pgvector` before migrating — migration 0000 creates a `vector(1536)`
 * column, so the extension must exist first.
 */
const runPostgresMigrations = (
  databaseUrl: string
): Effect.Effect<void, DatabaseConnectionError | MigrationError> =>
  Effect.gen(function* () {
    // First, before any other client of this process is built: whether this
    // database (or the pooler in front of it) accepts the runtime settings.
    // effect-promise: total -- `probePostgresRuntimeSettings` settles both arms of its only query and never rejects (a refused or failed probe answers `false`).
    yield* Effect.promise(() => probePostgresRuntimeSettings(databaseUrl))
    // The maintenance slot, released on every exit of this scope.
    const client = yield* acquireMaintenanceClient(databaseUrl)
    // No `schema` map: drizzle v1 removed the option, and the migrator never
    // read it — it applies raw SQL files.
    const db = drizzlePg({ client })
    // Undo the `bigint: true` that drizzle-orm 1.0.0-rc.4/rc.5's `construct()` forces
    // on every client it is handed — including this one, which the preflight
    // checks below then query RAW. Those checks read `COUNT(*)`, and they survive
    // a BigInt only because they normalise through `Number()`; this keeps the
    // `int8 -> string` contract true on the boot path as well, so the next
    // pre-flight to read a count does not have to know about the override.
    // Same reset, same reason as `buildClient()` in `db-bun.ts`.
    client.options.bigint = false

    // Test database connection first to fail fast on connection errors
    yield* Effect.tryPromise({
      try: () => client.unsafe('SELECT 1'),
      catch: (error) =>
        new DatabaseConnectionError({
          message: `Database connection failed: ${driverMessage(error)}`,
          cause: error,
        }),
    })

    // Enable pgvector BEFORE migrating: migration 0000 creates a `vector(1536)`
    // column, so the extension must exist first. Idempotent. Requires the
    // connecting role to hold CREATE on the database (granted by default for
    // pgvector on managed Postgres; otherwise pre-provision the extension and
    // this statement no-ops).
    yield* Effect.tryPromise({
      try: () => client.unsafe('CREATE EXTENSION IF NOT EXISTS vector'),
      catch: (error) =>
        new MigrationError({
          message: `Failed to enable pgvector extension: ${driverMessage(error)}`,
          cause: error,
        }),
    })

    yield* postgresPreflight((sql) => client.unsafe(sql))

    const migrationsFolder = yield* resolveMigrationsFolder('pg')
    yield* Effect.tryPromise({
      try: () => migratePg(db, { migrationsFolder }),
      catch: (error) =>
        new MigrationError({
          message: `Migration failed: ${driverMessage(error)}`,
          cause: error,
        }),
    })
  }).pipe(Effect.scoped)

/**
 * Apply the SQLite migration set (`drizzle/sqlite/`).
 *
 * No `CREATE EXTENSION` step — `tsvector` / `vector` columns are omitted from
 * the SQLite schema mirror (those features degrade to `501 requires-postgres`).
 * Uses the synchronous `bun:sqlite` driver and `drizzle-orm/bun-sqlite/migrator`.
 */
const runSqliteMigrations = (
  path: string
): Effect.Effect<void, DatabaseConnectionError | MigrationError> =>
  Effect.gen(function* () {
    const client = yield* Effect.acquireRelease(
      Effect.try({
        try: () => {
          // The zero-config default lives under `./.sovrium/`, which may not exist yet.
          return openPrivateSqlite(path, () => new BunSqlite(path, { create: true }))
        },
        catch: (error) =>
          new DatabaseConnectionError({
            message: `SQLite database open failed: ${driverMessage(error)}${sqliteLockHint(error, path)}`,
            cause: error,
          }),
      }),
      (opened) => Effect.sync(() => opened.close())
    )

    // The SAME pragmas the runtime connection gets, from the one module that
    // spells them. `busy_timeout` is the load-bearing one here: without it this
    // connection answered `SQLITE_BUSY: database is locked` the instant any
    // other process held the file, which turned a momentary overlap — a
    // `--watch` restart, a `sovrium` command, a backup reader — into
    // `Sovrium failed to start`. Foreign-key enforcement must also be on before
    // applying FK-bearing migrations, and it is, one line inside the helper.
    yield* Effect.try({
      try: () => applySqlitePragmas(client),
      catch: (error) =>
        new DatabaseConnectionError({
          message: `SQLite PRAGMA setup failed: ${driverMessage(error)}${sqliteLockHint(error, path)}`,
          cause: error,
        }),
    })

    const db = drizzleSqlite({ client })

    yield* sqlitePreflight((sql) => client.query(sql).all(), path)

    const migrationsFolder = yield* resolveMigrationsFolder('sqlite')
    yield* Effect.try({
      try: () => migrateSqlite(db, { migrationsFolder }),
      catch: (error) =>
        new MigrationError({
          message: `Migration failed: ${driverMessage(error)}${sqliteLockHint(error, path)}`,
          cause: error,
        }),
    })

    // Admin global-search FTS5 boot DDL (SQLite only). The Drizzle migration
    // created the durable content table `system__admin_search_index`; the FTS5
    // virtual table + its content-sync triggers are not expressible in Drizzle
    // sqlite-core, so they are created here via raw, idempotent DDL — the same
    // DDL-dispatch precedent the lookup-view generators follow on the SQLite
    // branch. PostgreSQL needs no equivalent (its generated `content_tsv` + GIN
    // ship in the PG migration).
    yield* Effect.try({
      try: () => adminSearchFtsBootStatements().forEach((statement) => client.exec(statement)),
      catch: (error) =>
        new MigrationError({
          message: `Admin-search FTS5 setup failed: ${driverMessage(error)}${sqliteLockHint(error, path)}`,
          cause: error,
        }),
    })
  }).pipe(Effect.scoped)

/**
 * Run Drizzle migrations to create/update the database schema.
 *
 * Applies all migrations for the resolved dialect:
 * - PostgreSQL → `drizzle/` (Better Auth tables, migration-audit tables, the
 *   `auth` schema with helper functions, the pgvector `vector(1536)` column).
 * - SQLite → `drizzle/sqlite/` (the sqlite-core mirror; `vector` / `tsvector`
 *   columns are absent — those features degrade).
 *
 * CRITICAL: Must run BEFORE initializeSchema() because:
 * 1. User fields (created-by, updated-by, user) need the users table to exist
 * 2. The users table must be created before app-specific tables
 * 3. initializeSchema() creates app-specific tables that reference users
 *
 * @param config - resolved database dialect configuration
 * @returns Effect that completes when migrations are applied (and resets cached column lists)
 */
export const runMigrations = (
  config: DatabaseDialectConfig
): Effect.Effect<void, DatabaseConnectionError | MigrationError> =>
  Effect.gen(function* () {
    yield* config.dialect === 'postgres'
      ? runPostgresMigrations(config.databaseUrl)
      : runSqliteMigrations(config.path)
    logDebug('[migrations] migrations applied', { dialect: config.dialect })
  }).pipe(Effect.ensuring(Effect.sync(resetTableColumnCache)))
