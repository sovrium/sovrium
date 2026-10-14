/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shape single-field uniqueness has in the LIVE catalog, against the shape
 * this version writes.
 *
 * A `unique` field is held by a live-rows unique index, `<table>_<field>_key …
 * WHERE deleted_at IS NULL`, on both engines; only a single-field primary key
 * declared unique keeps a table-level `UNIQUE` constraint. A database written by
 * an earlier version holds every `unique` field under such a constraint, which
 * counts trashed rows. Reading the catalog rather than the previous config is
 * what lets that database convert on its first boot of this version even though
 * its config did not change, and what keeps every later boot quiet.
 *
 * Three readings come out of one catalog query:
 *
 * - `legacy` — a table-level single-column `UNIQUE` a live-rows index replaces.
 *   PostgreSQL drops it in place; SQLite, whose constraint lives in the stored
 *   `CREATE TABLE` text, rebuilds the table.
 * - `stray` — a live-rows index of a field no longer unique or renamed, or a
 *   unique index declared with a `where` that the catalog holds without one. Dropped on both
 *   engines; the index sync builds the declared shape again.
 * - `missing` — a declared uniqueness the catalog does not enforce yet, which the
 *   duplicate pre-flight probes before anything is changed.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { logDebug } from '@/infrastructure/logging/logger'
