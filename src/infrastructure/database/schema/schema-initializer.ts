/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Data, type Config } from 'effect'
import { ProcessEnv } from '@/application/ports/services/process-env'
import { AuthConfigRequiredForUserFields } from '@/domain/errors/auth-config-required-error'
import { SchemaInitializationError } from '@/domain/errors/schema-initialization-error'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { logDebug } from '@/infrastructure/logging/logger'
import { withFreshTableColumns } from '../sql/dialect-introspection'
import { tablesWithRecordLanguages } from '../sql/sql-translatable-columns'
import { withScopeTableKeys } from './apply-schema-defaults'
import { reconcileCommandSearchIndexes } from './command-search-fts'
import { generateSchemaChecksum } from './migration-audit-trail'
import { executeSchemaInit, checkShouldSkipMigration } from './schema-initializer-execute'
import { executeMigrationSteps, type SchemaInitOptions } from './schema-migration-steps'
import { cleanupObsoleteViews } from './schema-view-steps'
import type { BetterAuthUsersTableRequired } from '../auth/auth-validation'
import type { App } from '@/domain/models/app'

export type { SchemaInitOptions } from './schema-migration-steps'

// Re-export error types for convenience
export { AuthConfigRequiredForUserFields } from '@/domain/errors/auth-config-required-error'
export { SchemaInitializationError } from '@/domain/errors/schema-initialization-error'
export { BetterAuthUsersTableRequired } from '../auth/auth-validation'

export class NoDatabaseUrlError extends Data.TaggedError('NoDatabaseUrlError')<{
  readonly message: string
}> {}

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
 * @see [internal ref] — the decision.
 */
const initializeSchemaInternal = (
  app: App,
  options: SchemaInitOptions
): Effect.Effect<void, SchemaError | Config.ConfigError> =>
  Effect.gen(function* () {
    // Normalize tables to empty array if undefined
    const tables = app.tables ?? []

    // Authorship fields (created-by, updated-by, deleted-by) are allowed without
    // auth config — when auth is not configured, these fields will be NULL.
    //
    // Resolve the active database dialect (single source of truth). PostgreSQL
    // when DATABASE_URL is set; SQLite (zero-config, frugal-by-default) otherwise.
    // Schema initialization always runs — SQLite is a real database, not a
    // "skip the database" mode.
    const dialectConfig = parseDatabaseDialectConfig(yield* ProcessEnv)

    // Fast path: Check if schema checksum matches (before opening transaction)
    const currentChecksum = generateSchemaChecksum(app)
    const shouldSkipMigration = yield* checkShouldSkipMigration(
      dialectConfig,
      currentChecksum,
      // Stamped with the app's languages, as the migration reads them: a
      // translatable unique field's per-language indexes are named by language.
      tablesWithRecordLanguages({
        tables: withScopeTableKeys(tables, app),
        languages: app.languages,
      }),
      sanitizeTableName
    )

    // Even if migration is skipped, obsolete views still need cleanup —
    // they may have been created manually via SQL.
    if (shouldSkipMigration) {
      yield* cleanupObsoleteViews(dialectConfig, tables)
      // Deliberately reconciled on the SKIP path too. The command-palette
      // search indexes are introduced by a BINARY upgrade rather than by a
      // config edit, and the checksum only hashes `app.tables` — so a
      // deployment whose config never changes would take this fast path
      // forever and never acquire them. Idempotent, and silent when the
      // indexes are already in place.
      yield* reconcileCommandSearchIndexes(dialectConfig, tables)
      return
    }

    // Execute schema initialization (even if tables is empty - to drop obsolete tables).
    // `executeMigrationSteps` is passed as the per-transaction work callback —
    // the dialect-aware transaction plumbing lives in schema-initializer-execute.ts.
    yield* executeSchemaInit(dialectConfig, tables, app, (tx, stepTables, stepApp) =>
      executeMigrationSteps(tx, stepTables, stepApp, options)
    )

    // AFTER the migration transaction, not inside it: the indexes are built
    // over columns the migration may have just created, and a failure here
    // must not roll back real table DDL — the palette degrades to an
    // unindexed scan, which is exactly the pre-hardening behaviour.
    yield* reconcileCommandSearchIndexes(dialectConfig, tables)

    logDebug('[schema] database schema initialized')
  })

/**
 * Initialize database schema from app configuration
 *
 * Configuration errors propagate, others are wrapped; cached column lists are reset around it.
 *
 * Propagated errors:
 * - AuthConfigRequiredForUserFields: auth not configured but user fields used
 * - SchemaInitializationError: schema creation failed (database likely required)
 *
 * @param app - Application configuration with tables
 * @param options - consents for this run; the boot passes none (see {@link SchemaInitOptions})
 * @returns Effect that propagates configuration errors but logs optional failures
 */
export const initializeSchema = (
  app: App,
  options: SchemaInitOptions = {}
): Effect.Effect<void, AuthConfigRequiredForUserFields | SchemaInitializationError> =>
  withFreshTableColumns(initializeSchemaInternal(app, options)).pipe(
    Effect.catch(
      (error): Effect.Effect<void, AuthConfigRequiredForUserFields | SchemaInitializationError> => {
        // Re-throw auth config errors - these are fatal configuration issues
        if (error instanceof AuthConfigRequiredForUserFields) {
          return Effect.fail(error)
        }
        // Re-throw schema initialization errors - database is required when tables are defined
        if (error instanceof SchemaInitializationError) {
          return Effect.fail(error)
        }
        // Wrap any other error (most commonly `SQLExecutionError` from a bad
        // CREATE TABLE / CREATE VIEW DDL) as `SchemaInitializationError` so
        // boot fails fast with a stack trace instead of silently swallowing the
        // failure. Postgres rejects bad DDL at parse time so it always
        // surfaces; SQLite tolerates broken view bodies until they're queried
        // (manifesting as runtime 500s on every record-list request) — losing
        // the boot-time signal made the partner-app `reciprocalField` rollup
        // bug invisible for hours of debugging. See the regression in
        // `schema-initializer.sqlite.smoke.test.ts`.
        const errorMessage =
          error instanceof Error
            ? error.message
            : ((error as { _tag?: string })._tag ?? String(error))
        return Effect.fail(
          new SchemaInitializationError({
            message: `Schema initialization failed: ${errorMessage}`,
            cause: error,
          })
        )
      }
    )
  )
