/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Single-field uniqueness on a table that already exists, read from the LIVE
 * catalog rather than from the previous config.
 *
 * Three consumers, one reading:
 *
 * - **The SQLite rebuild.** A single-field `UNIQUE` lives in the stored
 *   `CREATE TABLE` text, which `ALTER TABLE … ADD COLUMN` never rewrites. A
 *   unique field added to a populated table, or `unique` turned on or off in an
 *   edit that also adds a field, therefore left the table as it was. The table
 *   is rebuilt whenever the stored set of single-field unique columns is not the
 *   declared one, which also repairs a database an earlier version left without
 *   the constraint.
 * - **The duplicate pre-flight**, on both engines, before any DDL: a field
 *   becoming unique over rows that share a value is refused with the value
 *   named, instead of failing on the driver's own message, which names none.
 * - **The dry run**, which names each constraint a field would gain and
 *   reports the same refusal.
 *
 * "Becoming unique" means declared unique and not unique in the live catalog,
 * so an applied change plans nothing and probes nothing.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { logDebug } from '@/infrastructure/logging/logger'
import { getPhysicalTableName } from '../lookup/lookup-view-generators'
import { executeSQL, SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import { isBtreeUniqueField, tableConstraintPrefix } from '../sql/sql-key-constraints'
import { sqliteCheckClausesCurrent, sqliteCheckClausesStale } from './sqlite-check-drift'
import type { Table } from '@/domain/models/app/tables'

type Field = Table['fields'][number]

/** How many duplicated values a refusal names. */
const MAX_LISTED = 3

/** How many characters of one duplicated value a refusal shows. */
const MAX_VALUE_LENGTH = 80

/**
 * The single-column unique indexes of a SQLite table, from the `pragma_index_list`
 * row `il` of the table `il` was listed for: `origin = 'u'` is a `UNIQUE`
 * constraint (never a `CREATE INDEX`), `'pk'` the primary key, and the column
 * count keeps composite ones out.
 *
 * The primary key is read because SQLite FOLDS a `UNIQUE` constraint over the
 * primary-key column into the primary key's own index: a field that is both the
 * single-field key and declared unique never shows a `'u'` index, and without
 * the `'pk'` row it read as unenforced, so the table was rebuilt on every boot.
 */
const SQLITE_SINGLE_COLUMN_INDEX = `il.origin IN ('u', 'pk') AND (SELECT COUNT(*) FROM pragma_index_info(il.name)) = 1`

/** The single-column unique indexes of one SQLite table. */
const SQLITE_UNIQUE_COLUMNS = `SELECT ii.name AS col, il.origin AS origin FROM pragma_index_list($1) AS il JOIN pragma_index_info(il.name) AS ii WHERE ${SQLITE_SINGLE_COLUMN_INDEX}`

/** The single-field UNIQUE constraints of one PostgreSQL table in the current schema. */
const POSTGRES_UNIQUE_COLUMNS = `SELECT a.attname AS col FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1] WHERE c.contype = 'u' AND array_length(c.conkey, 1) = 1 AND t.relname = $1 AND n.nspname = current_schema()`

/** One single-column unique index, as the catalog lists it. */
interface LiveUniqueIndex {
  readonly col: unknown
  /** SQLite's `pragma_index_list.origin`; absent on PostgreSQL, which reads constraints only. */
  readonly origin?: unknown
}

/**
 * The columns whose values the live table already holds unique, in the terms
 * the declared set is compared in: a UNIQUE constraint, or the single-column
 * primary key of a field also declared unique (see
 * {@link SQLITE_SINGLE_COLUMN_INDEX}). A primary key the config does not
 * declare unique is left out, or every keyed table would read as drifted.
 *
 * @public
 */
export const liveUniqueColumnsOf = (
  table: Table,
  indexes: readonly LiveUniqueIndex[]
): ReadonlySet<string> => {
  const declared = new Set(table.fields.filter(isBtreeUniqueField).map((field) => field.name))
  return new Set(
    indexes
      .map((index) => ({ col: String(index.col), primaryKey: index.origin === 'pk' }))
      .filter((index) => !index.primaryKey || declared.has(index.col))
      .map((index) => index.col)
  )
}

/** The columns of `physicalTableName` that `table`'s live catalog holds unique today. */
const readLiveUniqueColumns = (
  tx: TransactionLike,
  table: Table,
  physicalTableName: string
): Effect.Effect<ReadonlySet<string>, SQLExecutionError> =>
  executeSQL(tx, isSqliteRuntime() ? SQLITE_UNIQUE_COLUMNS : POSTGRES_UNIQUE_COLUMNS, [
    physicalTableName,
  ]).pipe(Effect.map((rows) => liveUniqueColumnsOf(table, rows as readonly LiveUniqueIndex[])))

/**
 * The fields declared unique that the live table does not enforce yet — the
 * same rule (`isBtreeUniqueField`) the CREATE and the PostgreSQL sync apply.
 *
 * @public
 */
export const fieldsBecomingUnique = (
  table: Table,
  liveUnique: ReadonlySet<string>
): readonly Field[] =>
  table.fields.filter((field) => isBtreeUniqueField(field) && !liveUnique.has(field.name))

/**
 * Whether the live single-field unique columns are other than the declared
 * ones, in either direction.
 *
 * @public
 */
export const uniqueColumnsDiffer = (table: Table, liveUnique: ReadonlySet<string>): boolean => {
  const declared = new Set(table.fields.filter(isBtreeUniqueField).map((field) => field.name))
  return declared.size !== liveUnique.size || [...declared].some((name) => !liveUnique.has(name))
}

/**
 * The value an ADDED field's default gives every existing row, or `undefined`
 * when the column gets no shared value. `ADD COLUMN … DEFAULT` fills the rows
 * already there on both engines, whether or not the field is required.
 *
 * @public
 */
export const sharedDefaultOf = (field: Field): string | undefined => {
  const value = (field as { readonly default?: unknown }).default
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value !== 'string' || value === '' || value.startsWith('$')) return undefined
  return value
}

