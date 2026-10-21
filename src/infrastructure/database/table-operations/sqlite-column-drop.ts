/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { getPhysicalTableName } from '../lookup/lookup-view-generators'
import { executeSQL, type SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import type { ColumnDrop } from '../schema-migration/column-detection'
import type { Table } from '@/domain/models/app/tables'

/**
 * What the SQLite catalog says about one table, as far as `DROP COLUMN` cares.
 *
 * `tableSql` is the stored `CREATE TABLE` text; `dependentSql` the text of every
 * trigger and explicit index on the table and of every view (an expression or
 * partial index names its column only in that text); the three name lists come from
 * `pragma_foreign_key_list`, `pragma_index_list`/`pragma_index_info` and
 * `pragma_table_info`.
 */
export interface SqliteDropCatalog {
  readonly tableSql: string
  readonly dependentSql: readonly string[]
  readonly foreignKeyColumns: readonly string[]
  readonly indexedColumns: readonly string[]
  readonly primaryKeyColumns: readonly string[]
}

/** How many times `column` appears as an identifier in `sql`, quoted or bare. */
export const identifierOccurrences = (sql: string, column: string): number => {
  const escaped = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return (
    sql.match(new RegExp(`(?<![A-Za-z0-9_])["\`]?${escaped}["\`]?(?![A-Za-z0-9_])`, 'gi'))
      ?.length ?? 0
  )
}

/**
 * The `columns` SQLite's `ALTER TABLE … DROP COLUMN` would refuse.
 *
 * SQLite refuses to drop a column that is a primary key, carries a UNIQUE
 * constraint or an index, takes part in a foreign key, or is named by a CHECK
 * constraint, a generated column, a trigger or a view other than its own
 * definition (<https://sqlite.org/lang_altertable.html#altertabdropcol>). The
 * catalog lists answer the first four exactly; the rest are read from the stored
 * SQL text, where a name met more than once in the `CREATE TABLE` — or at all in
 * a trigger, an explicit index or a view — counts as a reference. That reading can only err towards
 * a rebuild, which drops the column just as well; it never sends a refused drop
 * through.
 */
export const columnsSqliteCannotDrop = (
  catalog: SqliteDropCatalog,
  columns: readonly string[]
): ReadonlySet<string> => {
  const listed = new Set(
    [...catalog.foreignKeyColumns, ...catalog.indexedColumns, ...catalog.primaryKeyColumns].map(
      (name) => name.toLowerCase()
    )
  )
  return new Set(
    columns.filter(
      (column) =>
        listed.has(column.toLowerCase()) ||
        identifierOccurrences(catalog.tableSql, column) > 1 ||
        catalog.dependentSql.some((sql) => identifierOccurrences(sql, column) > 0)
    )
  )
}

/** The string `key` of each row, for catalog queries that alias their column to it. */
const column = (rows: readonly unknown[], key: 'name' | 'sql'): readonly string[] =>
  rows
    .map((row) => (row as Readonly<Record<string, unknown>>)[key])
    .filter((value): value is string => typeof value === 'string')

/** The `key` column of one catalog query about `physicalTableName`, bound as `$1`. */
const catalogColumn = (
  tx: TransactionLike,
  physicalTableName: string,
  query: { readonly sql: string; readonly key: 'name' | 'sql' }
): Effect.Effect<readonly string[], SQLExecutionError> =>
  executeSQL(tx, query.sql, [physicalTableName]).pipe(Effect.map((rows) => column(rows, query.key)))

/** The queries behind each list of {@link SqliteDropCatalog}. */
const CATALOG_QUERIES = {
  tableSql: { sql: `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = $1`, key: 'sql' },
  dependentSql: {
    sql: `SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND (type = 'view' OR (type IN ('trigger', 'index') AND tbl_name = $1))`,
    key: 'sql',
  },
  foreignKeyColumns: { sql: `SELECT "from" AS name FROM pragma_foreign_key_list($1)`, key: 'name' },
  indexedColumns: {
    sql: `SELECT ii.name AS name FROM pragma_index_list($1) AS il JOIN pragma_index_info(il.name) AS ii`,
    key: 'name',
  },
  primaryKeyColumns: { sql: `SELECT name FROM pragma_table_info($1) WHERE pk > 0`, key: 'name' },
} as const

/** Read {@link SqliteDropCatalog} for one physical table. */
export const readSqliteDropCatalog = (
  tx: TransactionLike,
  physicalTableName: string
): Effect.Effect<SqliteDropCatalog, SQLExecutionError> =>
  Effect.all(
    {
      tableSql: catalogColumn(tx, physicalTableName, CATALOG_QUERIES.tableSql).pipe(
        Effect.map((rows) => rows[0] ?? '')
      ),
      dependentSql: catalogColumn(tx, physicalTableName, CATALOG_QUERIES.dependentSql),
      foreignKeyColumns: catalogColumn(tx, physicalTableName, CATALOG_QUERIES.foreignKeyColumns),
      indexedColumns: catalogColumn(tx, physicalTableName, CATALOG_QUERIES.indexedColumns),
      primaryKeyColumns: catalogColumn(tx, physicalTableName, CATALOG_QUERIES.primaryKeyColumns),
    },
    // One connection, one statement at a time: the SQLite schema transaction is serial.
    { concurrency: 1 }
  )

/**
 * `alterStatements` with every `DROP COLUMN` SQLite would refuse taken out, and
 * whether one was — in which case the caller rebuilds the table, which drops
 * the column by not copying it.
 *
 * SQLite's `DROP COLUMN` has no `CASCADE`: a `user` or `relationship` field's
 * own `REFERENCES` clause names the column, so the drop failed with `unknown
 * column … in foreign key definition` and the app could not boot. The rebuild
 * is the procedure SQLite documents for every change `ALTER TABLE` cannot make.
 * `drops` names, for each `DROP COLUMN` among the statements, the column it
 * drops — the pair the statement builder rendered, so nothing is re-rendered or
 * guessed here. PostgreSQL drops with `CASCADE` and is returned untouched.
 */
export const planSqliteDrops = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  readonly alterStatements: readonly string[]
  /** The `DROP COLUMN` statements among `alterStatements`, each with its column. */
  readonly drops: readonly ColumnDrop[]
  /** The relation to read the catalog from, when it is not the physical table yet. */
  readonly source?: string
}): Effect.Effect<
  { readonly statements: readonly string[]; readonly rebuild: boolean },
  SQLExecutionError
> =>
  Effect.gen(function* () {
    const { tx, alterStatements, drops } = params
    const unchanged = { statements: alterStatements, rebuild: false }
    if (!isSqliteRuntime() || drops.length === 0) return unchanged
    const catalog = yield* readSqliteDropCatalog(
      tx,
      params.source ?? getPhysicalTableName(params.table)
    )
    const refused = columnsSqliteCannotDrop(
      catalog,
      drops.map((drop) => drop.column)
    )
    if (refused.size === 0) return unchanged
    const withheld = new Set(
      drops.filter((drop) => refused.has(drop.column)).map((drop) => drop.statement)
    )
    return {
      statements: alterStatements.filter((statement) => !withheld.has(statement)),
      rebuild: true,
    }
  })
