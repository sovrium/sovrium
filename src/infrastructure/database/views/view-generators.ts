/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { shouldUseView } from '@/infrastructure/database/lookup/lookup-view-generators'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  getExistingViews,
  getExistingMaterializedViews,
  executeSQLStatementsParallel,
  type TransactionLike,
} from '../sql/sql-execution'
import { generateSqlCondition } from '../table-queries/filter-operators'
import { compileFilterTree, isCompleteCondition } from '../table-queries/filter-tree'
import type { Table } from '@/domain/models/app/tables'
import type { View } from '@/domain/models/app/tables/views'

/**
 * `DROP VIEW` statement for the active dialect.
 *
 * PostgreSQL supports `DROP VIEW … CASCADE` (drops dependents transitively).
 * SQLite has no `CASCADE` clause on `DROP VIEW`; a plain `DROP VIEW IF EXISTS`
 * is used there.
 *
 * A previous version of this note claimed SQLite views are "filtered out of the
 * dynamic-table set by `shouldUseView` degradation". That was FALSE and is
 * corrected here: `shouldUseView` (lookup/lookup-view-generators.ts) is
 * `hasLookupFields || hasRollupFields || hasCountFields` — it has no dialect
 * awareness whatsoever and never inspects `materialized`. SQLite really does
 * create views, so this branch is load-bearing rather than defensive.
 */
const dropViewStatement = (viewName: string): string => {
  // Quote the identifier — view IDs are kebab-case and must be quoted.
  const quoted = quoteSqlIdentifier(viewName)
  return isSqliteRuntime()
    ? `DROP VIEW IF EXISTS ${quoted}`
    : `DROP VIEW IF EXISTS ${quoted} CASCADE`
}

/**
 * Generate SQL WHERE clause from view filters.
 *
 * Supports every arm of `ViewFilterNodeSchema` — bare condition (with or
 * without a `value`), `and`, `or`, and arbitrarily nested groups, walked by
 * {@link compileFilterTree}. Values are escaped by `generateSqlCondition`
 * (this is DDL, where bound parameters are illegal).
 */
const generateWhereClause = (filters: View['filters']): string => {
  if (!filters) return ''

  // The top level stays unwrapped (`WHERE a AND b`), so a view whose SQL was
  // already right keeps it byte for byte. A condition whose operator needs a
  // value but carries none restricts nothing, as it always has here: compiling
  // it would compare against `undefined` and throw while the view is created.
  const condition = compileFilterTree(filters, (c) =>
    isCompleteCondition(c)
      ? generateSqlCondition(quoteSqlIdentifier(c.field), c.operator, c.value)
      : undefined
  )
  return condition === undefined ? '' : `WHERE ${condition}`
}

/**
 * Generate SQL ORDER BY clause from view sorts and groupBy
 * GroupBy takes precedence - when present, it's used for ordering
 * If both groupBy and sorts are present, groupBy is applied first
 */
const generateOrderByClause = (sorts: View['sorts'], groupBy: View['groupBy']): string => {
  // Build order items immutably
  const groupByItems = groupBy
    ? [`${quoteSqlIdentifier(groupBy.field)} ${(groupBy.direction || 'asc').toUpperCase()}`]
    : []

  const sortItems =
    sorts && sorts.length > 0 && !groupBy
      ? sorts.map((sort) => `${quoteSqlIdentifier(sort.field)} ${sort.direction.toUpperCase()}`)
      : []

  const orderItems = [...groupByItems, ...sortItems]

  return orderItems.length > 0 ? `ORDER BY ${orderItems.join(', ')}` : ''
}

/**
 * Whether this view is emitted as a MATERIALIZED VIEW on the ACTIVE dialect.
 *
 * `materialized: true` is a plain AppSchema flag with no dialect precondition
 * anywhere in the config surface, so nothing warns an author that it is
 * Postgres-only — and SQLite has no MATERIALIZED VIEW object at all. Reading
 * `view.materialized` directly therefore emitted `CREATE MATERIALIZED VIEW` on
 * the ZERO-CONFIG DEFAULT engine, which is a syntax error, which aborts schema
 * init, which means one config flag bricked the boot of the whole app.
 *
 * The degradation is deliberate and it is a DEGRADATION, not a skip: on SQLite
 * the view is still created, as a plain VIEW. SQLite's query planner makes the
 * two observationally equivalent for reads (only the refresh semantics differ,
 * and there is nothing to refresh when the view is always live), so honouring
 * the declaration loses nothing an author can observe. Dropping the view
 * instead would be a silent data-shape change wearing the same green tick.
 *
 * This predicate is the single place that decision is made. Every site that
 * used to branch on `view.materialized` — the CREATE here, the DROP form and
 * the REFRESH in `table-operations/table-effects.ts` — must go through it, or
 * they disagree about which objects exist.
 */
export const emitsMaterializedView = (view: Readonly<{ materialized?: boolean }>): boolean =>
  view.materialized === true && !isSqliteRuntime()

/**
 * Generate CREATE VIEW or CREATE MATERIALIZED VIEW statement for a table view
 * PostgreSQL doesn't support IF NOT EXISTS for CREATE VIEW, so we drop first
 */
