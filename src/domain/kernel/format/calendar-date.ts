/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { usableLocale } from './usable-locale'

/** The `YYYY-MM-DD` a date-only value, or the instant it was sent as, opens with. */
const CALENDAR_DAY_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/

/** The calendar day a date-only value names, as a UTC-midnight instant. */
function calendarDayOf(value: unknown): Readonly<Date> | undefined {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  }
  if (typeof value !== 'string') return undefined
  const match = CALENDAR_DAY_PREFIX.exec(value)
  if (!match) return undefined
  const [, year, month, day] = match
  const instant = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return Number.isNaN(instant.getTime()) ? undefined : instant
}

/**
 * A calendar date — a `date` field, a date-valued formula — written in the page
 * language: « 15 Mar 2026 » under `en-GB`, « 15 mars 2026 » under `fr-FR`.
 *
 * A date has no time and no zone. The API sends it as `YYYY-MM-DD` or as the
 * UTC-midnight instant the driver decodes it to, and formatting that instant in
 * the reader's own zone prints the day before for everyone west of Greenwich.
 * So the day is read off the value's own digits and formatted in UTC: which
 * calendar day it is never depends on who reads it. Only the LOCALE — month
 * names and order — follows the page.
 *
 * Returns `undefined` for a value that names no calendar day, so the caller
 * shows it as it came rather than "Invalid Date". `weekday` prints the day of
 * the week before the date (a field's `weekday: short | long`).
 */
export function formatCalendarDate(
  value: unknown,
  locale: string | undefined,
  weekday?: CalendarWeekday
): string | undefined {
  const day = calendarDayOf(value)
  if (day === undefined) return undefined
  return new Intl.DateTimeFormat(usableLocale(locale ?? 'en-US'), {
    ...calendarDateStyle(weekday),
    timeZone: 'UTC',
  }).format(day)
}

/** How a date field's `weekday` prints the day of the week before its date. */
export type CalendarWeekday = 'short' | 'long'

/**
 * The date's format parts. `dateStyle` cannot be combined with a weekday, so a
 * date that prints one spells the parts out: `short` keeps the medium date
 * ("Thu 24 Sept 2026"), `long` writes the month out ("Thursday, 24 September
 * 2026") — in the page language either way.
 */
export function calendarDateStyle(
  weekday: CalendarWeekday | undefined
): Readonly<Intl.DateTimeFormatOptions> {
  if (weekday === undefined) return { dateStyle: 'medium' }
  return { weekday, day: 'numeric', month: weekday, year: 'numeric' }
}
