/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import { Effect, Data } from 'effect'
import { logDebug } from '@/infrastructure/logging/logger'
import * as schema from './schema'

const hasMigrations = (dir: string): boolean =>
  existsSync(join(dir, 'drizzle', 'meta', '_journal.json'))

const ancestors = (start: string, depth: number): readonly string[] =>
  depth <= 0
    ? [start]
    : (() => {
        const parent = resolve(start, '..')
        return parent === start ? [start] : [start, ...ancestors(parent, depth - 1)]
      })()

const findMigrationsFolder = (): string => {
  const cwdPath = resolve('drizzle')

  const packageDir = ancestors(import.meta.dir, 5).find(hasMigrations)

  return packageDir ? join(packageDir, 'drizzle') : cwdPath
}

export class DatabaseConnectionError extends Data.TaggedError('DatabaseConnectionError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class MigrationError extends Data.TaggedError('MigrationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export const runMigrations = (
  databaseUrl: string
): Effect.Effect<void, DatabaseConnectionError | MigrationError> =>
  Effect.gen(function* () {
    logDebug('[Migrations] Running Drizzle migrations...')

    const client = new SQL(databaseUrl)
    const db = drizzle({ client, schema })

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

    yield* Effect.tryPromise({
      try: () => migrate(db, { migrationsFolder: findMigrationsFolder() }),
      catch: (error) =>
        new MigrationError({
          message: `Migration failed: ${String(error)}`,
          cause: error,
        }),
    })

    yield* Effect.promise(() => client.close())

    logDebug('[Migrations] Drizzle migrations completed')
  })
