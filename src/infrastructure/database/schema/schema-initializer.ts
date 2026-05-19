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

export { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
export { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
export { BetterAuthUsersTableRequired } from '../auth/auth-validation'

export class NoDatabaseUrlError extends Data.TaggedError('NoDatabaseUrlError')<{
  readonly message: string
}> {}

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

const buildTableUsesViewMap = (
  tables: readonly Table[],
  lookupViewModule: typeof lookupViewGenerators
): ReadonlyMap<string, boolean> =>
  new Map(tables.map((table) => [table.name, lookupViewModule.shouldUseView(table)]))

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

type CreateMigrateTablesConfig = {
  readonly tx: TransactionLike
  readonly sortedTables: readonly Table[]
  readonly tableUsesView: ReadonlyMap<string, boolean>
  readonly circularTables: ReadonlySet<string>
  readonly previousSchema: { readonly tables: readonly object[] } | undefined
  readonly lookupViewModule: typeof lookupViewGenerators
  readonly hasAuthConfig: boolean
}

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
  })

const addCircularFKConstraints = (
  tx: TransactionLike,
  sortedTables: readonly Table[],
  circularTables: ReadonlySet<string>,
  tableUsesView: ReadonlyMap<string, boolean>
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    if (circularTables.size === 0) return
    logDebug(`[Adding FK constraints for circular dependencies]`)
    for (const table of sortedTables.filter((t) => circularTables.has(t.name))) {
      yield* syncForeignKeyConstraints(tx, table, tableUsesView)
      logDebug(`[Added FK constraints] ${table.name}`)
    }
  })

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

  return new Map(junctionSpecs)
}

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

const executeMigrationSteps = (
  tx: TransactionLike,
  tables: readonly Table[],
  app: App
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    yield* validateStoredChecksum(tx)

    yield* ensureAuthPrerequisites(tx, tables, !!app.auth)

    const previousSchema = yield* getPreviousSchema(tx)

    yield* renameTablesIfNeeded(tx, tables, previousSchema)

    yield* dropObsoleteTables(tx, tables)

    const tableUsesView = buildTableUsesViewMap(tables, lookupViewGenerators)
    const circularTables = detectCircularDependenciesWithOptionalFK(tables)
    if (circularTables.size > 0) {
      logDebug(`[Circular dependencies detected] ${Array.from(circularTables).join(', ')}`)
    }

    const sortedTables = sortTablesByDependencies(tables)
    logDebug(`[Table creation order] ${sortedTables.map((t) => t.name).join(' → ')}`)

    const tablesForCreation = applySchemaDefaults(sortedTables, app)

    yield* createMigrateTables({
      tx,
      sortedTables: tablesForCreation,
      tableUsesView,
      circularTables,
      previousSchema,
      lookupViewModule: lookupViewGenerators,
      hasAuthConfig: !!app.auth,
    })

    yield* addCircularFKConstraints(tx, sortedTables, circularTables, tableUsesView)

    const junctionTableSpecs = collectJunctionTableSpecs(sortedTables, tableUsesView)
    yield* createJunctionTables(tx, junctionTableSpecs)

    yield* createAllViews(tx, sortedTables, viewGenerators)

    if (app.auth?.scopeTables && app.auth.scopeTables.length > 0) {
      yield* ensureUserAccessTable(tx)
    }

    yield* recordMigration(tx, app)
    yield* storeSchemaChecksum(tx, app)
  })

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
        await logDb.begin(async (logTx) => {
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
      catch: () => undefined,
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
          await db.begin(async (tx) => {
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

const checkShouldSkipMigration = (
  databaseUrl: string,
  currentChecksum: string,
  tables: readonly Table[]
): Effect.Effect<boolean, SchemaInitializationError> =>
  Effect.tryPromise({
    try: async () => {
      const quickDb = new SQL(databaseUrl)
      try {
        const result = (await quickDb.unsafe(
          `SELECT checksum FROM system.schema_checksum WHERE id = 'singleton'`
        )) as readonly { checksum: string }[]

        if (result.length === 0 || result[0]?.checksum !== currentChecksum) {
          logDebug(
            '[checkShouldSkipMigration] Schema checksum differs or missing - running full migration'
          )
          return false
        }

        if (tables.length === 0) {
          logDebug(
            '[checkShouldSkipMigration] Schema checksum matches and no tables expected - skipping migration (fast path)'
          )
          return true
        }

        const firstTableName = tables[0]?.name
        if (!firstTableName) {
          logDebug(
            '[checkShouldSkipMigration] Schema checksum matches and tables verified - skipping migration (fast path)'
          )
          return true
        }

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
        logDebug('[checkShouldSkipMigration] Checksum table not found - running full migration')
        return false
      } finally {
        await quickDb.close()
      }
    },
    catch: () =>
      new SchemaInitializationError({
        message: 'Failed to check schema checksum',
        cause: undefined,
      }),
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))

export type SchemaError =
  | SchemaInitializationError
  | NoDatabaseUrlError
  | BetterAuthUsersTableRequired
  | AuthConfigRequiredForUserFields

const initializeSchemaInternal = (
  app: App
): Effect.Effect<void, SchemaError | ConfigError.ConfigError> =>
  Effect.gen(function* () {
    logDebug('[initializeSchemaInternal] Starting schema initialization...')
    logDebug(`[initializeSchemaInternal] App tables count: ${app.tables?.length || 0}`)

    const tables = app.tables ?? []

    const tablesNeedUsersTable = needsUsersTable(tables)
    const hasAuthConfig = !!app.auth
    logDebug(`[initializeSchemaInternal] Tables need users table: ${tablesNeedUsersTable}`)
    logDebug(`[initializeSchemaInternal] Auth config present: ${hasAuthConfig}`)


    const databaseUrlConfig = yield* Config.string('DATABASE_URL').pipe(Config.withDefault(''))
    logDebug(
      `[initializeSchemaInternal] DATABASE_URL: ${databaseUrlConfig ? 'present' : 'missing'}`
    )

    if (!databaseUrlConfig) {
      logDebug('[Schema] No DATABASE_URL found, skipping schema initialization')
      return
    }

    logDebug('[Schema] Initializing database schema...')

    const currentChecksum = generateSchemaChecksum(app)
    const shouldSkipMigration = yield* checkShouldSkipMigration(
      databaseUrlConfig,
      currentChecksum,
      tables
    )

    if (shouldSkipMigration) {
      logDebug('[Schema] Schema unchanged, cleaning up obsolete views...')
      const db = new SQL({ url: databaseUrlConfig, max: 1 })
      try {
        yield* Effect.tryPromise({
          try: async () => {
            await db.begin(async (tx) => {
              await viewGenerators.dropAllObsoleteViews(tx, tables)
            })
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

    yield* executeSchemaInit(databaseUrlConfig, tables, app)

    logDebug('[Schema] Database schema initialized successfully')
  })

export const initializeSchema = (
  app: App
): Effect.Effect<void, AuthConfigRequiredForUserFields | SchemaInitializationError> =>
  initializeSchemaInternal(app).pipe(
    Effect.catchAll(
      (error): Effect.Effect<void, AuthConfigRequiredForUserFields | SchemaInitializationError> => {
        if (error instanceof AuthConfigRequiredForUserFields) {
          return Effect.fail(error)
        }
        if (error instanceof SchemaInitializationError) {
          return Effect.fail(error)
        }
        return Console.error(`Error initializing database schema: ${error._tag}`).pipe(
          Effect.flatMap(() => Effect.void)
        )
      }
    )
  )
