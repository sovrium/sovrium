/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `Date` a database driver decoded, read the way the records API reads it.
 *
 * PostgreSQL decodes a `date` and a timestamp to a `Date`; SQLite hands back
 * the text it stored. So every road that hands a row on — the records API, an
 * automation's read, a grouping key, a webhook's previous values, a record
 * printed on a page, a form skeleton — reads a driver `Date` through here, and
 * PostgreSQL answers what SQLite does:
 *
 *  - a column that reads as a day ({@link readsAsDay}: a `date` field, a
 *    `MIN`/`MAX` rollup over one, a formula whose result is a date) is its day,
 *    `YYYY-MM-DD`, on the UTC calendar — PostgreSQL decodes a `date` at UTC
 *    midnight, so the server's own time zone never moves the day;
 *  - anything else is its ISO 8601 instant.
 *
 * Every value that is not a valid `Date` passes unchanged.
 */

import { readsAsDay } from './min-max-order-service'

/** The tables a column's day-ness is read from (the app, or any object carrying its tables). */
export type DriverValueApp = Parameters<typeof readsAsDay>[0]

/** Which table a row belongs to, so its columns can be told apart. */
export interface DriverRowSchema {
  readonly app?: DriverValueApp | undefined
  readonly tableName?: string | undefined
}

/** A driver's `Date` as its UTC day (`asDay`) or its ISO instant; anything else unchanged. */
export const readDriverValue = (value: unknown, asDay: boolean): unknown => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return value
  const instant = value.toISOString()
  return asDay ? instant.slice(0, 10) : instant
}

/** Whether a column of `schema`'s table reads as a day; `false` when the table is unknown. */
export const columnReadsAsDay = (schema: DriverRowSchema | undefined, column: string): boolean =>
  schema?.app !== undefined &&
  schema.tableName !== undefined &&
  readsAsDay(schema.app, schema.tableName, column)

/** One value of a row, read as {@link readDriverValue} reads it for its column. */
export const serializeDriverValue = (
  column: string,
  value: unknown,
  schema: DriverRowSchema | undefined
): unknown =>
  value instanceof Date ? readDriverValue(value, columnReadsAsDay(schema, column)) : value

/** A row with every driver `Date` read as the records API reads it (see the module note). */
export const serializeDriverRow = (
  row: Readonly<Record<string, unknown>>,
  schema: DriverRowSchema
): Readonly<Record<string, unknown>> =>
  Object.values(row).some((value) => value instanceof Date)
    ? Object.fromEntries(
        Object.entries(row).map(([column, value]) => [
          column,
          serializeDriverValue(column, value, schema),
        ])
      )
    : row
