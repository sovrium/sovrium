/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { Config, Effect, Console, Data, Runtime, type ConfigError } from 'effect'
import { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
import { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import { logDebug } from '@/infrastructure/logging/logger'
import {
  needsUsersTable,
  needsUpdatedByTrigger,
  ensureBetterAuthUsersTable,
  ensureUpdatedByTriggerFunction,
  type BetterAuthUsersTableRequired,
} from '../auth/auth-validation'
import * as lookupViewGenerators from '../lookup/lookup-view-generators'
import {
  tableExists,
  executeSQL,
  type SQLExecutionError,
  type TransactionLike,
} from '../sql/sql-execution'
import { generateJunctionTableDDL, generateJunctionTableName } from '../sql/sql-generators'
import { sanitizeTableName, isManyToManyRelationship } from '../table-queries/shared/field-utils'
import {
  createOrMigrateTableEffect,
  createLookupViewsEffect,
  createTableViewsEffect,
} from '../table-queries/table-operations'
import * as viewGenerators from '../views/view-generators'
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
import { ensureUserAccessTable } from './user-access-table'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables'

// Re-export error types for convenience
export { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
export { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
export { BetterAuthUsersTableRequired } from '../auth/auth-validation'

export class NoDatabaseUrlError extends Data.TaggedError('NoDatabaseUrlError')<{
  readonly message: string
}> {}

/** Ensure Better Auth prerequisites exist (users table + updated-by trigger) */
const ensureAuthPrerequisites = (
  tx: TransactionLike,
  tables: readonly Table[],
  hasAuthConfig: boolean
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    logDebug('[executeSchemaInit] Checking if Better Auth users table is needed...')
    const needs = needsUsersTable(tables)
    logDebug(`[executeSchemaInit] needsUsersTable: ${needs}`)
    logDebug(`[executeSchemaInit] hasAuthConfig: ${hasAuthConfig}`)

    // Only enforce users table existence if auth is configured
    // If auth is NOT configured, authorship fields will be NULL
    if (needs && hasAuthConfig) {
      logDebug('[executeSchemaInit] Better Auth users table is needed, verifying it exists...')
      yield* Effect.promise(() => ensureBetterAuthUsersTable(tx))
    } else if (needs && !hasAuthConfig) {
      logDebug(
        '[executeSchemaInit] User fields present but auth not configured - fields will be NULL'
      )
    } else {
      logDebug('[executeSchemaInit] Better Auth users table not needed')
    }

    if (needsUpdatedByTrigger(tables)) {
      yield* Effect.promise(() => ensureUpdatedByTriggerFunction(tx))
    }
  })

/** Build map of which tables use VIEWs (have lookup fields) */
const buildTableUsesViewMap = (
  tables: readonly Table[],
  lookupViewModule: typeof lookupViewGenerators
): ReadonlyMap<string, boolean> =>
  new Map(tables.map((table) => [table.name, lookupViewModule.shouldUseView(table)]))

/**
 * F-11 (file-uploads): Upgrade single-attachment columns referenced by
 * any top-level form to storeMetadata true so the column type becomes
 * JSONB (via mapFieldTypeToPostgres special case). This makes the column
 * accept the canonical url/name/size/mimeType payload the form submit
 * pipeline writes, without forcing schema authors to repeat
 * storeMetadata true on every column they expose through a form.
 *
 * The set key is tableName::columnName so an attachment column on one
 * table is not auto-upgraded just because another table happens to have
 * the same column name.
 */
const upgradeFormReferencedAttachments = (
  tables: readonly Table[],
  app: Readonly<App>
): readonly Table[] => {
  const referenced = new Set<string>(
    (app.forms ?? []).flatMap((form) => {
      const tableName = form.submitTo.table
      if (typeof tableName !== 'string') return []
      return form.fields
        .filter(
          (f): f is typeof f & { readonly kind: 'table-field'; readonly column: string } =>
            f.kind === 'table-field'
        )
        .map((f) => tableName + '::' + f.column)
    })
  )
  if (referenced.size === 0) return tables
  return tables.map((t) => {
    const fields = t.fields.map((f) => {
      if (f.type !== 'single-attachment') return f
      if (!referenced.has(t.name + '::' + f.name)) return f
      const hasFlag =
        'storeMetadata' in f && (f as { storeMetadata?: boolean }).storeMetadata === true
      if (hasFlag) return f
      return { ...f, storeMetadata: true } as typeof f
    })
    return { ...t, fields } as Table
  })
}

/**
 * US-PAGES-ACCESS-PUBLISHING-002 (slug-management): Normalize the table-
 * level `unique: [{ fields: [...] }]` sugar into the existing primitives
 * so constraint-sync and index-sync handle persistence without a new
 * code path:
 *
 *   - single-field entry → set `field.unique = true` on the matching
 *     field (idempotent — leaves an already-unique field alone).
 *   - multi-field entry → append a unique btree index to `table.indexes`
 *     under a deterministic name (`uq_<table>_<f1>_<f2>__<i>`).
 *
 * Unknown field names are silently dropped — they would have failed
 * upstream Effect Schema validation if the author meant a real column.
 */
const normalizeTopLevelUnique = (tables: readonly Table[]): readonly Table[] =>
  tables.map((t) => {
    const uniqueGroups = (
      t as Table & { readonly unique?: ReadonlyArray<{ readonly fields: ReadonlyArray<string> }> }
    ).unique
    if (!uniqueGroups || uniqueGroups.length === 0) return t

    const knownFieldNames = new Set(t.fields.map((f) => f.name))
    const groups = uniqueGroups.filter((g) => g.fields.every((name) => knownFieldNames.has(name)))
    if (groups.length === 0) return t

    const singleFieldNames = new Set(
      groups.filter((g) => g.fields.length === 1).map((g) => g.fields[0]!)
    )
    const newFields = t.fields.map((f) =>
      singleFieldNames.has(f.name) && !('unique' in f && f.unique)
        ? ({ ...f, unique: true } as typeof f)
        : f
    )

    const compositeGroups = groups.filter((g) => g.fields.length > 1)
    const compositeIndexes = compositeGroups.map((g, idx) => ({
      name: `uq_${t.name}_${g.fields.join('_')}__${idx}`.slice(0, 60),
      fields: g.fields,
      unique: true,
    }))
    const mergedIndexes =
      compositeIndexes.length === 0 ? t.indexes : [...(t.indexes ?? []), ...compositeIndexes]

    return {
      ...t,
      fields: newFields,
      ...(mergedIndexes ? { indexes: mergedIndexes } : {}),
    } as Table
  })

/**
 * Apply schema-author-friendly defaults to the sorted table list:
 *   - Z-1/Z-2: tables in `auth.scopeTables` get a TEXT primary key when
 *     none was declared, so applications can store portable string IDs
 *     in `user_access.record_ids`.
 *   - F-11: form-referenced `single-attachment` columns get
 *     `storeMetadata: true` so the column type becomes JSONB and accepts
 *     the canonical `{ url, name, size, mimeType }` metadata produced by
 *     the form-submit pipeline.
 *   - Pages-002: top-level `unique: [{ fields: [...] }]` flattens into
 *     field-level `unique: true` (single field) or composite unique
 *     indexes so existing migration paths apply without modification.
 */
const applySchemaDefaults = (
  sortedTables: readonly Table[],
  app: Readonly<App>
): readonly Table[] => {
  const scopeTableNames = new Set(app.auth?.scopeTables ?? [])
  const withScopePk = sortedTables.map((t) =>
    scopeTableNames.has(t.name) && t.primaryKey === undefined
      ? ({ ...t, primaryKey: { type: 'text', field: 'id' } } as Table)
      : t
  )
  const withFormAttachments = upgradeFormReferencedAttachments(withScopePk, app)
  return normalizeTopLevelUnique(withFormAttachments)
}

// Configuration for createMigrateTables
type CreateMigrateTablesConfig = {
  readonly tx: TransactionLike
  readonly sortedTables: readonly Table[]
  readonly tableUsesView: ReadonlyMap<string, boolean>
  readonly circularTables: ReadonlySet<string>
  readonly previousSchema: { readonly tables: readonly object[] } | undefined
  readonly lookupViewModule: typeof lookupViewGenerators
  readonly hasAuthConfig: boolean
}

/** Create or migrate each table in sorted order */
const createMigrateTables = (
  config: CreateMigrateTablesConfig
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    const {
      tx,
      sortedTables,
      tableUsesView,
      circularTables,
      previousSchema,
      lookupViewModule,
      hasAuthConfig,
    } = config
    /* eslint-disable functional/no-loop-statements */
    for (const table of sortedTables) {
      const sanitized = sanitizeTableName(table.name)
      const physicalTableName = lookupViewModule.shouldUseView(table)
        ? lookupViewModule.getBaseTableName(sanitized)
        : sanitized
      const exists = yield* tableExists(tx, physicalTableName)
      logDebug(`[Creating/migrating table] ${table.name} (exists: ${exists})`)
      yield* createOrMigrateTableEffect({
        tx,
        table,
        exists,
        tableUsesView,
        previousSchema,
        skipForeignKeys: circularTables.has(table.name),
        hasAuthConfig,
      })
      logDebug(`[Created/migrated table] ${table.name}`)
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
    logDebug(`[Adding FK constraints for circular dependencies]`)
    /* eslint-disable functional/no-loop-statements */
    for (const table of sortedTables.filter((t) => circularTables.has(t.name))) {
      yield* syncForeignKeyConstraints(tx, table, tableUsesView)
      logDebug(`[Added FK constraints] ${table.name}`)
    }
    /* eslint-enable functional/no-loop-statements */
  })

/** Collect junction table specs for many-to-many relationships (functional construction with deduplication) */
const collectJunctionTableSpecs = (
  sortedTables: readonly Table[],
  tableUsesView: ReadonlyMap<string, boolean>
): ReadonlyMap<string, { readonly name: string; readonly ddl: string }> => {
  const junctionSpecs = sortedTables.flatMap((table) => {
    const manyToManyFields = table.fields.filter(isManyToManyRelationship)
    return manyToManyFields.map((field) => {
      const junctionTableName = generateJunctionTableName(table.name, field.relatedTable)
      const ddl = generateJunctionTableDDL(table.name, field.relatedTable, tableUsesView)
      return [junctionTableName, { name: junctionTableName, ddl }] as const
    })
  })

  // Deduplicate by junction table name (keep first occurrence)
  return new Map(junctionSpecs)
}

/** Create junction tables for many-to-many relationships */
const createJunctionTables = (
  tx: TransactionLike,
  junctionTableSpecs: ReadonlyMap<string, { readonly name: string; readonly ddl: string }>
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    if (junctionTableSpecs.size === 0) return
    logDebug(`[Creating junction tables] ${Array.from(junctionTableSpecs.keys()).join(', ')}`)
    yield* Effect.all(
      Array.from(junctionTableSpecs.values()).map((spec) =>
        executeSQL(tx, spec.ddl).pipe(
          Effect.tap(() => logDebug(`[Created junction table] ${spec.name}`))
        )
      ),
      { concurrency: 'unbounded' }
    )
  })

/** Drop obsolete views and create all views (lookup + user-defined) */
const createAllViews = (
  tx: TransactionLike,
  sortedTables: readonly Table[],
  viewGeneratorsModule: typeof viewGenerators
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    yield* Effect.promise(() => viewGeneratorsModule.dropAllObsoleteViews(tx, sortedTables))
    yield* Effect.all(
      sortedTables.map((table) => createLookupViewsEffect(tx, table, sortedTables)),
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
    yield* ensureAuthPrerequisites(tx, tables, !!app.auth)

    // Step 3: Load previous schema for field rename detection
    const previousSchema = yield* getPreviousSchema(tx)

    // Step 3.5: Rename tables that have changed names
    yield* renameTablesIfNeeded(tx, tables, previousSchema)

    // Step 4: Drop tables that exist in database but not in schema
    yield* dropObsoleteTables(tx, tables)

    // Step 5: Build view map and detect circular dependencies
    const tableUsesView = buildTableUsesViewMap(tables, lookupViewGenerators)
    const circularTables = detectCircularDependenciesWithOptionalFK(tables)
    if (circularTables.size > 0) {
      logDebug(`[Circular dependencies detected] ${Array.from(circularTables).join(', ')}`)
    }

    // Sort and log table creation order
    const sortedTables = sortTablesByDependencies(tables)
    logDebug(`[Table creation order] ${sortedTables.map((t) => t.name).join(' → ')}`)

    // Apply schema-author-friendly defaults: scope-table TEXT PKs (Z-1/Z-2)
    // + JSONB upgrade for form-referenced single-attachment columns (F-11).
    const tablesForCreation = applySchemaDefaults(sortedTables, app)

    // Step 6: Create or migrate tables
    yield* createMigrateTables({
      tx,
      sortedTables: tablesForCreation,
      tableUsesView,
      circularTables,
      previousSchema,
      lookupViewModule: lookupViewGenerators,
      hasAuthConfig: !!app.auth,
    })

    // Step 7: Add FK constraints for circular dependencies
    yield* addCircularFKConstraints(tx, sortedTables, circularTables, tableUsesView)

    // Step 8: Create junction tables for many-to-many relationships
    const junctionTableSpecs = collectJunctionTableSpecs(sortedTables, tableUsesView)
    yield* createJunctionTables(tx, junctionTableSpecs)

    // Steps 9-11: Create all views
    yield* createAllViews(tx, sortedTables, viewGenerators)

    // Step 11.5: Create the multi-tenant `user_access` junction table when
    // the app declares `auth.scopeTables`. Z-1 ($currentUser.assignments)
    // reads from this table at request time. The MCP audit log table
    // (`system.ai_tool_calls`) is created via Drizzle migration 0001 ahead
    // of this step — no runtime DDL needed.
    if (app.auth?.scopeTables && app.auth.scopeTables.length > 0) {
      yield* ensureUserAccessTable(tx)
    }

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
    logDebug(`[executeSchemaInit] CATCH HANDLER - Error caught: ${errorMessage}`)
    const logDb = new SQL(databaseUrl)

    yield* Effect.tryPromise({
      try: async () => {
        /* eslint-disable-next-line functional/no-expression-statements */
        await logDb.begin(async (logTx) => {
          /* eslint-disable-next-line functional/no-expression-statements */
          await Runtime.runPromise(runtime)(
            logRollbackOperation(logTx, errorMessage).pipe(
              Effect.catchAll((logError) => {
                logDebug(`[executeSchemaInit] Failed to log rollback: ${logError.message}`)
                return Effect.void
              })
            )
          )
        })
        logDebug('[executeSchemaInit] CATCH HANDLER - Rollback logged and committed')
      },
      catch: () => undefined, // Non-fatal
    }).pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          yield* Effect.promise(() => logDb.close())
          logDebug('[executeSchemaInit] CATCH HANDLER - Log DB connection closed')
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
            logDebug('[executeSchemaInit] Transaction completed successfully (auto-commit)')
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
          logDebug(
            '[checkShouldSkipMigration] Schema checksum differs or missing - running full migration'
          )
          return false
        }

        // Checksum matches, but verify tables actually exist
        // This prevents skipping migration when template DBs have checksum but no tables
        if (tables.length === 0) {
          logDebug(
            '[checkShouldSkipMigration] Schema checksum matches and no tables expected - skipping migration (fast path)'
          )
          return true
        }

        // Check if the first table exists (as a sanity check)
        // Note: Table names come from validated schema, not user input (see SECURITY NOTE above)
        const firstTableName = tables[0]?.name
        if (!firstTableName) {
          logDebug(
            '[checkShouldSkipMigration] Schema checksum matches and tables verified - skipping migration (fast path)'
          )
          return true
        }

        // Sanitize table name for PostgreSQL check
        const sanitizedTableName = sanitizeTableName(firstTableName)

        const tableCheck = (await quickDb.unsafe(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = '${sanitizedTableName}'
          )
        `)) as readonly { exists: boolean }[]

        if (!tableCheck[0]?.exists) {
          logDebug(
            `[checkShouldSkipMigration] Checksum matches but table '${sanitizedTableName}' does not exist - running full migration (template DB detected)`
          )
          return false
        }

        logDebug(
          '[checkShouldSkipMigration] Schema checksum matches and tables verified - skipping migration (fast path)'
        )
        return true
      } catch {
        // Table might not exist yet (first run) - proceed with full migration
        logDebug('[checkShouldSkipMigration] Checksum table not found - running full migration')
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
    logDebug('[initializeSchemaInternal] Starting schema initialization...')
    logDebug(`[initializeSchemaInternal] App tables count: ${app.tables?.length || 0}`)

    // Normalize tables to empty array if undefined
    const tables = app.tables ?? []

    // Check if tables require user fields and auth configuration status
    // Note: Authorship fields (created-by, updated-by, deleted-by) are allowed without auth config
    // When auth is not configured, these fields will be NULL
    const tablesNeedUsersTable = needsUsersTable(tables)
    const hasAuthConfig = !!app.auth
    logDebug(`[initializeSchemaInternal] Tables need users table: ${tablesNeedUsersTable}`)
    logDebug(`[initializeSchemaInternal] Auth config present: ${hasAuthConfig}`)

    // No validation error - authorship fields are allowed without auth (they'll be NULL)

    // Get database URL from Effect Config (reads from environment)
    const databaseUrlConfig = yield* Config.string('DATABASE_URL').pipe(Config.withDefault(''))
    logDebug(
      `[initializeSchemaInternal] DATABASE_URL: ${databaseUrlConfig ? 'present' : 'missing'}`
    )

    // Skip if no DATABASE_URL configured
    if (!databaseUrlConfig) {
      logDebug('[Schema] No DATABASE_URL found, skipping schema initialization')
      return
    }

    logDebug('[Schema] Initializing database schema...')

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
      logDebug('[Schema] Schema unchanged, cleaning up obsolete views...')
      // Quick cleanup of views not in schema (separate transaction)
      const db = new SQL({ url: databaseUrlConfig, max: 1 })
      try {
        yield* Effect.tryPromise({
          try: async () => {
            // Side effect: Drop obsolete views in database transaction
            /* eslint-disable functional/no-expression-statements */
            await db.begin(async (tx) => {
              await viewGenerators.dropAllObsoleteViews(tx, tables)
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
      logDebug('[Schema] Schema unchanged, view cleanup complete')
      return
    }

    // Execute schema initialization with bun:sql (even if tables is empty - to drop obsolete tables)
    yield* executeSchemaInit(databaseUrlConfig, tables, app)

    logDebug('[Schema] Database schema initialized successfully')
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
