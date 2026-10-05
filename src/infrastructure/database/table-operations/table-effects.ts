/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { triggerFormulaSignature } from '../formula/formula-trigger-generators'
import {
  shouldUseView,
  getPhysicalTableName,
  generateLookupViewSQL,
  generateLookupViewTriggers,
} from '../lookup/lookup-view-generators'
import {
  generateAlterTableStatements,
  needsTableRecreation,
  needsDefinitionReconciliation,
  findPreviousTableDefinition,
  formulaColumnsNeedRebuild,
  hasDriftedFormulaColumns,
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
  tableExists,
  type TransactionLike,
} from '../sql/sql-execution'
import {
  generateReadOnlyViewTrigger,
  generateViewSQL,
  emitsMaterializedView,
  sqlBackedViews,
} from '../views/view-generators'
import { generateCreateTableSQL, type TableDdlInputs } from './create-table-sql'
import { recreateTableWithDataEffect } from './migration-utils'
import { sqliteCheckClausesStale } from './sqlite-check-drift'
import {
  applyTableFeatures,
  applyTableFeaturesWithoutIndexes,
  backfillTriggerFormulas,
  normaliseSqliteDateValues,
} from './table-features'
import {
  detectUnconvertibleRows,
  planTypeChangeProbes,
  resolveProbeIdColumn,
} from './type-change-preflight'
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
 * Refuse a SQLite rebuild whose field-type change would silently store values
 * the new type cannot represent.
 *
 * Runs immediately BEFORE the rebuild's first statement, at the decision site
 * rather than inside `recreateTableWithDataEffect` — by the time that function
 * could scan anything it has already emitted `CREATE TABLE …_migration_temp`,
 * and "Nothing has been changed" would be a claim about a rollback rather than
 * about what ran. Here it is literally true.
 *
 * Postgres is untouched: it already refuses at driver level with
 * `invalid input syntax`, which `[internal ref]` pins. The objective
 * is parity of OUTCOME, not parity of message.
 *
 * A boot that changes no field type plans zero probes and issues zero queries,
 * so every existing recreate — a constraint change, a primary-key reshape, an FK
 * reconciliation, a display-only property edit — is unaffected.
 */
const guardSqliteTypeChanges = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  readonly existingColumns: ExistingColumns
  readonly previousSchema?: { readonly tables: readonly object[] }
}): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, existingColumns, previousSchema } = params
    if (!isSqliteRuntime()) return
    const probes = planTypeChangeProbes({ table, existingColumns, previousSchema })
    if (probes.length === 0) return

    const refusals = yield* detectUnconvertibleRows({
      query: (sql) => executeSQL(tx, sql),
      tableName: table.name,
      physicalTableName: getPhysicalTableName(table),
      idColumn: resolveProbeIdColumn(existingColumns),
      probes,
    })
    if (refusals.length === 0) return

    // `yield*` on the error value directly: a tagged error is yieldable, and
    // wrapping it in `Effect.fail` is what `unnecessaryFailYieldableError`
    // flags.
    return yield* new SQLExecutionError({ message: refusals.join('\n\n') })
  })

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

    const previousTable = findPreviousTableDefinition(table, tablePrimaryKeyTypes, previousSchema)
    if (
      needsTableRecreation(table, existingColumns) ||
      formulaColumnsNeedRebuild(table, existingColumns, previousTable)
    ) {
      // Incompatible change (an `id` column whose type disagrees with the
      // declared primary-key type, a formula column moving between a generated
      // column and a trigger-filled one, or a formula column an earlier version
      // converted to TEXT) — recreate preserving data.
      yield* guardSqliteTypeChanges({ tx, table, existingColumns, previousSchema })
      yield* recreateTableWithDataEffect({ tx, table, existingColumns, ...inputs })
      return
    }

    const alterStatements = generateAlterTableStatements({
      table,
      existingColumns,
      previousSchema,
      tablePrimaryKeyTypes,
      hasAuthConfig,
      physicalTableName: getPhysicalTableName(table),
    })
    if (alterStatements.length > 0) {
      // Incremental, column-level migration.
      yield* executeSQLStatements(tx, alterStatements)
      // SQLite carries a CHECK only in the CREATE TABLE text, which no ALTER
      // rewrites: an option added in the same edit as a field added or renamed
      // would otherwise stay refused. Rebuild from the columns as they stand
      // AFTER the ALTERs, so a renamed column is copied under its new name.
      yield* rebuildIfSqliteChecksStale({ tx, table, previousSchema, inputs })
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
      yield* guardSqliteTypeChanges({ tx, table, existingColumns, previousSchema })
      yield* recreateTableWithDataEffect({ tx, table, existingColumns, ...inputs })
      return
    }
    // The change has no DDL consequence — either the definition is
    // byte-identical to the previous run (a genuine no-op, [internal ref] fix #1) or
    // only a display-only property moved (e.g. a currency `thousandsSeparator`,
    // which never leaves `formatCurrencyValue`). Do NOT recreate: recreating a
    // structurally-unchanged table needlessly drops+rebuilds it — on Postgres
    // crashing on the pre-existing named UNIQUE constraint (the upgrade-path
    // incident), and on SQLite orphaning the rows of every table that
    // references it. The caller's constraint/index sync is idempotent and still
    // runs, so anything outside the CREATE TABLE DDL is reconciled regardless.
    //
    // The one exception is a SQLite table whose stored CHECK clauses are not the
    // declared ones — left so by an earlier boot that ALTERed it — which only a
    // rebuild repairs.
    yield* rebuildIfSqliteChecksStale({ tx, table, previousSchema, inputs })
  })

