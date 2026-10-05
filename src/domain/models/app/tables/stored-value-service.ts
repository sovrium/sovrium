/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A stored row with its typed fields read as the records list compares them.
 *
 * A row-level rule is answered in two places. The records list answers it in
 * SQL, where the database compares a number as a number and a date as a date.
 * A single read, an update, a delete, a restore and the history fetch the row
 * and answer the same rule in memory. Both must reach the same verdict for
 * every stored shape, or a row the list hides is one an update can still write.
 *
 * The drivers hand the same value back in different shapes, so every gate that
 * judges a fetched row reads it here first:
 *
 *  - a boolean (`checkbox`) — SQLite stores `1`/`0`, PostgreSQL a real boolean;
 *    both read as `true`/`false`;
 *  - a number (`integer`, `decimal`, `currency`…) — a driver may return a
 *    `bigint` or the text of a decimal; both read as a JS number;
 *  - a `date` — PostgreSQL returns a `Date` at UTC midnight, SQLite the
 *    `YYYY-MM-DD` text; both read as `YYYY-MM-DD`;
 *  - a `datetime` — PostgreSQL returns a `Date`, SQLite the instant as the write
 *    path stores it (`2026-10-01T09:30:00.000Z`); both read as that text.
 *
 * Only fields the table declares are read; every other value passes unchanged,
 * and so does `null` and a value already in its read form. A value the reader
 * cannot read (text in a number column) is left as it is, for the rule to
 * compare as written.
 */

/** The field types stored as a boolean. */
const BOOLEAN_FIELD_TYPES: ReadonlySet<string> = new Set(['checkbox', 'boolean', 'bool'])

/** The field types stored as a number. */
export const NUMBER_FIELD_TYPES: ReadonlySet<string> = new Set([
  'integer',
  'decimal',
  'number',
  'currency',
  'percentage',
  'progress',
  'rating',
  'autonumber',
  'count',
])

/** The field types stored as a calendar day. */
export const DATE_FIELD_TYPES: ReadonlySet<string> = new Set(['date'])

/** The field types stored as an instant. */
export const DATETIME_FIELD_TYPES: ReadonlySet<string> = new Set([
  'datetime',
  'created-at',
  'updated-at',
  'deleted-at',
])

interface TableShape {
  readonly fields?:
    ReadonlyArray<{ readonly name: string; readonly type?: string | undefined }> | undefined
}

/** A stored boolean as a JS boolean: `1`/`0` and their text spellings; anything else unchanged. */
const readStoredBoolean = (value: unknown): unknown => {
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'bigint') return value !== BigInt(0)
  if (typeof value !== 'string') return value
  const spelled = value.trim().toLowerCase()
  if (spelled === '1' || spelled === 'true') return true
  if (spelled === '0' || spelled === 'false') return false
  return value
}

/** A stored number as a JS number: a `bigint` or the text of a number; anything else unchanged. */
const readStoredNumber = (value: unknown): unknown => {
  if (typeof value === 'bigint') return Number(value)
  if (typeof value !== 'string' || value.trim() === '') return value
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : value
}

/** A valid `Date`, or `undefined`. */
const validDate = (value: unknown): Readonly<Date> | undefined =>
  value instanceof Date && !Number.isNaN(value.getTime()) ? value : undefined

/** A stored day as `YYYY-MM-DD`: a driver's `Date` is read on the UTC calendar. */
const readStoredDate = (value: unknown): unknown =>
  validDate(value)?.toISOString().slice(0, 10) ?? value

/** A stored instant as the text the write path stores: `2026-10-01T09:30:00.000Z`. */
const readStoredDatetime = (value: unknown): unknown => validDate(value)?.toISOString() ?? value

/** The reader of one declared field type, or `undefined` for a type read as it is. */
const readerOf = (type: string): ((value: unknown) => unknown) | undefined => {
  if (BOOLEAN_FIELD_TYPES.has(type)) return readStoredBoolean
  if (NUMBER_FIELD_TYPES.has(type)) return readStoredNumber
  if (DATE_FIELD_TYPES.has(type)) return readStoredDate
  if (DATETIME_FIELD_TYPES.has(type)) return readStoredDatetime
  return undefined
}

/** `row` with every typed field of `table` read as the records list compares it (see above). */
export const readStoredValues = (
  table: TableShape | undefined,
  row: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const typed = (table?.fields ?? []).flatMap((field) => {
    const reader = readerOf(field.type ?? '')
    return reader !== undefined && field.name in row ? [{ name: field.name, reader }] : []
  })
  if (typed.length === 0) return row
  return {
    ...row,
    ...Object.fromEntries(typed.map(({ name, reader }) => [name, reader(row[name])])),
  }
}
