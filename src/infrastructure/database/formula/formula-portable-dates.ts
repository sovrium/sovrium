/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'

/**
 * The portable date functions: `days_between(a, b)`, `add_days(d, n)` and
 * `date_part_utc(part, x)`. Each answers identically on SQLite and PostgreSQL,
 * in UTC, whatever time zone the database sessions run in.
 *
 * Neither engine has these names. This module rewrites each call into the
 * active engine's SQL before the rest of the translator runs:
 *
 * - **SQLite** reads every date through `date()` / `strftime()`, which parse
 *   the ISO text SQLite stores and read it in UTC.
 * - **PostgreSQL** reads a `date` as it is and a `TIMESTAMPTZ` through
 *   `AT TIME ZONE 'UTC'`. Both spellings are IMMUTABLE there, so a formula over
 *   date fields stays a generated column. An argument whose type cannot be told
 *   from the formula text (an expression, a literal, the clock) goes through
 *   `CAST(… AS TIMESTAMPTZ)`, which PostgreSQL computes through the session's
 *   zone: {@link formulaHasUntypedPortableDateArgument} routes such a formula to
 *   the row trigger, whose session is pinned to UTC.
 *
 * `days_between` counts CALENDAR days (two instants an hour apart across
 * midnight UTC are one day apart), so each operand is reduced to its UTC day
 * first. `date_part_utc` reads the ISO 8601 week (`%V` / `EXTRACT(week …)`)
 * and its year (`%G` / `isoyear`); SQLite's `%W` numbers weeks differently
 * and is never emitted.
 */

/** The parts `date_part_utc` reads, and the `strftime` format of each on SQLite. */
const SQLITE_PART_FORMATS = {
  year: '%Y',
  month: '%m',
  day: '%d',
  hour: '%H',
  minute: '%M',
  second: '%S',
  dow: '%w',
  week: '%V',
  isoyear: '%G',
} as const

type DatePart = keyof typeof SQLITE_PART_FORMATS

/** The parts `date_part_utc` accepts, in the order a refusal lists them. */
export const PORTABLE_DATE_PARTS: readonly DatePart[] = Object.keys(
  SQLITE_PART_FORMATS
) as DatePart[]

/** A `date_part_utc` call whose part is not one of {@link PORTABLE_DATE_PARTS}. */
export class PortableDatePartError extends Data.TaggedError('PortableDatePartError')<{
  readonly part: string
  readonly message: string
}> {}

/** How a function argument reads as a date. */
type DateKind = 'date' | 'instant' | 'untyped'

type FieldLike = { readonly name: string; readonly type: string }

const INSTANT_FIELD_TYPES: ReadonlySet<string> = new Set([
  'datetime',
  'created-at',
  'updated-at',
  'deleted-at',
])

const resultTypeOf = (field: FieldLike): string | undefined => {
  const { resultType } = field as { readonly resultType?: unknown }
  return typeof resultType === 'string' ? resultType.toLowerCase() : undefined
}

/**
 * Whether a field holds a day (`date`) or an instant (`TIMESTAMPTZ`) — a formula
 * field by its `resultType` — or neither.
 */
export const dateKindOfField = (field: FieldLike): 'date' | 'instant' | undefined => {
  if (field.type === 'date') return 'date'
  if (INSTANT_FIELD_TYPES.has(field.type)) return 'instant'
  if (field.type !== 'formula') return undefined
  const resultType = resultTypeOf(field)
  if (resultType === 'date') return 'date'
  return resultType === 'datetime' || resultType === 'timestamp' ? 'instant' : undefined
}

/** How one argument, as written, reads as a date. */
const dateKindOf = (arg: string, fields: readonly FieldLike[]): DateKind => {
  const text = arg.trim()
  if (/^CURRENT_DATE$/i.test(text) || /^add_days\s*\(/i.test(text)) return 'date'
  const name = text.replace(/^"(.*)"$/, '$1')
  const field = fields.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase())
  return (field === undefined ? undefined : dateKindOfField(field)) ?? 'untyped'
}