/**
 * Rebuild a SQLite table whose stored CHECK clauses differ from the ones its
 * definition declares (see `sqlite-check-drift.ts`). A no-op on PostgreSQL and
 * on a table whose clauses are current, which is every table after one rebuild.
 */
const rebuildIfSqliteChecksStale = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  readonly previousSchema?: { readonly tables: readonly object[] }
  readonly inputs: TableDdlInputs
}): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, previousSchema, inputs } = params
    if (!(yield* sqliteCheckClausesStale(tx, table))) return
    const existingColumns = yield* getExistingColumns(tx, getPhysicalTableName(table))
    yield* guardSqliteTypeChanges({ tx, table, existingColumns, previousSchema })
    yield* recreateTableWithDataEffect({ tx, table, existingColumns, ...inputs })
  })

/**
 * Migrate existing table (ALTER statements + constraints + indexes)
 *
 * Every statement addresses the PHYSICAL relation ({@link getPhysicalTableName}):
 * for a view-backed table that is `<name>_base`, and `existingColumns` must have
 * been read from it too — the view's column list includes its computed fields.
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

    const physicalTableName = getPhysicalTableName(table)
    // Read before the rebuild below repairs them: a drifted column is rebuilt
    // without its values, so its trigger formulas are computed again.
    const formulaTypesDrifted = hasDriftedFormulaColumns(table, existingColumns)

    yield* reconcileTableStructure({ tx, table, existingColumns, previousSchema, inputs })

    // Always add/update unique constraints for existing tables
    yield* syncUniqueConstraints(tx, table, previousSchema, physicalTableName)

    // Always sync foreign key constraints to ensure referential actions are up-to-date
    yield* syncForeignKeyConstraints(tx, table, tableUsesView, physicalTableName)

    // Always sync CHECK constraints for fields with validation requirements
    yield* syncCheckConstraints(tx, table, physicalTableName)

    // Always sync indexes when field indexed property changes or custom indexes are modified
    yield* syncIndexes(tx, table, previousSchema, physicalTableName)

    // Apply table features (triggers, RLS) - indexes handled by syncIndexes above
    yield* applyTableFeaturesWithoutIndexes(tx, table)

    // Datetimes and times written before SQLite stored them in one form are
    // rewritten first, so the formulas below compute from the stored values.
    yield* normaliseSqliteDateValues(tx, table)

    // A trigger-computed formula added or edited since the last migration
    // reaches the rows already in the table, not only the rows written next.
    if (
      formulaTypesDrifted ||
      triggerFormulasChanged(table, params.tablePrimaryKeyTypes, previousSchema)
    ) {
      yield* backfillTriggerFormulas(tx, table)
    }
  })

/**
 * Whether the table's trigger-computed formulas differ from the previous
 * migration's — added, removed, edited or moved onto the trigger path. With no
 * previous definition to compare, the rows are recomputed: the values are the
 * formulas' own, so recomputing them is always safe, only slower.
 */
