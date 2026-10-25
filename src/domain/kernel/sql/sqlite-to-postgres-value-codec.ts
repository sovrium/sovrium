/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DateTime, Option } from 'effect'

/**
 * Convert one SQLite cell into the text a PostgreSQL column of a given type
 * accepts, for restoring a SQLite backup into PostgreSQL.
 *
 * The two dialects store the same logical schema differently: SQLite keeps
 * booleans as `0`/`1`, system instants as epoch milliseconds, record instants
 * and dates as text, JSON and lists as text, durations as seconds and decimals
 * with numeric affinity. A copy that passes values through unchanged either
 * fails on the first boolean or, worse, succeeds with shifted instants.
 *
 * ### The contract
 *
 * - The output is TEXT the copier binds as `$n::text::<column type>` (a
 *   `bytea` column takes the bytes themselves), so PostgreSQL does the final
 *   parse with its own rules and nothing is re-rounded through a JS float.
 * - Instants come out as ISO-8601 UTC. Text without a zone is READ AS UTC,
 *   never as the machine's local time.
 * - A value that does not convert is a `problem`, never `null`: the restore
 *   aborts naming the table, the column and the row, because silently dropping
 *   a value is the one outcome a restore must not have.
 * - `NULL` stays `NULL` (`value: undefined`); whether the column accepts it is
 *   the copier's check.
 */

/** How a PostgreSQL column type is converted into. */
export type PostgresValueKind =
  | 'boolean'
  | 'timestamptz'
  | 'timestamp'
  | 'date'
  | 'time'
  | 'json'
  | 'array'
  | 'interval'
  | 'numeric'
  | 'integer'
  | 'float'
  | 'bytea'
  | 'point'
  | 'vector'
  | 'uuid'
  | 'text'

/** The converted cell, or what is wrong with it. */
export type ConvertedCell =
  /** `value` is `undefined` for SQL `NULL`. */
  | { readonly ok: true; readonly value: string | Uint8Array | undefined }
  | { readonly ok: false; readonly problem: string }

const ok = (value: string | Uint8Array | undefined): ConvertedCell => ({ ok: true, value })
const problem = (text: string): ConvertedCell => ({ ok: false, problem: text })

const EXACT_KINDS: Readonly<Record<string, PostgresValueKind>> = {
  boolean: 'boolean',
  'timestamp with time zone': 'timestamptz',
  'timestamp without time zone': 'timestamp',
  date: 'date',
  'time without time zone': 'time',
  'time with time zone': 'time',
  jsonb: 'json',
  json: 'json',
  interval: 'interval',
  smallint: 'integer',
  integer: 'integer',
  bigint: 'integer',
  'double precision': 'float',
  real: 'float',
  bytea: 'bytea',
  point: 'point',
  uuid: 'uuid',
}

/**
 * The conversion for a column, from its `format_type()` spelling
 * (`timestamp with time zone`, `numeric(10,2)`, `text[]`, `vector(1536)`).
 * Anything unrecognised is copied as text and left to PostgreSQL's own cast.
 */
export const postgresValueKind = (formatType: string): PostgresValueKind => {
  if (formatType.endsWith('[]')) return 'array'
  const base = formatType.replace(/\(.*\)$/, '').trim()
  if (base === 'numeric') return 'numeric'
  if (base === 'vector') return 'vector'
  if (/^time(stamp)?\(\d+\) with(out)? time zone$/.test(formatType)) {
    return formatType.startsWith('timestamp')
      ? formatType.includes('without')
        ? 'timestamp'
        : 'timestamptz'
      : 'time'
  }
  return EXACT_KINDS[base] ?? 'text'
}

/**
 * Whether the copier must read the column through `CAST(col AS TEXT)`: a
 * decimal comes across as SQLite renders it, never through a JS float.
 */
export const readsThroughTextCast = (kind: PostgresValueKind): boolean => kind === 'numeric'

const isWholeNumber = (value: unknown): value is number | bigint =>
  typeof value === 'bigint' || (typeof value === 'number' && Number.isInteger(value))

const isFiniteNumber = (value: unknown): value is number | bigint =>
  typeof value === 'bigint' || (typeof value === 'number' && Number.isFinite(value))

const INTEGER_TEXT = /^-?\d+$/
const DECIMAL_TEXT = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/
const DATE_TIME_TEXT =
  /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?))?(Z|[+-]\d{2}(?::?\d{2})?)?$/
const TIME_TEXT = /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?([+-]\d{2}(:?\d{2})?|Z)?$/
const UUID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const POINT_TEXT = /^\(?\s*[-+]?[\d.eE+-]+\s*,\s*[-+]?[\d.eE+-]+\s*\)?$/

/**
 * An instant from epoch milliseconds or from ISO-8601 / `YYYY-MM-DD HH:MM:SS`
 * text; text without a zone is UTC.
 */
const toInstant = (value: unknown): Readonly<DateTime.Utc> | undefined => {
  if (isFiniteNumber(value)) return Option.getOrUndefined(DateTime.make(Number(value)))
  if (typeof value !== 'string') return undefined
  const match = DATE_TIME_TEXT.exec(value.trim())
  if (match === null) return undefined
  const [, date, time, zone] = match
  const normalised = `${date}T${time ?? '00:00:00'}${zone ?? 'Z'}`
  return Option.getOrUndefined(DateTime.make(normalised))
}

