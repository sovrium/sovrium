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
import { getBaseTableName, shouldUseView } from '../lookup/lookup-view-generators'
import {
  getExistingTableNames,
  getExistingViews,
  executeSQL,
  executeSQLStatements,
  SQLExecutionError,
  type TransactionLike,
} from '../sql/sql-execution'
import { PROTECTED_SYSTEM_TABLES } from './constants'
import { detectAmbiguousTableRenames, detectTableRenames } from './rename-detection'
import {
  classifyPhysicalTables,
  formatPopulatedDropRefusal,
  isCommandSearchIndexTable,
} from './table-classification'
import type { Table } from '@/domain/models/app/tables'

/**
 * Whether `tableName` is a managed Better-Auth / system table that runtime
 * schema migration must never drop.
 *
 * On PostgreSQL the Better-Auth (`auth.*`) and system (`system.*`) tables live
 * in dedicated schemas, so `getExistingTableNames` (scoped to `public`) never
 * even returns them; the `PROTECTED_SYSTEM_TABLES` set is otherwise defensive.
 *
 * On SQLite there are no schemas: the `schema-sqlite/` mirror prefixes those
 * tables `auth_` / `system_`, and `getExistingTableNames` returns every
 * non-`sqlite_%` table in one flat namespace. So the SQLite arm protects any
 * `auth_`- or `system_`-prefixed physical table.
 */
const isProtectedTable = (tableName: string): boolean => {
  if (PROTECTED_SYSTEM_TABLES.has(tableName)) return true
  if (isSqliteRuntime()) {
    return tableName.startsWith('auth_') || tableName.startsWith('system_')
  }
  return false
}

/**
 * `DROP TABLE` statement for the active dialect.
 *
 * PostgreSQL supports `DROP TABLE … CASCADE` (drops dependent FK constraints
 * and objects). SQLite has no `CASCADE` clause on `DROP TABLE`; dependent
 * foreign keys are governed by their `ON DELETE` actions instead.
 */
const dropTableStatement = (tableName: string): string =>
  isSqliteRuntime() ? `DROP TABLE ${tableName}` : `DROP TABLE ${tableName} CASCADE`

/**
 * Diagnostic for a set of tables that exchange names in a single config edit.
 *
 * Deliberately actionable and dialect-neutral: the alternative is letting the
 * first `ALTER TABLE … RENAME TO` collide and surfacing the driver's
 * `relation "x" already exists`, which names one table, blames the database, and
 * leaves the author no way to tell a swap from an id renumbering.
 */
const ambiguousRenameMessage = (names: readonly string[]): string =>
  `Ambiguous table rename detected: [${[...names].toSorted().join(', ')}] exchange names in a single config change, ` +
  `so Sovrium cannot tell which existing table each name should follow and refuses to guess. ` +
  `Rename them one at a time — deploy an intermediate name first, then the final one — or give the tables ids that stay attached to the same data.`

/**
 * Rename tables that have changed names (same table ID, different name)
 * Uses ALTER TABLE RENAME TO to preserve data, indexes, and constraints
 *
 * Refuses the migration outright when the renames form a cycle: a name swap is
 * the one case where no evidence in the config can say which physical table each
 * name belongs to, and both available guesses move rows between tables.
 */
export const renameTablesIfNeeded = (
  tx: TransactionLike,
  tables: readonly Table[],
  previousSchema?: { readonly tables: readonly object[] }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const ambiguous = detectAmbiguousTableRenames(tables, previousSchema)
    if (ambiguous.length > 0) {
      return yield* new SQLExecutionError({ message: ambiguousRenameMessage(ambiguous) })
    }

    const tableRenames = detectTableRenames(tables, previousSchema)

    if (tableRenames.size === 0) return

    // Generate ALTER TABLE RENAME TO statements
    const renameStatements = Array.from(tableRenames.entries()).map(
      ([oldName, newName]) => `ALTER TABLE ${oldName} RENAME TO ${newName}`
    )

    yield* executeSQLStatements(tx, renameStatements)
  })

