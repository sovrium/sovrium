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
  ensureMigrationHistoryTable,
  ensureMigrationLogTable,
  ensureSchemaChecksumTable,
  getPreviousSchema,
  logRollbackOperation,
  recordMigration,
  storeSchemaChecksum,
} from './migration-audit-trail'
import { dropObsoleteTables } from './schema-migration-helpers'
import { tableExists, executeSQL } from './sql-execution'
import {
  isRelationshipField,
  generateJunctionTableDDL,
  generateJunctionTableName,
} from './sql-generators'
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
 * Sort tables by foreign key dependencies using topological sort
 * Tables with no dependencies come first, tables with dependencies come after their referenced tables
 *
 * This ensures that when we CREATE TABLE statements, referenced tables exist before
 * tables that reference them via foreign keys.
 *
 * Algorithm: Kahn's algorithm for topological sorting (functional implementation)
 * - Build dependency graph (which tables does each table depend on)
 * - Process tables with no dependencies first
 * - Remove processed tables from dependency lists
 * - Repeat until all tables are processed
 *
 * Handles circular dependencies by detecting them and keeping original order for those tables.
 */
const sortTablesByDependencies = (tables: readonly Table[]): readonly Table[] => {
  // Build dependency map: tableName -> Set of tables it depends on
  const tableMap = new Map(tables.map((t) => [t.name, t]))

  const initialDeps = new Map(
    tables.map((table) => {
      const deps = new Set(
        table.fields
          .filter(isRelationshipField)
          .map((f) => f.relatedTable)
          .filter((name): name is string => name !== undefined && name !== table.name)
      )
      return [table.name, deps]
    })
  )

  // Recursive helper to process tables in dependency order
  const processTable = (
    current: string,
    remaining: ReadonlyMap<string, Set<string>>,
    sorted: readonly Table[]
  ): readonly Table[] => {
    const table = tableMap.get(current)
    if (!table) return sorted

    // Add current table to sorted list
    const newSorted = [...sorted, table]

    // Remove current table from all dependency sets
    const updated = new Map(
      Array.from(remaining.entries()).map(([name, deps]) => {
        const newDeps = new Set(deps)
        // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, drizzle/enforce-delete-with-where
        newDeps.delete(current)
        return [name, newDeps]
      })
    )

    // Remove current table from remaining
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, drizzle/enforce-delete-with-where
    updated.delete(current)

    // Find next table with no dependencies
    const next = Array.from(updated.entries()).find(([, deps]) => deps.size === 0)

    if (next) {
      return processTable(next[0], updated, newSorted)
    }

    // No more tables with zero dependencies - check for remaining tables
    if (updated.size > 0) {
      // Circular dependency or remaining tables - add in original order
      return [...newSorted, ...tables.filter((t) => !newSorted.includes(t) && updated.has(t.name))]
    }

    return newSorted
  }

  // Find first table with no dependencies
  const first = Array.from(initialDeps.entries()).find(([, deps]) => deps.size === 0)

  if (first) {
    return processTable(first[0], initialDeps, [])
  }

  // All tables have dependencies (circular) - return original order
  return tables
}

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
    const db = new SQL(databaseUrl)
    // Extract runtime to use in async callback (avoids Effect.runPromise inside Effect)
    const runtime = yield* Effect.runtime<never>()

    try {
      yield* Effect.tryPromise({
        try: () =>
          db.begin(async (tx) => {
            // Run the migration logic within Effect.gen and convert to Promise
            /* eslint-disable-next-line functional/no-expression-statements */
            await Runtime.runPromise(runtime)(
              Effect.gen(function* () {
                // Step -1: Ensure migration log table exists FIRST (for rollback logging)
                yield* ensureMigrationLogTable(tx)

                // Wrap the entire migration process to catch errors and log rollback
                yield* Effect.gen(function* () {
                  // Step 0: Verify Better Auth users table exists if any table needs it for foreign keys
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

                  // Step 0.1: Ensure updated-by trigger function exists if any table needs it
                  if (needsUpdatedByTrigger(tables)) {
                    yield* Effect.promise(() => ensureUpdatedByTriggerFunction(tx))
                  }

                  // Step 0.2: Load previous schema for field rename detection
                  const previousSchema = yield* getPreviousSchema(tx)

                  // Step 1: Drop tables that exist in database but not in schema
                  yield* dropObsoleteTables(tx, tables)

                  // Step 2: Build map of which tables use VIEWs (have lookup fields)
                  // This is needed for foreign key generation to reference base tables correctly
                  const lookupViewModule = yield* Effect.promise(
                    () => import('./lookup-view-generators')
                  )

                  const tableUsesView = new Map<string, boolean>(
                    tables.map((table) => [table.name, lookupViewModule.shouldUseView(table)])
                  )

                  // Sort tables by dependencies to ensure referenced tables are created first
                  const sortedTables = sortTablesByDependencies(tables)

                  // Debug: log table creation order
                  logInfo(`[Table creation order] ${sortedTables.map((t) => t.name).join(' → ')}`)

                  // Step 3: Create or migrate tables defined in schema (base tables only, defer VIEWs)
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
                    })
                    logInfo(`[Created/migrated table] ${table.name}`)
                  }
                  /* eslint-enable functional/no-loop-statements */

                  // Step 4: Create junction tables for many-to-many relationships (after all base tables exist)
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

                  // Step 5: Create VIEWs for tables with lookup fields (after all base tables exist)
                  // This ensures lookup VIEWs can reference other tables without dependency issues
                  // Execute in parallel - each table's lookup VIEW is independent
                  yield* Effect.all(
                    sortedTables.map((table) => createLookupViewsEffect(tx, table)),
                    { concurrency: 'unbounded' }
                  )

                  // Step 6: Create user-defined VIEWs from table.views configuration
                  // This is done after lookup views to ensure all base tables and lookup views exist
                  // Execute in parallel - each table's user-defined VIEWs are independent
                  yield* Effect.all(
                    sortedTables.map((table) => createTableViewsEffect(tx, table)),
                    { concurrency: 'unbounded' }
                  )

                  // Step 7: Record migration in history table
                  // Ensure migration history table exists before recording
                  yield* ensureMigrationHistoryTable(tx)
                  yield* recordMigration(tx, app)

                  // Step 8: Store schema checksum
                  // Ensure schema checksum table exists before storing
                  yield* ensureSchemaChecksumTable(tx)
                  yield* storeSchemaChecksum(tx, app)
                }).pipe(
                  Effect.catchAll((error) =>
                    Effect.gen(function* () {
                      // Log rollback operation before transaction rolls back
                      const errorMessage = String(error)
                      logInfo(`[executeSchemaInit] Migration failed: ${errorMessage}`)
                      yield* logRollbackOperation(tx, errorMessage)
                      // Re-throw error to trigger transaction rollback
                      return yield* Effect.fail(error)
                    })
                  )
                )
              })
            )
          }),
        catch: (error) =>
          new SchemaInitializationError({
            message: `Schema initialization failed: ${String(error)}`,
            cause: error,
          }),
      })
    } finally {
      // Close connection
      yield* Effect.promise(() => db.close())
    }
  })
/* eslint-enable max-lines-per-function */

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
