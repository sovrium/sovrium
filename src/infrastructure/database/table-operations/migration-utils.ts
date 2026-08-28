/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { shouldUseView, getBaseTableName } from '../lookup/lookup-view-generators'
import { executeSQL, SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import { sanitizeTableName } from '../table-queries/shared/field-utils'
import { generateCreateTableSQL, type TableDdlInputs } from './create-table-sql'
import { areTypesCompatible } from './type-compatibility'
import type { Table } from '@/domain/models/app/tables'

/**
 * Get compatible columns between existing and new table for data migration
 */
export const getCompatibleColumns = (
  existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >,
  newColumnInfo: ReadonlyMap<string, { columnDefault: string | null; dataType: string }>
): readonly string[] => {
  // SQLite uses type affinity: `INSERT INTO temp (col) SELECT col FROM old`
  // copies any stored value into any column without a type error, so column
  // compatibility is name-intersection only. This preserves data across a
  // recreate even when a column's DECLARED type spelling drifted between schema
  // versions (e.g. an isolated field-type change routed through the recreate
  // path) — a strict type-compatibility check could otherwise drop such a
  // column from the copy and lose its data. Postgres enforces column types on
  // `INSERT ... SELECT`, so it keeps the strict check below (byte-for-byte
  // unchanged).
  if (isSqliteRuntime()) {
    return Array.from(existingColumns.keys()).filter((col) => newColumnInfo.has(col))
  }
  return Array.from(existingColumns.keys()).filter((col) => {
    const newColInfo = newColumnInfo.get(col)
    if (!newColInfo) return false
    const oldType = existingColumns.get(col)?.dataType.toLowerCase() ?? ''
    return areTypesCompatible(oldType, newColInfo.dataType.toLowerCase())
  })
}

interface CopyDataParams {
  readonly tx: TransactionLike
  readonly tempTableName: string
  readonly physicalTableName: string
  readonly commonColumns: readonly string[]
  readonly newColumnInfo: ReadonlyMap<string, { columnDefault: string | null; dataType: string }>
}

/**
 * Copy data and reset SERIAL sequences for migration
 */
export const copyDataAndResetSequences = (
  params: CopyDataParams
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, tempTableName, physicalTableName, commonColumns, newColumnInfo } = params
    if (commonColumns.length === 0) return

    const columnList = commonColumns.join(', ')
    yield* executeSQL(
      tx,
      `INSERT INTO ${tempTableName} (${columnList}) SELECT ${columnList} FROM ${physicalTableName}`
    )

    // Reset SERIAL sequences to max value + 1 to avoid conflicts
    const serialColumns = commonColumns.filter((col) =>
      newColumnInfo.get(col)?.columnDefault?.includes('nextval')
    )
    yield* Effect.forEach(serialColumns, (col) =>
      executeSQL(
        tx,
        `SELECT setval(pg_get_serial_sequence('${tempTableName}', '${col}'), COALESCE((SELECT MAX(${col}) FROM ${tempTableName}), 1), true)`
      )
    )
  })

/**
 * Get column metadata (name / default / declared type) from a table.
 *
 * Dialect-aware: SQLite has no `information_schema`, so it reads the same facts
 * from `pragma_table_info` (aliased to the Postgres column names so the row
 * shape is identical on both engines). Without this, the recreate-and-copy path
 * crashed on SQLite with `no such table: information_schema.columns` — which is
 * why constraint/type evolution on an existing SQLite database could not
 * complete. The Postgres query is unchanged (byte-for-byte).
 */
const fetchColumnInfo = (
  tx: TransactionLike,
  tableName: string
): Effect.Effect<
  Map<string, { columnDefault: string | null; dataType: string }>,
  SQLExecutionError
> =>
  Effect.gen(function* () {
    const query = isSqliteRuntime()
      ? `SELECT name AS column_name, dflt_value AS column_default, type AS data_type FROM pragma_table_info('${tableName}')`
      : `SELECT column_name, column_default, data_type FROM information_schema.columns WHERE table_name = '${tableName}'`
    const columns = yield* executeSQL(tx, query)
    return new Map(
      (
        columns as readonly {
          column_name: string
          column_default: string | null
          data_type: string
        }[]
      ).map((row) => [
        row.column_name,
        { columnDefault: row.column_default, dataType: row.data_type },
      ])
    )
  })

