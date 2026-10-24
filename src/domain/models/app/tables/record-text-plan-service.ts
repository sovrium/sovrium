/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How one field of a table reads in a sentence when the author names no
 * format: the plan (`RecordTextField`) the domain's `formatRecordText` prints a
 * value with. ONE builder for every surface that writes a record's text — the
 * served page and the page export's boards — so a formula printed as money, a
 * rollup of a currency field, a clock duration or a record's created instant
 * can never read one way on the page and another on its design board.
 *
 * What only the caller knows is handed in as resolvers: the page language, the
 * operator zone, an option field's translated labels, and a field's currency
 * display (the renderer and the export each resolve it their own way).
 */

import { dateTimeGlueOf } from './cell-value-format'
import { defaultTextFormatOfFieldType } from './field-type-presentation-service'
import { CURRENCY_DISPLAY_KEYS, withInheritedCurrency } from './rollup-currency-service'
import type { RecordTextField } from './record-text-service'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'
import type { DurationDisplayFormat } from '@/domain/kernel/format/duration-format'
import type { ColumnFormat } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * The system timestamps, by the name the records API gives them: a record
 * carries them whether or not the table declares a field for them.
 */
export const SYSTEM_TIMESTAMP_TYPES: Readonly<Record<string, string>> = {
  createdAt: 'created-at',
  updatedAt: 'updated-at',
}

/** A field as a plan reads it: its name, its type, and whatever it declares. */
export type PlanField = Readonly<Record<string, unknown>> & {
  readonly name: string
  readonly type: string
}

/** A table as a plan reads it. */
export interface PlanTable {
  readonly name: string
  readonly fields: readonly PlanField[]
}

/** What a plan reads beyond the table, resolved by the caller. */
export interface RecordTextResolvers {
  /** The page's language, as a locale: a date-time's glue is written in it. */
  readonly locale: string
  /** The operator time zone: every instant that declares no zone of its own is read in it. */
  readonly timeZone: string
  /** An option field's labels, stored value → the label a reader sees. */
  readonly optionLabels: (field: PlanField | undefined) => Readonly<Record<string, string>>
  /** The currency display a field is shown in, or `undefined` when it shows none. */
  readonly currencyOf: (
    table: PlanTable,
    fieldName: string | undefined
  ) => CurrencyDisplayOptions | undefined
}

export const planFieldOf = (
  table: PlanTable | undefined,
  fieldName: string | undefined
): PlanField | undefined =>
  fieldName === undefined ? undefined : table?.fields.find((field) => field.name === fieldName)

/** The type a field reads as: its declared type, else a system timestamp's. */
export const planFieldTypeOf = (
  field: PlanField | undefined,
  fieldName: string | undefined
): string | undefined =>
  field?.type ?? (fieldName === undefined ? undefined : SYSTEM_TIMESTAMP_TYPES[fieldName])

/**
 * The zone a value is drawn in. A `date` has no time and no zone, so its day is
 * read in UTC. A date-time declaring its own `timeZone` is drawn there; `local`
 * (the reader's zone, which the server does not know) and every other value are
 * read in the operator time zone.
 */
export const planZoneOf = (
  field: PlanField | undefined,
  fieldType: string | undefined,
  operatorZone: string
): string => {
  if (fieldType === 'date') return 'UTC'
  const declared = field?.['timeZone']
  return typeof declared === 'string' && declared !== '' && declared !== 'local'
    ? declared
    : operatorZone
}

/**
 * The currency display a field declares, read from the domain alone: a
 * `currency` field's keys, any field declaring a code, and an amount rollup
 * over a `currency` field inheriting its source's keys.
 */
export const declaredCurrencyOf = (
  table: PlanTable,
  fieldName: string | undefined,
  tables: readonly PlanTable[]
): CurrencyDisplayOptions | undefined => {
  const field = planFieldOf(table, fieldName)
  if (field === undefined) return undefined
  const shown = withInheritedCurrency(field, table, tables)
  const picked = CURRENCY_DISPLAY_KEYS.flatMap((key) =>
    shown[key] === undefined ? [] : [[key, shown[key]] as const]
  )
  if (picked.length === 0) return undefined
  const display = Object.fromEntries(picked) as CurrencyDisplayOptions
  return field.type === 'currency' || display.currency !== undefined ? display : undefined
}