/** How many rows `tableName` holds. Numeric on both engines (pg returns `bigint` as text). */
export const countTableRows = (
  tx: TransactionLike,
  tableName: string
): Effect.Effect<number, SQLExecutionError> =>
  executeSQL(tx, `SELECT COUNT(*) AS count FROM ${quoteSqlIdentifier(tableName)}`).pipe(
    Effect.map((rows) => Number((rows as readonly { count: unknown }[])[0]?.count ?? 0))
  )

/** One table the config no longer declares, with the rows a drop would delete. */
export interface ObsoleteTable {
  readonly table: string
  readonly rows: number
  /**
   * A derived structure the engine rebuilds on its own (the SQLite search
   * index). Dropped like any other leftover, but never refused and never
   * reported as a drop of the operator's data; `rows` is 0.
   */
  readonly engineManaged: boolean
}

/**
 * The physical tables the config no longer accounts for, each with its row
 * count. Read-only: shared by the apply path (Step 4) and `--dry-run`/`--check`,
 * so the plan an operator reads is the drop the migration would run.
 *
 * "Accounts for" is {@link classifyPhysicalTables}: config tables, the
 * `<name>_base` behind each view-backed one, and every many-to-many junction.
 * Managed Better Auth / system tables are never candidates.
 */
export const findObsoleteTables = (
  tx: TransactionLike,
  tables: readonly Table[]
): Effect.Effect<readonly ObsoleteTable[], SQLExecutionError> =>
  Effect.gen(function* () {
    const existingTableNames = yield* getExistingTableNames(tx)
    const { obsolete } = classifyPhysicalTables(existingTableNames, tables)
    return yield* Effect.forEach(
      obsolete.filter((tableName) => !isProtectedTable(tableName)),
      (table): Effect.Effect<ObsoleteTable, SQLExecutionError> =>
        isCommandSearchIndexTable(table)
          ? Effect.succeed({ table, rows: 0, engineManaged: true })
          : countTableRows(tx, table).pipe(
              Effect.map((rows) => ({ table, rows, engineManaged: false }))
            )
    )
  })

/** The `DROP TABLE` a {@link dropObsoleteTables} run would issue for `tableName`. */
export const obsoleteTableDropStatement = (tableName: string): string =>
  dropTableStatement(tableName)

/**
 * Drop tables that exist in the database but that the config no longer owns —
 * and REFUSE, before writing anything, when one of them still holds rows.
 *
 * A table removed from the config has no config node left to carry a consent,
 * so the consent is a flag on the one-shot `sovrium migrate --allow-destructive`
 * and nothing else: the boot passes no option and therefore never drops a
 * populated table. An EMPTY obsolete table still drops without asking — config
 * clean-up must not wedge on tables with nothing in them.
 *
 * SECURITY NOTE: the names reaching the `DROP`/`COUNT` statements are not user
 * input. They come from the engine's own catalog query (`pg_tables` scoped to
 * `public`, or `sqlite_master`), are compared against names derived from the
 * validated config, and are quoted with `quoteSqlIdentifier` in the count probe.
 * Managed Better Auth / system tables are excluded before either statement.
 */
export const dropObsoleteTables = (
  tx: TransactionLike,
  tables: readonly Table[],
  options: { readonly allowDestructive?: boolean } = {}
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const obsolete = yield* findObsoleteTables(tx, tables)

    const populated = obsolete.filter((entry) => entry.rows > 0)
    if (populated.length > 0 && options.allowDestructive !== true) {
      return yield* new SQLExecutionError({
        message: populated
          .map((entry) => formatPopulatedDropRefusal(entry.table, entry.rows))
          .join('\n'),
      })
    }

    // Drop all obsolete tables sequentially (dialect-aware — SQLite has no CASCADE).
    const dropStatements = obsolete.map((entry) => dropTableStatement(entry.table))
    yield* executeSQLStatements(tx, dropStatements)
  })

/** `DROP VIEW IF EXISTS` for the active dialect (Postgres also takes the views built on it). */
const dropViewStatement = (viewName: string): string =>
  isSqliteRuntime() ? `DROP VIEW IF EXISTS ${viewName}` : `DROP VIEW IF EXISTS ${viewName} CASCADE`

