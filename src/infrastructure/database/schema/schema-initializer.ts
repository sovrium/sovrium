/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { Effect, Data, type ConfigError } from 'effect'
import {
  parseDatabaseDialectConfig,
  type DatabaseDialectConfig,
} from '@/domain/models/env/database/database-dialect'
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
  dropObsoleteTables,
  renameTablesIfNeeded,
  syncForeignKeyConstraints,
} from '../schema-migration'
import { openSqliteDdlDatabase, runSqliteSchemaTransaction } from '../sql/dialect-ddl'
import {
  tableExists,
  executeSQL,
  type SQLExecutionError,
  type TransactionLike,
} from '../sql/sql-execution'
import { generateJunctionTableDDL, generateJunctionTableName } from '../sql/sql-generators'
import {
  createOrMigrateTableEffect,
  createLookupViewsEffect,
  createTableViewsEffect,
} from '../table-operations'
import { sanitizeTableName, isManyToManyRelationship } from '../table-queries/shared/field-utils'
import * as viewGenerators from '../views/view-generators'
import { ensureCommentReadStateTable } from './comment-read-state-table'
import {
  getPreviousSchema,
  recordMigration,
  storeSchemaChecksum,
  generateSchemaChecksum,
  validateStoredChecksum,
} from './migration-audit-trail'
import {
  detectCircularDependenciesWithOptionalFK,
  sortTablesByDependencies,
  sortTablesByViewDependencies,
} from './schema-dependency-sorting'
import { executeSchemaInit, checkShouldSkipMigration } from './schema-initializer-execute'
import { ensureUserAccessTable } from './user-access-table'
import { ensureWebhookDeliveriesTable } from './webhook-deliveries-table'
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
    const needs = needsUsersTable(tables)

    // Only enforce users table existence if auth is configured
    // If auth is NOT configured, authorship fields will be NULL
    if (needs && hasAuthConfig) {
      yield* Effect.promise(() => ensureBetterAuthUsersTable(tx))
    } else if (needs && !hasAuthConfig) {
      logDebug('[schema] user fields present but auth not configured — authorship will be NULL')
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
 * Build map of table name → `primaryKey.type` so relationship FK columns can be
 * generated with a type matching the referenced table's primary key.
 *
 * MUST be built from the `applySchemaDefaults`-processed table list so that
 * `auth.scopeTables` parents (which get an implicit `{ type: 'text' }` PK) are
 * captured as `'text'` rather than the default serial/INTEGER.
 */
const buildTablePrimaryKeyTypesMap = (
  tables: readonly Table[]
): ReadonlyMap<string, string | undefined> =>
  new Map(tables.map((table) => [table.name, table.primaryKey?.type]))

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
 * [internal ref] (slug-management): Normalize the table-
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
  readonly tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>
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
      tablePrimaryKeyTypes,
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
      logDebug('[schema] create/migrate table', { table: table.name, exists: String(exists) })
      yield* createOrMigrateTableEffect({
        tx,
        table,
        exists,
        tableUsesView,
        tablePrimaryKeyTypes,
        previousSchema,
        skipForeignKeys: circularTables.has(table.name),
        hasAuthConfig,
      })
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
    logDebug('[schema] adding FK constraints for circular dependencies')
    /* eslint-disable functional/no-loop-statements */
    for (const table of sortedTables.filter((t) => circularTables.has(t.name))) {
      yield* syncForeignKeyConstraints(tx, table, tableUsesView)
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
    logDebug('[schema] creating junction tables', {
      tables: Array.from(junctionTableSpecs.keys()).join(', '),
    })
    yield* Effect.all(
      Array.from(junctionTableSpecs.values()).map((spec) => executeSQL(tx, spec.ddl)),
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
    // Lookup/rollup/count VIEWs must be created in VIEW-BODY dependency order,
    // NOT the FK-topological `sortedTables` order: a view-backed table that is a
    // lookup/rollup/count SOURCE for another view must exist before the view that
    // reads from it (Postgres validates the referenced relation at CREATE VIEW
    // time). Created sequentially (`concurrency: 1`) so that order is honoured on
    // the shared transaction connection.
    const viewOrderedTables = sortTablesByViewDependencies(sortedTables)
    yield* Effect.all(
      viewOrderedTables.map((table) => createLookupViewsEffect(tx, table, sortedTables)),
      { concurrency: 1 }
    )
    yield* Effect.all(
      sortedTables.map((table) => createTableViewsEffect(tx, table)),
      { concurrency: 'unbounded' }
    )
  })

/**
 * Create the conditional, config-gated system tables (Steps 11.5-11.7).
 *
 * Each is engine-managed runtime DDL (`CREATE TABLE IF NOT EXISTS`, idempotent)
 * and only materialized when the app opts into the owning feature — so a config
 * that uses none of them pays for none of them:
 *  - `user_access` when `auth.scopeTables` is declared (Z-1/Z-2).
 *  - `_webhook_deliveries` when any table declares outgoing webhooks.
 *  - `comment_read_state` when any table opts into `comments.readTracking`
 * ([internal ref] per-user comment read/unread state).
 *
 * The MCP audit log (`system.ai_tool_calls`) is created via Drizzle migration
 * 0001 instead, so it is not included here.
 */
const ensureConditionalSystemTables = (
  tx: TransactionLike,
  app: App
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    if (app.auth?.scopeTables && app.auth.scopeTables.length > 0) {
      yield* ensureUserAccessTable(tx)
    }
    if ((app.tables ?? []).some((t) => (t.webhooks ?? []).length > 0)) {
      yield* ensureWebhookDeliveriesTable(tx)
    }
    if ((app.tables ?? []).some((t) => t.comments?.readTracking === true)) {
      yield* ensureCommentReadStateTable(tx)
    }
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
      logDebug('[schema] circular dependencies detected', {
        tables: Array.from(circularTables).join(', '),
      })
    }

    // Sort and log table creation order
    const sortedTables = sortTablesByDependencies(tables)
    logDebug('[schema] table creation order', {
      order: sortedTables.map((t) => t.name).join(' → '),
    })

    // Apply schema-author-friendly defaults: scope-table TEXT PKs (Z-1/Z-2)
    // + JSONB upgrade for form-referenced single-attachment columns (F-11).
    // PK-type map is built from this list (post-defaults) so scope-table
    // parents resolve relationship FK columns to TEXT.
    const tablesForCreation = applySchemaDefaults(sortedTables, app)

    // Step 6: Create or migrate tables
    yield* createMigrateTables({
      tx,
      sortedTables: tablesForCreation,
      tableUsesView,
      tablePrimaryKeyTypes: buildTablePrimaryKeyTypesMap(tablesForCreation),
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

    // Steps 11.5-11.7: Create the config-gated engine-managed system tables
    // (user_access / _webhook_deliveries / comment_read_state).
    yield* ensureConditionalSystemTables(tx, app)

    // Steps 12-13: Record migration and store checksum
    yield* recordMigration(tx, app)
    yield* storeSchemaChecksum(tx, app)
  })

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
 */
/**
 * Drop obsolete views when migration is skipped (checksum fast-path).
 *
 * Views may be created manually via SQL and still need cleanup even when the
 * schema is otherwise unchanged. Dialect-aware: Postgres uses `db.begin`,
 * SQLite uses the explicit BEGIN/COMMIT/ROLLBACK helper — both run
 * `dropAllObsoleteViews` through the shared `TransactionLike` interface.
 */
const cleanupObsoleteViews = (
  dialectConfig: Readonly<DatabaseDialectConfig>,
  tables: readonly Table[]
): Effect.Effect<void, SchemaInitializationError> =>
  Effect.gen(function* () {
    if (dialectConfig.dialect === 'sqlite') {
      const sqliteDb = openSqliteDdlDatabase(dialectConfig.path)
      try {
        yield* Effect.tryPromise({
          try: () =>
            runSqliteSchemaTransaction(sqliteDb, (tx) =>
              viewGenerators.dropAllObsoleteViews(tx, tables)
            ),
          catch: (error) =>
            new SchemaInitializationError({
              message: `View cleanup failed: ${String(error)}`,
              cause: error,
            }),
        })
      } finally {
        sqliteDb.close()
      }
    } else {
      const db = new SQL({ url: dialectConfig.databaseUrl, max: 1 })
      try {
        yield* Effect.tryPromise({
          try: async () => {
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
    }
    logDebug('[schema] obsolete views cleaned up (schema unchanged)')
  })

const initializeSchemaInternal = (
  app: App
): Effect.Effect<void, SchemaError | ConfigError.ConfigError> =>
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
    const dialectConfig = parseDatabaseDialectConfig()

    // Fast path: Check if schema checksum matches (before opening transaction)
    const currentChecksum = generateSchemaChecksum(app)
    const shouldSkipMigration = yield* checkShouldSkipMigration(
      dialectConfig,
      currentChecksum,
      tables,
      sanitizeTableName
    )

    // Even if migration is skipped, obsolete views still need cleanup —
    // they may have been created manually via SQL.
    if (shouldSkipMigration) {
      yield* cleanupObsoleteViews(dialectConfig, tables)
      return
    }

    // Execute schema initialization (even if tables is empty - to drop obsolete tables).
    // `executeMigrationSteps` is passed as the per-transaction work callback —
    // the dialect-aware transaction plumbing lives in schema-initializer-execute.ts.
    yield* executeSchemaInit(dialectConfig, tables, app, executeMigrationSteps)

    logDebug('[schema] database schema initialized')
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
