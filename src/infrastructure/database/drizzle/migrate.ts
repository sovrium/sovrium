/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import { Effect, Console, Data } from 'effect'
import * as schema from './schema'

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
 * Run Drizzle migrations to create/update database schema
 *
 * This applies all migrations from the ./drizzle folder:
 * - Better Auth tables (users, sessions, accounts, etc.)
 * - Migration audit tables (_sovrium_migration_history, etc.)
 * - Auth schema with helper functions (auth.is_authenticated, auth.user_has_role)
 *
 * CRITICAL: Must run BEFORE initializeSchema() because:
 * 1. User fields (created-by, updated-by, user) need users table to exist
 * 2. The users table must be created before app-specific tables
 * 3. initializeSchema() creates app-specific tables that reference users
 *
 * @param databaseUrl - PostgreSQL connection URL
 * @returns Effect that completes when migrations are applied
 */
export const runMigrations = (
  databaseUrl: string
): Effect.Effect<void, DatabaseConnectionError | MigrationError> =>
  Effect.gen(function* () {
    yield* Console.log('[runMigrations] Running Drizzle migrations...')

    const client = new SQL(databaseUrl)
    const db = drizzle({ client, schema })

    // Test database connection first to fail fast on connection errors
    yield* Effect.tryPromise({
      try: () => client.unsafe('SELECT 1'),
      catch: (error) =>
        new DatabaseConnectionError({
          message: `Database connection failed: ${String(error)}`,
          cause: error,
        }),
    })

    yield* Effect.tryPromise({
      try: () => migrate(db, { migrationsFolder: './drizzle' }),
      catch: (error) =>
        new MigrationError({
          message: `Migration failed: ${String(error)}`,
          cause: error,
        }),
    })

    yield* Effect.promise(() => client.close())

    yield* Console.log('[runMigrations] ✓ Drizzle migrations completed')
  })
