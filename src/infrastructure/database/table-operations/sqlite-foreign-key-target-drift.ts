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
import type { Table } from '@/domain/models/app/tables'

/**
 * Whether an existing SQLite table holds a foreign key naming a relation that is
 * no longer the table holding the rows it references.
 *
 * A table gains or loses a computed field (`count`, `rollup`, `lookup`) by a
 * RENAME between `<name>` and `<name>_base` (Step 5.5). The schema step runs
 * with foreign keys off and Bun's SQLite in `legacy_alter_table` mode, where a
 * rename rewrites no other table's `REFERENCES`: a table linking to the renamed
 * one kept naming the old relation — a `<name>_base` that no longer exists, or
 * a `<name>` that is now a view — and every insert into it failed. Only a
 * rebuild rewrites the stored `CREATE TABLE` text, and the rebuild generates
 * the key against the relation the config now implies. Always `false` on
 * PostgreSQL, whose keys follow the renamed table.
 */
export const sqliteForeignKeyTargetsStale = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<boolean, SQLExecutionError> =>
  Effect.gen(function* () {
    if (!isSqliteRuntime()) return false
    const relation = getPhysicalTableName(table).replaceAll("'", "''")
    const rows = yield* executeSQL(
      tx,
      `SELECT DISTINCT m.type AS kind FROM pragma_foreign_key_list('${relation}') AS fk
       LEFT JOIN sqlite_master AS m ON m.name = fk."table"`
    )
    return rows.some((row) => (row as { readonly kind?: unknown }).kind !== 'table')
  })
