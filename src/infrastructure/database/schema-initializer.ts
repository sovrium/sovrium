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
import { logInfo } from '@/infrastructure/logging/logger'
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
import {
  tableExists,
  executeSQL,
  type SQLExecutionError,
  type TransactionLike,
} from './sql-execution'
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

// Type for lookup view module (dynamic import)
type LookupViewModule = {
  readonly shouldUseView: (table: Table) => boolean
  readonly getBaseTableName: (tableName: string) => string
}

// Type for view generators module (dynamic import)
type ViewGeneratorsModule = {
  readonly dropAllObsoleteViews: (tx: TransactionLike, tables: readonly Table[]) => Promise<void>
}

/** Ensure Better Auth prerequisites exist (users table + updated-by trigger) */
const ensureAuthPrerequisites = (
  tx: TransactionLike,
  tables: readonly Table[]
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    logInfo('[executeSchemaInit] Checking if Better Auth users table is needed...')
    const needs = needsUsersTable(tables)
    logInfo(`[executeSchemaInit] needsUsersTable: ${needs}`)
    if (needs) {
      logInfo('[executeSchemaInit] Better Auth users table is needed, verifying it exists...')
      yield* Effect.promise(() => ensureBetterAuthUsersTable(tx))
    } else {
      logInfo('[executeSchemaInit] Better Auth users table not needed')
    }

    if (needsUpdatedByTrigger(tables)) {
      yield* Effect.promise(() => ensureUpdatedByTriggerFunction(tx))
    }
  })

/** Build map of which tables use VIEWs (have lookup fields) */
const buildTableUsesViewMap = (
  tables: readonly Table[],
  lookupViewModule: LookupViewModule
): ReadonlyMap<string, boolean> =>
  new Map(tables.map((table) => [table.name, lookupViewModule.shouldUseView(table)]))

// Configuration for createMigrateTables
type CreateMigrateTablesConfig = {
  readonly tx: TransactionLike
  readonly sortedTables: readonly Table[]
  readonly tableUsesView: ReadonlyMap<string, boolean>
  readonly circularTables: ReadonlySet<string>
  readonly previousSchema: { readonly tables: readonly object[] } | undefined
  readonly lookupViewModule: LookupViewModule
}

/** Create or migrate each table in sorted order */
const createMigrateTables = (
  config: CreateMigrateTablesConfig
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    const { tx, sortedTables, tableUsesView, circularTables, previousSchema, lookupViewModule } =
      config
    /* eslint-disable functional/no-loop-statements */
    for (const table of sortedTables) {
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
  })

/** Add foreign key constraints for tables with circular dependencies */
const addCircularFKConstraints = (
  tx: TransactionLike,
  sortedTables: readonly Table[],
  circularTables: ReadonlySet<string>,
  tableUsesView: ReadonlyMap<string, boolean>
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    if (circularTables.size === 0) return
    logInfo(`[Adding FK constraints for circular dependencies]`)
    /* eslint-disable functional/no-loop-statements */
    for (const table of sortedTables.filter((t) => circularTables.has(t.name))) {
      yield* syncForeignKeyConstraints(tx, table, tableUsesView)
      logInfo(`[Added FK constraints] ${table.name}`)
    }
    /* eslint-enable functional/no-loop-statements */
  })

/** Collect junction table specs for many-to-many relationships */
const collectJunctionTableSpecs = (
  sortedTables: readonly Table[],
  tableUsesView: ReadonlyMap<string, boolean>
): ReadonlyMap<string, { readonly name: string; readonly ddl: string }> => {
  const specs = new Map<string, { name: string; ddl: string }>()
  sortedTables.forEach((table) => {
    const manyToManyFields = table.fields.filter(isManyToManyRelationship)
    manyToManyFields.forEach((field) => {
      const junctionTableName = generateJunctionTableName(table.name, field.relatedTable)
      if (!specs.has(junctionTableName)) {
        const ddl = generateJunctionTableDDL(table.name, field.relatedTable, tableUsesView)
        // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements
        specs.set(junctionTableName, { name: junctionTableName, ddl })
      }
    })
  })
  return specs
}

/** Create junction tables for many-to-many relationships */
const createJunctionTables = (
  tx: TransactionLike,
  junctionTableSpecs: ReadonlyMap<string, { readonly name: string; readonly ddl: string }>
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    if (junctionTableSpecs.size === 0) return
    logInfo(`[Creating junction tables] ${Array.from(junctionTableSpecs.keys()).join(', ')}`)
    yield* Effect.all(
      Array.from(junctionTableSpecs.values()).map((spec) =>
        executeSQL(tx, spec.ddl).pipe(
          Effect.tap(() => logInfo(`[Created junction table] ${spec.name}`))
        )
      ),
      { concurrency: 'unbounded' }
    )
  })

/** Drop obsolete views and create all views (lookup + user-defined) */
const createAllViews = (
  tx: TransactionLike,
  sortedTables: readonly Table[],
  viewGeneratorsModule: ViewGeneratorsModule
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    yield* Effect.promise(() => viewGeneratorsModule.dropAllObsoleteViews(tx, sortedTables))
    yield* Effect.all(
      sortedTables.map((table) => createLookupViewsEffect(tx, table)),
      { concurrency: 'unbounded' }
    )
    yield* Effect.all(
      sortedTables.map((table) => createTableViewsEffect(tx, table)),
      { concurrency: 'unbounded' }
    )
  })

