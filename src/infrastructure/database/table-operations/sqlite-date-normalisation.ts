/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { isPhysicalColumnField } from '../sql/sql-field-predicates'
import type { Table } from '@/domain/models/app/tables'

/**
 * SQLite datetimes and times written before the write path normalised them.
 *
 * SQLite stores the text a value was written as. Until this version a datetime
 * kept its offset or its missing zone (`2026-09-30T16:00:00+02:00`,
 * `2026-09-30 14:00:00`) and a time its spelling (`8:05`); the write path now
 * stores a datetime as its UTC instant and a time as `HH:MM:SS`
 * (`normalizeDateValues`). The rows already in a table would otherwise keep
 * their old text until someone rewrote them — read back in a form the docs no
 * longer describe, and sorted and filtered by how they were spelled.
 *
 * The rewrite is the SQL form of the write path's: SQLite's
 * `strftime('%Y-%m-%dT%H:%M:%fZ', …)` reads an offset and takes a value with
 * no zone as UTC, exactly as `toUtcInstant` does; a value it cannot read is
 * left as it is, as the write path leaves it for the write to refuse. A table
 * whose values are all in the stored form matches no row, so the statement is
 * a scan and writes nothing.
 */

/** A datetime as the write path stores it: `2026-09-30T14:00:00.000Z`. */
const STORED_DATETIME =
  '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'

const utcInstant = (column: string): string => `strftime('%Y-%m-%dT%H:%M:%fZ', ${column})`

/** A datetime SQLite can read that is not yet in the stored form. */
const legacyDatetime = (column: string): string =>
  `(${column} NOT GLOB '${STORED_DATETIME}' AND ${utcInstant(column)} IS NOT NULL)`

/** `8:05` → `08:05:00`, `8:05:30` → `08:05:30`, `08:05` → `08:05:00`. */
const clockTime = (column: string): string => {
  const padded = `(CASE WHEN ${column} GLOB '[0-9]:*' THEN '0' || ${column} ELSE ${column} END)`
  return `(CASE WHEN length(${padded}) = 5 THEN ${padded} || ':00' ELSE ${padded} END)`
}

/**
 * A clock time typed `8:05`, `8:05:30` or `08:05` — every form but `HH:MM:SS` —
 * that names a real time: `25:99` is left as it is, as `toClockTime` leaves it.
 */
const legacyTime = (column: string): string =>
  `((${column} GLOB '[0-9]:[0-9][0-9]' OR ${column} GLOB '[0-9]:[0-9][0-9]:[0-9][0-9]*' OR ${column} GLOB '[0-9][0-9]:[0-9][0-9]') AND time(${clockTime(column)}) IS NOT NULL)`

/** Each physical `datetime` and `time` column of the table, quoted, with the rule that finds its legacy values. */
const dateColumns = (
  table: Table
): readonly { readonly column: string; readonly type: 'datetime' | 'time' }[] =>
  table.fields.flatMap((field) =>
    (field.type === 'datetime' || field.type === 'time') &&
    isPhysicalColumnField(field, table.fields)
      ? [{ column: quoteSqlIdentifier(field.name), type: field.type }]
      : []
  )

/** The condition a row holding a legacy value in `column` meets. */
const legacyValue = (entry: { readonly column: string; readonly type: 'datetime' | 'time' }) =>
  entry.type === 'datetime' ? legacyDatetime(entry.column) : legacyTime(entry.column)

/**
 * The statements that rewrite every legacy datetime and time of a SQLite table
 * into its stored form, one per column.
 *
 * The table's `updated_at` trigger is dropped around them and recreated from
 * `updatedAtTriggers` (its own `DROP` + `CREATE`), as the formula backfill does:
 * rewriting how a value is spelled is not an edit of the record, and must not
 * restamp it. The formula triggers still fire, so a formula reading the column
 * follows the rewritten value.
 */
export const generateSqliteDateNormalisation = (
  physicalTableName: string,
  table: Table,
  updatedAtTriggers: readonly string[]
): readonly string[] => {
  const columns = dateColumns(table)
  if (columns.length === 0) return []
  const relation = quoteSqlIdentifier(physicalTableName)
  const updates = columns.map((entry) => {
    const rewritten = entry.type === 'datetime' ? utcInstant(entry.column) : clockTime(entry.column)
    return `UPDATE ${relation} SET ${entry.column} = ${rewritten} WHERE ${legacyValue(entry)}`
  })
  return [...updatedAtTriggers.slice(0, 1), ...updates, ...updatedAtTriggers]
}

/**
 * A query answering `exists = 1` when a SQLite table still holds a legacy
 * datetime or time — the check that sends a boot whose config did not change
 * down the full migration once, so the rewrite reaches a deployment that
 * upgrades without editing its config. `undefined` for a table with neither.
 */
export const sqliteLegacyDateValuesQuery = (
  physicalTableName: string,
  table: Table
): string | undefined => {
  const columns = dateColumns(table)
  if (columns.length === 0) return undefined
  const condition = columns.map(legacyValue).join(' OR ')
  return `SELECT EXISTS (SELECT 1 FROM ${quoteSqlIdentifier(physicalTableName)} WHERE ${condition}) AS "exists"`
}
