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
import { logDebug } from '@/infrastructure/logging/logger'
import { isCompiled } from '@/infrastructure/utils/package-paths'
import * as schema from './schema'
import * as schemaSqlite from './schema-sqlite'
import type { DatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'

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

  const cwdPath = resolve(folder)

  const packageDir = ancestors(import.meta.dir, 5).find((dir) => hasMigrations(dir, subdir))

  return packageDir ? join(packageDir, folder) : cwdPath
}

const resolveMigrationsFolder = (dialect: 'pg' | 'sqlite'): Effect.Effect<string, never> =>
  isCompiled
    ? Effect.promise(() => materializeMigrations(dialect))
    : Effect.sync(() => findMigrationsFolder(dialect === 'sqlite' ? 'sqlite' : ''))

export class DatabaseConnectionError extends Data.TaggedError('DatabaseConnectionError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class MigrationError extends Data.TaggedError('MigrationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

const runPostgresMigrations = (
  databaseUrl: string
): Effect.Effect<void, DatabaseConnectionError | MigrationError> =>
  Effect.gen(function* () {
    const client = new SQL(databaseUrl)
    const db = drizzlePg({ client, schema })

    yield* Effect.tryPromise({
      try: () => client.unsafe('SELECT 1'),
      catch: (error) =>
        new DatabaseConnectionError({
          message: `Database connection failed: ${String(error)}`,
          cause: error,
        }),
    })

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

const runSqliteMigrations = (
  path: string
): Effect.Effect<void, DatabaseConnectionError | MigrationError> =>
  Effect.gen(function* () {
    const client = yield* Effect.try({
      try: () => {
        if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
        return new BunSqlite(path, { create: true })
      },
      catch: (error) =>
        new DatabaseConnectionError({
          message: `SQLite database open failed: ${String(error)}`,
          cause: error,
        }),
    })

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

    yield* Effect.sync(() => client.close())
  })

export const runMigrations = (
  config: DatabaseDialectConfig
): Effect.Effect<void, DatabaseConnectionError | MigrationError> =>
  Effect.gen(function* () {
    logDebug(`[Migrations] Running Drizzle migrations (${config.dialect})...`)

    yield* config.dialect === 'postgres'
      ? runPostgresMigrations(config.databaseUrl)
      : runSqliteMigrations(config.path)

    logDebug('[Migrations] Drizzle migrations completed')
  })
