/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The view phase of table DDL: the lookup VIEW (and its INSTEAD OF triggers)
 * that replaces a table with computed fields, and the user-defined views of
 * `table.views`. Both run once every base table exists.
 *
 * Split out of `table-effects.ts`.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import {
  shouldUseView,
  generateLookupViewSQL,
  generateLookupViewTriggers,
} from '../lookup/lookup-view-generators'
import {
  executeSQL,
  executeSQLStatements,
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
import type { Table } from '@/domain/models/app/tables'

type TableView = NonNullable<Table['views']>[number]

/**
 * Whether `name` exists as a TABLE — not a view. `tableExists` alone cannot say:
 * on Postgres it reads `information_schema.tables`, which lists views too.
 */
const tableExistsAsTable = (
  tx: TransactionLike,
  name: string
): Effect.Effect<boolean, SQLExecutionError> =>
  tx.dialect === 'sqlite'
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
 * still standing here, something upstream did not run, and dropping it with
 * `DROP TABLE IF EXISTS <name>` would delete the rows. It refuses instead.
 */
export const createLookupViewsEffect = (
  tx: TransactionLike,
  table: Table,
  allTables: readonly Table[] = []
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (shouldUseView(table)) {
      const createViewSQL = generateLookupViewSQL(table, allTables, tx.dialect)
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
        const cascadeSuffix = tx.dialect === 'sqlite' ? '' : ' CASCADE'
        yield* executeSQL(tx, `DROP VIEW IF EXISTS ${viewName}${cascadeSuffix}`)

        yield* executeSQL(tx, createViewSQL)

        // Create INSTEAD OF triggers to make the VIEW writable
        const triggerStatements = generateLookupViewTriggers(table, tx.dialect)
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
    const cascadeSuffix = tx.dialect === 'sqlite' ? '' : ' CASCADE'
    if (emitsMaterializedView(view, tx.dialect)) {
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
    const readOnlyTriggerSQL = generateReadOnlyViewTrigger(viewId, tx.dialect)
    for (const triggerSQL of readOnlyTriggerSQL) {
      yield* executeSQL(tx, triggerSQL)
    }
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
    if (emitsMaterializedView(view, tx.dialect) && view.refreshOnMigration) {
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
    for (const view of sqlBackedViews(table)) {
      // Convert view.id to string (ViewId can be number or string)
      const viewIdStr = String(view.id)

      // Drop existing view or materialized view (if any)
      yield* dropExistingView(tx, view, viewIdStr)

      // Create view (regular or materialized), from this view's own statement:
      // a search of every statement by id text picked the wrong one whenever an
      // id occurs inside another view's statement (a view `order` over `orders`).
      const createSQL = generateViewSQL(table, view, tx.dialect)
      if (createSQL) {
        yield* executeSQL(tx, createSQL)

        // For regular (non-materialized) views, add read-only triggers.
        // `emitsMaterializedView`, not `view.materialized`: on SQLite a
        // `materialized: true` declaration degrades to a plain VIEW, and a
        // plain view is exactly the object that needs the INSTEAD OF guards.
        if (!emitsMaterializedView(view, tx.dialect)) {
          yield* addReadOnlyTriggers(tx, view.id)
        }

        // Refresh materialized view if requested
        yield* maybeRefreshMaterializedView(tx, view, viewIdStr)
      }
    }
  })
