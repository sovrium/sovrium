/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { Config, Effect, Console, Data, type ConfigError } from 'effect'
import { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
import { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import { logInfo } from '@/infrastructure/logging/effect-logger'
import {
  needsUsersTable,
  needsUpdatedByTrigger,
  ensureBetterAuthUsersTable,
  ensureUpdatedByTriggerFunction,
  type BetterAuthUsersTableRequired,
} from './auth-validation'
import { tableExists, dropObsoleteTables } from './schema-migration-helpers'
import { createOrMigrateTable } from './table-operations'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/table'

// Re-export error types for convenience
export { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
export { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
export { BetterAuthUsersTableRequired } from './auth-validation'

export class NoDatabaseUrlError extends Data.TaggedError('NoDatabaseUrlError')<{
  readonly message: string
}> {}

/**
 * Execute schema initialization using bun:sql with transaction support
 * Uses Bun's native SQL driver for optimal performance
 *
 * Now supports incremental schema migrations:
 * - For new tables: CREATE TABLE
 * - For existing tables: ALTER TABLE ADD COLUMN for new fields
 *
 * Note: This function intentionally uses imperative patterns for database I/O.
 * Side effects are unavoidable when executing DDL statements against PostgreSQL.
 *
 * SECURITY NOTE: tx.unsafe() is intentionally used here for DDL execution.
 *
 * This is SAFE because:
 * 1. SQL is generated from validated Effect Schema objects, not user input
 *    - Table names come from schema definitions validated at startup
 *    - Field names/types are constrained by the domain model (Fields type)
 * 2. DDL statements (CREATE TABLE, CREATE INDEX) cannot use parameterized queries
 *    - PostgreSQL does not support $1 placeholders in DDL statements
 *    - Table and column names must be interpolated directly
 * 3. All identifiers come from validated schema definitions
 *    - The App schema is validated via Effect Schema before reaching this code
 *    - Invalid identifiers would fail schema validation, not reach SQL execution
 * 4. Transaction boundary provides atomicity
 *    - If any statement fails, the entire transaction rolls back
 *    - No partial schema state is possible
 *
 * This pattern is standard for schema migration tools (Drizzle, Prisma, etc.)
 * which all generate and execute DDL strings directly.
 */
/* eslint-disable functional/no-expression-statements, functional/no-loop-statements */
const executeSchemaInit = async (databaseUrl: string, tables: readonly Table[]): Promise<void> => {
  const db = new SQL(databaseUrl)

  try {
    await db.begin(async (tx) => {
      // Step 0: Verify Better Auth users table exists if any table needs it for foreign keys
      logInfo('[executeSchemaInit] Checking if Better Auth users table is needed...')
      const needs = needsUsersTable(tables)
      logInfo(`[executeSchemaInit] needsUsersTable: ${needs}`)
      if (needs) {
        logInfo('[executeSchemaInit] Better Auth users table is needed, verifying it exists...')
        await ensureBetterAuthUsersTable(tx)
      } else {
        logInfo('[executeSchemaInit] Better Auth users table not needed')
      }

      // Step 0.1: Ensure updated-by trigger function exists if any table needs it
      if (needsUpdatedByTrigger(tables)) {
        await ensureUpdatedByTriggerFunction(tx)
      }

      // Step 1: Drop tables that exist in database but not in schema
      await dropObsoleteTables(tx, tables)

      // Step 2: Create or migrate tables defined in schema
      for (const table of tables) {
        const exists = await tableExists(tx, table.name)
        await createOrMigrateTable(tx, table, exists)
      }
    })
  } finally {
    // Close connection
    await db.close()
  }
}
/* eslint-enable functional/no-expression-statements, functional/no-loop-statements */

/**
 * Error type union for schema initialization
 */
export type SchemaError =
  | SchemaInitializationError
  | NoDatabaseUrlError
  | BetterAuthUsersTableRequired
  | AuthConfigRequiredForUserFields

/**
 * Initialize database schema from app configuration (internal with error handling)
 *
 * Uses Bun's native SQL driver (bun:sql) for:
 * - Zero-dependency PostgreSQL access
 * - Optimal performance on Bun runtime
 * - Built-in connection pooling
 * - Transaction support with automatic rollback
 *
 * Errors are logged and handled internally - returns Effect<void, never>
 * for simpler composition in application layer.
 *
 * @see docs/infrastructure/database/runtime-sql-migrations/04-migration-executor.md
 */
const initializeSchemaInternal = (
  app: App
): Effect.Effect<void, SchemaError | ConfigError.ConfigError> =>
  Effect.gen(function* () {
    logInfo('[initializeSchemaInternal] Starting schema initialization...')
    logInfo(`[initializeSchemaInternal] App tables count: ${app.tables?.length || 0}`)

    // Skip if no tables defined
    if (!app.tables || app.tables.length === 0) {
      yield* Console.log('No tables defined, skipping schema initialization')
      return
    }

    // Check if tables require user fields but auth is not configured
    const tablesNeedUsersTable = needsUsersTable(app.tables)
    const hasAuthConfig = !!app.auth
    logInfo(`[initializeSchemaInternal] Tables need users table: ${tablesNeedUsersTable}`)
    logInfo(`[initializeSchemaInternal] Auth config present: ${hasAuthConfig}`)

    if (tablesNeedUsersTable && !hasAuthConfig) {
      return yield* Effect.fail(
        new AuthConfigRequiredForUserFields({
          message:
            'User fields (user, created-by, updated-by) require auth configuration. Please add auth: { methods: ["email-and-password"] } to your app schema.',
        })
      )
    }

    // Get database URL from Effect Config (reads from environment)
    const databaseUrlConfig = yield* Config.string('DATABASE_URL').pipe(Config.withDefault(''))
    logInfo(
      `[initializeSchemaInternal] DATABASE_URL: ${databaseUrlConfig ? 'present' : 'missing'}`
    )

    // Skip if no DATABASE_URL configured
    if (!databaseUrlConfig) {
      yield* Console.log('No DATABASE_URL found, skipping schema initialization')
      return
    }

    yield* Console.log('Initializing database schema...')

    // Execute schema initialization with bun:sql
    yield* Effect.tryPromise({
      try: () => executeSchemaInit(databaseUrlConfig, app.tables!),
      catch: (error) =>
        new SchemaInitializationError({
          message: `Schema initialization failed: ${String(error)}`,
          cause: error,
        }),
    })

    yield* Console.log('✓ Database schema initialized successfully')
  })

/**
 * Initialize database schema from app configuration
 *
 * Public API that handles errors internally to maintain backward compatibility.
 * Configuration errors are propagated, other errors are logged.
 *
 * Propagated errors:
 * - AuthConfigRequiredForUserFields: auth not configured but user fields used
 * - SchemaInitializationError: schema creation failed (database likely required)
 *
 * @param app - Application configuration with tables
 * @returns Effect that propagates configuration errors but logs optional failures
 */
export const initializeSchema = (
  app: App
): Effect.Effect<void, AuthConfigRequiredForUserFields | SchemaInitializationError> =>
  initializeSchemaInternal(app).pipe(
    Effect.catchAll(
      (error): Effect.Effect<void, AuthConfigRequiredForUserFields | SchemaInitializationError> => {
        // Re-throw auth config errors - these are fatal configuration issues
        if (error instanceof AuthConfigRequiredForUserFields) {
          return Effect.fail(error)
        }
        // Re-throw schema initialization errors - database is required when tables are defined
        if (error instanceof SchemaInitializationError) {
          return Effect.fail(error)
        }
        // Log other errors but don't fail
        return Console.error(`Error initializing database schema: ${error._tag}`).pipe(
          Effect.flatMap(() => Effect.void)
        )
      }
    )
  )
