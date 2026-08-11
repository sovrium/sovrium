/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { existsSync, mkdirSync } from 'node:fs'
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
import { logDebug } from '@/infrastructure/logging/logger'
import { isCompiled } from '@/infrastructure/utils/package-paths'
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
const resolveMigrationsFolder = (dialect: 'pg' | 'sqlite'): Effect.Effect<string, never> =>
  isCompiled
    ? Effect.promise(() => materializeMigrations(dialect))
    : Effect.sync(() => findMigrationsFolder(dialect === 'sqlite' ? 'sqlite' : ''))

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
          message: `Database connection failed: ${String(error)}`,
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
          message: `Failed to enable pgvector extension: ${String(error)}`,
          cause: error,
        }),
    })

    const migrationsFolder = yield* resolveMigrationsFolder('pg')
    yield* Effect.tryPromise({
      try: () => migratePg(db, { migrationsFolder }),
      catch: (error) =>
        new MigrationError({
          message: `Migration failed: ${String(error)}`,
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
          message: `SQLite database open failed: ${String(error)}`,
          cause: error,
        }),
    })

    // Foreign-key enforcement must be on before applying FK-bearing migrations.
    yield* Effect.try({
      try: () => client.exec('PRAGMA foreign_keys = ON'),
      catch: (error) =>
        new DatabaseConnectionError({
          message: `SQLite PRAGMA setup failed: ${String(error)}`,
          cause: error,
        }),
    })

    const db = drizzleSqlite({ client, schema: schemaSqlite })

    const migrationsFolder = yield* resolveMigrationsFolder('sqlite')
    yield* Effect.try({
      try: () => migrateSqlite(db, { migrationsFolder }),
      catch: (error) =>
        new MigrationError({
          message: `Migration failed: ${String(error)}`,
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
          message: `Admin-search FTS5 setup failed: ${String(error)}`,
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
