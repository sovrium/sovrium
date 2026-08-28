/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/utils/database/sql-formatting'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  shouldUseView,
  generateLookupViewSQL,
  generateLookupViewTriggers,
} from '../lookup/lookup-view-generators'
import {
  generateAlterTableStatements,
  needsTableRecreation,
  needsDefinitionReconciliation,
  syncUniqueConstraints,
  syncForeignKeyConstraints,
  syncCheckConstraints,
  syncIndexes,
  type BunSQLTransaction,
} from '../schema-migration'
import {
  executeSQL,
  executeSQLStatements,
  getExistingColumns,
  SQLExecutionError,
  type TransactionLike,
} from '../sql/sql-execution'
import {
  generateTableViewStatements,
  generateReadOnlyViewTrigger,
  emitsMaterializedView,
} from '../views/view-generators'
import { generateCreateTableSQL, type TableDdlInputs } from './create-table-sql'
import { recreateTableWithDataEffect } from './migration-utils'
import { applyTableFeatures, applyTableFeaturesWithoutIndexes } from './table-features'
import type { Table } from '@/domain/models/app/tables'

type TableView = NonNullable<Table['views']>[number]

/**
 * Configuration for table migration operations
 * @public
 */
export type MigrationConfig = {
  readonly tableUsesView?: ReadonlyMap<string, boolean>
  readonly previousSchema?: { readonly tables: readonly object[] }
}

/** Live-column shape shared by the migrate helpers. */
type ExistingColumns = ReadonlyMap<
  string,
  { dataType: string; isNullable: string; columnDefault: string | null }
>

/**
 * Bring one existing table's STRUCTURE up to date: recreate, ALTER, or skip.
 *
 * Decides from EXPLICIT signals, never from an empty ALTER list alone
 * — an empty list is ambiguous between "incompatible change → recreate",
 * "constraint-only change → recreate" and "nothing changed → skip".
 */
const reconcileTableStructure = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  readonly existingColumns: ExistingColumns
  readonly previousSchema?: { readonly tables: readonly object[] }
  /**
   * Held as ONE value so the recreate branch, the ALTER branch and the
   * definition-fingerprint comparison below are all driven by the SAME inputs —
   * a generator reached through one branch with a different map than another
   * would emit a different table for the same config.
   */
  readonly inputs: TableDdlInputs
}): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, existingColumns, previousSchema, inputs } = params
    const { tableUsesView, tablePrimaryKeyTypes, hasAuthConfig } = inputs

    if (needsTableRecreation(table, existingColumns)) {
      // Incompatible change (an `id` column whose type disagrees with the
      // declared primary-key type) — recreate preserving data.
      yield* recreateTableWithDataEffect({ tx, table, existingColumns, ...inputs })
      return
    }

    const alterStatements = generateAlterTableStatements({
      table,
      existingColumns,
      previousSchema,
      tablePrimaryKeyTypes,
      hasAuthConfig,
    })
    if (alterStatements.length > 0) {
      // Incremental, column-level migration.
      yield* executeSQLStatements(tx, alterStatements)
      return
    }

    if (
      needsDefinitionReconciliation({
        table,
        previousSchema,
        tableUsesView,
        tablePrimaryKeyTypes,
        hasAuthConfig,
      })
    ) {
      // No column-level ALTERs, but the table's definition changed in a way not
      // expressible as an ALTER (e.g. a CHECK/UNIQUE constraint added or
      // removed) — recreate to reconcile. The recreate is idempotent
      // (temp-scoped constraint names, canonical names restored) so it never
      // collides with the live catalog ([internal ref] fix #2).
      yield* recreateTableWithDataEffect({ tx, table, existingColumns, ...inputs })
    }
    // else: the change has no DDL consequence — either the definition is
    // byte-identical to the previous run (a genuine no-op, [internal ref] fix #1) or
    // only a display-only property moved (e.g. a currency `thousandsSeparator`,
    // which never leaves `formatCurrencyValue`). Do NOT recreate: recreating a
    // structurally-unchanged table needlessly drops+rebuilds it — on Postgres
    // crashing on the pre-existing named UNIQUE constraint (the upgrade-path
    // incident), and on SQLite orphaning the rows of every table that
    // references it. The caller's constraint/index sync is idempotent and still
    // runs, so anything outside the CREATE TABLE DDL is reconciled regardless.
  })

/**
 * Migrate existing table (ALTER statements + constraints + indexes)
 */
