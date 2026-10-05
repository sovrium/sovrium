/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { diffCheckClauses } from '@/domain/kernel/sql/sql-check-clauses'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { logDebug } from '@/infrastructure/logging/logger'
import { getPhysicalTableName } from '../lookup/lookup-view-generators'
import { executeSQL, type SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import { generateTableConstraints } from '../sql/sql-generators'
import type { Table } from '@/domain/models/app/tables'

/**
 * SQLite cannot add, drop or replace a CHECK constraint on an existing table:
 * the rule lives in the CREATE TABLE text, and only a rebuild rewrites it. So
 * an edit that reaches the table through `ALTER TABLE … ADD / RENAME COLUMN`
 * — a field added or renamed — leaves every CHECK as it was, while the schema
 * snapshot records the new config. A new single-select option was then refused
 * on that table for good, the next boot seeing nothing left to change.
 *
 * The question is therefore asked of the DATABASE, not of the snapshot: does
 * the live table enforce the CHECK clauses its definition declares? The
 * clauses compare without their constraint names (see `extractCheckClauses`),
 * so a table rebuilt under a temp-scoped name, or a renamed column's rule,
 * reads as current once its clauses are.
 */

/** The CHECK-bearing part of a table's DDL, as `generateCreateTableSQL` emits it. */
const declaredConstraintDdl = (table: Table): string =>
  generateTableConstraints(table, undefined, true).join(',\n')

/** Whether `liveDdl`, a table's stored CREATE TABLE text, enforces other CHECK rules than `table` declares. */
const checkClausesStale = (table: Table, liveDdl: string): boolean => {
  const { missing, unexpected } = diffCheckClauses(liveDdl, declaredConstraintDdl(table))
  return missing.length > 0 || unexpected.length > 0
}

/** `name → CREATE TABLE text` from rows of `sqlite_master` holding `name` and `sql`. */
const tableDdlByName = (rows: readonly unknown[]): ReadonlyMap<string, string> =>
  new Map(
    rows.flatMap((row) => {
      const { name, sql } = row as { readonly name?: unknown; readonly sql?: unknown }
      return typeof name === 'string' && typeof sql === 'string' ? [[name, sql] as const] : []
    })
  )

/**
 * The first declared table whose live CHECK clauses are stale, or `undefined`.
 * A table the database does not hold yet is not stale: creating it is the
 * migration's ordinary work.
 */
const findTableWithStaleChecks = (
  tables: readonly Table[],
  liveDdl: ReadonlyMap<string, string>
): string | undefined =>
  tables.find((table) => {
    const ddl = liveDdl.get(getPhysicalTableName(table))
    return ddl !== undefined && checkClausesStale(table, ddl)
  })?.name

/**
 * Whether every SQLite table enforces the CHECK clauses its definition declares
 * — the boot's fast-path probe. An earlier boot that added or renamed a field
 * with `ALTER TABLE` in the same edit as a new single-select option left the
 * old CHECK in place and stored the new checksum; without this probe such a
 * database would skip the migration on every boot and keep refusing the
 * option. `query` runs one statement on a SQLite connection.
 */
export const sqliteCheckClausesCurrent = async (
  query: (sql: string) => Promise<readonly unknown[]>,
  tables: readonly Table[]
): Promise<boolean> => {
  const rows = await query(`SELECT name, sql FROM sqlite_master WHERE type = 'table'`)
  const stale = findTableWithStaleChecks(tables, tableDdlByName(rows))
  if (stale === undefined) return true
  logDebug(
    '[schema] checksum matches but a table does not enforce the CHECK rules it declares — full migration',
    { table: stale }
  )
  return false
}

/**
 * Whether an existing SQLite table must be rebuilt for its CHECK clauses to
 * match its definition. Always `false` on PostgreSQL, where
 * `syncCheckConstraints` replaces each CHECK in place.
 */
export const sqliteCheckClausesStale = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<boolean, SQLExecutionError> =>
  Effect.gen(function* () {
    if (!isSqliteRuntime()) return false
    const physicalTableName = getPhysicalTableName(table)
    const rows = yield* executeSQL(
      tx,
      `SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name = '${physicalTableName.replaceAll("'", "''")}'`
    )
    return findTableWithStaleChecks([table], tableDdlByName(rows)) !== undefined
  })