/** Execute all migration steps within a transaction */
const executeMigrationSteps = (
  tx: TransactionLike,
  tables: readonly Table[],
  app: App
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    // Step 0: Validate stored checksum to detect tampering
    yield* validateStoredChecksum(tx)

    // Steps 1-2: Ensure Better Auth prerequisites
    yield* ensureAuthPrerequisites(tx, tables)

    // Step 3: Load previous schema for field rename detection
    const previousSchema = yield* getPreviousSchema(tx)

    // Step 3.5: Rename tables that have changed names
    yield* renameTablesIfNeeded(tx, tables, previousSchema)

    // Step 4: Drop tables that exist in database but not in schema
    yield* dropObsoleteTables(tx, tables)

    // Step 5: Build view map and detect circular dependencies
    const lookupViewModule = yield* Effect.promise(() => import('./lookup-view-generators'))
    const tableUsesView = buildTableUsesViewMap(tables, lookupViewModule)
    const circularTables = detectCircularDependenciesWithOptionalFK(tables)
    if (circularTables.size > 0) {
      logInfo(`[Circular dependencies detected] ${Array.from(circularTables).join(', ')}`)
    }

    // Sort and log table creation order
    const sortedTables = sortTablesByDependencies(tables)
    logInfo(`[Table creation order] ${sortedTables.map((t) => t.name).join(' → ')}`)

    // Step 6: Create or migrate tables
    yield* createMigrateTables({
      tx,
      sortedTables,
      tableUsesView,
      circularTables,
      previousSchema,
      lookupViewModule,
    })

    // Step 7: Add FK constraints for circular dependencies
    yield* addCircularFKConstraints(tx, sortedTables, circularTables, tableUsesView)

    // Step 8: Create junction tables for many-to-many relationships
    const junctionTableSpecs = collectJunctionTableSpecs(sortedTables, tableUsesView)
    yield* createJunctionTables(tx, junctionTableSpecs)

    // Steps 9-11: Create all views
    const viewGeneratorsModule = yield* Effect.promise(() => import('./view-generators'))
    yield* createAllViews(tx, sortedTables, viewGeneratorsModule)

    // Steps 12-13: Record migration and store checksum
    yield* recordMigration(tx, app)
    yield* storeSchemaChecksum(tx, app)
  })

/** Log rollback operation in a separate transaction */
const logRollbackError = (
  databaseUrl: string,
  errorMessage: string,
  runtime: Runtime.Runtime<never>
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    logInfo(`[executeSchemaInit] CATCH HANDLER - Error caught: ${errorMessage}`)
    const logDb = new SQL(databaseUrl)

    yield* Effect.tryPromise({
      try: async () => {
        /* eslint-disable-next-line functional/no-expression-statements */
        await logDb.begin(async (logTx) => {
          /* eslint-disable-next-line functional/no-expression-statements */
          await Runtime.runPromise(runtime)(
            logRollbackOperation(logTx, errorMessage).pipe(
              Effect.catchAll((logError) => {
                logInfo(`[executeSchemaInit] Failed to log rollback: ${logError.message}`)
                return Effect.void
              })
            )
          )
        })
        logInfo('[executeSchemaInit] CATCH HANDLER - Rollback logged and committed')
      },
      catch: () => undefined, // Non-fatal
    }).pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          yield* Effect.promise(() => logDb.close())
          logInfo('[executeSchemaInit] CATCH HANDLER - Log DB connection closed')
        })
      ),
      Effect.ignore
    )
  })

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
const executeSchemaInit = (
  databaseUrl: string,
  tables: readonly Table[],
  app: App
): Effect.Effect<void, SchemaInitializationError, never> =>
  Effect.gen(function* () {
    const db = new SQL({ url: databaseUrl, max: 1 })
    const runtime = yield* Effect.runtime<never>()

    try {
      yield* Effect.tryPromise({
        try: async () => {
          /* eslint-disable-next-line functional/no-expression-statements */
          await db.begin(async (tx) => {
            /* eslint-disable-next-line functional/no-expression-statements */
            await Runtime.runPromise(runtime)(executeMigrationSteps(tx, tables, app))
            logInfo('[executeSchemaInit] Transaction completed successfully (auto-commit)')
          })
        },
        catch: (error) =>
          new SchemaInitializationError({
            message: `Schema initialization failed: ${String(error)}`,
            cause: error,
          }),
      }).pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* logRollbackError(databaseUrl, error.message, runtime)
            return yield* error
          })
        )
      )
    } finally {
      yield* Effect.promise(() => db.close())
    }
  })

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
          `SELECT checksum FROM system.schema_checksum WHERE id = 'singleton'`
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
      return yield* new AuthConfigRequiredForUserFields({
        message:
          'User fields (user, created-by, updated-by) require auth configuration. Please add auth: { methods: ["email-and-password"] } to your app schema.',
      })
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
