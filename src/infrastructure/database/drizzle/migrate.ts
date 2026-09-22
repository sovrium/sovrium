/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { SQL } from 'bun'
import { Database as BunSqlite } from 'bun:sqlite'
import { drizzle as drizzlePg } from 'drizzle-orm/bun-sql'
import { migrate as migratePg } from 'drizzle-orm/bun-sql/migrator'
import { drizzle as drizzleSqlite } from 'drizzle-orm/bun-sqlite'
import { migrate as migrateSqlite } from 'drizzle-orm/bun-sqlite/migrator'
import { Effect, Data } from 'effect'
import { adminSearchFtsBootStatements } from '@/infrastructure/database/lookup/admin-search-fts-ddl'
import { withCauseInMessage } from '@/infrastructure/errors/with-cause-in-message'
import { logDebug } from '@/infrastructure/logging/logger'
import { applySqlitePragmas, sqliteLockHint } from '../sql/sqlite-pragmas'
import {
  detectPostgresAccountCollisions,
  detectSqliteAccountCollisions,
  formatAccountCollisionMessage,
  type AccountCollisionRow,
} from './account-issuer-preflight'
import { MigrationError } from './migration-error'
import {
  resolveMigrationsFolder,
  shippedMigrations,
  truncateToSecond,
  type ShippedMigration,
} from './migration-folder'
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
 * Every `catch:` below used to be a bare `String(error)`. On a `DrizzleQueryError`
 * that yields `Failed query: <sql>` and nothing else — the driver's message
 * (`relation "auth.oauth_resource" already exists`) lives on `.cause`, one hop
 * away and invisible. That is the same defect class that hid the v0.23.0 root
 * cause from everyone reading the logs.
 */
const driverMessage = (error: unknown): string => String(withCauseInMessage(error))

/**
 * Error when database connection fails
 */
export class DatabaseConnectionError extends Data.TaggedError('DatabaseConnectionError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

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
    const client = new SQL(databaseUrl)
    // No `schema` map: drizzle v1 removed the option, and the migrator never
    // read it — it applies raw SQL files.
    const db = drizzlePg({ client })
    // Undo the `bigint: true` that drizzle-orm 1.0.0-rc.4's `construct()` forces
    // on every client it is handed — including this one, which the preflight
    // checks below then query RAW. Those checks read `COUNT(*)`, and they survive
    // a BigInt only because they normalise through `Number()`; this keeps the
    // `int8 -> string` contract true on the boot path as well, so the next
    // pre-flight to read a count does not have to know about the override.
    // Same reset, same reason as `buildClient()` in `db-bun.ts`.
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- driver-level connection setup; restores Bun's own documented default
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

    // effect-promise: total -- `SQL.close()` resolves once the pool is drained and has no rejection path; the migration it is closing after has already succeeded, and a teardown failure must not be reported as a migration failure.
    yield* Effect.promise(() => client.close())
  })

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
    const client = yield* Effect.try({
      try: () => {
        // Create the parent dir first — `bun:sqlite` `{ create: true }` makes
        // the file but not its directory, and the zero-config default now lives
        // under `./.sovrium/`. Skip the in-memory sentinel (no filesystem path).
        // eslint-disable-next-line functional/no-expression-statements -- filesystem prep before the synchronous driver open
        if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
        return new BunSqlite(path, { create: true })
      },
      catch: (error) =>
        new DatabaseConnectionError({
          message: `SQLite database open failed: ${driverMessage(error)}${sqliteLockHint(error, path)}`,
          cause: error,
        }),
    })

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

    yield* Effect.sync(() => client.close())
  })

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
 * @returns Effect that completes when migrations are applied
 */
export const runMigrations = (
  config: DatabaseDialectConfig
): Effect.Effect<void, DatabaseConnectionError | MigrationError> =>
  Effect.gen(function* () {
    yield* config.dialect === 'postgres'
      ? runPostgresMigrations(config.databaseUrl)
      : runSqliteMigrations(config.path)

    logDebug('[migrations] migrations applied', { dialect: config.dialect })
  })