export const generateViewSQL = (table: Table, view: View): string => {
  const viewType = emitsMaterializedView(view) ? 'MATERIALIZED VIEW' : 'VIEW'
  // Convert view.id to string (ViewId can be number or string).
  // Kebab-case view IDs (e.g. `active-orders`) need double-quoting — an
  // unquoted hyphen is a SQL syntax error.
  const viewIdStr = quoteSqlIdentifier(String(view.id))

  // If view has a custom query, use it directly
  if (view.query) {
    return `CREATE ${viewType} ${viewIdStr} AS ${view.query}`
  }

  // Otherwise, build query from filters, sorts, fields, groupBy
  // Column names are quoted the way the table's own columns were (a field may
  // be named `values` or `window`, key words a bare column cannot be).
  const fields =
    view.fields && view.fields.length > 0 ? view.fields.map(quoteSqlIdentifier).join(', ') : '*'
  const whereClause = generateWhereClause(view.filters)
  const orderByClause = generateOrderByClause(view.sorts, view.groupBy)

  // The DATABASE name, quoted: the config name (`report-requests`) is not an
  // identifier. A view-backed table reads its lookup VIEW, which carries this
  // same name and the computed columns a saved view may select.
  const source = quoteSqlIdentifier(sanitizeTableName(table.name))
  const clauses = [`SELECT ${fields}`, `FROM ${source}`, whereClause, orderByClause].filter(
    (clause) => clause !== ''
  )

  const query = clauses.join(' ')

  return `CREATE ${viewType} ${viewIdStr} AS ${query}`
}

/**
 * The views of a table that become database VIEWs, in config order.
 *
 * JSON config mode views with numeric IDs cannot create PostgreSQL VIEWs — unquoted
 * numeric identifiers are invalid SQL syntax. Those are handled at the API layer via
 * ?view= param. SQL query mode views (with a `query` property) always create
 * PostgreSQL VIEWs regardless of ID type, so they are retained. Each one's
 * statement is {@link generateViewSQL} of that view: a caller pairs the two
 * directly, never by searching the statements for the id's text.
 */
export const sqlBackedViews = (table: Table): readonly View[] =>
  (table.views ?? []).filter((view) => view.query || typeof view.id !== 'number')

/**
 * The read-only guard, in SQLite's spelling.
 *
 * Same contract as the PostgreSQL form — one `INSTEAD OF` trigger per write verb
 * that aborts — but SQLite has no stored functions, so the rejection is a
 * `SELECT RAISE(ABORT, …)` INSIDE the trigger body rather than a `RAISE
 * EXCEPTION` inside a PL/pgSQL function the trigger merely references.
 *
 * The `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER … INSTEAD OF … BEGIN … END`
 * shape is deliberately the one `lookup/lookup-view-triggers.ts` already uses
 * for view-backed tables. That is this codebase's SQLite trigger convention;
 * inventing a second spelling here is how the two would drift apart.
 */
const generateReadOnlyViewTriggerSqlite = (
  quotedViewId: string,
  viewIdStr: string,
  triggerBaseName: string
): readonly string[] =>
  (['insert', 'update', 'delete'] as const).flatMap((verb) => [
    `DROP TRIGGER IF EXISTS ${triggerBaseName}_${verb}`,
    `CREATE TRIGGER ${triggerBaseName}_${verb}
INSTEAD OF ${verb.toUpperCase()} ON ${quotedViewId}
BEGIN
  SELECT RAISE(ABORT, 'cannot ${verb} view "${viewIdStr}"');
END`,
  ])

/**
 * Generate trigger to make a view read-only.
 *
 * Both engines will otherwise let writes through a simple view — PostgreSQL
 * auto-updates qualifying views, SQLite honours whatever `INSTEAD OF` triggers
 * exist — so this guard is what makes a declared view genuinely read-only
 * rather than incidentally so.
 *
 * DIALECT-AWARE BECAUSE IT HAD TO BE. This emitted PL/pgSQL unconditionally,
 * and SQLite cannot parse `CREATE OR REPLACE FUNCTION`: a table declaring a
 * STRING-id view aborted schema init on the ZERO-CONFIG DEFAULT engine with
 * `near "OR": syntax error`, so the app never bound its port. `sovrium validate`
 * accepted that config, and no `@spec` test could see it because `@spec` runs on
 * PostgreSQL — which is why its spec is parameterised by dialect.
 *
 * A NUMERIC view id never reaches here: `sqlBackedViews` leaves it out, so no
 * SQL view for one, by design, because those are served by the records API
 * through `?view=`.
 */
