/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The instant behind a relative reading. A grid cell or a description-list
 * detail drawn in a relative format wraps its words in a `time` element whose
 * `dateTime` and `title` this module computes. Its own module rather than a
 * part of `cell-value-format.ts`, which every list island ships: only the two
 * renderers that draw the element pay for it.
 */

import { formatZonedDate, MONTH_DAY, toDate, YEAR } from '../../../kernel/format/day-relative-time'
import { usableLocale } from '../../../kernel/format/usable-locale'
import type { ColumnFormat } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** A 24-hour time of day to the second, `06:00:07`. */
const CLOCK_SECONDS = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
} as const

/**
 * The absolute date and time of an instant to the second (`Oct 17, 2026,
 * 06:00:07`), in `locale` and `timeZone`; `undefined` for a value naming none.
 */
const absoluteInstantOf = (
  date: Readonly<Date> | undefined,
  locale: string,
  timeZone: string | undefined
): string | undefined =>
  date === undefined
    ? undefined
    : `${formatZonedDate(date, locale, { ...MONTH_DAY, ...YEAR }, timeZone)}, ${formatZonedDate(date, locale, CLOCK_SECONDS, timeZone)}`

/** The formats that read an instant relative to now or to the reader's day. */
const RELATIVE_FORMATS: ReadonlySet<ColumnFormat> = new Set<ColumnFormat>([
  'relative-date',
  'relative-time',
  'day-relative-time',
  'day-relative-time-seconds',
])

/**
 * The `time` element a relative reading is drawn as: its `dateTime` the ISO
 * instant, its `title` the absolute date and time to the second in the page
 * language and the operator zone (`Oct 17, 2026, 06:00:07`) — so a hover and a
 * screen reader find the moment behind "Today 06:00". `undefined` for any other
 * format, and for a value naming no instant.
 */
export function relativeStampOf(
  value: unknown,
  format: ColumnFormat,
  locale: string,
  timeZone: string | undefined
): { readonly dateTime: string; readonly title: string } | undefined {
  if (!RELATIVE_FORMATS.has(format) || value === undefined || value === null) return undefined
  const date = toDate(value)
  const title = absoluteInstantOf(date, usableLocale(locale), timeZone)
  return date === undefined || title === undefined
    ? undefined
    : { dateTime: date.toISOString(), title }
}
