/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getTableColumns, getTableName, is, sql, type SQL } from 'drizzle-orm'
import { SQLiteTable, SQLiteTimestamp } from 'drizzle-orm/sqlite-core'
import { DateTime, Layer, Option } from 'effect'
import {
  McpInternalsDatabaseError,
  McpInternalsRepository,
  type McpInternalColumn,
  type McpInternalColumnKind,
  type McpInternalEquality,
  type McpInternalListQuery,
} from '@/application/ports/repositories/mcp/mcp-internals-repository'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { db } from '@/infrastructure/database'
import * as sqliteSchema from '@/infrastructure/database/drizzle/schema-sqlite'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import {
  authTableRef,
  sqliteSystemTableName,
  systemTableRef,
} from '@/infrastructure/database/sql/dialect-sql'
import type { InternalTableEntry } from '@/domain/models/app/tables/internal-tables'

/** Wrap a DB promise, adapting failures to `McpInternalsDatabaseError`. */
const wrap = makeDbWrap((cause) => new McpInternalsDatabaseError({ cause }))

/**
 * A dialect-aware, safely-quoted table reference for an internal registry entry.
 *
 * Delegates to the same `authTableRef` / `systemTableRef` helpers the GDPR
 * erasure sweep uses, so the reference is correct on BOTH dialects:
 * `auth.session` / `system."links"` on Postgres, `auth_session` /
 * `system_links` on SQLite. A hand-spliced `${entry.schema}.${entry.name}` form
 * is Postgres-only and raises "no such table" on the zero-config SQLite default.
 */
const internalTableRef = (entry: Readonly<InternalTableEntry>) =>
  entry.schema === 'auth' ? authTableRef(entry.name) : systemTableRef(entry.name)

const isSqlite = (): boolean => parseDatabaseDialectConfig().dialect === 'sqlite'

/**
 * The columns of an internal table and their declared types, from the engine's
 * own catalogue. The table name is registry data, never client input, and is
 * still bound as a value.
 */
const sqliteTableName = (entry: Readonly<InternalTableEntry>): string =>
  entry.schema === 'auth' ? `auth_${entry.name}` : sqliteSystemTableName(entry.name)

const columnsQuery = (entry: Readonly<InternalTableEntry>): SQL =>
  isSqlite()
    ? sql`SELECT name AS column_name, type AS data_type FROM pragma_table_info(${sqliteTableName(entry)})`
    : sql`SELECT column_name, data_type FROM information_schema.columns
          WHERE table_schema = ${entry.schema} AND table_name = ${entry.name}`

const POSTGRES_NUMBER_TYPES = new Set([
  'smallint',
  'integer',
  'bigint',
  'numeric',
  'real',
  'double precision',
])
const POSTGRES_TEXT_TYPES = new Set(['text', 'character varying', 'character'])

/** A PostgreSQL `information_schema.columns.data_type`, folded into its family. */
const postgresColumnKind = (dataType: string): McpInternalColumnKind => {
  const type = dataType.toLowerCase()
  if (type === 'boolean') return 'boolean'
  if (POSTGRES_NUMBER_TYPES.has(type)) return 'number'
  if (type.startsWith('timestamp') || type === 'date') return 'time'
  if (type === 'uuid') return 'uuid'
  if (POSTGRES_TEXT_TYPES.has(type)) return 'text'
  if (type === 'json' || type === 'jsonb') return 'json'
  return 'other'
}

/** SQLite's affinity rules, in its own order of precedence, JSON first. */
const SQLITE_AFFINITY_RULES: ReadonlyArray<
  readonly [ReadonlyArray<string>, McpInternalColumnKind]
> = [
  [['JSON'], 'json'],
  [['INT'], 'number-or-boolean'],
  [['CHAR', 'CLOB', 'TEXT'], 'text'],
  [['BLOB'], 'other'],
  [['REAL', 'FLOA', 'DOUB'], 'number'],
]

/**
 * A SQLite declared type, folded into its family by SQLite's own affinity
 * rules: an integer column is also where a boolean lives, so it takes either.
 * The epoch-millisecond time columns stored there are told apart by the
 * caller, from the table's schema.
 */
const sqliteColumnKind = (declaredType: string): McpInternalColumnKind => {
  const type = declaredType.toUpperCase()
  if (type === '') return 'other'
  const rule = SQLITE_AFFINITY_RULES.find(([fragments]) =>
    fragments.some((fragment) => type.includes(fragment))
  )
  return rule === undefined ? 'number-or-boolean' : rule[1]
}

/**
 * Which integer columns of an internal SQLite table hold a time.
 *
 * SQLite stores an instant as epoch milliseconds in an INTEGER column, so its
 * catalogue cannot tell `created_at` from `duration_ms` or a flag: both declare
 * `integer`. The Drizzle SQLite schema can — a time is declared
 * `integer(…, { mode: 'timestamp_ms' })` — so the time columns are read from it,
 * keyed by physical table name (`system_automation_runs`, `auth_user`) and
 * physical column name.
 */
