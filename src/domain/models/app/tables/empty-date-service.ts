/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DateTime, Option } from 'effect'

/**
 * An empty string written to a `date`, `datetime` or `time` field is "no
 * date", and "no date" has one representation: `null`.
 *
 * The empty string is not a value a date column can hold. PostgreSQL refuses
 * to read it as a date (a records-API write answered 400, a seed exited 1, a
 * `default: ''` aborted the boot), while SQLite silently STORED the empty text
 * and read it back as `""` — two engines disagreeing on what an empty date is.
 * Every write road maps it to `null` before it reaches either engine.
 */

/** The field types whose column stores a calendar value. */
const DATE_LIKE_FIELD_TYPES: ReadonlySet<string> = new Set(['date', 'datetime', 'time'])

interface FieldShape {
  readonly name: string
  readonly type: string
}

/**
 * Whether `value` written to a field of `type` means "no date": the empty
 * string, or one holding only whitespace (`'  '`), which no engine reads as a
 * date either — PostgreSQL refused it and SQLite stored the spaces.
 */
export const isEmptyDateValue = (type: string, value: unknown): boolean =>
  typeof value === 'string' && value.trim() === '' && DATE_LIKE_FIELD_TYPES.has(type)

/** An ISO 8601 date-time as it is typed: a day, then an optional clock time and zone. */
const DATETIME_SPELLING =
  /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?$/i

/** A zone offset spelled `+02`, `+0200` or `+02:00`, as `+02:00`. */
const withColonOffset = (zone: string): string => {
  if (/^z$/i.test(zone)) return 'Z'
  const digits = zone.slice(1).replace(':', '')
  return `${zone.slice(0, 1)}${digits.slice(0, 2)}:${digits.slice(2, 4).padEnd(2, '0')}`
}

/**
 * A datetime as the instant it names, in UTC ISO 8601 ending in `Z`
 * (`2026-09-30T14:00:00.000Z`). A value written with an offset is read at that
 * offset; a value with no zone is taken as UTC. PostgreSQL stores a datetime
 * as an instant and reads it back this way; SQLite stored the text it was
 * sent, so the same field read differently on the two engines and a sort
 * ordered the rows by how they were spelled. A value that is not a date-time
 * is returned as it is, for the write to refuse.
 */
export const toUtcInstant = (value: string): string => {
  const match = DATETIME_SPELLING.exec(value.trim())
  if (match === null) return value
  const [, day, clock, zone] = match
  const instant = DateTime.make(
    `${day}T${clock ?? '00:00:00'}${zone === undefined ? 'Z' : withColonOffset(zone)}`
  )
  return Option.isSome(instant) ? DateTime.formatIso(instant.value) : value
}

/** A clock time as it is typed: `8:05`, `08:05`, `08:05:30`, `08:05:30.5`. */
const TIME_SPELLING = /^(\d{1,2}):(\d{2})(?::(\d{2})(\.\d+)?)?$/

/**
 * A time as `HH:MM:SS` — the way PostgreSQL reads a `time` back — however it
 * was typed: `8:05` reads `08:05:00`. SQLite stored the text as sent, so a
 * filter spelled `09:30:00` missed the row typed `09:30` and a text sort put
 * `8:05` after `17:45`. A value that is not a clock time is returned as it is.
 */
export const toClockTime = (value: string): string => {
  const match = TIME_SPELLING.exec(value.trim())
  if (match === null) return value
  const [, hours = '', minutes = '', seconds = '00', fraction = ''] = match
  if (Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59) return value
  return `${hours.padStart(2, '0')}:${minutes}:${seconds}${fraction}`
}

/** `value` written to a field of `type`, as the engines store it — or `value` itself. */
const normalizedDateValue = (type: string, value: unknown): unknown => {
  if (typeof value !== 'string') return value
  // eslint-disable-next-line unicorn/no-null -- SQL NULL is the stored value: `undefined` would drop the column and fall back to its default
  if (isEmptyDateValue(type, value)) return null
  if (type === 'datetime') return toUtcInstant(value)
  if (type === 'time') return toClockTime(value)
  return value
}

/**
 * `fields` with every value written to a date-like field of `tableFields` in
 * the one form both engines store: an empty or blank string as `null`, a
 * datetime as its UTC instant ({@link toUtcInstant}), a time as `HH:MM:SS`
 * ({@link toClockTime}). Every other entry passes through untouched; the input
 * is returned as it is when nothing changes.
 */
export const normalizeDateValues = (
  fields: Readonly<Record<string, unknown>>,
  tableFields: readonly FieldShape[] | undefined
): Readonly<Record<string, unknown>> => {
  const changed = (tableFields ?? [])
    .filter((field) => Object.hasOwn(fields, field.name))
    .map((field) => [field.name, normalizedDateValue(field.type, fields[field.name])] as const)
    .filter(([name, value]) => value !== fields[name])
  return changed.length === 0 ? fields : { ...fields, ...Object.fromEntries(changed) }
}

interface TableShape {
  readonly name: string
  readonly fields: readonly FieldShape[]
}

/**
 * `fields` written to `tableName` with every date-like value in its stored form
 * ({@link normalizeDateValues}) — the table-scoped form every write road calls,
 * whether or not it carries the whole app (an automation step writes with only
 * the table list in hand).
 */
export const normalizeDateValuesIn = (
  tables: readonly TableShape[] | undefined,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
  normalizeDateValues(fields, tables?.find((table) => table.name === tableName)?.fields)