export const migrateExistingTableEffect = (
  params: TableDdlInputs & {
    readonly tx: TransactionLike
    readonly table: Table
    readonly existingColumns: ExistingColumns
    readonly previousSchema?: { readonly tables: readonly object[] }
  }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, existingColumns, tableUsesView, previousSchema } = params
    const inputs: TableDdlInputs = {
      tablePrimaryKeyTypes: params.tablePrimaryKeyTypes,
      tableUsesView,
      skipForeignKeys: params.skipForeignKeys,
      hasAuthConfig: params.hasAuthConfig ?? true,
    }

    yield* reconcileTableStructure({ tx, table, existingColumns, previousSchema, inputs })

    // Always add/update unique constraints for existing tables
    yield* syncUniqueConstraints(tx, table, previousSchema)

    // Always sync foreign key constraints to ensure referential actions are up-to-date
    yield* syncForeignKeyConstraints(tx, table, tableUsesView)

    // Always sync CHECK constraints for fields with validation requirements
    yield* syncCheckConstraints(tx, table)

    // Always sync indexes when field indexed property changes or custom indexes are modified
    yield* syncIndexes(tx, table, previousSchema)

    // Apply table features (triggers, RLS) - indexes handled by syncIndexes above
    yield* applyTableFeaturesWithoutIndexes(tx, table)
  })

/**
 * Create new table (CREATE statement + indexes + triggers)
 *
 * VIEWs are NOT created here: they are created in a separate phase once all
 * base tables exist, because a lookup/rollup view body references relations
 * this table may be declared before.
 */
export const createNewTableEffect = (
  params: TableDdlInputs & {
    readonly tx: TransactionLike
    readonly table: Table
  }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const {
      tx,
      table,
      tableUsesView,
      skipForeignKeys,
      hasAuthConfig = true,
      tablePrimaryKeyTypes,
    } = params
    // Wrap DDL generation in Effect.try to catch synchronous errors (e.g., unknown field types)
    const createTableSQL = yield* Effect.try({
      try: () =>
        generateCreateTableSQL(table, {
          tablePrimaryKeyTypes,
          tableUsesView,
          skipForeignKeys,
          hasAuthConfig,
        }),
      catch: (error) =>
        new SQLExecutionError({
          message: `Failed to generate CREATE TABLE DDL: ${String(error)}`,
          cause: error,
        }),
    })
    yield* executeSQL(tx, createTableSQL)

    // Apply all table features (indexes, triggers, RLS)
    yield* applyTableFeatures(tx, table)
  })

/**
 * Create lookup VIEWs for tables with lookup fields
 * Called after all base tables have been created to avoid dependency issues
 */
export const createLookupViewsEffect = (
  tx: TransactionLike,
  table: Table,
  allTables: readonly Table[] = []
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (shouldUseView(table)) {
      const createViewSQL = generateLookupViewSQL(table, allTables)
      if (createViewSQL) {
        // Drop existing table if it exists (to allow VIEW creation)
        // This handles the transition from TABLE to VIEW when rollup/lookup fields are added.
        // Dialect-aware: SQLite has no `CASCADE` keyword on DROP TABLE; dependent
        // FK constraints are governed by `PRAGMA foreign_keys = ON` at runtime
        // (already set by `openSqliteDdlDatabase`).
        const cascadeSuffix = isSqliteRuntime() ? '' : ' CASCADE'
        yield* executeSQL(tx, `DROP TABLE IF EXISTS ${table.name}${cascadeSuffix}`)

        yield* executeSQL(tx, createViewSQL)

        // Create INSTEAD OF triggers to make the VIEW writable
        const triggerStatements = generateLookupViewTriggers(table)
        yield* executeSQLStatements(tx, triggerStatements)
      }
    }
  })

/**
 * Drop the existing view (regular or materialized) for a given view config.
 *
 * Issues exactly one DROP statement; the materialized vs regular DROP form
 * is required because PostgreSQL exposes them as distinct object kinds.
 *
 * Dialect-aware: SQLite has no `CASCADE` keyword on DROP VIEW, and no
 * MATERIALIZED VIEW concept at all.
 *
 * A previous version of this note claimed materialized views "are not produced
 * under SQLite (the view generator filters them out via `shouldUseView`
 * degradation)". That was FALSE — `shouldUseView` is
 * `hasLookupFields || hasRollupFields || hasCountFields`, with no dialect
 * awareness and no reference to `materialized` at all — and the claim was what
 * let `generateViewSQL` emit `CREATE MATERIALIZED VIEW` on SQLite and abort
 * boot. The DROP form must therefore be decided by the SAME predicate the
 * CREATE uses (`emitsMaterializedView`), or a redeploy would try to drop an
 * object kind that was never created.
 */
const dropExistingView = (
  tx: TransactionLike,
  view: TableView,
  viewIdStr: string
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // Quote the view identifier — kebab-case IDs (e.g. `active-orders`) are
    // invalid as bare SQL identifiers.
    const quotedId = quoteSqlIdentifier(viewIdStr)
    const cascadeSuffix = isSqliteRuntime() ? '' : ' CASCADE'
    if (emitsMaterializedView(view)) {
      yield* executeSQL(tx, `DROP MATERIALIZED VIEW IF EXISTS ${quotedId}${cascadeSuffix}`)
    } else {
      yield* executeSQL(tx, `DROP VIEW IF EXISTS ${quotedId}${cascadeSuffix}`)
    }
  })

/**
 * Add read-only INSTEAD-OF triggers to a regular view.
 *
 * PostgreSQL views can be automatically updatable, so we need triggers to
 * prevent modifications. Issues one statement per generated trigger DDL.
 */
