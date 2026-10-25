/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  convertSqliteCell,
  postgresValueKind,
  readsThroughTextCast,
  type PostgresValueKind,
} from '@/domain/kernel/sql/sqlite-to-postgres-value-codec'
import { DERIVED_POSTGRES_COLUMNS, type TableCopy } from './sqlite-to-postgres-table-map'

/**
 * The statements one table's SQLite → PostgreSQL copy runs, and the checks that
 * decide them: which columns are written, how each is read from SQLite, how
 * each value is bound, and the error that names the cell a value stopped at.
 * The transaction around them is `sqlite-to-postgres-copy.ts`.
 */

/** One value or table that could not be copied. */
export class SqliteToPostgresCopyError extends Error {
  constructor(
    readonly table: string,
    readonly problem: string,
    readonly column?: string,
    readonly rowId?: string
  ) {
    super(problem)
    this.name = 'SqliteToPostgresCopyError'
  }
}

export interface TargetColumn {
  readonly name: string
  readonly type: string
  readonly notNull: boolean
  readonly hasDefault: boolean
  readonly generated: boolean
}

export interface SourceColumn {
  readonly name: string
  readonly type: string
  readonly pk: number
}

export type Sql = InstanceType<typeof Bun.SQL>

export const quote = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`
export const qualified = (copy: TableCopy): string => `${quote(copy.schema)}.${quote(copy.table)}`
export const label = (copy: TableCopy): string =>
  copy.schema === 'public' ? copy.table : `${copy.schema}.${copy.table}`
/** The columns one table's copy writes, with how each is read and converted. */
export interface ColumnPlan {
  readonly name: string
  readonly type: string
  readonly kind: PostgresValueKind
  readonly notNull: boolean
}

export const planColumns = (
  copy: TableCopy,
  source: readonly SourceColumn[],
  target: readonly TargetColumn[]
): readonly ColumnPlan[] => {
  const byName = new Map(target.map((column) => [column.name, column]))
  const missing = source.find((column) => !byName.has(column.name))
  if (missing !== undefined) {
    throw new SqliteToPostgresCopyError(
      label(copy),
      'the column does not exist in the PostgreSQL schema',
      missing.name
    )
  }
  const sourceNames = new Set(source.map((column) => column.name))
  const derived = derivedColumnsOf(copy)
  const unfillable = target.find(
    (column) =>
      column.notNull &&
      !column.hasDefault &&
      !column.generated &&
      !sourceNames.has(column.name) &&
      derived[column.name] === undefined
  )
  if (unfillable !== undefined) {
    throw new SqliteToPostgresCopyError(
      label(copy),
      'PostgreSQL requires a value and the backup has none',
      unfillable.name
    )
  }
  return source.flatMap((column) => {
    const targetColumn = byName.get(column.name)
    if (targetColumn === undefined || targetColumn.generated) return []
    return [
      {
        name: column.name,
        type: targetColumn.type,
        kind: postgresValueKind(targetColumn.type),
        notNull: targetColumn.notNull,
      },
    ]
  })
}

export const selectStatement = (
  table: string,
  columns: readonly ColumnPlan[],
  idColumn: string
) => {
  const expressions = columns.map((column) =>
    readsThroughTextCast(column.kind)
      ? `CAST(${quote(column.name)} AS TEXT) AS ${quote(column.name)}`
      : quote(column.name)
  )
  return `SELECT ${[...expressions, `CAST(${idColumn} AS TEXT) AS "__row_id"`].join(', ')} FROM ${quote(table)}`
}

const derivedColumnsOf = (copy: TableCopy): Readonly<Record<string, string>> =>
  DERIVED_POSTGRES_COLUMNS[`${copy.schema}.${copy.table}`] ?? {}

/**
 * One multi-row INSERT. Every value is bound as text and cast to its column's
 * type (bytes as `bytea`), and identity columns keep the copied ids. A table
 * with derived columns inserts from its VALUES list so each derived column is
 * computed from the row it belongs to.
 */
export const insertStatement = (copy: TableCopy, columns: readonly ColumnPlan[], rows: number) => {
  const placeholder = (column: ColumnPlan, index: number): string =>
    column.kind === 'bytea' ? `$${index}::bytea` : `$${index}::text::${column.type}`
  const tuples = Array.from(
    { length: rows },
    (_, row) =>
      `(${columns.map((column, offset) => placeholder(column, row * columns.length + offset + 1)).join(', ')})`
  )
  const names = columns.map((column) => quote(column.name))
  const derived = Object.entries(derivedColumnsOf(copy))
  if (derived.length === 0) {
    return `INSERT INTO ${qualified(copy)} (${names.join(', ')}) OVERRIDING SYSTEM VALUE VALUES ${tuples.join(', ')}`
  }
  const targetNames = [...names, ...derived.map(([name]) => quote(name))]
  const selected = [
    ...names.map((name) => `v.${name}`),
    ...derived.map(([, expression]) => expression),
  ]
  return `INSERT INTO ${qualified(copy)} (${targetNames.join(', ')}) OVERRIDING SYSTEM VALUE SELECT ${selected.join(', ')} FROM (VALUES ${tuples.join(', ')}) AS v (${names.join(', ')})`
}

/** Convert one SQLite row into bound parameters, or reject naming the cell. */
export const convertRow = (
  copy: TableCopy,
  columns: readonly ColumnPlan[],
  row: Readonly<Record<string, unknown>>
): readonly (string | Uint8Array | null)[] =>
  columns.map((column) => {
    const converted = convertSqliteCell(column.kind, row[column.name])
    const rowId = String(row['__row_id'] ?? '')
    if (!converted.ok) {
      throw new SqliteToPostgresCopyError(
        label(copy),
        `the value ${converted.problem}`,
        column.name,
        rowId
      )
    }
    if (converted.value === undefined && column.notNull) {
      throw new SqliteToPostgresCopyError(
        label(copy),
        'the value is empty, and PostgreSQL requires one',
        column.name,
        rowId
      )
    }
    return converted.value ?? null
  })
