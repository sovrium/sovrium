/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CHECKBOX_FIELD_TYPES, checkboxLiteralOf } from './checkbox-literal-service'
import { effectiveKeyType, MAX_SERIAL_KEY, type RecordKeyShape } from './record-id-service'
import type { App } from '@/domain/models/app'

/**
 * Whether a value can be compared with the column of a typed field.
 *
 * PostgreSQL refuses to compare a number column with `abc`, an integer column
 * with `1.5`, or a date column with February 30th, and refuses `contains` on a
 * number; SQLite answers the same comparisons with arbitrary rows. So a value
 * or an operator its field cannot take is judged here, before any query runs,
 * and both engines give one answer: a record page's route segment names no
 * record, a page list matches no row, and the records API refuses the filter.
 *
 * Only the typed scalar columns are judged — numbers, checkboxes, dates and
 * times. Any other field type, and a field whose type is unknown, is left to
 * the query.
 */

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

/** The operators that match part of a text, which a number column does not take. */
const TEXT_OPERATORS: ReadonlySet<string> = new Set(['contains', 'startsWith', 'endsWith'])

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

/** The check a text value passes to be compared with a column of each typed field. */
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

/**
 * Whether the text `value` can be compared with a column of a field of `type`:
 * `true` for a type with no check, or no type at all.
 */
export const columnHoldsText = (type: string | undefined, value: string): boolean =>
  type === undefined ? true : (TYPE_CHECKS.get(type)?.(value) ?? true)

/** Whether a field of `type` holds a number. */
const holdsNumber = (type: string): boolean => INTEGER_TYPES.has(type) || NUMBER_TYPES.has(type)

/**
 * Whether one filter value can be compared with a field of `type`. A filter
 * on a date may name an instant, which the date column reads as its day, so a
 * date takes what a date-time takes. Only text is judged: a number, a boolean
 * or no value at all is the engine's to compare.
 */
const filterValueFits = (type: string, value: unknown): boolean => {
  if (typeof value !== 'string') return true
  return columnHoldsText(type === 'date' ? 'datetime' : type, value)
}

/**
 * How a filter condition fits the field it names: `fits`, `mistyped-value`
 * when its value (or one of a list's) cannot be held by the field's column,
 * or `mistyped-operator` when it matches part of a text on a number field.
 */
export type FilterConditionFit = 'fits' | 'mistyped-value' | 'mistyped-operator'

/**
 * Judge one filter condition — its `operator` in either the page or the
 * records-API vocabulary, the two spell the text operators alike — against
 * the declared `type` of its field (`undefined` when unknown: it fits).
 */
export const filterConditionFit = (
  type: string | undefined,
  operator: string,
  value: unknown
): FilterConditionFit => {
  if (type === undefined) return 'fits'
  if (holdsNumber(type) && TEXT_OPERATORS.has(operator)) return 'mistyped-operator'
  const values: readonly unknown[] = Array.isArray(value) ? value : [value]
  return values.every((item) => filterValueFits(type, item)) ? 'fits' : 'mistyped-value'
}

/** The fields a filter is judged against: each one's name and declared type. */
type TypedFields = readonly { readonly name?: string; readonly type?: string }[] | undefined

/**
 * The declared type of the field `fields` names `name`, for
 * {@link filterConditionFit}: `undefined` for a name it does not declare.
 */
export const declaredFieldTypeOf =
  (fields: TypedFields) =>
  (name: string): string | undefined =>
    fields?.find((field) => field.name === name)?.type

/**
 * {@link declaredFieldTypeOf} over `table`, the id included: an `id` the
 * table does not declare is an integer when the engine keys the table with its
 * default serial, and any other key is left to the query.
 */
export const filterFieldTypeOf =
  (
    table: Omit<RecordKeyShape, 'fields'> & { readonly fields?: TypedFields },
    scopeTables: readonly string[] | undefined
  ) =>
  (name: string): string | undefined => {
    const declared = table.fields?.find((field) => field.name === name)
    if (declared !== undefined) return declared.type
    return name === 'id' && effectiveKeyType(table, scopeTables) === undefined
      ? 'integer'
      : undefined
  }

/**
 * The type a page filter on the field `name` of `table` is judged as
 * ({@link filterFieldTypeOf}), a relationship included: compared by id, it is
 * judged as the id of the table it links to. A text operator on a relationship
 * is matched against the linked record's display field, so it is not judged.
 */
const pageFilterFieldTypeOf =
  (app: App, table: NonNullable<App['tables']>[number], operator: string) =>
  (name: string): string | undefined => {
    const scopeTables = app.auth?.scopeTables
    const field = table.fields.find((candidate) => candidate.name === name)
    if (field?.type !== 'relationship') return filterFieldTypeOf(table, scopeTables)(name)
    if (TEXT_OPERATORS.has(operator)) return undefined
    const { relatedTable } = field as { readonly relatedTable?: string }
    const related = app.tables?.find((candidate) => candidate.name === relatedTable)
    return related === undefined ? undefined : filterFieldTypeOf(related, scopeTables)('id')
  }

/**
 * A page filter condition on `tableName` with what its field cannot take
 * refused ({@link filterConditionFit}). A value read from a record or a route
 * that the column cannot hold, such as `three` compared with a record id, or a
 * text operator on a number, matches no row on either engine: PostgreSQL would
 * refuse the comparison where SQLite answers arbitrary rows. An `in` list drops
 * the values its column cannot hold; any other condition that does not fit
 * becomes `in []`, the condition that matches no row. A condition that fits is
 * returned as it came.
 */
export const withUnholdableValuesRefused = <
  F extends { readonly field: string; readonly operator: string; readonly value?: unknown },
>(
  condition: F,
  app: App,
  tableName: string
): F => {
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  if (table === undefined) return condition
  const { field, operator, value } = condition
  const type = pageFilterFieldTypeOf(app, table, operator)(field)
  if (operator === 'in' && Array.isArray(value)) {
    const kept = value.filter(
      (item: unknown) => filterConditionFit(type, operator, item) === 'fits'
    )
    return kept.length === value.length ? condition : { ...condition, value: kept }
  }
  return filterConditionFit(type, operator, value) === 'fits'
    ? condition
    : { ...condition, operator: 'in', value: [] }
}
