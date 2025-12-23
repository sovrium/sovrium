/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { Config, Effect, Console, Data, Runtime, type ConfigError } from 'effect'
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
import { isManyToManyRelationship } from './field-utils'
import {
  getPreviousSchema,
  logRollbackOperation,
  recordMigration,
  storeSchemaChecksum,
  generateSchemaChecksum,
  validateStoredChecksum,
} from './migration-audit-trail'
import {
  detectCircularDependenciesWithOptionalFK,
  sortTablesByDependencies,
} from './schema-dependency-sorting'
import {
  dropObsoleteTables,
  renameTablesIfNeeded,
  syncForeignKeyConstraints,
} from './schema-migration-helpers'
import { tableExists, executeSQL } from './sql-execution'
import { generateJunctionTableDDL, generateJunctionTableName } from './sql-generators'
import {
  createOrMigrateTableEffect,
  createLookupViewsEffect,
  createTableViewsEffect,
} from './table-operations'
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
/* eslint-disable max-lines-per-function */
const executeSchemaInit = (
  databaseUrl: string,
  tables: readonly Table[],
  app: App
): Effect.Effect<void, SchemaInitializationError> =>
  Effect.gen(function* () {
    // Create SQL connection with max: 1 for transaction safety
    // This ensures only one connection is used, preventing transaction isolation issues
    const db = new SQL({ url: databaseUrl, max: 1 })
    // Extract runtime to use in async callback (avoids Effect.runPromise inside Effect)
    const runtime = yield* Effect.runtime<never>()

    try {
      // Run transaction using bun:sql's db.begin() for proper transaction management
      yield* Effect.tryPromise({
        try: async () => {
          // Use db.begin() callback-based transaction API
          // CRITICAL: db.begin() only rolls back if the callback throws (rejects the Promise)
          // We use Effect.runPromise which will reject on Effect failure
          /* eslint-disable-next-line functional/no-expression-statements */
          await db.begin(async (tx) => {
            // Run the migration logic within Effect.gen
            // Effect.runPromise will throw (reject) if any Effect fails, triggering ROLLBACK
            /* eslint-disable-next-line functional/no-expression-statements */
            await Runtime.runPromise(runtime)(
              Effect.gen(function* () {
                // Migration process - tables are created by Drizzle migrations
                // Step 0: Validate stored checksum to detect tampering (MIGRATION-ROLLBACK-001)
                yield* validateStoredChecksum(tx)

                // Step 1: Verify Better Auth users table exists if any table needs it for foreign keys
                logInfo('[executeSchemaInit] Checking if Better Auth users table is needed...')
                const needs = needsUsersTable(tables)
                logInfo(`[executeSchemaInit] needsUsersTable: ${needs}`)
                if (needs) {
                  logInfo(
                    '[executeSchemaInit] Better Auth users table is needed, verifying it exists...'
                  )
                  yield* Effect.promise(() => ensureBetterAuthUsersTable(tx))
                } else {
                  logInfo('[executeSchemaInit] Better Auth users table not needed')
                }

                // Step 2: Ensure updated-by trigger function exists if any table needs it
                if (needsUpdatedByTrigger(tables)) {
                  yield* Effect.promise(() => ensureUpdatedByTriggerFunction(tx))
                }

                // Step 3: Load previous schema for field rename detection
                const previousSchema = yield* getPreviousSchema(tx)

                // Step 3.5: Rename tables that have changed names (same ID, different name)
                yield* renameTablesIfNeeded(tx, tables, previousSchema)

                // Step 4: Drop tables that exist in database but not in schema
                yield* dropObsoleteTables(tx, tables)

                // Step 5: Build map of which tables use VIEWs (have lookup fields)
                // This is needed for foreign key generation to reference base tables correctly
                const lookupViewModule = yield* Effect.promise(
                  () => import('./lookup-view-generators')
                )

                const tableUsesView = new Map<string, boolean>(
                  tables.map((table) => [table.name, lookupViewModule.shouldUseView(table)])
                )

                // Detect circular dependencies with optional FK (allows INSERT-UPDATE pattern)
                const circularTables = detectCircularDependenciesWithOptionalFK(tables)
                if (circularTables.size > 0) {
                  logInfo(
                    `[Circular dependencies detected] ${Array.from(circularTables).join(', ')} - FK constraints will be added later`
                  )
                }

                // Sort tables by dependencies to ensure referenced tables are created first
                const sortedTables = sortTablesByDependencies(tables)

                // Debug: log table creation order
                logInfo(`[Table creation order] ${sortedTables.map((t) => t.name).join(' → ')}`)

                // Step 6: Create or migrate tables defined in schema (base tables only, defer VIEWs)
                /* eslint-disable functional/no-loop-statements */
                for (const table of sortedTables) {
                  // Check if the physical table exists (base table for tables with lookup fields)
                  const physicalTableName = lookupViewModule.shouldUseView(table)
                    ? lookupViewModule.getBaseTableName(table.name)
                    : table.name
                  const exists = yield* tableExists(tx, physicalTableName)
                  logInfo(`[Creating/migrating table] ${table.name} (exists: ${exists})`)
                  yield* createOrMigrateTableEffect({
                    tx,
                    table,
                    exists,
                    tableUsesView,
                    previousSchema,
                    skipForeignKeys: circularTables.has(table.name),
                  })
                  logInfo(`[Created/migrated table] ${table.name}`)
                }
                /* eslint-enable functional/no-loop-statements */

                // Step 7: Add foreign key constraints for circular dependencies
                // These were skipped during CREATE TABLE to avoid "relation does not exist" errors
                if (circularTables.size > 0) {
                  logInfo(`[Adding FK constraints for circular dependencies]`)
                  /* eslint-disable functional/no-loop-statements */
                  for (const table of sortedTables.filter((t) => circularTables.has(t.name))) {
                    yield* syncForeignKeyConstraints(tx, table, tableUsesView)
                    logInfo(`[Added FK constraints] ${table.name}`)
                  }
                  /* eslint-enable functional/no-loop-statements */
                }

                // Step 8: Create junction tables for many-to-many relationships (after all base tables exist)
                // Junction tables must be created after both source and related tables exist
                // Collect unique junction table DDLs first, then execute in parallel
                const junctionTableSpecs = new Map<string, { name: string; ddl: string }>()
                sortedTables.forEach((table) => {
                  const manyToManyFields = table.fields.filter(isManyToManyRelationship)
                  manyToManyFields.forEach((field) => {
                    const junctionTableName = generateJunctionTableName(
                      table.name,
                      field.relatedTable
                    )
                    // Avoid creating duplicate junction tables (if both sides define the relationship)
                    if (!junctionTableSpecs.has(junctionTableName)) {
                      const ddl = generateJunctionTableDDL(
                        table.name,
                        field.relatedTable,
                        tableUsesView
                      )
                      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements
                      junctionTableSpecs.set(junctionTableName, { name: junctionTableName, ddl })
                    }
                  })
                })

                // Execute junction table creation in parallel
                if (junctionTableSpecs.size > 0) {
                  logInfo(
                    `[Creating junction tables] ${Array.from(junctionTableSpecs.keys()).join(', ')}`
                  )
                  yield* Effect.all(
                    Array.from(junctionTableSpecs.values()).map((spec) =>
                      executeSQL(tx, spec.ddl).pipe(
                        Effect.tap(() => logInfo(`[Created junction table] ${spec.name}`))
                      )
                    ),
                    { concurrency: 'unbounded' }
                  )
                }

                // Step 9: Drop all obsolete views (CASCADE)
                // This must happen before creating new views to ensure clean state
                // Drops views that exist in DB but not in any table's schema
                const viewGeneratorsModule = yield* Effect.promise(
                  () => import('./view-generators')
                )
                yield* Effect.promise(() =>
                  viewGeneratorsModule.dropAllObsoleteViews(tx, sortedTables)
                )

                // Step 10: Create VIEWs for tables with lookup fields (after all base tables exist)
                // This ensures lookup VIEWs can reference other tables without dependency issues
                // Execute in parallel - each table's lookup VIEW is independent
                yield* Effect.all(
                  sortedTables.map((table) => createLookupViewsEffect(tx, table)),
                  { concurrency: 'unbounded' }
                )

                // Step 11: Create user-defined VIEWs from table.views configuration
                // This is done after lookup views to ensure all base tables and lookup views exist
                // Execute in parallel - each table's user-defined VIEWs are independent
                yield* Effect.all(
                  sortedTables.map((table) => createTableViewsEffect(tx, table)),
                  { concurrency: 'unbounded' }
                )

                // Step 12: Record migration in history table
                // Tables are created by Drizzle migrations (drizzle/0006_*.sql)
                yield* recordMigration(tx, app)

                // Step 13: Store schema checksum
                yield* storeSchemaChecksum(tx, app)
              })
            )
            // db.begin() automatically COMMITs if callback completes successfully
            logInfo('[executeSchemaInit] Transaction completed successfully (auto-commit)')
          })
          // If db.begin() callback throws, it automatically ROLLBACKs
        },
        catch: (error) =>
          new SchemaInitializationError({
            message: `Schema initialization failed: ${String(error)}`,
            cause: error,
          }),
      }).pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            // Log rollback in separate transaction after error is caught
            logInfo(`[executeSchemaInit] CATCH HANDLER - Error caught: ${error.message}`)
            const logDb = new SQL(databaseUrl)

            const logRollback = Effect.gen(function* () {
              logInfo(
                '[executeSchemaInit] CATCH HANDLER - Logging rollback in separate transaction...'
              )
              yield* Effect.tryPromise({
                try: async () => {
                  // Use a transaction to ensure rollback logging is atomic and committed
                  /* eslint-disable-next-line functional/no-expression-statements */
                  await logDb.begin(async (logTx) => {
                    // Table is created by Drizzle migrations (drizzle/0006_*.sql)
                    /* eslint-disable-next-line functional/no-expression-statements */
                    await Runtime.runPromise(runtime)(
                      logRollbackOperation(logTx, error.message).pipe(
                        Effect.catchAll((logError) => {
                          logInfo(`[executeSchemaInit] Failed to log rollback: ${logError.message}`)
                          return Effect.void
                        })
                      )
                    )
                  })
                  logInfo('[executeSchemaInit] CATCH HANDLER - Rollback logged and committed')
                },
                catch: (logError) =>
                  new SchemaInitializationError({
                    message: `Failed to log rollback: ${String(logError)}`,
                    cause: logError,
                  }),
              }).pipe(Effect.ignore) // Non-fatal - continue with error propagation
            }).pipe(
              Effect.ensuring(
                Effect.gen(function* () {
                  yield* Effect.promise(() => logDb.close())
                  logInfo('[executeSchemaInit] CATCH HANDLER - Log DB connection closed')
                })
              )
            )

            yield* logRollback
            // Re-throw the original error after logging rollback
            return yield* Effect.fail(error)
          })
        )
      )
    } finally {
      // Close connection
      yield* Effect.promise(() => db.close())
    }
  })