/**
 * Where the shipped set and the database each stand, read WITHOUT applying
 * anything.
 *
 * `runMigrations` reports neither a count nor a name, which is half of why the
 * v0.23.0 outage was unreadable from outside: "did nothing" and "migrated 7 →
 * 14" produced byte-identical output. `sovrium migrate` narrates the difference
 * by reading this before and after, so the applied set is the DIFFERENCE
 * between the two name sets rather than a claim the command makes about itself.
 */
export interface MigrationFolderState {
  readonly dialect: DatabaseDialectConfig['dialect']
  /** The folder drizzle would migrate from — resolved, never the token typed. */
  readonly migrationsFolder: string
  /** Every migration folder name the current build ships, in apply order. */
  readonly names: readonly string[]
  /**
   * The names this database records as applied.
   *
   * A SET, not a count. Drizzle v1 decides what to run by NAME membership, so
   * a positional `names.slice(appliedCount)` — correct under 0.45's strictly
   * ordered timestamp model — can now name the wrong migrations outright: a
   * database that skipped one and applied the next would be reported as having
   * applied the one it skipped. May contain a name this build does not ship
   * (a downgrade, or a fork); reported verbatim rather than dropped, and the
   * counts derive from the intersection.
   */
  readonly applied: readonly string[]
}

/** One `__drizzle_migrations` row, as either driver returns it, on either shape. */
interface AppliedRow {
  readonly hash: string
  readonly created_at: string | number | bigint
  readonly name?: string | null
}

/**
 * Map legacy rows onto folder names the way drizzle's own upgrade does.
 *
 * A pre-v1 `__drizzle_migrations` has no `name` column at all, so the only way
 * to say which migrations it holds is to reproduce `upgradeIfNeeded`'s join:
 * truncate the stored millisecond `created_at` to seconds and match it against
 * the folder's own second-precision timestamp, falling back to the sha256 when
 * the timestamp finds nothing. This is a READ — it never writes the column —
 * so the one `--dry-run` an operator runs BEFORE their first v1 boot is
 * accurate instead of reporting a fully-migrated database as empty.
 */
const namesForLegacyRows = (
  shipped: readonly ShippedMigration[],
  rows: readonly AppliedRow[]
): readonly string[] => {
  const byWhen = new Map(shipped.map((entry) => [entry.whenMillis, entry] as const))
  const byHash = new Map(shipped.map((entry) => [entry.hash, entry] as const))

  return rows.flatMap((row) => {
    const matched = byWhen.get(truncateToSecond(row.created_at)) ?? byHash.get(String(row.hash))
    return matched ? [matched.name] : []
  })
}

/**
 * Which migrations this database records, tolerating both table shapes.
 *
 * Existence is probed FIRST rather than catching a failed `SELECT`: an error
 * mid-transaction would poison the session, and "the table is absent" is a
 * legitimate state (a fresh install) rather than a failure to recover from.
 * The `name` COLUMN is probed for the same reason — this runs before drizzle's
 * one-time `upgradeIfNeeded` has had any chance to add it.
 */
const postgresAppliedNames = async (
  query: (sql: string) => Promise<unknown>,
  shipped: readonly ShippedMigration[]
): Promise<readonly string[]> => {
  const present = (await query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present"
  )) as readonly { readonly present: boolean }[]
  if (present[0]?.present !== true) return []

  const columns = (await query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'"
  )) as readonly { readonly column_name: string }[]
  const hasName = columns.some((column) => column.column_name === 'name')

  if (!hasName) {
    return namesForLegacyRows(
      shipped,
      (await query(
        'SELECT hash, created_at FROM drizzle.__drizzle_migrations'
      )) as readonly AppliedRow[]
    )
  }

  const named = (await query(
    'SELECT name FROM drizzle.__drizzle_migrations WHERE name IS NOT NULL'
  )) as readonly { readonly name: string }[]
  return named.map((row) => row.name)
}