import { getPhysicalTableName } from '../lookup/lookup-view-generators'
import { applyUniqueDefaults } from '../schema/apply-schema-defaults'
import { executeSQL, type SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import {
  isBtreeUniqueField,
  isLiveUniqueField,
  liveUniqueIndexName,
  tableConstraintPrefix,
} from '../sql/sql-key-constraints'
import { sqliteCheckClausesCurrent } from './sqlite-check-drift'
import type { Table } from '@/domain/models/app/tables'

/** One unique index of a table, as the catalog lists it. */
export interface LiveUniqueIndex {
  readonly name: unknown
  /** The first indexed column; `null` for an expression. */
  readonly col: unknown
  /** How many columns the index covers. */
  readonly ncols: unknown
  /** `u` a `UNIQUE` constraint, `pk` the primary key, `c` a `CREATE INDEX`. */
  readonly origin: unknown
  /** `1` / `true` when the index carries a `WHERE`. */
  readonly partial: unknown
}

/** A {@link LiveUniqueIndex} with the table it belongs to. */
type CatalogRow = LiveUniqueIndex & { readonly tbl: unknown }

const SQLITE_COLUMNS = `il.name AS name, il.origin AS origin, il.partial AS partial, (SELECT COUNT(*) FROM pragma_index_info(il.name)) AS ncols, (SELECT ii.name FROM pragma_index_info(il.name) AS ii WHERE ii.seqno = 0) AS col`

const SQLITE_TABLE = `SELECT ${SQLITE_COLUMNS} FROM pragma_index_list($1) AS il WHERE il."unique" = 1`

const SQLITE_ALL = `SELECT m.name AS tbl, ${SQLITE_COLUMNS} FROM sqlite_master AS m JOIN pragma_index_list(m.name) AS il WHERE m.type = 'table' AND il."unique" = 1`

const POSTGRES_ALL = `SELECT t.relname AS tbl, ic.relname AS name, CASE c.contype WHEN 'p' THEN 'pk' WHEN 'u' THEN 'u' ELSE 'c' END AS origin, i.indpred IS NOT NULL AS partial, i.indnatts AS ncols, a.attname AS col FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace LEFT JOIN pg_constraint c ON c.conindid = i.indexrelid AND c.conrelid = i.indrelid AND c.contype IN ('p', 'u') LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0] WHERE i.indisunique AND n.nspname = current_schema()`

const POSTGRES_TABLE = `${POSTGRES_ALL} AND t.relname = $1`

/** How one table's uniqueness differs from the shape this version writes. */
export interface UniqueShapeDrift {
  /** Names of the table-level single-column `UNIQUE` constraints to retire. */
  readonly legacy: readonly string[]
  /** Names of the unique indexes to drop so the declared shape is built again. */
  readonly stray: readonly string[]
  /** Declared unique columns held by a live-rows index that the catalog lacks. */
  readonly missing: readonly string[]
  /** Declared unique primary-key columns the catalog does not hold unique. */
  readonly missingKeyed: readonly string[]
}

/** A catalog row in the terms the comparison reads. */
interface CatalogIndex {
  readonly name: string
  readonly col: string | undefined
  readonly single: boolean
  readonly origin: string
  readonly partial: boolean
}

const toCatalogIndex = (row: LiveUniqueIndex): CatalogIndex => ({
  name: String(row.name),
  col: row.col === null || row.col === undefined ? undefined : String(row.col),
  single: Number(row.ncols) === 1,
  origin: String(row.origin),
  partial: Number(row.partial) === 1,
})

const named = (list: readonly CatalogIndex[]): readonly string[] => list.map((index) => index.name)

/** The names of every index `table` declares under `indexes`. */
const declaredIndexNames = (table: Table): ReadonlySet<string> =>
  new Set((table.indexes ?? []).map((index) => index.name))

/** The names of the unique indexes declared with a `where` on `table`. */
const partialIndexNames = (table: Table): ReadonlySet<string> =>
  new Set(
    (table.indexes ?? [])
      .filter((index) => index.unique === true && 'where' in index && !!index.where)
      .map((index) => index.name)
  )

/**
 * Compare one table's unique indexes, as the catalog lists them, with the shape
 * its definition declares.
 *
 * @public
 */
export const uniqueShapeDrift = (
  table: Table,
  rows: readonly LiveUniqueIndex[]
): UniqueShapeDrift => {
  const relation = getPhysicalTableName(table)
  const live = new Set(table.fields.filter(isLiveUniqueField(table)).map((field) => field.name))
  const keyed = new Set(
    table.fields
      .filter((field) => isBtreeUniqueField(field) && !live.has(field.name))
      .map((field) => field.name)
  )
  const indexes = rows.map(toCatalogIndex)
  const singles = indexes.filter((index) => index.single && index.col !== undefined)
  const isLiveIndex = (index: CatalogIndex): boolean =>
    index.origin === 'c' &&
    index.partial &&
    index.name === liveUniqueIndexName(relation, String(index.col))
  const enforced = (col: string): boolean =>
    singles.some((index) =>
      index.col !== col
        ? false
        : live.has(col)
          ? isLiveIndex(index)
          : index.origin === 'u' || index.origin === 'pk'
    )
  const partial = partialIndexNames(table)
  // A live-rows index whose name no longer matches its column: the field was
  // renamed (both engines keep the index, under its old name, on the new column).
  const renamed = (index: CatalogIndex): boolean =>
    index.origin === 'c' &&
    index.partial &&
    index.name.startsWith(`${tableConstraintPrefix(relation)}_`) &&
    index.name.endsWith('_key') &&
    index.name !== liveUniqueIndexName(relation, String(index.col)) &&
    !declaredIndexNames(table).has(index.name)
  return {
    legacy: named(singles.filter((i) => i.origin === 'u' && !keyed.has(String(i.col)))),
    stray: [
      ...named(singles.filter((i) => (isLiveIndex(i) && !live.has(String(i.col))) || renamed(i))),
      ...named(indexes.filter((i) => i.origin === 'c' && !i.partial && partial.has(i.name))),
    ],
    missing: [...live].filter((col) => !enforced(col)),
    missingKeyed: [...keyed].filter((col) => !enforced(col)),
  }
}

/** Whether `drift` asks for nothing. */
const isQuiet = (drift: UniqueShapeDrift): boolean =>
  drift.legacy.length === 0 &&
  drift.stray.length === 0 &&
  drift.missing.length === 0 &&
  drift.missingKeyed.length === 0

/** Read one table's unique indexes and compare them with its definition. */
export const readUniqueShapeDrift = (
  tx: TransactionLike,
  table: Table,
  physicalTableName: string = getPhysicalTableName(table)
): Effect.Effect<UniqueShapeDrift, SQLExecutionError> =>
  executeSQL(tx, isSqliteRuntime() ? SQLITE_TABLE : POSTGRES_TABLE, [physicalTableName]).pipe(
    Effect.map((rows) => uniqueShapeDrift(table, rows as readonly LiveUniqueIndex[]))
  )

/**
 * The statements that retire what the catalog holds beyond the declared shape:
 * on PostgreSQL the table-level constraints a live-rows index replaces, on both
 * engines the stray unique indexes. Run before the index sync, which then builds
 * the live-rows indexes under the names the constraints carried. SQLite's legacy
 * constraints are not here: only a rebuild removes them.
 *
 * @public
 */
export const uniqueShapeRepairStatements = (params: {
  readonly sqlite: boolean
  readonly physicalTableName: string
  readonly drift: UniqueShapeDrift
}): readonly string[] => {
  const { sqlite, physicalTableName, drift } = params
  const legacy = sqlite
    ? []
    : drift.legacy.map(
        (name) =>
          `ALTER TABLE ${quoteSqlIdentifier(physicalTableName)} DROP CONSTRAINT IF EXISTS ${quoteSqlIdentifier(name)}`
      )
  return [
    ...legacy,
    ...drift.stray.map((name) => `DROP INDEX IF EXISTS ${quoteSqlIdentifier(name)}`),
  ]
}

/** Whether the tables the database holds hold their declared uniqueness shape. */
const allTablesQuiet = (
  tables: readonly Table[],
  rows: readonly CatalogRow[],
  present: ReadonlySet<string>
): Table | undefined => {
  const byTable = Map.groupBy(rows, (row) => String(row.tbl))
  return tables.find((table) => {
    const physical = getPhysicalTableName(table)
    return present.has(physical) && !isQuiet(uniqueShapeDrift(table, byTable.get(physical) ?? []))
  })
}

/**
 * The boot fast path's probe, on both engines: whether every table the database
 * holds has the uniqueness shape its definition declares — and, on SQLite, the
 * CHECK clauses (`sqlite-check-drift.ts`). The checksum hashes the config alone,
 * so without it a database an earlier version created would keep its
 * constraints on every boot whose config did not move. A handful of catalog
 * queries for the whole database, whatever the table count.
 */
export const storedConstraintsCurrent = async (
  tx: TransactionLike,
  sqlite: boolean,
  tables: readonly Table[]
): Promise<boolean> => {
  if (sqlite && !(await sqliteCheckClausesCurrent((sql) => tx.unsafe(sql), tables))) return false
  // The config's tables as the migration reads their uniqueness (a top-level
  // `unique`, a key a `foreignKeys` entry references), not as authored.
  const declared = applyUniqueDefaults(tables)
  const rows = (await tx.unsafe(sqlite ? SQLITE_ALL : POSTGRES_ALL)) as readonly CatalogRow[]
  const present = (await tx.unsafe(
    sqlite
      ? `SELECT name FROM sqlite_master WHERE type = 'table'`
      : `SELECT tablename AS name FROM pg_tables WHERE schemaname = current_schema()`
  )) as readonly { readonly name: string }[]
  const stale = allTablesQuiet(declared, rows, new Set(present.map((row) => row.name)))
  if (stale === undefined) return true
  logDebug(
    '[schema] checksum matches but a table does not hold its unique fields in the declared shape — full migration',
    { table: stale.name }
  )
  return false
}
