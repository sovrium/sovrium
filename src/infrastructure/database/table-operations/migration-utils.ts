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
import { getPhysicalTableName } from '../lookup/lookup-view-generators'
import { executeSQL, SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
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
  readonly newColumnInfo: ReadonlyMap<string, NewColumnInfo>
}

/** What the copy needs to know about one column of the table being built. */
interface NewColumnInfo {
  readonly columnDefault: string | null
  readonly dataType: string
  /** The column refuses NULL. Absent when the catalog was not asked. */
  readonly notNull?: boolean
}

/**
 * The expression that copies `column` into the rebuilt table.
 *
 * A column that becomes required WITH a default takes that default where the
 * old row held NULL — the same back-fill PostgreSQL's `ALTER COLUMN` path runs
 * before `SET NOT NULL`. Copied verbatim, the NULL was rejected by the scratch
 * table and the boot failed, on SQLite, where every such change is a rebuild.
 * A required column WITHOUT a default still copies its NULL and is refused:
 * there is no value to put in its place. A sequence default is never a fill.
 */
export const copyExpression = (column: string, info: NewColumnInfo | undefined): string => {
  const fill = info?.notNull === true ? (info.columnDefault ?? undefined) : undefined
  const quoted = quoteSqlIdentifier(column)
  return fill === undefined || fill.includes('nextval') ? quoted : `COALESCE(${quoted}, ${fill})`
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

    const columnList = commonColumns.map((column) => quoteSqlIdentifier(column)).join(', ')
    const selectList = commonColumns
      .map((column) => copyExpression(column, newColumnInfo.get(column)))
      .join(', ')
    yield* executeSQL(
      tx,
      `INSERT INTO ${tempTableName} (${columnList}) SELECT ${selectList} FROM ${physicalTableName}`
    )

    // Reset SERIAL sequences to max value + 1 to avoid conflicts
    const serialColumns = commonColumns.filter((col) =>
      newColumnInfo.get(col)?.columnDefault?.includes('nextval')
    )
    yield* Effect.forEach(serialColumns, (col) =>
      executeSQL(
        tx,
        `SELECT setval(pg_get_serial_sequence('${tempTableName}', '${col}'), COALESCE((SELECT MAX(${quoteSqlIdentifier(col)}) FROM ${tempTableName}), 1), true)`
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
): Effect.Effect<Map<string, NewColumnInfo>, SQLExecutionError> =>
  Effect.gen(function* () {
    const query = isSqliteRuntime()
      ? `SELECT name AS column_name, dflt_value AS column_default, type AS data_type, "notnull" AS not_null FROM pragma_table_info('${tableName}')`
      : // A generated column computes its own value and refuses one: it is never a copy target.
        `SELECT column_name, column_default, data_type, is_nullable = 'NO' AS not_null FROM information_schema.columns WHERE table_name = '${tableName}' AND is_generated = 'NEVER'`
    const columns = yield* executeSQL(tx, query)
    return new Map(
      (
        columns as readonly {
          column_name: string
          column_default: string | null
          data_type: string
          not_null: unknown
        }[]
      ).map((row) => [
        row.column_name,
        {
          columnDefault: row.column_default,
          dataType: row.data_type,
          // SQLite answers 1/0, PostgreSQL a boolean.
          notNull: row.not_null === true || Number(row.not_null) === 1,
        },
      ])
    )
  })

/**
 * One inline constraint the scratch table carries under a borrowed name: the
 * name the generator emitted (`canonical`) and the one the scratch table used
 * instead (`scoped`), so the swap can put back exactly the former.
 */
type ScopedConstraint = { readonly canonical: string; readonly scoped: string }

/**
 * Finalize table recreation by dropping the old table and renaming the temp
 * table.
 *
 * Dialect-aware:
 * - `DROP TABLE … CASCADE` — `CASCADE` keyword is PG-only; SQLite drops
 *   without it (FK semantics governed by `PRAGMA foreign_keys = ON`).
 * - The constraint renames are PG-only. The temp CREATE scoped every
 *   table-prefixed constraint name to `${tempTableName}_…` (see
 *   {@link buildTempTableDDL}) and Postgres auto-named the primary key
 *   `${tempTableName}_pkey`; renaming the table does NOT rename its
 *   constraints. Each scoped name goes back to EXACTLY the name the generator
 *   emitted — required so `syncUniqueConstraints` (which probes by the
 *   canonical `${table}_${col}_key` name) does not add a DUPLICATE unique
 *   constraint, and so a later recreate does not collide again. A view-backed
 *   table keeps its rows in `<name>_base` but its constraints are named after
 *   `<name>`, so one shared prefix cannot restore both; the list can. What is
 *   left under the temp prefix — the auto-named primary key — takes the
 *   physical table's prefix, as the initial CREATE would have named it.
 *   SQLite's `ALTER TABLE … RENAME TO …` already carries indexes/constraints
 *   with the new table name (and SQLite cannot rename constraints
 *   separately), so the renames are skipped on SQLite.
 */
const finalizeTableRecreation = (
  tx: TransactionLike,
  physicalTableName: string,
  tempTableName: string,
  scopedConstraints: readonly ScopedConstraint[]
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const cascadeSuffix = isSqliteRuntime() ? '' : ' CASCADE'
    yield* executeSQL(tx, `DROP TABLE ${physicalTableName}${cascadeSuffix}`)
    yield* executeSQL(tx, `ALTER TABLE ${tempTableName} RENAME TO ${physicalTableName}`)
    if (isSqliteRuntime()) return
    yield* Effect.forEach(
      scopedConstraints,
      ({ canonical, scoped }) =>
        executeSQL(
          tx,
          `ALTER TABLE ${physicalTableName} RENAME CONSTRAINT ${scoped} TO ${canonical}`
        ),
      { discard: true }
    )
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
  })

/**
 * The table-prefixed constraint names in `ddl`, each with the scratch-table
 * name it is built under.
 *
 * A name is table-prefixed when it starts with the physical relation's name
 * or with the table's derived name — they differ for a view-backed table,
 * whose rows live in `<name>_base` while its constraints are named after
 * `<name>` (`orders_code_key`). Both kinds name catalog objects the live table
 * still holds while the scratch table is built (Postgres:
 * `relation "orders_code_key" already exists`), so both are re-scoped. The
 * longer prefix is tried first, so `orders_base_x` stays `…_temp_x`. Names
 * that are not table-prefixed (`check_<column>_<suffix>`) are per-table on
 * both dialects and stay as they are.
 */
const scopeConstraintNames = (
  ddl: string,
  prefixes: readonly string[],
  tempTableName: string
): readonly ScopedConstraint[] => {
  const byLength = [...new Set(prefixes)].toSorted((a, b) => b.length - a.length)
  const names = new Set(Array.from(ddl.matchAll(/CONSTRAINT (\w+)/g), (match) => match[1] ?? ''))
  return [...names].flatMap((canonical) => {
    const prefix = byLength.find((candidate) => canonical.startsWith(`${candidate}_`))
    return prefix === undefined
      ? []
      : [{ canonical, scoped: `${tempTableName}_${canonical.slice(prefix.length + 1)}` }]
  })
}

/**
 * The `CREATE TABLE` DDL for the scratch table a recreate copies into, and the
 * constraint names it borrowed.
 *
 * Identical to the DDL the create path would emit for this table, with two
 * textual re-scopings applied: the table name, and every table-prefixed inline
 * constraint name (see {@link scopeConstraintNames}). Driven by the SAME
 * {@link TableDdlInputs} the fresh-create path takes — a recreate that fed the
 * generator anything less would not reproduce the table the create path would
 * have built.
 */
const buildTempTableDDL = (
  table: Table,
  physicalTableName: string,
  tempTableName: string,
  inputs: TableDdlInputs
): { readonly ddl: string; readonly scopedConstraints: readonly ScopedConstraint[] } => {
  const generated = generateCreateTableSQL(table, inputs).replace(
    `CREATE TABLE IF NOT EXISTS ${physicalTableName}`,
    `CREATE TABLE ${tempTableName}`
  )
  // Defense-in-depth (the idempotent schema re-initialisation rule fix #2): building the temp table under the live
  // constraint names collides with the still-present live table's same-named
  // backing index; `finalizeTableRecreation` restores the names after the swap.
  const scopedConstraints = scopeConstraintNames(
    generated,
    [physicalTableName, sanitizeTableName(table.name)],
    tempTableName
  )
  const scopedBy = new Map(scopedConstraints.map(({ canonical, scoped }) => [canonical, scoped]))
  const ddl = generated.replace(/CONSTRAINT (\w+)/g, (clause, name: string) => {
    const scoped = scopedBy.get(name)
    return scoped === undefined ? clause : `CONSTRAINT ${scoped}`
  })
  return { ddl, scopedConstraints }
}

/**
 * Why a rebuild that would carry NO column of a populated table must stop.
 *
 * Every table has `id` and the timestamp columns, so an empty intersection does
 * not mean "nothing to keep": it means the columns were read from the wrong
 * relation (the SQLite user-key repair once probed `Report Requests` instead of
 * `report_requests`, copied nothing, and dropped the original). The copy is the
 * only thing standing between the rows and the `DROP TABLE` that follows, so
 * with nothing to copy the rebuild refuses rather than deleting them. An empty
 * table has nothing to lose and rebuilds as before. `undefined` means proceed.
 */
export const emptyCopyRefusal = (
  tableName: string,
  physicalTableName: string,
  rows: number
): string | undefined =>
  rows === 0
    ? undefined
    : `Refusing to rebuild table ${tableName}: none of the columns of ${physicalTableName} ` +
      `carry over to the rebuilt table, so its ${rows} ${rows === 1 ? 'row' : 'rows'} would be ` +
      `deleted. The rebuild stopped before the original table was dropped.`

/** Stop a rebuild that would copy nothing out of a table that holds rows. */
const guardEmptyCopy = (
  tx: TransactionLike,
  tableName: string,
  physicalTableName: string
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const counted = yield* executeSQL(tx, `SELECT COUNT(*) AS count FROM ${physicalTableName}`)
    const rows = Number((counted as readonly { count: unknown }[])[0]?.count ?? 0)
    const refusal = emptyCopyRefusal(tableName, physicalTableName, rows)
    if (refusal !== undefined) return yield* new SQLExecutionError({ message: refusal })
  })

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
    const physicalTableName = getPhysicalTableName(table)
    const tempTableName = `${physicalTableName}_migration_temp`

    // Create temporary table with new schema
    const { ddl: createTableSQL, scopedConstraints } = yield* Effect.try({
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
    if (commonColumns.length === 0) yield* guardEmptyCopy(tx, table.name, physicalTableName)
    yield* copyDataAndResetSequences({
      tx,
      tempTableName,
      physicalTableName,
      commonColumns,
      newColumnInfo,
    })

    // Finalize by dropping old table and renaming temp table
    yield* finalizeTableRecreation(tx, physicalTableName, tempTableName, scopedConstraints)
  })