export const timeColumnsFromSchema = (
  exports: Readonly<Record<string, unknown>>
): ReadonlyMap<string, ReadonlySet<string>> =>
  new Map(
    Object.values(exports)
      .filter((value): value is SQLiteTable => is(value, SQLiteTable))
      .map((table) => [
        getTableName(table),
        new Set(
          Object.values(getTableColumns(table))
            .filter((column) => is(column, SQLiteTimestamp) && column.mode === 'timestamp_ms')
            .map((column) => column.name)
        ),
      ])
  )

const SCHEMA_TIME_COLUMNS = timeColumnsFromSchema(sqliteSchema)

/**
 * The time columns assumed for a table the SQLite schema does not declare: the
 * creation and event times every internal table names alike.
 */
const FALLBACK_TIME_COLUMNS: ReadonlySet<string> = new Set([
  'created_at',
  'submitted_at',
  'paused_at',
])

/**
 * Whether an INTEGER column of a SQLite internal table holds an epoch-millisecond
 * time: as the table's schema declares it, or by name when no schema is found.
 *
 * @param tableName - the physical SQLite table name (`system_automation_runs`)
 * @param columnName - the physical column name (`started_at`)
 * @param schema - the declared time columns per table; the Drizzle schema's by default
 */
export const isSqliteTimeColumn = (
  tableName: string,
  columnName: string,
  schema: ReadonlyMap<string, ReadonlySet<string>> = SCHEMA_TIME_COLUMNS
): boolean => (schema.get(tableName) ?? FALLBACK_TIME_COLUMNS).has(columnName)

/**
 * A catalogue row as a column of `entry`. On SQLite an integer column the
 * table's schema declares as a timestamp is a time column, so a `where` on it
 * takes an ISO instant exactly as on PostgreSQL.
 */
const toColumn =
  (entry: Readonly<InternalTableEntry>) =>
  (row: Readonly<Record<string, unknown>>): McpInternalColumn => {
    const name = String(row['column_name'])
    const dataType = String(row['data_type'] ?? '')
    if (!isSqlite()) return { name, kind: postgresColumnKind(dataType) }
    const kind = sqliteColumnKind(dataType)
    const isTime = kind === 'number-or-boolean' && isSqliteTimeColumn(sqliteTableName(entry), name)
    return { name, kind: isTime ? 'time' : kind }
  }

/**
 * An instant as the time column stores it: `timestamptz` on PostgreSQL, epoch
 * milliseconds (`timestamp_ms`) on SQLite.
 */
const instantValue = (instant: Date): SQL =>
  isSqlite() ? sql`${instant.getTime()}` : sql`CAST(${instant.toISOString()} AS timestamptz)`

/**
 * An ISO instant (validated upstream) as the epoch milliseconds a SQLite time
 * column stores; a bare date reads as UTC midnight, as `since` does.
 */
const epochMillis = (value: McpInternalEquality['value']): McpInternalEquality['value'] =>
  typeof value === 'string'
    ? Option.match(DateTime.make(value), {
        onNone: () => value,
        onSome: (instant) => DateTime.toEpochMillis(instant),
      })
    : value

/** The PostgreSQL type a bound value is cast to, per family; the rest compare as bound. */
const POSTGRES_CASTS: Partial<Record<McpInternalColumnKind, string>> = {
  number: 'numeric',
  time: 'timestamptz',
  uuid: 'uuid',
}

/**
 * The bound value, compared as its column's type. PostgreSQL is told the type
 * explicitly, because a bound string would otherwise reach a numeric, time or
 * uuid column as `text` and fail to compare; SQLite applies the column's
 * affinity to the operand by itself.
 */
const typedValue = (equality: McpInternalEquality): SQL => {
  if (isSqlite() && equality.kind === 'time') return sql`${epochMillis(equality.value)}`
  const value = sql`${equality.value}`
  const cast = POSTGRES_CASTS[equality.kind]
  // sql-literal: keyword -- `cast` is a value of the fixed POSTGRES_CASTS table
  return isSqlite() || cast === undefined ? value : sql`CAST(${value} AS ${sql.raw(cast)})`
}

/**
 * The column side of an equality. A PostgreSQL `timestamptz` holds microseconds
 * while a row answers its instant to the millisecond, so a time column is
 * compared truncated to the millisecond: a value copied from an answer, pasted
 * back unchanged, then finds its row on both engines. SQLite already stores
 * whole milliseconds.
 */
const comparedColumn = (equality: McpInternalEquality): SQL => {
  const column = sql.identifier(equality.column)
  return equality.kind === 'time' && !isSqlite()
    ? sql`date_trunc('milliseconds', ${column})`
    : sql`${column}`
}

const equalityCondition = (equality: McpInternalEquality): SQL =>
  equality.value === null
    ? sql`${sql.identifier(equality.column)} IS NULL`
    : sql`${comparedColumn(equality)} = ${typedValue(equality)}`

