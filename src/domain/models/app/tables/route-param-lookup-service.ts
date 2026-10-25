/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { callerTableGate, type CallerReader } from './caller-record-gate-service'
import { CHECKBOX_FIELD_TYPES, checkboxLiteralOf } from './checkbox-literal-service'
import { isRecordKeyShaped, MAX_SERIAL_KEY, type RecordKeyShape } from './record-id-service'
import type { App } from '@/domain/models/app'

/**
 * Which row a route segment names, for a single-record binding.
 *
 * A binding's `param` names the route segment, freely. The segment's value
 * matches the column named like the parameter when the table declares one
 * (`/authors/:slug` on a table with a `slug` field), and otherwise the
 * record's id (`/shelves/:shelf` on a table with no `shelf` field). The
 * page-level and the component-level binding read their row through this one
 * rule, and so does the record an inline form is created under.
 *
 * A value that cannot be held by the column it would be compared with — `abc`
 * against a serial id, `1.5` or `99999999999` against an integer field,
 * February 30th against a date — names no record, and a column holding a list,
 * a document or a file matches no segment at all; either
 * is answered as a missing record is, before any query runs: PostgreSQL would
 * refuse the comparison where SQLite only finds nothing. A column the table
 * does not declare is never compared at all.
 */

/** The row a segment names: the column it is compared with, and its value. */
export interface RouteParamLookup {
  readonly field: string
  readonly value: string
}

/** The view of a table this rule needs. */
export type RouteParamTable = Omit<RecordKeyShape, 'fields'> & {
  readonly fields?: readonly { readonly name?: string; readonly type?: string }[]
}

/** Field types whose column is a 32-bit integer. */
const INTEGER_TYPES: ReadonlySet<string> = new Set([
  'integer',
  'rating',
  'progress',
  'autonumber',
  'count',
  'duration',
])

/** Field types whose column holds a number with decimals. */
const NUMBER_TYPES: ReadonlySet<string> = new Set(['number', 'decimal', 'currency', 'percentage'])

/** Field types whose column no single route segment can equal: a list, a document, a file. */
const UNMATCHABLE_TYPES: ReadonlySet<string> = new Set([
  'json',
  'geolocation',
  'multi-select',
  'attachment',
  'single-attachment',
  'multiple-attachments',
  'signature',
])

/** Whether `value` is a whole number a 32-bit integer column holds. */
const isInt4 = (value: string): boolean =>
  /^-?\d{1,10}$/.test(value) &&
  BigInt(value) <= MAX_SERIAL_KEY &&
  BigInt(value) >= -MAX_SERIAL_KEY - 1n

/** Whether `value` is a real calendar day written `YYYY-MM-DD`: February 30th is none. */
const isCalendarDay = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

/** Whether `value` is a time of day written `HH:MM` or `HH:MM:SS`, optionally with fractions. */
const isTimeOfDay = (value: string): boolean =>
  /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?$/.test(value)

/** Whether `value` is an ISO 8601 date-time: a real day, then optionally a time and an offset. */
const isDateTime = (value: string): boolean => {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](.+?)(Z|[+-]\d{2}:?\d{2})?)?$/.exec(value)
  if (match === null || !isCalendarDay(match[1] as string)) return false
  return match[2] === undefined || isTimeOfDay(match[2])
}

/** The check a segment passes to be compared with a column of each typed field. */
const TYPE_CHECKS: ReadonlyMap<string, (value: string) => boolean> = new Map([
  ...[...INTEGER_TYPES].map((type) => [type, isInt4] as const),
  ...[...NUMBER_TYPES].map(
    (type) => [type, (v: string) => /^-?\d{1,18}(\.\d+)?$/.test(v)] as const
  ),
  ...[...CHECKBOX_FIELD_TYPES].map(
    (type) => [type, (v: string) => checkboxLiteralOf(v) !== undefined] as const
  ),
  ['date', isCalendarDay],
  ['datetime', isDateTime],
  ['time', isTimeOfDay],
])

/** Whether `value` can be compared with a column of a field of `type`. */
const fitsFieldType = (type: string | undefined, value: string): boolean => {
  if (type === undefined) return true
  if (UNMATCHABLE_TYPES.has(type) || type.startsWith('ai-')) return false
  return TYPE_CHECKS.get(type)?.(value) ?? true
}

/**
 * The value a segment is compared with: a checkbox spelling as `1` or `0`,
 * which both engines read as the stored yes-or-no; any other value as written.
 */
const comparedValueOf = (type: string | undefined, value: string): string => {
  if (type === undefined || !CHECKBOX_FIELD_TYPES.has(type)) return value
  return checkboxLiteralOf(value) === true ? '1' : '0'
}

/**
 * The row the segment `value` of the parameter `param` names in `table`, or
 * `undefined` when the value cannot name any row (see the module header).
 *
 * `readable` says whether the reader may read a column. A segment compared
 * with a column she may not read names no record for her, exactly as a value
 * no record holds, so the two answers are the same; a segment naming the id is
 * unaffected, since every reader of a record reads its id.
 */
export const routeParamLookupOf = (
  table: RouteParamTable,
  segment: { readonly param: string; readonly value: string },
  context: {
    readonly scopeTables: readonly string[] | undefined
    readonly readable: (field: string) => boolean
  }
): RouteParamLookup | undefined => {
  const { param, value } = segment
  const column = table.fields?.find((field) => field.name === param)
  if (column !== undefined) {
    return fitsFieldType(column.type, value) && context.readable(param)
      ? { field: param, value: comparedValueOf(column.type, value) }
      : undefined
  }
  return isRecordKeyShaped(value, table, context.scopeTables) ? { field: 'id', value } : undefined
}

/**
 * Whether `reader` may read each column of `tableName`: the verdict the records
 * API applies to a filter on that column — none of a table she may not read,
 * none her read plan withholds (a field permission, or a built-in default that
 * hides a column from a role).
 */
export const columnReadableBy = (
  app: App,
  tableName: string,
  reader: CallerReader | undefined
): ((field: string) => boolean) => {
  const gate = callerTableGate(app, tableName, reader)
  if (gate.kind === 'refused') return () => false
  const withheld = gate.plan?.restrictedColumns
  return (field) => withheld === undefined || !withheld.has(field)
}
