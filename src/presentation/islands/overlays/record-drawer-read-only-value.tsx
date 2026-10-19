/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The value a read-only drawer entry prints, drawn the way the grid draws the
 * same field: an attachment as links named after its files, a `multi-select`
 * or `array` value as one chip per entry, a chosen option as a badge in its
 * option colour, a person as an avatar beside the name, a checkbox as a check
 * mark, a date in the page language's date format, a date-time at the wall
 * clock of its field's own zone, else the operator zone, and an amount in its
 * column's currency and the page language. Every other value keeps its plain
 * text.
 *
 * The chips share the grid cell's class recipes and its list decoding
 * (`readsAsList`), so a value reads the same in the cell and in the drawer.
 */

import { formatCalendarDate, type CalendarWeekday } from '@/domain/kernel/format/calendar-date'
import {
  formatCurrencyValue,
  type CurrencyDisplayOptions,
} from '@/domain/kernel/format/currency-format'
import { formatDateTimeInstant } from '@/domain/kernel/format/date-time-instant'
import { formatDateTimeColumn } from '@/domain/models/app/tables/cell-value-format'
import {
  computeArrayChipClasses,
  computeArrayChipsWrapClasses,
} from '@/presentation/design/cell-affordances-default-classes'
import { computeTableEmptyValueClasses } from '@/presentation/design/table-body-default-classes'
import { AttachmentLinks } from '../parts/attachment-links'
import { readsAsList } from '../runtime/cell-value-semantics'
import { resolvePageLocale } from '../runtime/page-locale'
import { resolvePageTimezone } from '../runtime/page-timezone'
import { OptionBadge, ReadOnlyCheck, UserChip } from './record-drawer-value-marks'
import type { OptionChipPaint } from '@/presentation/design/option-chip-paint'
import type { ReactNode } from 'react'

/** Field types whose value is one stored file or several, drawn as named links. */
const ATTACHMENT_FIELD_TYPES: ReadonlySet<string> = new Set([
  'single-attachment',
  'multiple-attachments',
])

/** Field types whose value is a list of entries, drawn as chips. */
/** The instants the engine stamps, read as a date-time is. */
const STAMP_INSTANT_TYPES: ReadonlySet<string> = new Set(['created-at', 'updated-at', 'deleted-at'])

const LIST_FIELD_TYPES: ReadonlySet<string> = new Set(['multi-select', 'array'])

/** Field types whose value is one chosen option, drawn as the grid's badge. */
const OPTION_FIELD_TYPES: ReadonlySet<string> = new Set(['single-select', 'status'])

/** Field types whose value names a person, drawn as an avatar beside the name. */
const USER_FIELD_TYPES: ReadonlySet<string> = new Set([
  'user',
  'created-by',
  'updated-by',
  'deleted-by',
])

/** Whether a record value holds nothing to draw. */
const isEmptyValue = (value: unknown): boolean =>
  value === null || value === undefined || value === ''

/** What a date or date-time the record does not carry reads: the grid's empty marker. */
const EMPTY_DATE = '—'

/** Coerce a record value to its read-only display string. */
/**
 * What an empty read-only value reads as: the grid's muted dash. A blank span
 * under a heading read as a heading printed twice when the next entry shared
 * its words (an empty `Quotes` relation above a `Quotes` count).
 */
const EMPTY_READING = <span className={computeTableEmptyValueClasses()}>—</span>

/** An attachment value as links named after its files, or the empty reading when it holds none. */
const attachmentReading = (value: unknown): ReactNode => AttachmentLinks({ value }) ?? EMPTY_READING

/** A read text, or the empty reading when there is none. */
const orEmptyReading = (text: string): ReactNode => (text === '' ? EMPTY_READING : text)

const toReadOnlyText = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value)

/** An amount as a finite number, or `undefined` when the value holds none. */
const toAmount = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : undefined
}

/**
 * A date or a date-time printed as the grid cell prints it — the page
 * language's date, its `weekday` before it when the field declares one, and a
 * date-time's time at the wall clock of the field's own `timeZone`, else the
 * operator zone; the empty marker for a date the record does not carry; else
 * `undefined`.
 */
