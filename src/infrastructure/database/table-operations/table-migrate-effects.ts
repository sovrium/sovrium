/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Migrating a table that already exists: the ALTER path, the SQLite rebuild
 * and its type-change guard, and the trigger-formula backfill.
 *
 * Split out of `table-effects.ts`, which keeps the create-or-migrate entry.
 */

import { Effect } from 'effect'
import { triggerFormulaSignature } from '../formula/formula-trigger-generators'
import { getPhysicalTableName } from '../lookup/lookup-view-generators'
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
} from '../schema-migration'
import {
  executeSQL,
  executeSQLStatements,
  getExistingColumns,
  SQLExecutionError,
  type TransactionLike,
} from '../sql/sql-execution'
import { type TableDdlOptions } from './create-table-sql'
import { recreateTableWithDataEffect } from './migration-utils'
import { guardRequiredColumns } from './required-column-preflight'
import { planSqliteDrops } from './sqlite-column-drop'
import {
  applyTableFeaturesWithoutIndexes,
  backfillTriggerFormulas,
  normaliseSqliteDateValues,
} from './table-features'
import {
  detectUnconvertibleRows,
  planTypeChangeProbes,
  resolveProbeIdColumn,
} from './type-change-preflight'
import { guardUniqueDuplicates, sqliteConstraintsStale } from './unique-constraint-drift'
import type { Table } from '@/domain/models/app/tables'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

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
 * Postgres already refuses at driver level (`invalid input syntax`): parity of
 * OUTCOME, not of message. A boot that changes no field type plans zero probes,
 * so every other recreate (constraint, primary key, FK, display-only) is unaffected.
 */
const guardSqliteTypeChanges = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  readonly existingColumns: ExistingColumns
  readonly previousSchema?: { readonly tables: readonly object[] }
}): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, existingColumns, previousSchema } = params
    if (tx.dialect !== 'sqlite') return
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
    // wrapping it in `Effect.fail` is what `unnecessaryFailYieldableError` flags.
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
  readonly inputs: TableDdlOptions
}): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, existingColumns, previousSchema, inputs } = params
    const { tableUsesView, tablePrimaryKeyTypes, hasAuthConfig } = inputs

    const previousTable = findPreviousTableDefinition(table, tablePrimaryKeyTypes, previousSchema)
    if (
      needsTableRecreation(table, existingColumns, tx.dialect) ||
      formulaColumnsNeedRebuild(table, existingColumns, previousTable, tx.dialect)
    ) {
      // Incompatible change (an `id` type disagreeing with the primary key, a
      // formula column changing kind or once converted to TEXT): recreate.
      yield* guardSqliteTypeChanges({ tx, table, existingColumns, previousSchema })
      yield* recreateTableWithDataEffect({ tx, table, existingColumns, ...inputs })
      return
    }

    const { statements: alterStatements, drops } = generateAlterTableStatements({
      dialect: tx.dialect,
      table,
      existingColumns,
      previousSchema,
      tablePrimaryKeyTypes,
      hasAuthConfig,
      physicalTableName: getPhysicalTableName(table),
    })
    if (alterStatements.length > 0) {
      // Incremental, column-level migration, less any drop SQLite would refuse.
      const plan = yield* planSqliteDrops({ tx, table, alterStatements, drops })
      yield* executeSQLStatements(tx, plan.statements)
      // SQLite carries CHECK and UNIQUE only in the CREATE TABLE text, which no
      // ALTER rewrites, and a withheld drop leaves its column: rebuild from the
      // columns as they stand AFTER the ALTERs (a renamed one under its new name).
      yield* rebuildIfSqliteChecksStale({ tx, table, previousSchema, inputs, force: plan.rebuild })
      return
    }

    if (
      needsDefinitionReconciliation({
        dialect: tx.dialect,
        table,
        previousSchema,
        tableUsesView,
        tablePrimaryKeyTypes,
        hasAuthConfig,
      })
    ) {
      // A definition change no ALTER expresses (a CHECK/UNIQUE constraint added
      // or removed): recreate, idempotently — temp-scoped constraint names, so it
      // never collides with the live catalog (idempotent re-initialisation fix #2).
      yield* guardSqliteTypeChanges({ tx, table, existingColumns, previousSchema })
      yield* recreateTableWithDataEffect({ tx, table, existingColumns, ...inputs })
      return
    }
    // No DDL consequence: a byte-identical definition (the idempotent schema
    // re-initialisation rule fix #1) or a display-only property (a currency
    // `thousandsSeparator`). Recreating would crash Postgres on its named UNIQUE
    // constraint (the upgrade-path incident) and orphan SQLite's referencing
    // rows; the caller's idempotent constraint/index sync still runs. The one
    // exception is a SQLite table whose stored CHECK clauses or unique columns
    // an earlier ALTER left stale, which only a rebuild repairs.
    yield* rebuildIfSqliteChecksStale({ tx, table, previousSchema, inputs })
  })

/**
 * Rebuild a SQLite table whose stored CHECK clauses or single-field unique
 * columns differ from its definition (see `unique-constraint-drift.ts`). A no-op
 * on PostgreSQL and on a current table, which is every table after one rebuild.
 */
const rebuildIfSqliteChecksStale = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  readonly previousSchema?: { readonly tables: readonly object[] }
  readonly inputs: TableDdlOptions
  /** Rebuild even when nothing is stale: an ALTER this table needs was withheld. */
  readonly force?: boolean
}): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, previousSchema, inputs } = params
    if (params.force !== true && !(yield* sqliteConstraintsStale(tx, table))) return
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
  params: TableDdlOptions & {
    readonly tx: TransactionLike
    readonly table: Table
    readonly existingColumns: ExistingColumns
    readonly previousSchema?: { readonly tables: readonly object[] }
  }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, existingColumns, tableUsesView, previousSchema } = params
    const inputs: TableDdlOptions = {
      tablePrimaryKeyTypes: params.tablePrimaryKeyTypes,
      tableUsesView,
      skipForeignKeys: params.skipForeignKeys,
      hasAuthConfig: params.hasAuthConfig ?? true,
    }

    const physicalTableName = getPhysicalTableName(table)
    // Read before the rebuild below repairs them: a drifted column is rebuilt
    // without its values, so its trigger formulas are computed again.
    const formulaTypesDrifted = hasDriftedFormulaColumns(table, existingColumns, tx.dialect)
    // Before any DDL: a required field added with no default over existing rows,
    // and a field becoming unique over shared values, are refused.
    yield* guardRequiredColumns({ tx, table, existingColumns, previousSchema })
    yield* guardUniqueDuplicates({ tx, table, existingColumns })
    yield* reconcileTableStructure({ tx, table, existingColumns, previousSchema, inputs })

    // Always add/update unique constraints for existing tables
    yield* syncUniqueConstraints(tx, table, physicalTableName)

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
      triggerFormulasChanged(tx.dialect, table, params.tablePrimaryKeyTypes, previousSchema)
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
  dialect: DatabaseDialect,
  table: Table,
  declared: ReadonlyMap<string, unknown>,
  previousSchema?: { readonly tables: readonly object[] }
): boolean => {
  const previous = findPreviousTableDefinition(table, declared, previousSchema) as
    { readonly fields?: unknown } | undefined
  if (previous === undefined || !Array.isArray(previous.fields)) return true
  try {
    return (
      triggerFormulaSignature(dialect, previous.fields as Table['fields']) !==
      triggerFormulaSignature(dialect, table.fields)
    )
  } catch {
    return true
  }
}
