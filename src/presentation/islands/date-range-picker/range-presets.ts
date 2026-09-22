/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DateRange } from '../date-picker/date-format-helpers'

/**
 * The named periods the panel offers as one click.
 *
 * ─── WHY THESE ARE COMPUTED AND NOT DECLARED ───────────────────────────────
 *
 * "This month" is the one thing a config cannot express: an author writing it
 * down would have to write two dates, and those dates are wrong on the first of
 * next month. So the vocabulary is CLOSED at the schema and resolved HERE,
 * against the clock, when the panel opens — which is also why a preset name is
 * refused as `value`. A preset is a question; a value is an answer.
 *
 * Each resolver takes `now` rather than reading the clock itself, so the table
 * is pure and a unit test can pin a date without pinning the machine's.
 */

/** Midnight on the given day, in the reader's own zone. */
const dayOf = (date: Date, offsetDays = 0): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays)

/** The whole month containing `date`, shifted by `offsetMonths`. */
const monthSpan = (date: Date, offsetMonths: number): DateRange => {
  const year = date.getFullYear()
  const month = date.getMonth() + offsetMonths
  // Day 0 of the NEXT month is the last day of this one — which is how February
  // gets 28 or 29 without this table knowing anything about leap years.
  return { from: new Date(year, month, 1), to: new Date(year, month + 1, 0) }
}

/** The whole quarter containing `date`, shifted by `offsetQuarters`. */
const quarterSpan = (date: Date, offsetQuarters: number): DateRange => {
  const startMonth = Math.floor(date.getMonth() / 3) * 3 + offsetQuarters * 3
  return {
    from: new Date(date.getFullYear(), startMonth, 1),
    to: new Date(date.getFullYear(), startMonth + 3, 0),
  }
}

/** The whole calendar year containing `date`, shifted by `offsetYears`. */
const yearSpan = (date: Date, offsetYears: number): DateRange => ({
  from: new Date(date.getFullYear() + offsetYears, 0, 1),
  to: new Date(date.getFullYear() + offsetYears, 11, 31),
})

/**
 * One resolver per member of `DateRangePresetSchema`.
 *
 * A rolling window is INCLUSIVE of today: "last 7 days" is today and the six
 * before it, which is the reading every reporting tool ships and the one a
 * reader checking "did anything happen today" expects.
 */
export const RANGE_PRESETS: Readonly<Record<string, (now: Date) => DateRange>> = {
  today: (now) => ({ from: dayOf(now), to: dayOf(now) }),
  yesterday: (now) => ({ from: dayOf(now, -1), to: dayOf(now, -1) }),
  'last-7-days': (now) => ({ from: dayOf(now, -6), to: dayOf(now) }),
  'last-30-days': (now) => ({ from: dayOf(now, -29), to: dayOf(now) }),
  'this-month': (now) => monthSpan(now, 0),
  'last-month': (now) => monthSpan(now, -1),
  'this-quarter': (now) => quarterSpan(now, 0),
  'last-quarter': (now) => quarterSpan(now, -1),
  'this-year': (now) => yearSpan(now, 0),
  'last-year': (now) => yearSpan(now, -1),
}

/** What each preset reads down the left of the panel. */
export const PRESET_LABELS: Readonly<Record<string, string>> = {
  today: 'Today',
  yesterday: 'Yesterday',
  'last-7-days': 'Last 7 days',
  'last-30-days': 'Last 30 days',
  'this-month': 'This month',
  'last-month': 'Last month',
  'this-quarter': 'This quarter',
  'last-quarter': 'Last quarter',
  'this-year': 'This year',
  'last-year': 'Last year',
}

/** Resolve one preset name against `now`, or `undefined` for a name nobody computes. */
export function resolvePreset(name: string, now: Date): DateRange | undefined {
  return RANGE_PRESETS[name]?.(now)
}