const calendarDate = (
  type: string,
  value: unknown,
  zoned: {
    readonly weekday: CalendarWeekday | undefined
    readonly timeZone: string | undefined
    readonly format: 'datetime' | undefined
  }
): string | undefined => {
  const { weekday } = zoned
  const isDate = type === 'date' || type === 'datetime' || STAMP_INSTANT_TYPES.has(type)
  if (!isDate) return undefined
  // A date the record does not carry is the empty marker, never `undefined`.
  if (isEmptyValue(value)) return EMPTY_DATE
  if (type === 'date') return formatCalendarDate(value, resolvePageLocale(), weekday)
  if (zoned.format === 'datetime') {
    return formatDateTimeColumn(value, resolvePageLocale(), zoned.timeZone ?? resolvePageTimezone())
  }
  return formatDateTimeInstant(value, resolvePageLocale(), {
    timeZone: zoned.timeZone ?? resolvePageTimezone(),
    ...(weekday === undefined ? {} : { weekday }),
  })
}

/** An option, a person or a check — the marks the grid draws for those types. */
function markedValue(
  type: string,
  value: unknown,
  mark: {
    readonly paints?: Readonly<Record<string, OptionChipPaint>>
    readonly label: string
    readonly valueLabels?: Readonly<Record<string, string>> | undefined
  }
): ReactNode {
  if (type === 'checkbox') {
    return (
      <ReadOnlyCheck
        value={value}
        label={mark.label}
      />
    )
  }
  if (isEmptyValue(value)) return undefined
  if (OPTION_FIELD_TYPES.has(type)) {
    const option = String(value)
    return (
      <OptionBadge
        value={mark.valueLabels?.[option] ?? option}
        paint={mark.paints?.[option]}
      />
    )
  }
  if (USER_FIELD_TYPES.has(type)) {
    const names = Array.isArray(value) ? value.map(String) : [String(value)]
    return names.map((name, index) => (
      <UserChip
        key={`user-${String(index)}`}
        name={name}
      />
    ))
  }
  return undefined
}

/**
 * The words a value is renamed to, which outrank every rendering, as on the
 * grid — except an option's, whose chip draws them in the option's paint.
 */
const renamedValue = (
  type: string,
  value: unknown,
  valueLabels: Readonly<Record<string, string>> | undefined
): string | undefined => (OPTION_FIELD_TYPES.has(type) ? undefined : valueLabels?.[String(value)])

/** An amount in its column's currency and the page language; else `undefined`. */
const amountText = (
  value: unknown,
  currency: CurrencyDisplayOptions | undefined
): string | undefined => {
  const amount = currency === undefined ? undefined : toAmount(value)
  return currency === undefined || amount === undefined
    ? undefined
    : formatCurrencyValue(amount, currency, resolvePageLocale())
}

/** A list value as one chip per entry, as the grid's list cell draws it. */
function ListChips({ value }: { readonly value: unknown }): ReactNode {
  const items = readsAsList(value)
  if (items.length === 0) return EMPTY_READING
  return (
    <span className={computeArrayChipsWrapClasses()}>
      {items.map((item, index) => (
        <span
          key={`chip-${String(index)}`}
          data-component-type="badge"
          className={computeArrayChipClasses()}
        >
          {item}
        </span>
      ))}
    </span>
  )
}

export function ReadOnlyValue({
  type,
  value,
  label,
  currency,
  weekday,
  timeZone,
  format,
  paints,
  valueLabels,
}: {
  readonly type: string
  readonly value: unknown
  /** The entry's heading — the accessible name of a checkbox's mark. */
  readonly label: string
  readonly currency?: CurrencyDisplayOptions | undefined
  /** A date's `weekday`: printed before the date, as the grid prints it. */
  readonly weekday?: CalendarWeekday | undefined
  /** A datetime field's own zone, read before the operator zone. */
  readonly timeZone?: string | undefined
  /** The grid column format a system-source date-time reads in. */
  readonly format?: 'datetime' | undefined
  /** An option field's `value → paint` map, resolved on the server. */
  readonly paints?: Readonly<Record<string, OptionChipPaint>> | undefined
  /** The words printed for a stored value, keyed by its text; unmapped prints as stored. */
  readonly valueLabels?: Readonly<Record<string, string>> | undefined
}): ReactNode {
  const renamed = renamedValue(type, value, valueLabels)
  if (renamed !== undefined) return renamed
  const marked = markedValue(type, value, {
    label,
    valueLabels,
    ...(paints === undefined ? {} : { paints }),
  })
  if (marked !== undefined) return marked
  const date = calendarDate(type, value, { weekday, timeZone, format })
  if (date !== undefined) return date
  if (ATTACHMENT_FIELD_TYPES.has(type)) return attachmentReading(value)
  if (LIST_FIELD_TYPES.has(type) && value !== null && value !== undefined) {
    return <ListChips value={value} />
  }
  return orEmptyReading(amountText(value, currency) ?? toReadOnlyText(value))
}