/**
 * Strictly after the cursor row, in the list's own order. The cursor row is
 * found by its id as text, so an integer key and a text key page alike; an id
 * that matches no row yields no row, which reads as the end of the list.
 */
const afterCondition = (ref: SQL, timeColumn: string | undefined, after: string): SQL => {
  const id = sql.identifier('id')
  const cursorRow = sql`FROM ${ref} WHERE CAST(${id} AS TEXT) = ${after}`
  if (timeColumn === undefined) return sql`${id} < (SELECT ${id} ${cursorRow})`
  const time = sql.identifier(timeColumn)
  return sql`(${time}, ${id}) < (SELECT ${time}, ${id} ${cursorRow})`
}

/**
 * One page of a raw list over `ref`, answering `projection`: the order, `since`,
 * `where` and `after` rules every raw list follows, the tool-call ledger's
 * included. Column names reach SQL only through `sql.identifier`, and only
 * after the caller checked them against the catalogue; every value is bound (S3).
 */
export const rawListStatement = (ref: SQL, projection: SQL, query: McpInternalListQuery): SQL => {
  const { timeColumn } = query
  const conditions: ReadonlyArray<SQL> = [
    ...(query.since !== undefined && timeColumn !== undefined
      ? [sql`${sql.identifier(timeColumn)} >= ${instantValue(query.since)}`]
      : []),
    ...query.where.map(equalityCondition),
    ...(query.after !== undefined ? [afterCondition(ref, timeColumn, query.after)] : []),
  ]
  const whereClause =
    conditions.length === 0 ? sql`` : sql`WHERE ${sql.join([...conditions], sql` AND `)}`
  const orderBy =
    timeColumn === undefined
      ? sql`ORDER BY ${sql.identifier('id')} DESC`
      : sql`ORDER BY ${sql.identifier(timeColumn)} DESC, ${sql.identifier('id')} DESC`
  // `LIMIT` stays an inlined SQL literal (the caller clamps it to an integer in
  // `[1, 1000]`) because `LIMIT $1` round-trips poorly through bun:sql's
  // param-binding path; the value can never be anything but a small integer.
  // sql-literal: number -- a floored integer the caller clamped to [1, 1000]
  const limit = sql.raw(String(Math.floor(query.limit)))
  return sql`SELECT ${projection} FROM ${ref} ${whereClause} ${orderBy} LIMIT ${limit}`
}

/**
 * A raw SQLite row with each time column answered as the UTC ISO 8601 instant
 * PostgreSQL answers, instead of the epoch milliseconds SQLite stores. Only the
 * columns the table's schema declares a time change; a duration or a flag kept
 * in an INTEGER column stays the number it is.
 *
 * @param tableName - the physical SQLite table name (`system_automation_runs`)
 * @param row - the row as the driver answered it
 */
export const withSqliteInstants = (
  tableName: string,
  row: Readonly<Record<string, unknown>>,
  schema: ReadonlyMap<string, ReadonlySet<string>> = SCHEMA_TIME_COLUMNS
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(row).map(([column, value]) =>
      typeof value === 'number' && isSqliteTimeColumn(tableName, column, schema)
        ? [column, new Date(value).toISOString()]
        : [column, value]
    )
  )

/** Rows answered by the engine, time columns as ISO instants on SQLite (PostgreSQL already is). */
export const answeredRows = <Row extends object>(
  tableName: string,
  rows: ReadonlyArray<Row>
): ReadonlyArray<Row> =>
  isSqlite()
    ? rows.map(
        (row) => withSqliteInstants(tableName, row as Readonly<Record<string, unknown>>) as Row
      )
    : rows

export const McpInternalsRepositoryLive = Layer.succeed(McpInternalsRepository, {
  listColumns: (entry: Readonly<InternalTableEntry>) =>
    wrap(async () => {
      const rows = await executeRaw(db, columnsQuery(entry))
      return rows.map(toColumn(entry))
    }),

  // Column names reach SQL only through `sql.identifier`, and only after the
  // caller checked them against `listColumns`; every value is bound (S3).
  listRows: (entry: Readonly<InternalTableEntry>, query: McpInternalListQuery) =>
    wrap(async () =>
      answeredRows(
        sqliteTableName(entry),
        await executeRaw(db, rawListStatement(internalTableRef(entry), sql.raw('*'), query))
      )
    ),

  readRow: (entry: Readonly<InternalTableEntry>, id: string) =>
    wrap(async () => {
      // `id` is first-order user input (`args.id` off the JSON-RPC envelope),
      // so it is bound as a VALUE through the `sql` template tag — never
      // spliced as text. Quote doubling is not an escaping strategy; it is a
      // coincidence that holds until the first backslash or dollar-quote (S3).
      const rows = await executeRaw(
        db,
        sql`SELECT * FROM ${internalTableRef(entry)} WHERE id = ${id} LIMIT 1`
      )
      return answeredRows(sqliteTableName(entry), rows)[0]
    }),
})
