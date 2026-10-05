/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatCalendarDate, type CalendarWeekday } from '@/domain/kernel/format/calendar-date'
import { resolvePageLocale } from '../runtime/page-locale'

/** The weekday-declaring date fields a list or gallery was told about, by name. */
export type WeekdayFields = Readonly<Record<string, CalendarWeekday>>

/**
 * A date whose field declares a `weekday`, printed in the page language with
 * its day of the week — as the grid and the record drawer print it — or
 * `undefined` when the field declares none or the value names no day.
 */
export function formatWeekdayDate(
  field: string,
  value: unknown,
  weekdays: WeekdayFields | undefined
): string | undefined {
  const weekday = weekdays?.[field]
  return weekday === undefined ? undefined : formatCalendarDate(value, resolvePageLocale(), weekday)
}

/**
 * Records whose weekday-declaring dates are replaced by their printed form, so
 * a `$record.<field>` written into a card reads "Sunday 20 September 2026"
 * rather than the stored ISO text. Records are returned as they are when no
 * field declares a weekday.
 */
export function withWeekdayDates<T extends Readonly<Record<string, unknown>>>(
  records: readonly T[],
  weekdays: WeekdayFields | undefined
): readonly T[] {
  if (weekdays === undefined) return records
  const fields = Object.keys(weekdays)
  return records.map((record) => ({
    ...record,
    ...Object.fromEntries(
      fields.flatMap((field) => {
        const printed = formatWeekdayDate(field, record[field], weekdays)
        return printed === undefined ? [] : [[field, printed]]
      })
    ),
  }))
}
