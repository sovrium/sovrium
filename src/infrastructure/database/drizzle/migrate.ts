/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { SQL } from 'bun'
import { Database as BunSqlite } from 'bun:sqlite'
import { drizzle as drizzlePg } from 'drizzle-orm/bun-sql'
import { migrate as migratePg } from 'drizzle-orm/bun-sql/migrator'
import { drizzle as drizzleSqlite } from 'drizzle-orm/bun-sqlite'
import { migrate as migrateSqlite } from 'drizzle-orm/bun-sqlite/migrator'
import { Effect, Data } from 'effect'
import { materializeMigrations } from '@/infrastructure/assets/embedded-static-assets'
import { adminSearchFtsBootStatements } from '@/infrastructure/database/lookup/admin-search-fts-ddl'
import { withCauseInMessage } from '@/infrastructure/errors/with-cause-in-message'
import { logDebug } from '@/infrastructure/logging/logger'
import { isCompiled } from '@/infrastructure/utils/package-paths'
import {
  detectPostgresAccountCollisions,
  detectSqliteAccountCollisions,
  formatAccountCollisionMessage,
  type AccountCollisionRow,
} from './account-issuer-preflight'
import {
  detectPostgresOauthClientIdCollisions,
  detectSqliteOauthClientIdCollisions,
  formatOauthClientIdCollisionMessage,
  type OauthClientIdCollisionRow,
} from './oauth-client-id-preflight'
import * as schema from './schema'
import * as schemaSqlite from './schema-sqlite'
import type { DatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'

/**
 * Resolve a drizzle migrations folder.
 *
 * `subdir` distinguishes the two dialect-specific generated sets:
 *   - `''`        → `drizzle/`        (PostgreSQL — `drizzle-kit generate`)
 *   - `'sqlite'`  → `drizzle/sqlite/` (SQLite — `drizzle-kit generate` with the
 *                                      sqlite dialect config)
 *
 * Checks in order:
 * 1. CWD-relative (works when sovrium IS the project root)
 * 2. Relative to this file's package root (works when sovrium is a dependency)
 *
 * Walks up from `import.meta.dir` to find the `drizzle/` folder containing
 * the dialect's `meta/_journal.json`.
 */
const journalSegments = (subdir: string): readonly string[] =>
  subdir ? ['drizzle', subdir, 'meta', '_journal.json'] : ['drizzle', 'meta', '_journal.json']

const hasMigrations = (dir: string, subdir: string): boolean =>
  existsSync(join(dir, ...journalSegments(subdir)))

const ancestors = (start: string, depth: number): readonly string[] =>
  depth <= 0
    ? [start]
    : (() => {
        const parent = resolve(start, '..')
        return parent === start ? [start] : [start, ...ancestors(parent, depth - 1)]
      })()

const findMigrationsFolder = (subdir: string): string => {
  const folder = subdir ? join('drizzle', subdir) : 'drizzle'

  // 1. CWD-relative (dev / root project)
  const cwdPath = resolve(folder)

  // 2. Package-relative candidates (sovrium as dependency)
  const packageDir = ancestors(import.meta.dir, 5).find((dir) => hasMigrations(dir, subdir))

  return packageDir ? join(packageDir, folder) : cwdPath
}

/**
 * Resolve the drizzle migrations folder for a dialect.
 *
 * In a compiled binary the `drizzle/` files are not on disk beside the
 * executable — they are embedded — so {@link materializeMigrations} writes them
 * to a temp dir that drizzle's folder-based migrator can read. In dev/bundled
 * mode the on-disk folder is resolved via {@link findMigrationsFolder}.
 */
export const resolveMigrationsFolder = (dialect: 'pg' | 'sqlite'): Effect.Effect<string, never> =>
  isCompiled
    ? Effect.promise(() => materializeMigrations(dialect))
    : Effect.sync(() => findMigrationsFolder(dialect === 'sqlite' ? 'sqlite' : ''))

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

/**
 * Error when migration fails
 */
export class MigrationError extends Data.TaggedError('MigrationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

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

/** Wrap a pre-flight probe failure as a migration failure. */
const preflightFailed = (error: unknown) =>
  new MigrationError({
    message: `Account identity pre-flight check failed: ${driverMessage(error)}`,
    cause: error,
  })

/** Wrap an OAuth-client pre-flight probe failure as a migration failure. */
const oauthPreflightFailed = (error: unknown) =>
  new MigrationError({
    message: `OAuth client identity pre-flight check failed: ${driverMessage(error)}`,
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

/** The SQLite counterpart of {@link postgresPreflight}; `bun:sqlite` is synchronous. */
const sqlitePreflight = (
  query: (sql: string) => readonly unknown[]
): Effect.Effect<void, MigrationError> =>
  Effect.gen(function* () {
    yield* guardAccountIdentity(
      yield* Effect.try({
        try: () => detectSqliteAccountCollisions(query),
        catch: preflightFailed,
      })
    )
    yield* guardOauthClientIdentity(
      yield* Effect.try({
        try: () => detectSqliteOauthClientIdCollisions(query),
        catch: oauthPreflightFailed,
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
    const db = drizzlePg({ client, schema })

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
          message: `SQLite database open failed: ${driverMessage(error)}`,
          cause: error,
        }),
    })

    // Foreign-key enforcement must be on before applying FK-bearing migrations.
    yield* Effect.try({
      try: () => client.exec('PRAGMA foreign_keys = ON'),
      catch: (error) =>
        new DatabaseConnectionError({
          message: `SQLite PRAGMA setup failed: ${driverMessage(error)}`,
          cause: error,
        }),
    })

    const db = drizzleSqlite({ client, schema: schemaSqlite })

    yield* sqlitePreflight((sql) => client.query(sql).all())

    const migrationsFolder = yield* resolveMigrationsFolder('sqlite')
    yield* Effect.try({
      try: () => migrateSqlite(db, { migrationsFolder }),
      catch: (error) =>
        new MigrationError({
          message: `Migration failed: ${driverMessage(error)}`,
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
          message: `Admin-search FTS5 setup failed: ${driverMessage(error)}`,
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
 * Where the journal and the database each stand, read WITHOUT applying anything.
 *
 * `runMigrations` reports neither a count nor a tag, which is half of why the
 * v0.23.0 outage was unreadable from outside: "did nothing" and "migrated 7 →
 * 14" produced byte-identical output. `sovrium migrate` narrates the difference
 * by reading this before and after, so the applied set is the SLICE between the
 * two counts rather than a claim the command makes about itself.
 */
export interface MigrationJournalState {
  readonly dialect: DatabaseDialectConfig['dialect']
  /** The folder drizzle would migrate from — resolved, never the token typed. */
  readonly migrationsFolder: string
  /** Every tag the current build ships, in journal (applied) order. */
  readonly tags: readonly string[]
  /** How many of them this database has already applied. `0` before the first run. */
  readonly appliedCount: number
}

/** Read a journal's tags in applied order. */
const readJournalTags = (migrationsFolder: string): readonly string[] =>
  (
    JSON.parse(readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf-8')) as {
      readonly entries: readonly { readonly tag: string }[]
    }
  ).entries.map((entry) => entry.tag)

/**
 * Count the applied rows, tolerating a database that has never been migrated.
 *
 * Existence is probed FIRST rather than catching a failed `SELECT`: an error
 * mid-transaction would poison the session, and "the table is absent" is a
 * legitimate state (a fresh install) rather than a failure to recover from.
 */
const postgresAppliedCount = async (query: (sql: string) => Promise<unknown>): Promise<number> => {
  const present = (await query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present"
  )) as readonly { readonly present: boolean }[]
  if (present[0]?.present !== true) return 0

  const counted = (await query(
    'SELECT count(*)::int AS applied FROM drizzle.__drizzle_migrations'
  )) as readonly { readonly applied: number }[]
  return Number(counted[0]?.applied ?? 0)
}

/** The SQLite counterpart of {@link postgresAppliedCount}; `bun:sqlite` is synchronous. */
const sqliteAppliedCount = (query: (sql: string) => readonly unknown[]): number => {
  const present = query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'"
  )
  if (present.length === 0) return 0

  const counted = query('SELECT count(*) AS applied FROM __drizzle_migrations') as readonly {
    readonly applied: number
  }[]
  return Number(counted[0]?.applied ?? 0)
}

/**
 * How many journal entries this database has already applied.
 *
 * Opens its own short-lived connection and closes it. Never CREATES: a SQLite
 * file that does not exist has applied nothing, and answering that by creating
 * it would make every read-only mode a writer — precisely what `--dry-run` and
 * `--check` promise not to be. The apply path is unaffected, since
 * `runSqliteMigrations` creates the file moments later as it always did.
 */
const readAppliedCount = (
  config: DatabaseDialectConfig
): Effect.Effect<number, DatabaseConnectionError> => {
  if (config.dialect === 'sqlite') {
    return existsSync(config.path)
      ? Effect.try({
          try: () => {
            const client = new BunSqlite(config.path, { create: false, readonly: true })
            try {
              return sqliteAppliedCount((sql) => client.query(sql).all())
            } finally {
              client.close()
            }
          },
          catch: (error) =>
            new DatabaseConnectionError({
              message: `SQLite database open failed: ${driverMessage(error)}`,
              cause: error,
            }),
        })
      : Effect.succeed(0)
  }

  return Effect.tryPromise({
    try: async () => {
      const client = new SQL(config.databaseUrl)
      try {
        return await postgresAppliedCount((sql) => client.unsafe(sql))
      } finally {
        // eslint-disable-next-line functional/no-expression-statements -- releasing the probe connection
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
 * Read {@link MigrationJournalState} for the resolved dialect.
 *
 * The journal is read from the resolved folder and the applied count from the
 * database; neither side writes anything.
 */
export const readMigrationJournalState = (
  config: DatabaseDialectConfig
): Effect.Effect<MigrationJournalState, DatabaseConnectionError> =>
  Effect.gen(function* () {
    const migrationsFolder = yield* resolveMigrationsFolder(
      config.dialect === 'postgres' ? 'pg' : 'sqlite'
    )
    const tags = yield* Effect.try({
      try: () => readJournalTags(migrationsFolder),
      catch: (error) =>
        new DatabaseConnectionError({
          message: `Migration journal could not be read at ${migrationsFolder}: ${driverMessage(error)}`,
          cause: error,
        }),
    })

    return {
      dialect: config.dialect,
      migrationsFolder,
      tags,
      appliedCount: yield* readAppliedCount(config),
    }
  })