const plural = (count: number): string => (count === 1 ? 'row' : 'rows')

/** A duplicated value as a refusal shows it: quoted, and cut to {@link MAX_VALUE_LENGTH}. */
const showValue = (value: string): string =>
  JSON.stringify(value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value)

/**
 * The refusal for a field becoming unique over rows that share a value. Names
 * at most {@link MAX_LISTED} duplicated values, each cut to
 * {@link MAX_VALUE_LENGTH} characters, and never a value held once. The values
 * are user data, and the refusal reaches the boot log and, when error
 * reporting is on, the error store: the caps bound what either receives.
 *
 * @public
 */
export const formatDuplicateRefusal = (params: {
  readonly tableName: string
  readonly column: string
  readonly rowCount: number
  readonly values: readonly { readonly value: string; readonly rows: number }[]
  readonly valueCount: number
}): string => {
  const { tableName, column, rowCount, values, valueCount } = params
  const listed = values.map((entry) => `    ${showValue(entry.value)}: ${entry.rows} rows`)
  const remainder =
    valueCount > values.length ? [`    … and ${valueCount - values.length} more value(s)`] : []
  return [
    `\`${tableName}.${column}\` cannot take a unique constraint: ${rowCount} ${plural(rowCount)} hold ${valueCount === 1 ? 'the same value' : `${valueCount} duplicated values`}`,
    '',
    ...listed,
    ...remainder,
    '',
    'Remove the duplicates, or leave unique off for this field.',
    'Nothing has been changed.',
  ].join('\n')
}

/**
 * The refusal for a unique field ADDED with a default every existing row would share.
 *
 * @public
 */