/* eslint-enable max-lines-per-function */

/**
 * Check if schema checksum matches saved checksum (fast path optimization)
 * Returns true if migration should be skipped, false otherwise
 *
 * IMPORTANT: Also verifies that expected tables actually exist.
 * This prevents skipping migration when template databases have checksum but no tables.
 */
const checkShouldSkipMigration = (
  databaseUrl: string,
  currentChecksum: string,
  tables: readonly Table[]
): Effect.Effect<boolean, SchemaInitializationError> =>
  Effect.tryPromise({
    try: async () => {
      const quickDb = new SQL(databaseUrl)
      try {
        // Quick read-only query to check checksum (no transaction needed)
        const result = (await quickDb.unsafe(
          `SELECT checksum FROM _sovrium_schema_checksum WHERE id = 'singleton'`
        )) as readonly { checksum: string }[]

        // Early return if checksum doesn't match
        if (result.length === 0 || result[0]?.checksum !== currentChecksum) {
          logInfo(
            '[checkShouldSkipMigration] Schema checksum differs or missing - running full migration'
          )
          return false
        }

        // Checksum matches, but verify tables actually exist
        // This prevents skipping migration when template DBs have checksum but no tables
        if (tables.length === 0) {
          logInfo(
            '[checkShouldSkipMigration] Schema checksum matches and no tables expected - skipping migration (fast path)'
          )
          return true
        }

        // Check if the first table exists (as a sanity check)
        // Note: Table names come from validated schema, not user input (see SECURITY NOTE above)
        const firstTableName = tables[0]?.name
        if (!firstTableName) {
          logInfo(
            '[checkShouldSkipMigration] Schema checksum matches and tables verified - skipping migration (fast path)'
          )
          return true
        }

        const tableCheck = (await quickDb.unsafe(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = '${firstTableName}'
          )
        `)) as readonly { exists: boolean }[]

        if (!tableCheck[0]?.exists) {
          logInfo(
            `[checkShouldSkipMigration] Checksum matches but table '${firstTableName}' does not exist - running full migration (template DB detected)`
          )
          return false
        }

        logInfo(
          '[checkShouldSkipMigration] Schema checksum matches and tables verified - skipping migration (fast path)'
        )
        return true
      } catch {
        // Table might not exist yet (first run) - proceed with full migration
        logInfo('[checkShouldSkipMigration] Checksum table not found - running full migration')
        return false
      } finally {
        /* eslint-disable-next-line functional/no-expression-statements */
        await quickDb.close()
      }
    },
    catch: () =>
      new SchemaInitializationError({
        message: 'Failed to check schema checksum',
        cause: undefined,
      }),
  }).pipe(Effect.catchAll(() => Effect.succeed(false))) // Non-fatal - if check fails, proceed with full migration

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

    // Normalize tables to empty array if undefined
    const tables = app.tables ?? []

    // Check if tables require user fields but auth is not configured
    const tablesNeedUsersTable = needsUsersTable(tables)
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
    logInfo(`[initializeSchemaInternal] DATABASE_URL: ${databaseUrlConfig ? 'present' : 'missing'}`)

    // Skip if no DATABASE_URL configured
    if (!databaseUrlConfig) {
      yield* Console.log('No DATABASE_URL found, skipping schema initialization')
      return
    }

    yield* Console.log('Initializing database schema...')

    // Fast path: Check if schema checksum matches (before opening transaction)
    const currentChecksum = generateSchemaChecksum(app)
    const shouldSkipMigration = yield* checkShouldSkipMigration(
      databaseUrlConfig,
      currentChecksum,
      tables
    )

    // Even if migration is skipped, we need to clean up obsolete views
    // Views might be created manually via SQL and need cleanup
    if (shouldSkipMigration) {
      yield* Console.log('✓ Schema unchanged, cleaning up obsolete views...')
      // Quick cleanup of views not in schema (separate transaction)
      const db = new SQL({ url: databaseUrlConfig, max: 1 })
      try {
        yield* Effect.tryPromise({
          try: async () => {
            // Side effect: Drop obsolete views in database transaction
            /* eslint-disable functional/no-expression-statements */
            await db.begin(async (tx) => {
              const viewGeneratorsModule = await import('./view-generators')
              await viewGeneratorsModule.dropAllObsoleteViews(tx, tables)
            })
            /* eslint-enable functional/no-expression-statements */
          },
          catch: (error) =>
            new SchemaInitializationError({
              message: `View cleanup failed: ${String(error)}`,
              cause: error,
            }),
        })
      } finally {
        yield* Effect.promise(() => db.close())
      }
      yield* Console.log('✓ Schema unchanged, view cleanup complete')
      return
    }

    // Execute schema initialization with bun:sql (even if tables is empty - to drop obsolete tables)
    yield* executeSchemaInit(databaseUrlConfig, tables, app)

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