/** The SQLite counterpart of {@link postgresAppliedNames}; `bun:sqlite` is synchronous. */
const sqliteAppliedNames = (
  query: (sql: string) => readonly unknown[],
  shipped: readonly ShippedMigration[]
): readonly string[] => {
  const present = query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'"
  )
  if (present.length === 0) return []

  const columns = query(
    "SELECT name AS column_name FROM pragma_table_info('__drizzle_migrations')"
  ) as readonly { readonly column_name: string }[]
  const hasName = columns.some((column) => column.column_name === 'name')

  if (!hasName) {
    return namesForLegacyRows(
      shipped,
      query('SELECT hash, created_at FROM __drizzle_migrations') as readonly AppliedRow[]
    )
  }

  const named = query('SELECT name FROM __drizzle_migrations WHERE name IS NOT NULL') as readonly {
    readonly name: string
  }[]
  return named.map((row) => row.name)
}

/**
 * The names this database has already applied.
 *
 * Opens its own short-lived connection and closes it. Never CREATES: a SQLite
 * file that does not exist has applied nothing, and answering that by creating
 * it would make every read-only mode a writer — precisely what `--dry-run` and
 * `--check` promise not to be. The apply path is unaffected, since
 * `runSqliteMigrations` creates the file moments later as it always did.
 */
const readAppliedNames = (
  config: DatabaseDialectConfig,
  shipped: readonly ShippedMigration[]
): Effect.Effect<readonly string[], DatabaseConnectionError> => {
  if (config.dialect === 'sqlite') {
    return existsSync(config.path)
      ? Effect.try({
          try: () => {
            const client = new BunSqlite(config.path, { create: false, readonly: true })
            // Read-only, so the busy timeout alone: a reader is still refused
            // outright by a writer holding the file, and `sovrium migrate
            // --dry-run` reporting "locked" where it could simply have waited
            // is the same defect in a quieter place.

            applySqlitePragmas(client, { readOnly: true })
            try {
              return sqliteAppliedNames((sql) => client.query(sql).all(), shipped)
            } finally {
              client.close()
            }
          },
          catch: (error) =>
            new DatabaseConnectionError({
              message: `SQLite database open failed: ${driverMessage(error)}${sqliteLockHint(error, config.path)}`,
              cause: error,
            }),
        })
      : Effect.succeed([])
  }

  return Effect.tryPromise({
    try: async () => {
      const client = new SQL(config.databaseUrl)
      try {
        return await postgresAppliedNames((sql) => client.unsafe(sql), shipped)
      } finally {
        await client.close()
      }
    },
    catch: (error) =>
      new DatabaseConnectionError({
        message: `Database connection failed: ${driverMessage(error)}`,
        cause: error,
      }),
  })
}

/**
 * Read {@link MigrationFolderState} for the resolved dialect.
 *
 * The shipped set is read from the resolved folder and the applied names from
 * the database; neither side writes anything.
 */
export const readMigrationFolderState = (
  config: DatabaseDialectConfig
  // `MigrationError` joins the union because resolving the folder now reports
  // its own failure: in a compiled binary that step unpacks the embedded
  // migrations to disk, which a read-only or full filesystem refuses.
): Effect.Effect<MigrationFolderState, DatabaseConnectionError | MigrationError> =>
  Effect.gen(function* () {
    const migrationsFolder = yield* resolveMigrationsFolder(
      config.dialect === 'postgres' ? 'pg' : 'sqlite'
    )
    const shipped = yield* Effect.try({
      try: () => shippedMigrations(migrationsFolder),
      catch: (error) =>
        new DatabaseConnectionError({
          message: `Migrations could not be read at ${migrationsFolder}: ${driverMessage(error)}`,
          cause: error,
        }),
    })

    return {
      dialect: config.dialect,
      migrationsFolder,
      names: shipped.map((entry) => entry.name),
      applied: yield* readAppliedNames(config, shipped),
    }
  })
