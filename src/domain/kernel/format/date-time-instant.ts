/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { calendarDateStyle, type CalendarWeekday } from './calendar-date'
import { usableLocale } from './usable-locale'

/**
 * A datetime's format parts. `dateStyle` cannot be combined with a weekday, so
 * a datetime that prints one spells its parts out, the time included.
 */
function dateTimeStyle(weekday: CalendarWeekday | undefined): Readonly<Intl.DateTimeFormatOptions> {
  return weekday === undefined
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { ...calendarDateStyle(weekday), hour: 'numeric', minute: '2-digit' }
}

/**
 * A stored instant — a `datetime` field — written as a person reads one: its
 * date and time in the page language, at the wall clock of `timeZone` (the
 * field's own zone, else the operator's), « Sep 23, 2026, 5:49 AM » under
 * `en-US`. The grid's cell and the read-only drawer both print through here, so
 * one value reads the same in both.
 *
 * Returns `undefined` for a value that names no instant, so the caller shows it
 * as it came rather than "Invalid Date". With no `timeZone` — or `local`, a
 * field's way of asking for the reader's own clock, or a zone `Intl` does not
 * know — the runtime's own zone is used, never an error.
 */
export function formatDateTimeInstant(
  value: unknown,
  locale: string | undefined,
  options: { readonly timeZone?: string | undefined; readonly weekday?: CalendarWeekday } = {}
): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return undefined
  return formatInZone(parsed.getTime(), usableLocale(locale ?? 'en-US'), {
    style: dateTimeStyle(options.weekday),
    timeZone: options.timeZone,
  })
}

/**
 * The instant `epochMs` in `style` at the wall clock of `timeZone` — or of the runtime's
 * own zone when it names none, names `local` (a field asking for the reader's
 * clock) or names a zone `Intl` does not know.
 */
function formatInZone(
  epochMs: number,
  tag: string,
  zoned: { readonly style: Intl.DateTimeFormatOptions; readonly timeZone: string | undefined }
): string {
  const { style, timeZone } = zoned
  if (timeZone === undefined || timeZone === '' || timeZone === 'local') {
    return new Intl.DateTimeFormat(tag, style).format(epochMs)
  }
  try {
    return new Intl.DateTimeFormat(tag, { ...style, timeZone }).format(epochMs)
  } catch {
    return new Intl.DateTimeFormat(tag, style).format(epochMs)
  }
}
