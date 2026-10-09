/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a record value READS in a sentence — the one formatter behind every
 * `$record.<field>` a reader sees, wherever it is filled.
 *
 * The server fills a page's text; the browser fills a record drawer's children,
 * its confirm prompt and a board's cards, from a record it fetched after the
 * page loaded. Both call THIS module, so one value can never read `Mar 14, 2025`
 * on a page and as its raw stored date in the drawer opened from it. Two copies would be
 * two rounding rules.
 *
 * The caller resolves each field ONCE into a {@link RecordTextField} — its
 * format, and whatever the format needs that only the server knows: the zone a
 * date-time is read in, the currency, an option's translated label. That plan is
 * plain data, so the server can hand it to an island as a prop and the island
 * formats with no schema, no translation catalogue and no zone lookup.
 *
 * Effect-free and DOM-free by construction: islands import it.
 */

import {
  formatDurationValue,
  type DurationDisplayFormat,
} from '../../../kernel/format/duration-format'
import { usableLocale } from '../../../kernel/format/usable-locale'
import { RECORD_TEXT_KEY } from '../pages/substitute-record-vars'
import { formatCellValue, formatDateTimeJoined } from './cell-value-format'
import type { CurrencyDisplayOptions } from '../../../kernel/format/currency-format'
import type { ColumnFormat } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** A field read through one of the grid's column formats (a date, an amount, yes or no). */
interface CellTextField {
  readonly format: ColumnFormat
  readonly currency?: CurrencyDisplayOptions
  /** The IANA zone a date or a date-time is read in. */
  readonly timeZone?: string
  /** A `datetime`'s words between its date and its time, as the server writes them. */
  readonly glue?: string
}

/** A `percentage` field: the stored 0–100 value with `%`, at the field's precision. */
interface PercentTextField {
  readonly format: 'percent'
  readonly precision?: number
}

/** An option field: one value (`option`) or a list of them (`options`), each by its label. */
interface OptionTextField {
  readonly format: 'option' | 'options'
  /** Stored value → the label a reader sees, already translated. */
  readonly labels: Readonly<Record<string, string>>
}

/** A `duration` field: its stored seconds (or interval text) in its display format. */
interface DurationTextField {
  readonly format: 'duration'
  readonly displayFormat?: DurationDisplayFormat
}

/** How one field reads in a sentence. */
export type RecordTextField = CellTextField | PercentTextField | OptionTextField | DurationTextField

/** The fields of one table that read differently from what is stored, by name. */
export type RecordTextFields = Readonly<Record<string, RecordTextField>>

/**
 * The values a multi-select holds, whatever shape the driver handed back: a list
 * (PostgreSQL), its JSON text (SQLite), or a comma-joined string.
 */
const listValuesOf = (value: unknown): readonly string[] => {
  if (Array.isArray(value)) return value.map(String)
  const text = String(value).trim()
  if (text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text)
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch {
      // Not JSON after all: read it as a comma-joined list below.
    }
  }
  const bare = text.startsWith('{') && text.endsWith('}') ? text.slice(1, -1) : text
  return bare
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
}

/** A stored checkbox as a boolean: the drivers answer `true`, `1`, `'true'` or `'1'`. */
const isChecked = (value: unknown): boolean =>
  value === true || value === 1 || value === 'true' || value === '1' || value === 't'

const formatPercent = (value: unknown, precision: number | undefined, locale: string): string => {
  const num = Number(value)
  if (typeof value === 'boolean' || Number.isNaN(num)) return String(value)
  const digits = precision ?? 0
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num / 100)
}

const formatOptions = (
  value: unknown,
  labels: Readonly<Record<string, string>>,
  locale: string
): string =>
  new Intl.ListFormat(locale, { type: 'conjunction', style: 'long' }).format(
    listValuesOf(value).map((entry) => labels[entry] ?? entry)
  )

/** A field whose format is not one of the grid's column formats. */
type OwnTextField = PercentTextField | OptionTextField | DurationTextField

const isCellField = (field: RecordTextField): field is CellTextField =>
  field.format !== 'percent' &&
  field.format !== 'option' &&
  field.format !== 'options' &&
  field.format !== 'duration'

/** A value in one of the formats only a sentence reads (a percentage, an option, a duration). */
const formatOwn = (value: unknown, field: OwnTextField, tag: string): string => {
  if (field.format === 'percent') return formatPercent(value, field.precision, tag)
  if (field.format === 'duration') {
    return formatDurationValue(value, field.displayFormat) ?? String(value)
  }
  return field.format === 'options'
    ? formatOptions(value, field.labels, tag)
    : (field.labels[String(value)] ?? String(value))
}

/** A value through a grid column format; a checkbox is read as a boolean first. */
const formatCell = (
  value: unknown,
  field: CellTextField,
  tag: string,
  now: Readonly<Date> | undefined
): string =>
  field.format === 'datetime' && field.glue !== undefined
    ? formatDateTimeJoined(value, tag, field.glue, field.timeZone)
    : formatCellValue(field.format === 'yes-no' ? isChecked(value) : value, field.format, tag, {
        ...(field.currency === undefined ? {} : { currency: field.currency }),
        ...(field.timeZone === undefined ? {} : { timeZone: field.timeZone }),
        ...(now === undefined ? {} : { now }),
      })

/**
 * One value as it reads in a sentence, in `locale`. `now` is the instant a short
 * date reads "this year" at — the server passes its own clock, a browser its own.
 */
export const formatRecordText = (
  value: unknown,
  field: RecordTextField,
  locale: string,
  now?: Readonly<Date>
): string => {
  if (value === undefined || value === null) return ''
  const tag = usableLocale(locale)
  return isCellField(field) ? formatCell(value, field, tag, now) : formatOwn(value, field, tag)
}

/**
 * Every value of `record` that reads differently from what is stored, as text,
 * by field name. A `null` or absent value carries no text: it prints nothing
 * either way.
 */
export const recordTextOf = (
  record: Readonly<Record<string, unknown>>,
  fields: RecordTextFields,
  locale: string,
  now?: Readonly<Date>
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(fields).flatMap(([name, field]) => {
      const value = record[name]
      return value === undefined || value === null
        ? []
        : [[name, formatRecordText(value, field, locale, now)] as const]
    })
  )

/**
 * `record` carrying its formatted text under {@link RECORD_TEXT_KEY}, the map a
 * TEXT site prints (`withRecordText`) and an address site never reads. Text the
 * record already carries is kept; the record is returned unchanged when no field
 * of it reads differently from what is stored.
 */
export const withRecordTextFields = (
  record: Readonly<Record<string, unknown>>,
  fields: RecordTextFields | undefined,
  locale: string,
  now?: Readonly<Date>
): Readonly<Record<string, unknown>> => {
  const text = fields === undefined ? {} : recordTextOf(record, fields, locale, now)
  if (Object.keys(text).length === 0) return record
  const carried = record[RECORD_TEXT_KEY]
  const kept = typeof carried === 'object' && carried !== null ? carried : {}
  return { ...record, [RECORD_TEXT_KEY]: { ...kept, ...text } }
}
