/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Single-field uniqueness on a table that already exists, read from the LIVE
 * catalog rather than from the previous config (see `live-unique-shape.ts`).
 *
 * Three consumers, one reading:
 *
 * - **The SQLite rebuild.** A table-level `UNIQUE` lives in the stored
 *   `CREATE TABLE` text, which no `ALTER TABLE` rewrites. A table still holding
 *   one over a field a live-rows index now holds — a database an earlier version
 *   created — is rebuilt without it, as is a table whose unique primary key is
 *   not enforced.
 * - **The duplicate pre-flight**, on both engines, before any DDL: a field
 *   becoming unique over LIVE rows that share a value is refused with the value
 *   named, instead of failing on the driver's own message, which names none.
 *   Duplicates sitting in the trash do not count: the index ignores them.
 * - **The dry run**, which names each index a field would gain and reports the
 *   same refusal.
 *
 * "Becoming unique" means declared unique and not held in the declared shape by
 * the live catalog, so an applied change plans nothing and probes nothing.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { getPhysicalTableName } from '../lookup/lookup-view-generators'
import { executeSQL, SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import {
  isBtreeUniqueField,
  LIVE_ROWS_PREDICATE,
  liveUniqueIndexName,
} from '../sql/sql-key-constraints'
import { readUniqueShapeDrift } from './live-unique-shape'
import { sqliteCheckClausesStale } from './sqlite-check-drift'
import { sqliteForeignKeyTargetsStale } from './sqlite-foreign-key-target-drift'
import type { Table } from '@/domain/models/app/tables'

type Field = Table['fields'][number]

/** How many duplicated values a refusal names. */
const MAX_LISTED = 3

/** How many characters of one duplicated value a refusal shows. */
const MAX_VALUE_LENGTH = 80

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

/** One `GROUP BY` probe over the non-NULL values of `column` among live rows. */
const probeDuplicates = (
  query: (sql: string) => Effect.Effect<readonly unknown[], SQLExecutionError>,
  tableName: string,
  physicalTableName: string,
  column: string
): Effect.Effect<readonly string[], SQLExecutionError> => {
  const quoted = quoteSqlIdentifier(column)
  return query(
    `SELECT ${quoted} AS dup_value, COUNT(*) AS dup_rows, SUM(COUNT(*)) OVER () AS dup_total, COUNT(*) OVER () AS dup_values FROM ${quoteSqlIdentifier(physicalTableName)} WHERE ${quoted} IS NOT NULL AND ${LIVE_ROWS_PREDICATE} GROUP BY ${quoted} HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC LIMIT ${MAX_LISTED}`
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
    : query(
        `SELECT COUNT(*) AS n FROM ${quoteSqlIdentifier(physicalTableName)} WHERE ${LIVE_ROWS_PREDICATE}`
      ).pipe(
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
    const drift = yield* readUniqueShapeDrift(tx, table, source)
    const missing = new Set([...drift.missing, ...drift.missingKeyed])
    const becoming = table.fields.filter((field) => missing.has(field.name))
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
 * The plan lines for the columns becoming unique: the live-rows index the index
 * sync creates, on both engines.
 *
 * @public
 */
export const uniquePlanLines = (params: {
  readonly physicalTableName: string
  readonly columns: readonly string[]
}): readonly string[] =>
  params.columns.map(
    (column) =>
      `CREATE UNIQUE INDEX ${liveUniqueIndexName(params.physicalTableName, column)} ON ${params.physicalTableName} (${quoteSqlIdentifier(column)}) WHERE ${LIVE_ROWS_PREDICATE}`
  )

/**
 * Whether an existing SQLite table must be rebuilt for its definition to hold:
 * its CHECK clauses differ from the declared ones, it still holds a table-level
 * `UNIQUE` a live-rows index replaces, its unique primary key is not enforced,
 * or a foreign key names a relation that no longer holds the referenced rows
 * (`sqliteForeignKeyTargetsStale`). Always `false` on PostgreSQL, which syncs
 * them in place.
 */
export const sqliteConstraintsStale = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<boolean, SQLExecutionError> =>
  Effect.gen(function* () {
    if (!isSqliteRuntime()) return false
    if (yield* sqliteCheckClausesStale(tx, table)) return true
    if (yield* sqliteForeignKeyTargetsStale(tx, table)) return true
    const drift = yield* readUniqueShapeDrift(tx, table)
    return drift.legacy.length > 0 || drift.missingKeyed.length > 0
  })