export const formatSharedDefaultRefusal = (params: {
  readonly tableName: string
  readonly column: string
  readonly rowCount: number
  readonly value: string
}): string =>
  [
    `\`${params.tableName}.${params.column}\` cannot be added with a unique constraint: its default ${JSON.stringify(params.value)} would be given to all ${params.rowCount} existing rows`,
    '',
    'Add the field without the default, or without unique until each row has its own value.',
    'Nothing has been changed.',
  ].join('\n')

/** One `GROUP BY` probe over the non-NULL values of `column`. */
const probeDuplicates = (
  query: (sql: string) => Effect.Effect<readonly unknown[], SQLExecutionError>,
  tableName: string,
  physicalTableName: string,
  column: string
): Effect.Effect<readonly string[], SQLExecutionError> => {
  const quoted = quoteSqlIdentifier(column)
  return query(
    `SELECT ${quoted} AS dup_value, COUNT(*) AS dup_rows, SUM(COUNT(*)) OVER () AS dup_total, COUNT(*) OVER () AS dup_values FROM ${quoteSqlIdentifier(physicalTableName)} WHERE ${quoted} IS NOT NULL GROUP BY ${quoted} HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC LIMIT ${MAX_LISTED}`
  ).pipe(
    Effect.map((raw) => {
      const rows = raw as readonly Record<string, unknown>[]
      const first = rows[0]
      if (first === undefined) return []
      const values = rows.map((row) => ({
        value: String(row['dup_value']),
        rows: Number(row['dup_rows']),
      }))
      return [
        formatDuplicateRefusal({
          tableName,
          column,
          rowCount: Number(first['dup_total']),
          values,
          valueCount: Number(first['dup_values']),
        }),
      ]
    })
  )
}

/** The refusal for each added unique field whose default two or more rows would share. */
const probeSharedDefaults = (
  query: (sql: string) => Effect.Effect<readonly unknown[], SQLExecutionError>,
  tableName: string,
  physicalTableName: string,
  added: readonly { readonly column: string; readonly value: string }[]
): Effect.Effect<readonly string[], SQLExecutionError> =>
  added.length === 0
    ? Effect.succeed([])
    : query(`SELECT COUNT(*) AS n FROM ${quoteSqlIdentifier(physicalTableName)}`).pipe(
        Effect.map((rows) => {
          const rowCount = Number((rows[0] as { readonly n?: unknown } | undefined)?.n ?? 0)
          return rowCount < 2
            ? []
            : added.map((entry) => formatSharedDefaultRefusal({ tableName, rowCount, ...entry }))
        })
      )

/** What one existing table would gain in uniqueness, and why it would be refused. */
export interface UniquePlan {
  /** The physical columns becoming unique, in declaration order. */
  readonly columns: readonly string[]
  readonly refusals: readonly string[]
}

/**
 * Read the live catalog and probe the rows for every field becoming unique.
 * Read-only: `SELECT`s only, so the dry run reuses it verbatim. A table that
 * declares no unique field issues no query.
 */
export const planUniqueChanges = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  /** The relation that holds the rows today. */
  readonly source: string
  readonly existingColumns: ReadonlyMap<string, unknown>
}): Effect.Effect<UniquePlan, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, source, existingColumns } = params
    if (!table.fields.some(isBtreeUniqueField)) return { columns: [], refusals: [] }
    const becoming = fieldsBecomingUnique(table, yield* readLiveUniqueColumns(tx, table, source))
    const query = (sql: string) => executeSQL(tx, sql)
    const existing = becoming.filter((field) => existingColumns.has(field.name))
    const duplicates = yield* Effect.forEach(existing, (field) =>
      probeDuplicates(query, table.name, source, field.name)
    )
    const added = becoming.flatMap((field) => {
      const value = existingColumns.has(field.name) ? undefined : sharedDefaultOf(field)
      return value === undefined ? [] : [{ column: field.name, value }]
    })
    const shared = yield* probeSharedDefaults(query, table.name, source, added)
    return {
      columns: becoming.map((field) => field.name),
      refusals: [...duplicates.flat(), ...shared],
    }
  })