export const generateReadOnlyViewTrigger = (viewId: string | number): readonly string[] => {
  const viewIdStr = String(viewId)
  // The view itself is referenced as a target identifier — quote it so
  // kebab-case IDs (e.g. `active-orders`) are valid SQL.
  const quotedViewId = quoteSqlIdentifier(viewIdStr)
  // Trigger and function names must be plain (unquoted) identifiers, so
  // normalize any non-identifier characters (e.g. hyphens) to underscores.
  const triggerBaseName = `${viewIdStr.replace(/[^a-z0-9_]/gi, '_')}_readonly`

  if (isSqliteRuntime()) {
    return generateReadOnlyViewTriggerSqlite(quotedViewId, viewIdStr, triggerBaseName)
  }

  return [
    // INSTEAD OF INSERT trigger
    `CREATE OR REPLACE FUNCTION ${triggerBaseName}_insert_fn()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'cannot insert into view "%"', TG_TABLE_NAME;
    END;
    $$ LANGUAGE plpgsql`,
    `CREATE TRIGGER ${triggerBaseName}_insert
    INSTEAD OF INSERT ON ${quotedViewId}
    FOR EACH ROW EXECUTE FUNCTION ${triggerBaseName}_insert_fn()`,

    // INSTEAD OF UPDATE trigger
    `CREATE OR REPLACE FUNCTION ${triggerBaseName}_update_fn()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'cannot update view "%"', TG_TABLE_NAME;
    END;
    $$ LANGUAGE plpgsql`,
    `CREATE TRIGGER ${triggerBaseName}_update
    INSTEAD OF UPDATE ON ${quotedViewId}
    FOR EACH ROW EXECUTE FUNCTION ${triggerBaseName}_update_fn()`,

    // INSTEAD OF DELETE trigger
    `CREATE OR REPLACE FUNCTION ${triggerBaseName}_delete_fn()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'cannot delete from view "%"', TG_TABLE_NAME;
    END;
    $$ LANGUAGE plpgsql`,
    `CREATE TRIGGER ${triggerBaseName}_delete
    INSTEAD OF DELETE ON ${quotedViewId}
    FOR EACH ROW EXECUTE FUNCTION ${triggerBaseName}_delete_fn()`,
  ]
}

/**
 * Collect the full set of view IDs the schema expects to exist in the DB.
 *
 * Combines both sources, since the obsolete-view sweepers must treat the
 * union as "expected" or they will drop legitimately-created views:
 *  - (a) User-declared views from `table.views[]`.
 *  - (b) Auto-generated lookup/rollup/count views (named after the table's
 *    DATABASE name, sibling of `<name>_base`) emitted by the `shouldUseView` machinery
 *    in `lookup-view-generators.ts`.
 *
 * Omitting (b) was the root cause of a migration checksum view drift spec: the
 * fast-path skip path dropped auto-generated views on every 2nd+ boot,
 * breaking API reads against `<table.name>` with `no such table`.
 */
const collectExpectedViewIds = (tables: readonly Table[]): ReadonlySet<string> => {
  const userDeclaredViewIds = tables.flatMap((table) =>
    table.views && table.views.length > 0 ? table.views.map((view) => String(view.id)) : []
  )
  const autoGeneratedLookupViewNames = tables
    .filter((table) => shouldUseView(table))
    .map((table) => sanitizeTableName(table.name))
  return new Set<string>([...userDeclaredViewIds, ...autoGeneratedLookupViewNames])
}

/**
 * Build the dialect-aware DROP MATERIALIZED VIEW statement for `viewName`.
 *
 * SQLite has no MATERIALIZED VIEW concept — the catalog query that feeds this
 * helper returns `[]` on SQLite — but the cascade suffix is applied
 * defensively for any caller that synthesizes names outside the catalog.
 */
const dropMaterializedViewStatement = (viewName: string): string => {
  const cascadeSuffix = isSqliteRuntime() ? '' : ' CASCADE'
  return `DROP MATERIALIZED VIEW IF EXISTS ${quoteSqlIdentifier(viewName)}${cascadeSuffix}`
}

/** Find every view in `existing` that is no longer part of the schema. */
const findObsoleteViewNames = (
  existingViewNames: readonly string[],
  existingMatViewNames: readonly string[],
  expectedViewIds: ReadonlySet<string>
): { readonly views: readonly string[]; readonly matViews: readonly string[] } => ({
  views: existingViewNames.filter((viewName) => !expectedViewIds.has(viewName)),
  matViews: existingMatViewNames.filter((viewName) => !expectedViewIds.has(viewName)),
})

/**
 * Drop all views that are not defined in any table's schema
 * This ensures orphaned views (manually created or from previous schemas) are cleaned up
 */
export const dropAllObsoleteViews = async (
  tx: TransactionLike,
  tables: readonly Table[]
): Promise<void> => {
  const program = Effect.gen(function* () {
    const [existingViewNames, existingMatViewNames] = yield* Effect.all(
      [getExistingViews(tx), getExistingMaterializedViews(tx)],
      { concurrency: 2 }
    )

    const expectedViewIds = collectExpectedViewIds(tables)
    const obsolete = findObsoleteViewNames(existingViewNames, existingMatViewNames, expectedViewIds)

    const dropViewStatements = obsolete.views.map(dropViewStatement)
    const dropMatViewStatements = obsolete.matViews.map(dropMaterializedViewStatement)

    // Execute all DROP statements in parallel
    if (dropViewStatements.length > 0 || dropMatViewStatements.length > 0) {
      yield* executeSQLStatementsParallel(tx, [...dropViewStatements, ...dropMatViewStatements])
    }
  })

  await Effect.runPromise(program)
}
