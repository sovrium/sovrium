/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatCompactCurrency } from '@/domain/kernel/format/compact-currency'
import { usableLocale } from '@/domain/kernel/format/usable-locale'
import { resolvePageLocale } from '../runtime/page-locale'
import { resolvePageTimezone } from '../runtime/page-timezone'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'

/**
 * Display formats applied to chart axis tick labels. Mirrors the domain
 * `AxisFormat` literal (`date | currency | number | percent`).
 */
export type ChartAxisFormat = 'date' | 'currency' | 'number' | 'percent'

/**
 * A `currency` axis prints the PLOTTED field's currency in the page language's
 * compact notation — `€3.5K`, `3,5 k€` — never with cents: a tick names a
 * level on the scale, not an amount to the cent. With no field currency
 * resolved (a plain number field formatted as currency), the axis keeps its
 * historical `$` prefix.
 */
function formatCurrencyTick(value: number, currency: CurrencyDisplayOptions | undefined): string {
  return currency === undefined
    ? `$${String(value)}`
    : formatCompactCurrency(value, currency, resolvePageLocale())
}

/** A month bucket key, as a `month` interval groups a date: `2025-07`. */
const MONTH_KEY = /^(\d{4})-(\d{2})$/

/**
 * The labeller of an axis whose every key is a month bucket: each key printed
 * as its short month in the page language (`Jul`, `juil.`), with its year only
 * when the keys span more than one year (`Dec 2025`, `Jan 2026`). `undefined`
 * when any key is not a month bucket, so the keys print as they are.
 */
export function monthKeyLabeller(keys: readonly string[]): ((key: string) => string) | undefined {
  const months = keys.map((key) => MONTH_KEY.exec(key))
  if (months.length === 0 || months.some((month) => month === null)) return undefined
  const years = new Set(months.map((month) => month?.[1]))
  const format = new Intl.DateTimeFormat(usableLocale(resolvePageLocale()), {
    month: 'short',
    ...(years.size > 1 ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  })
  return (key) => {
    const month = MONTH_KEY.exec(key)
    return month === null
      ? key
      : format.format(new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1)))
  }
}

/** A sub-day bucket key, as an `hour` or `minute` interval groups a date: an ISO instant. */
const INSTANT_KEY = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/**
 * The labeller of a date axis whose every key is an instant (an `hour` or
 * `minute` bucket): each key printed as its time of day on a 24-hour clock in
 * the operator timezone (`15:00`), with its day and short month in the page
 * language when the keys fall on more than one day there (`Oct 9, 22:00`).
 * `undefined` when any key carries no time, so a day or month axis keeps its
 * own label.
 */
export function timeKeyLabeller(keys: readonly string[]): ((key: string) => string) | undefined {
  if (keys.length === 0 || keys.some((key) => !INSTANT_KEY.test(key))) return undefined
  const timeZone = resolvePageTimezone()
  const zone = timeZone === undefined ? {} : { timeZone }
  const dayOf = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', ...zone })
  const days = new Set(keys.map((key) => dayOf.format(new Date(key))))
  const format = new Intl.DateTimeFormat(usableLocale(resolvePageLocale()), {
    ...(days.size > 1 ? { day: 'numeric', month: 'short' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...zone,
  })
  return (key) => format.format(new Date(key))
}

/**
 * The labeller of a category axis declared with `format`: a date axis of
 * instants reads as times ({@link timeKeyLabeller}), any other date axis as
 * `<Month> <Year>`; an undeclared axis of month buckets reads as months
 * ({@link monthKeyLabeller}); anything else through {@link formatAxisLabel}.
 */
export function axisKeyLabeller(
  keys: readonly string[],
  format: ChartAxisFormat | undefined
): (key: string) => string {
  const labeller = format === 'date' ? timeKeyLabeller(keys) : monthKeyLabeller(keys)
  return labeller ?? ((key) => formatAxisLabel(key, format))
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/**
 * Formats a raw X-axis key for display. With `format: 'date'` the key is
 * parsed as a date and rendered as `"<Month> <Year>"` (e.g. `"Jan 2025"`).
 * Non-date formats and unparseable values pass through unchanged.
 */
export function formatAxisLabel(
  raw: string,
  format: ChartAxisFormat | undefined,
  currency?: CurrencyDisplayOptions
): string {
  if (format === 'date') {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) {
      const month = MONTH_NAMES[parsed.getUTCMonth()] ?? ''
      return `${month} ${String(parsed.getUTCFullYear())}`
    }
    return raw
  }
  if (format === 'currency') {
    const num = Number(raw)
    return Number.isFinite(num) ? formatCurrencyTick(num, currency) : `$${raw}`
  }
  if (format === 'percent') return `${formatNumber(raw)}%`
  return raw
}

/**
 * Formats a numeric Y-axis tick value according to the axis `format`.
 * `currency` prints the plotted field's currency (a `$` when none is known),
 * `percent` suffixes a `%`, everything else renders the bare number.
 */
export function formatAxisValue(
  value: number,
  format: ChartAxisFormat | undefined,
  currency?: CurrencyDisplayOptions
): string {
  if (format === 'currency') return formatCurrencyTick(value, currency)
  if (format === 'percent') return `${String(value)}%`
  return String(value)
}

/** Renders a numeric-looking string without trailing fractional noise. */
function formatNumber(raw: string): string {
  const num = Number(raw)
  return Number.isFinite(num) ? String(num) : raw
}