/**
 * Refuse, before any DDL, a migration that would make a field unique over rows
 * that share a value. Both engines; schema initialisation is one transaction,
 * so nothing else in the same edit is applied either.
 */
export const guardUniqueDuplicates = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  readonly existingColumns: ReadonlyMap<string, unknown>
}): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, existingColumns } = params
    const source = getPhysicalTableName(table)
    const { refusals } = yield* planUniqueChanges({ tx, table, source, existingColumns })
    if (refusals.length === 0) return
    return yield* new SQLExecutionError({ message: refusals.join('\n\n') })
  })

/**
 * The plan lines for the columns becoming unique: the statement PostgreSQL's
 * constraint sync runs, or, on SQLite, the rebuild that writes the constraint
 * into the table definition.
 *
 * @public
 */
export const uniquePlanLines = (params: {
  readonly sqlite: boolean
  readonly tableName: string
  readonly physicalTableName: string
  readonly columns: readonly string[]
}): readonly string[] =>
  params.columns.map((column) =>
    params.sqlite
      ? `rebuild table ${params.physicalTableName} to enforce UNIQUE (${quoteSqlIdentifier(column)})`
      : `ALTER TABLE ${params.physicalTableName} ADD CONSTRAINT ${tableConstraintPrefix(params.tableName)}_${column}_key UNIQUE (${quoteSqlIdentifier(column)})`
  )

/**
 * Whether an existing SQLite table must be rebuilt for its definition to hold:
 * its CHECK clauses or its single-field unique columns differ from the
 * declared ones. Always `false` on PostgreSQL, which syncs both in place.
 */
export const sqliteConstraintsStale = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<boolean, SQLExecutionError> =>
  Effect.gen(function* () {
    if (!isSqliteRuntime()) return false
    if (yield* sqliteCheckClausesStale(tx, table)) return true
    const live = yield* readLiveUniqueColumns(tx, table, getPhysicalTableName(table))
    return uniqueColumnsDiffer(table, live)
  })

/**
 * The boot fast path's probe: whether every SQLite table enforces the CHECK
 * clauses and the single-field unique columns its definition declares. A table
 * the database does not hold yet is not stale.
 *
 * Every boot of a checksum-matched SQLite app runs it, so it costs one catalog
 * query for the whole database, whatever the table count (about 4 µs per
 * table, measured at 1,000 tables), grouped once rather than filtered per table.
 */
export const sqliteConstraintsCurrent = async (
  tx: TransactionLike,
  tables: readonly Table[]
): Promise<boolean> => {
  if (!(await sqliteCheckClausesCurrent((sql) => tx.unsafe(sql), tables))) return false
  const rows = (await tx.unsafe(
    `SELECT m.name AS tbl, ii.name AS col, il.origin AS origin FROM sqlite_master AS m JOIN pragma_index_list(m.name) AS il JOIN pragma_index_info(il.name) AS ii WHERE m.type = 'table' AND ${SQLITE_SINGLE_COLUMN_INDEX}`
  )) as readonly (LiveUniqueIndex & { readonly tbl: string })[]
  const present = (await tx.unsafe(
    `SELECT name FROM sqlite_master WHERE type = 'table'`
  )) as readonly { readonly name: string }[]
  const tablesPresent = new Set(present.map((row) => row.name))
  const byTable = Map.groupBy(rows, (row) => row.tbl)
  const stale = tables.find((table) => {
    const physical = getPhysicalTableName(table)
    if (!tablesPresent.has(physical)) return false
    return uniqueColumnsDiffer(table, liveUniqueColumnsOf(table, byTable.get(physical) ?? []))
  })
  if (stale === undefined) return true
  logDebug(
    '[schema] checksum matches but a table does not enforce the unique fields it declares — full migration',
    { table: stale.name }
  )
  return false
}