const triggerFormulasChanged = (
  table: Table,
  declared: ReadonlyMap<string, unknown>,
  previousSchema?: { readonly tables: readonly object[] }
): boolean => {
  const previous = findPreviousTableDefinition(table, declared, previousSchema) as
    { readonly fields?: unknown } | undefined
  if (previous === undefined || !Array.isArray(previous.fields)) return true
  try {
    return (
      triggerFormulaSignature(previous.fields as Table['fields']) !==
      triggerFormulaSignature(table.fields)
    )
  } catch {
    return true
  }
}

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
 * Whether `name` exists as a TABLE — not a view. `tableExists` alone cannot say:
 * on Postgres it reads `information_schema.tables`, which lists views too.
 */
const tableExistsAsTable = (
  tx: TransactionLike,
  name: string
): Effect.Effect<boolean, SQLExecutionError> =>
  isSqliteRuntime()
    ? tableExists(tx, name)
    : executeSQL(
        tx,
        `SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '${name}') AS "exists"`
      ).pipe(Effect.map((rows) => Boolean((rows as readonly { exists?: unknown }[])[0]?.exists)))

/**
 * Create lookup VIEWs for tables with lookup fields
 * Called after all base tables have been created to avoid dependency issues
 *
 * The view takes the config name, so that name must not hold a TABLE by now.
 * The plain → view-backed transition moves a populated `<name>` to
 * `<name>_base` by rename in Step 5.5 (`reconcileViewTopology`); if a table is
 * still standing here, something upstream did not run, and dropping it — which
 * is what this step used to do, with `DROP TABLE IF EXISTS <name>` — would
 * delete the rows. It refuses instead.
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
        // The view's own name: `generateLookupViewSQL` creates it under the
        // SANITIZED name, which differs from `table.name` for a config name with
        // capitals, spaces or hyphens — probing the config name would miss the
        // standing table and the tripwire would never fire.
        const viewName = sanitizeTableName(table.name)
        const standingTable = yield* tableExistsAsTable(tx, viewName)
        if (standingTable) {
          return yield* new SQLExecutionError({
            message:
              `Refusing to replace table '${table.name}' with a view: it still holds the ` +
              `table's rows, and the view that computes its lookup, rollup or count fields ` +
              `needs its name. Nothing was dropped.`,
          })
        }

        // Safety net for a view Step 5.5 did not clear. Dialect-aware: SQLite has
        // no `CASCADE` on DROP VIEW.
        const cascadeSuffix = isSqliteRuntime() ? '' : ' CASCADE'
        yield* executeSQL(tx, `DROP VIEW IF EXISTS ${viewName}${cascadeSuffix}`)

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
    // JSON config views with numeric IDs are left out — those are handled at the
    // API layer via ?view= param (unquoted numeric identifiers are invalid SQL).
    // Process each view sequentially (views may depend on each other)
    /* eslint-disable functional/no-loop-statements */
    for (const view of sqlBackedViews(table)) {
      // Convert view.id to string (ViewId can be number or string)
      const viewIdStr = String(view.id)

      // Drop existing view or materialized view (if any)
      yield* dropExistingView(tx, view, viewIdStr)

      // Create view (regular or materialized), from this view's own statement:
      // a search of every statement by id text picked the wrong one whenever an
      // id occurs inside another view's statement (a view `order` over `orders`).
      const createSQL = generateViewSQL(table, view)
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
      // The BASE table's columns for a view-backed table: the view also lists
      // its computed fields, which would read as stored columns to the planner.
      const existingColumns = yield* getExistingColumns(tx, getPhysicalTableName(table))
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
