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
import {
  computeArrayChipClasses,
  computeArrayChipsWrapClasses,
} from '@/presentation/design/cell-affordances-default-classes'
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

/** Coerce a record value to its read-only display string. */
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
 * operator zone; else `undefined`.
 */
const calendarDate = (
  type: string,
  value: unknown,
  zoned: { readonly weekday: CalendarWeekday | undefined; readonly timeZone: string | undefined }
): string | undefined => {
  const { weekday } = zoned
  if (type === 'date') return formatCalendarDate(value, resolvePageLocale(), weekday)
  if (type !== 'datetime') return undefined
  return formatDateTimeInstant(value, resolvePageLocale(), {
    timeZone: zoned.timeZone ?? resolvePageTimezone(),
    ...(weekday === undefined ? {} : { weekday }),
  })
}

/** An option, a person or a check — the marks the grid draws for those types. */
function markedValue(
  type: string,
  value: unknown,
  mark: { readonly paints?: Readonly<Record<string, OptionChipPaint>>; readonly label: string }
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
        value={option}
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
  if (items.length === 0) return ''
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
  paints,
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
  /** An option field's `value → paint` map, resolved on the server. */
  readonly paints?: Readonly<Record<string, OptionChipPaint>> | undefined
}): ReactNode {
  const marked = markedValue(type, value, { label, ...(paints === undefined ? {} : { paints }) })
  if (marked !== undefined) return marked
  const date = calendarDate(type, value, { weekday, timeZone })
  if (date !== undefined) return date
  if (ATTACHMENT_FIELD_TYPES.has(type)) return <AttachmentLinks value={value} />
  if (LIST_FIELD_TYPES.has(type) && value !== null && value !== undefined) {
    return <ListChips value={value} />
  }
  return amountText(value, currency) ?? toReadOnlyText(value)
}