/**
 * Finalize table recreation by dropping the old table and renaming the temp
 * table.
 *
 * Dialect-aware:
 * - `DROP TABLE … CASCADE` — `CASCADE` keyword is PG-only; SQLite drops
 *   without it (FK semantics governed by `PRAGMA foreign_keys = ON`).
 * - The final `DO $$ … END $$` constraint-rename is a PG-only PL/pgSQL block
 * that restores canonical constraint names after the swap ([internal ref] fix #2).
 *   The temp CREATE scoped every named constraint to `${tempTableName}_…` and
 *   Postgres auto-named the primary key `${tempTableName}_pkey`; renaming the
 *   table does NOT rename its constraints. Stripping the temp infix restores the
 *   same canonical names the initial CREATE would have produced — required so
 *   `syncUniqueConstraints` (which probes by the canonical `${table}_${col}_key`
 *   name) does not add a DUPLICATE unique constraint, and so a later recreate
 *   does not collide again. SQLite's `ALTER TABLE … RENAME TO …` already carries
 *   indexes/constraints with the new table name (and SQLite cannot rename
 *   constraints separately), so the block is skipped on SQLite.
 */
const finalizeTableRecreation = (
  tx: TransactionLike,
  physicalTableName: string,
  tempTableName: string
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const cascadeSuffix = isSqliteRuntime() ? '' : ' CASCADE'
    yield* executeSQL(tx, `DROP TABLE ${physicalTableName}${cascadeSuffix}`)
    yield* executeSQL(tx, `ALTER TABLE ${tempTableName} RENAME TO ${physicalTableName}`)
    if (!isSqliteRuntime()) {
      yield* executeSQL(
        tx,
        `DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = '${physicalTableName}'::regclass
      AND position('${tempTableName}_' in conname) = 1
  LOOP
    EXECUTE format(
      'ALTER TABLE ${physicalTableName} RENAME CONSTRAINT %I TO %I',
      r.conname,
      replace(r.conname, '${tempTableName}_', '${physicalTableName}_')
    );
  END LOOP;
END $$`
      )
    }
  })

/**
 * The `CREATE TABLE` DDL for the scratch table a recreate copies into.
 *
 * Identical to the DDL the create path would emit for this table, with two
 * textual re-scopings applied: the table name, and every inline constraint name.
 * Driven by the SAME {@link TableDdlInputs} the fresh-create path takes — a
 * recreate that fed the generator anything less would not reproduce the table
 * the create path would have built.
 */
const buildTempTableDDL = (
  table: Table,
  physicalTableName: string,
  tempTableName: string,
  inputs: TableDdlInputs
): string =>
  generateCreateTableSQL(table, inputs)
    .replace(`CREATE TABLE IF NOT EXISTS ${physicalTableName}`, `CREATE TABLE ${tempTableName}`)
    // Defense-in-depth ([internal ref] fix #2): the generated DDL names inline
    // constraints after the LIVE table (e.g. `CONSTRAINT <table>_<col>_key
    // UNIQUE (...)`). Building the temp table with those live names collides
    // with the still-present live table's same-named backing index (Postgres:
    // `relation "<table>_<col>_key" already exists`). Re-scope every
    // `<physicalTableName>_`-prefixed constraint name to the temp table so the
    // temp CREATE never reuses a live catalog name; `finalizeTableRecreation`
    // restores the canonical names after the swap.
    .replaceAll(`CONSTRAINT ${physicalTableName}_`, `CONSTRAINT ${tempTableName}_`)

/**
 * Recreate table with data preservation when schema changes are incompatible with ALTER TABLE
 * Used when primary key type changes or other incompatible schema modifications occur
 */
export const recreateTableWithDataEffect = (
  options: TableDdlInputs & {
    readonly tx: TransactionLike
    readonly table: Table
    readonly existingColumns: ReadonlyMap<
      string,
      { dataType: string; isNullable: string; columnDefault: string | null }
    >
  }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, existingColumns } = options
    const sanitized = sanitizeTableName(table.name)
    const physicalTableName = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized
    const tempTableName = `${physicalTableName}_migration_temp`

    // Create temporary table with new schema
    const createTableSQL = yield* Effect.try({
      try: () => buildTempTableDDL(table, physicalTableName, tempTableName, options),
      catch: (error) =>
        new SQLExecutionError({
          message: `Failed to generate CREATE TABLE DDL for migration: ${String(error)}`,
          cause: error,
        }),
    })
    yield* executeSQL(tx, createTableSQL)

    // Get new table column info and copy compatible data
    const newColumnInfo = yield* fetchColumnInfo(tx, tempTableName)
    const commonColumns = getCompatibleColumns(existingColumns, newColumnInfo)
    yield* copyDataAndResetSequences({
      tx,
      tempTableName,
      physicalTableName,
      commonColumns,
      newColumnInfo,
    })

    // Finalize by dropping old table and renaming temp table
    yield* finalizeTableRecreation(tx, physicalTableName, tempTableName)
  })