const convertInstant = (value: unknown, withZone: boolean): ConvertedCell => {
  const instant = toInstant(value)
  if (instant === undefined) return problem('is not a date and time')
  const iso = DateTime.formatIso(instant)
  return ok(withZone ? iso : iso.replace(/Z$/, ''))
}

const convertBoolean = (value: unknown): ConvertedCell => {
  if (value === 0 || value === 0n || value === false) return ok('false')
  if (value === 1 || value === 1n || value === true) return ok('true')
  return problem('is not a checkbox value (0 or 1)')
}

const parseJson = (text: string): { readonly parsed: unknown } | undefined => {
  try {
    return { parsed: JSON.parse(text) as unknown }
  } catch {
    return undefined
  }
}

const convertJson = (value: unknown): ConvertedCell => {
  if (isFiniteNumber(value)) return ok(String(value))
  if (typeof value !== 'string' || parseJson(value) === undefined) {
    return problem('is not valid JSON')
  }
  // PostgreSQL's JSON types refuse the NUL character SQLite stores happily.
  return value.includes('\\u0000') ? problem('holds a NUL character') : ok(value)
}

const quoteArrayElement = (element: unknown): string =>
  element === null
    ? 'NULL'
    : `"${String(typeof element === 'object' ? JSON.stringify(element) : element)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')}"`

const convertArray = (value: unknown): ConvertedCell => {
  const decoded = typeof value === 'string' ? parseJson(value) : undefined
  if (decoded === undefined || !Array.isArray(decoded.parsed)) {
    return problem('is not a JSON list')
  }
  return ok(`{${decoded.parsed.map(quoteArrayElement).join(',')}}`)
}

const convertNumeric = (value: unknown): ConvertedCell => {
  if (isFiniteNumber(value)) return ok(String(value))
  return typeof value === 'string' && DECIMAL_TEXT.test(value.trim())
    ? ok(value.trim())
    : problem('is not a number')
}

const convertInteger = (value: unknown): ConvertedCell => {
  if (isWholeNumber(value)) return ok(String(value))
  return typeof value === 'string' && INTEGER_TEXT.test(value.trim())
    ? ok(value.trim())
    : problem('is not a whole number')
}

const convertFloat = (value: unknown): ConvertedCell =>
  isFiniteNumber(value) ? ok(String(value)) : convertNumeric(value)

const convertDate = (value: unknown): ConvertedCell =>
  typeof value === 'string' && ISO_DATE.test(value) && toInstant(value.slice(0, 10)) !== undefined
    ? ok(value.slice(0, 10))
    : problem('is not a date (YYYY-MM-DD)')

const convertTime = (value: unknown): ConvertedCell =>
  typeof value === 'string' && TIME_TEXT.test(value.trim())
    ? ok(value.trim())
    : problem('is not a time of day')

const convertInterval = (value: unknown): ConvertedCell =>
  isFiniteNumber(value) ? ok(`${String(value)} seconds`) : problem('is not a number of seconds')

const convertBytea = (value: unknown): ConvertedCell =>
  value instanceof Uint8Array ? ok(value) : problem('is not binary data')

/** A `Float32Array` blob, as SQLite stores an embedding, in pgvector's `[a,b,…]` text. */
const convertVector = (value: unknown): ConvertedCell => {
  if (!(value instanceof Uint8Array) || value.byteLength % 4 !== 0) {
    return problem('is not a vector of 32-bit floats')
  }
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength)
  const floats = Array.from({ length: value.byteLength / 4 }, (_, index) =>
    view.getFloat32(index * 4, true)
  )
  return floats.every(Number.isFinite)
    ? ok(`[${floats.join(',')}]`)
    : problem('holds a value that is not a finite number')
}

const convertPoint = (value: unknown): ConvertedCell => {
  if (typeof value !== 'string' || !POINT_TEXT.test(value.trim())) {
    return problem('is not a point (x,y)')
  }
  const inner = value.trim().replace(/^\(/, '').replace(/\)$/, '')
  return ok(`(${inner})`)
}

const convertUuid = (value: unknown): ConvertedCell =>
  typeof value === 'string' && UUID_TEXT.test(value) ? ok(value) : problem('is not a UUID')

const convertText = (value: unknown): ConvertedCell => {
  if (typeof value === 'string') return ok(value)
  if (isFiniteNumber(value)) return ok(String(value))
  return problem('is binary data in a text column')
}

const CONVERTERS: Readonly<Record<PostgresValueKind, (value: unknown) => ConvertedCell>> = {
  boolean: convertBoolean,
  timestamptz: (value) => convertInstant(value, true),
  timestamp: (value) => convertInstant(value, false),
  date: convertDate,
  time: convertTime,
  json: convertJson,
  array: convertArray,
  interval: convertInterval,
  numeric: convertNumeric,
  integer: convertInteger,
  float: convertFloat,
  bytea: convertBytea,
  point: convertPoint,
  vector: convertVector,
  uuid: convertUuid,
  text: convertText,
}

/**
 * Convert one SQLite cell for a PostgreSQL column of `kind`. `NULL` (and an
 * absent value) stays `NULL`.
 */
export const convertSqliteCell = (kind: PostgresValueKind, value: unknown): ConvertedCell => {
  // SQLite reads `NULL` as `null`; `?? undefined` folds it into the one absent value.
  const present = value ?? undefined
  return present === undefined ? ok(undefined) : CONVERTERS[kind](present)
}