/**
 * One table's part of the Step 5.5 topology reconciliation.
 *
 * `rename` is set when the table's rows change relation — it becomes, or stops
 * being, view-backed — and names the relation the rows move FROM and TO. A step
 * without `rename` only clears the lookup view so it can be rebuilt later.
 */
export interface ViewTopologyStep {
  /** The config name of the table. */
  readonly table: string
  readonly rename?: { readonly from: string; readonly to: string }
  /** The statements Step 5.5 runs for this table, in order. */
  readonly statements: readonly string[]
}

/**
 * The statements that bring the database's relation TOPOLOGY in line with the
 * config, before any table is created or altered (Step 5.5). Pure: the caller
 * supplies the live table and view names.
 *
 * Three transitions, each by RENAME — never by copy, because a rename keeps the
 * rows, the `id` sequence (`pg_get_serial_sequence` resolves by column
 * ownership) and every foreign key pointing at the table (Postgres follows the
 * OID; SQLite rewrites the referencing DDL with `legacy_alter_table=OFF`, its
 * default):
 *
 *  - **plain → view-backed** (a first `lookup`/`rollup`/`count` field):
 *    `<name>` is a TABLE and `<name>_base` does not exist → rename it to
 *    `<name>_base`. Without this the create step would build an empty
 *    `<name>_base` and the view step would stand the view where the rows were.
 *  - **view-backed → plain** (its last computed field removed): `<name>_base`
 *    exists and `<name>` is a view or absent → drop the view, rename
 *    `<name>_base` back to `<name>`.
 *  - **every view-backed table**: drop its VIEW up front. SQLite refuses to drop
 *    a column a view still selects, and Postgres's `CREATE OR REPLACE VIEW`
 *    cannot drop or reorder columns — so the view is rebuilt after the base
 *    table has changed (Steps 9-11 recreate it on every full migration, and the
 *    checksum fast path already treats a missing view as "migrate").
 *
 * Triggers and indexes created under the old relation's prefix survive a rename
 * and sit beside the ones the next create step derives from the new name. They
 * are idempotent duplicates, not a defect worth a catalog walk to chase.
 */
export const planViewTopology = (
  tables: readonly Table[],
  existing: { readonly tables: ReadonlySet<string>; readonly views: ReadonlySet<string> }
): readonly ViewTopologyStep[] =>
  tables.flatMap((table): readonly ViewTopologyStep[] => {
    const name = sanitizeTableName(table.name)
    const base = getBaseTableName(name)
    if (shouldUseView(table)) {
      const becomesViewBacked = existing.tables.has(name) && !existing.tables.has(base)
      const dropView = existing.views.has(name) ? [dropViewStatement(name)] : []
      if (becomesViewBacked) {
        return [
          {
            table: table.name,
            rename: { from: name, to: base },
            statements: [`ALTER TABLE ${name} RENAME TO ${base}`, ...dropView],
          },
        ]
      }
      return dropView.length === 0 ? [] : [{ table: table.name, statements: dropView }]
    }
    return existing.tables.has(base) && !existing.tables.has(name)
      ? [
          {
            table: table.name,
            rename: { from: base, to: name },
            statements: [
              ...(existing.views.has(name) ? [dropViewStatement(name)] : []),
              `ALTER TABLE ${base} RENAME TO ${name}`,
            ],
          },
        ]
      : []
  })

/**
 * The statements of {@link planViewTopology}, in the order Step 5.5 runs them.
 * Pure: the caller supplies the live table and view names.
 */
export const planViewTopologyStatements = (
  tables: readonly Table[],
  existing: { readonly tables: ReadonlySet<string>; readonly views: ReadonlySet<string> }
): readonly string[] => planViewTopology(tables, existing).flatMap((step) => step.statements)

/**
 * Step 5.5 — reconcile which relation holds each table's rows, and clear the
 * lookup views that must be rebuilt around a changed base table. See
 * {@link planViewTopologyStatements}.
 */
export const reconcileViewTopology = (
  tx: TransactionLike,
  tables: readonly Table[]
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const existingTables = new Set(yield* getExistingTableNames(tx))
    const existingViews = new Set(yield* getExistingViews(tx))
    yield* executeSQLStatements(
      tx,
      planViewTopologyStatements(tables, { tables: existingTables, views: existingViews })
    )
  })