const PORTABLE_CALL = /^(days_between|add_days|date_part_utc)\s*\(/i

/** One portable call: its name, its arguments as written, and where it ends. */
interface PortableCall {
  readonly name: string
  readonly start: number
  readonly end: number
  readonly args: readonly string[]
}

/** The index just past a quoted run starting at `index` (`'it''s'`, `"order"`). */
const skipQuoted = (sql: string, index: number): number => {
  const quote = sql[index]
  let cursor = index + 1
  while (cursor < sql.length) {
    if (sql[cursor] === quote && sql[cursor + 1] === quote) cursor += 2
    else if (sql[cursor] === quote) return cursor + 1
    else cursor += 1
  }
  return cursor
}

/** The top-level arguments of the call whose `(` is at `open`, and the index past its `)`. */
const readArguments = (
  sql: string,
  open: number
): { readonly args: readonly string[]; readonly end: number } => {
  let depth = 0
  let cursor = open + 1
  let argStart = cursor
  let args: readonly string[] = []
  while (cursor < sql.length) {
    const char = sql[cursor]
    if (char === "'" || char === '"') {
      cursor = skipQuoted(sql, cursor)
      continue
    }
    if (char === '(') depth += 1
    else if (char === ')' && depth === 0) {
      return { args: [...args, sql.slice(argStart, cursor).trim()], end: cursor + 1 }
    } else if (char === ')') depth -= 1
    else if (char === ',' && depth === 0) {
      args = [...args, sql.slice(argStart, cursor).trim()]
      argStart = cursor + 1
    }
    cursor += 1
  }
  return { args: [...args, sql.slice(argStart).trim()], end: sql.length }
}

/** The first portable call in `sql`, outside string literals and quoted names. */
const findPortableCall = (sql: string): PortableCall | undefined => {
  let cursor = 0
  while (cursor < sql.length) {
    const char = sql[cursor] ?? ''
    if (char === "'" || char === '"') {
      cursor = skipQuoted(sql, cursor)
      continue
    }
    const previous = sql[cursor - 1] ?? ''
    const match = /[\w.]/.test(previous) ? null : PORTABLE_CALL.exec(sql.slice(cursor))
    if (match !== null) {
      const { args, end } = readArguments(sql, cursor + match[0].length - 1)
      return { name: (match[1] ?? '').toLowerCase(), start: cursor, end, args }
    }
    cursor += 1
  }
  return undefined
}

/** One argument: as written (to read its kind) and as translated (to emit). */
interface Argument {
  readonly written: string
  readonly sql: string
  readonly kind: DateKind
}

type Dialect = 'postgres' | 'sqlite'

/** The part a `date_part_utc` call names; refused when it is not one of the offered parts. */
const datePartOf = (arg: Argument | undefined): DatePart => {
  const literal = /^'([^']*)'$/.exec(arg?.written ?? '')
  const part = (literal?.[1] ?? arg?.written ?? '').toLowerCase()
  if (part in SQLITE_PART_FORMATS) return part as DatePart
  // The translator refuses an invalid formula at DDL generation, as it refuses a function SQLite lacks
  throw new PortableDatePartError({
    part,
    message:
      `date_part_utc() does not read the part "${part}". ` +
      `It reads one of: ${PORTABLE_DATE_PARTS.join(', ')}, written as a quoted literal.`,
  })
}

/** PostgreSQL: the UTC day of an argument, as a `date`. */
const postgresDay = (arg: Argument | undefined): string => {
  const sql = arg?.sql ?? 'NULL'
  if (arg?.kind === 'date') return `CAST(${sql} AS DATE)`
  if (arg?.kind === 'instant') return `CAST((${sql} AT TIME ZONE 'UTC') AS DATE)`
  return `CAST((CAST(${sql} AS TIMESTAMPTZ) AT TIME ZONE 'UTC') AS DATE)`
}