const addReadOnlyTriggers = (
  tx: TransactionLike,
  viewId: TableView['id']
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const readOnlyTriggerSQL = generateReadOnlyViewTrigger(viewId)
    /* eslint-disable functional/no-loop-statements */
    for (const triggerSQL of readOnlyTriggerSQL) {
      yield* executeSQL(tx, triggerSQL)
    }
    /* eslint-enable functional/no-loop-statements */
  })

/**
 * Issue a `REFRESH MATERIALIZED VIEW` if the view is materialized on the ACTIVE
 * dialect AND configured to refresh on migration; otherwise do nothing.
 *
 * Gated on `emitsMaterializedView`, not on `view.materialized`: under SQLite the
 * declaration degrades to a plain VIEW, `REFRESH MATERIALIZED VIEW` is not
 * SQLite syntax, and there is nothing to refresh anyway — a plain view is
 * always live.
 */
const maybeRefreshMaterializedView = (
  tx: TransactionLike,
  view: TableView,
  viewIdStr: string
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (emitsMaterializedView(view) && view.refreshOnMigration) {
      yield* executeSQL(tx, `REFRESH MATERIALIZED VIEW ${quoteSqlIdentifier(viewIdStr)}`)
    }
  })

/**
 * Create table views (user-defined VIEWs from table.views configuration)
 * Called after all tables and lookup views have been created
 */
export const createTableViewsEffect = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // Views are dropped globally in schema-initializer.ts before this function is called
    // This ensures all obsolete views are removed before creating new ones

    // Only create views if table has views defined
    if (!table.views || table.views.length === 0) {
      return
    }

    // Drop and recreate each view (PostgreSQL doesn't support IF NOT EXISTS for views).
    // Filter out JSON config views with numeric IDs — those are handled at the API layer
    // via ?view= param (unquoted numeric identifiers are invalid SQL).
    const sqlViews = table.views.filter((v) => v.query || typeof v.id !== 'number')
    const viewSQL = generateTableViewStatements(table)

    // Process each view sequentially (views may depend on each other)
    /* eslint-disable functional/no-loop-statements */
    for (const view of sqlViews) {
      // Convert view.id to string (ViewId can be number or string)
      const viewIdStr = String(view.id)

      // Drop existing view or materialized view (if any)
      yield* dropExistingView(tx, view, viewIdStr)

      // Create view (regular or materialized)
      const createSQL = viewSQL.find((sql) => sql.includes(viewIdStr))
      if (createSQL) {
        yield* executeSQL(tx, createSQL)

        // For regular (non-materialized) views, add read-only triggers.
        // `emitsMaterializedView`, not `view.materialized`: on SQLite a
        // `materialized: true` declaration degrades to a plain VIEW, and a
        // plain view is exactly the object that needs the INSTEAD OF guards.
        if (!emitsMaterializedView(view)) {
          yield* addReadOnlyTriggers(tx, view.id)
        }

        // Refresh materialized view if requested
        yield* maybeRefreshMaterializedView(tx, view, viewIdStr)
      }
    }
    /* eslint-enable functional/no-loop-statements */
  })

/**
 * Attribute a schema-init failure to the table being created or migrated.
 *
 * The driver reports only its own text — `SQLiteError: NOT NULL constraint
 * failed` — so an operator with twenty tables was told a migration failed but
 * not WHICH one, even though this frame has `table.name` in hand and logs it one
 * line above the error site. The original message is preserved verbatim (it
 * carries the actual reason) and prefixed with the table, so existing greps for
 * the driver text still match.
 */
const withTableContext = (
  error: Readonly<SQLExecutionError>,
  tableName: string
): Readonly<SQLExecutionError> =>
  error.message.includes(`table '${tableName}'`)
    ? error
    : new SQLExecutionError({
        message: `Failed to migrate table '${tableName}': ${error.message}`,
        ...(error.sql === undefined ? {} : { sql: error.sql }),
        cause: error.cause ?? error,
      })

/**
 * Create or migrate table based on existence
 */
export const createOrMigrateTableEffect = (
  params: TableDdlInputs & {
    readonly tx: BunSQLTransaction
    readonly table: Table
    readonly exists: boolean
    readonly previousSchema?: { readonly tables: readonly object[] }
  }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const {
      tx,
      table,
      exists,
      tableUsesView,
      previousSchema,
      skipForeignKeys,
      hasAuthConfig,
      tablePrimaryKeyTypes,
    } = params
    if (exists) {
      const existingColumns = yield* getExistingColumns(tx, table.name)
      yield* migrateExistingTableEffect({
        tx,
        table,
        existingColumns,
        tableUsesView,
        previousSchema,
        skipForeignKeys,
        hasAuthConfig: hasAuthConfig ?? true,
        tablePrimaryKeyTypes,
      })
    } else {
      yield* createNewTableEffect({
        tx,
        table,
        tableUsesView,
        skipForeignKeys,
        hasAuthConfig: hasAuthConfig ?? true,
        tablePrimaryKeyTypes,
      })
    }
  }).pipe(Effect.mapError((error) => withTableContext(error, params.table.name)))