/** What a field is drawn with in every format: its zone, its currency, a `duration` field's unit. */
export interface FieldFormatOptions {
  readonly timeZone: string
  readonly currency?: CurrencyDisplayOptions
  readonly durationUnit?: 'seconds'
}

/**
 * The options every grid column format reads a field with — the served page's
 * explicit `format`, the export's grid cell and {@link cellTextFieldOf} alike —
 * so a `long-date` or `time-ms` cell can never be drawn in one zone on the page
 * and another on its design board.
 */
export const fieldFormatOptionsOf = (
  table: PlanTable | undefined,
  fieldName: string | undefined,
  resolvers: Pick<RecordTextResolvers, 'timeZone' | 'currencyOf'>
): FieldFormatOptions => {
  const field = planFieldOf(table, fieldName)
  const fieldType = planFieldTypeOf(field, fieldName)
  const currency = table === undefined ? undefined : resolvers.currencyOf(table, fieldName)
  return {
    timeZone: planZoneOf(field, fieldType, resolvers.timeZone),
    ...(currency === undefined ? {} : { currency }),
    // A `duration` field stores seconds; every other number a `duration`
    // format reads is milliseconds (the formatter's default).
    ...(fieldType === 'duration' ? { durationUnit: 'seconds' as const } : {}),
  }
}

/** A field read through a grid column format: its zone, its currency, a date-time's glue. */
export const cellTextFieldOf = (
  table: PlanTable | undefined,
  fieldName: string,
  format: ColumnFormat,
  resolvers: RecordTextResolvers
): RecordTextField => {
  const { timeZone, currency, durationUnit } = fieldFormatOptionsOf(table, fieldName, resolvers)
  // Only a date reads a zone: the prop an island receives carries nothing else.
  const dated = format === 'short-date' || format === 'datetime'
  return {
    format,
    ...(dated ? { timeZone } : {}),
    ...(currency && { currency }),
    ...(format === 'datetime' ? { glue: dateTimeGlueOf(resolvers.locale) } : {}),
    ...(format === 'duration' && durationUnit !== undefined ? { durationUnit } : {}),
  }
}

/**
 * Whether a field with no type default is money: a formula declaring
 * `format: currency`, or a rollup whose currency display resolves to a code —
 * exactly when the grid and `?format=display` print it as money.
 */
const isMoneyField = (
  table: PlanTable,
  field: PlanField | undefined,
  fieldName: string,
  resolvers: RecordTextResolvers
): boolean => {
  if (field?.type === 'formula') return field['format'] === 'currency'
  if (field?.type !== 'rollup') return false
  return resolvers.currencyOf(table, fieldName)?.currency !== undefined
}

/** The format a field reads in by default: its type's, else `currency` for money. */
const defaultFormatOf = (
  table: PlanTable | undefined,
  field: PlanField | undefined,
  fieldName: string,
  resolvers: RecordTextResolvers
): RecordTextField['format'] | undefined => {
  const byType = defaultTextFormatOfFieldType(planFieldTypeOf(field, fieldName))
  if (byType !== undefined || table === undefined) return byType
  return isMoneyField(table, field, fieldName, resolvers) ? 'currency' : undefined
}

/**
 * How one field reads in a sentence when the author names no format, or
 * `undefined` when it prints as stored. A system timestamp (`createdAt`,
 * `updatedAt`) reads as a date-time whether or not the table declares it.
 */
export const recordTextFieldOf = (
  table: PlanTable | undefined,
  fieldName: string,
  resolvers: RecordTextResolvers
): RecordTextField | undefined => {
  const field = planFieldOf(table, fieldName)
  const format = defaultFormatOf(table, field, fieldName, resolvers)
  if (format === undefined) return undefined
  if (format === 'percent') {
    const precision = field?.['precision']
    return typeof precision === 'number' ? { format, precision } : { format }
  }
  if (format === 'option' || format === 'options') {
    return { format, labels: resolvers.optionLabels(field) }
  }
  if (format === 'duration-clock') {
    const displayFormat = field?.['displayFormat'] as DurationDisplayFormat | undefined
    return displayFormat === undefined ? { format } : { format, displayFormat }
  }
  return cellTextFieldOf(table, fieldName, format, resolvers)
}

/** The fields a record carries text for: the system timestamps first, then the declared ones. */
export const planFieldNamesOf = (table: PlanTable): readonly string[] => [
  ...Object.keys(SYSTEM_TIMESTAMP_TYPES),
  ...table.fields.map((field) => field.name),
]