/** PostgreSQL: an argument as a UTC wall-clock `timestamp`. */
const postgresUtcTimestamp = (arg: Argument | undefined): string => {
  const sql = arg?.sql ?? 'NULL'
  if (arg?.kind === 'date') return `CAST(${sql} AS TIMESTAMP)`
  if (arg?.kind === 'instant') return `(${sql} AT TIME ZONE 'UTC')`
  return `(CAST(${sql} AS TIMESTAMPTZ) AT TIME ZONE 'UTC')`
}

const RENDERERS: Readonly<
  Record<Dialect, Readonly<Record<string, (args: readonly Argument[]) => string>>>
> = {
  postgres: {
    days_between: ([a, b]) => `(${postgresDay(a)} - ${postgresDay(b)})`,
    add_days: ([d, n]) =>
      `(${postgresDay(d)} + CAST(TRUNC(CAST(${n?.sql ?? 'NULL'} AS NUMERIC)) AS INTEGER))`,
    date_part_utc: ([part, x]) =>
      `CAST(FLOOR(EXTRACT(${datePartOf(part)} FROM ${postgresUtcTimestamp(x)})) AS INTEGER)`,
  },
  sqlite: {
    days_between: ([a, b]) =>
      `CAST(julianday(date(${a?.sql ?? 'NULL'})) - julianday(date(${b?.sql ?? 'NULL'})) AS INTEGER)`,
    add_days: ([d, n]) =>
      `date(${d?.sql ?? 'NULL'}, CAST(${n?.sql ?? 'NULL'} AS INTEGER) || ' days')`,
    date_part_utc: ([part, x]) =>
      `CAST(strftime('${SQLITE_PART_FORMATS[datePartOf(part)]}', ${x?.sql ?? 'NULL'}) AS INTEGER)`,
  },
}

/**
 * Rewrite every `days_between`, `add_days` and `date_part_utc` call of a
 * formula into `dialect`'s SQL, nested calls included.
 *
 * @throws {PortableDatePartError} when a `date_part_utc` part is not offered
 */
export const translatePortableDates = (
  formula: string,
  fields: readonly FieldLike[],
  dialect: Dialect
): string => {
  const call = findPortableCall(formula)
  if (call === undefined) return formula
  const args = call.args.map((written) => ({
    written,
    sql: translatePortableDates(written, fields, dialect),
    kind: dateKindOf(written, fields),
  }))
  const render = RENDERERS[dialect][call.name]
  const rendered = render === undefined ? formula.slice(call.start, call.end) : render(args)
  return (
    formula.slice(0, call.start) +
    rendered +
    translatePortableDates(formula.slice(call.end), fields, dialect)
  )
}

/** Every portable call of a formula, nested ones included. */
const portableCalls = (formula: string): readonly PortableCall[] => {
  const call = findPortableCall(formula)
  if (call === undefined) return []
  return [call, ...call.args.flatMap(portableCalls), ...portableCalls(formula.slice(call.end))]
}

/**
 * Whether a portable date function reads an argument whose type the formula
 * text does not tell — neither a date field, a date-and-time field, a formula
 * with a date result, nor `CURRENT_DATE`. PostgreSQL then reads it through the
 * session's zone, so the formula must be computed by the UTC-pinned trigger.
 * (`date_part_utc`'s first argument is its part, never a date.)
 */
export const formulaHasUntypedPortableDateArgument = (
  formula: string,
  fields: readonly FieldLike[]
): boolean =>
  portableCalls(formula).some((call) => {
    const dates =
      call.name === 'date_part_utc'
        ? call.args.slice(1)
        : call.name === 'add_days'
          ? call.args.slice(0, 1)
          : call.args
    return dates.some((arg) => dateKindOf(arg, fields) === 'untyped')
  })
