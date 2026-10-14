/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Date formatting / parsing / comparison helpers extracted from the
 * date-picker island. Pure functions only — no React, no DOM.
 */

export interface DateRange {
  readonly from?: Date
  readonly to?: Date
}

export function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

export function formatDate(date: Date, dateFormat: string | undefined): string {
  const yyyy = date.getFullYear()
  const mm = pad2(date.getMonth() + 1)
  const dd = pad2(date.getDate())
  if (dateFormat === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`
  return `${yyyy}-${mm}-${dd}`
}

export function formatRange(range: DateRange | undefined, dateFormat: string | undefined): string {
  if (!range?.from) return ''
  const from = formatDate(range.from, dateFormat)
  const to = range.to ? formatDate(range.to, dateFormat) : ''
  return to ? `${from} → ${to}` : from
}

export function parseIso(d: string | undefined): Date | undefined {
  if (!d) return undefined
  const parsed = new Date(`${d}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function isOutOfBounds(day: Date, min: Date | undefined, max: Date | undefined): boolean {
  if (min && day < min) return true
  if (max && day > max) return true
  return false
}

/**
 * The bounds as react-day-picker's `disabled` matchers: every day before the
 * minimum and every day after the maximum. Same reading as {@link isOutOfBounds}.
 */
export function calendarBounds(
  min: Date | undefined,
  max: Date | undefined
): Array<{ readonly before: Date } | { readonly after: Date }> {
  return [
    ...(min === undefined ? [] : [{ before: min }]),
    ...(max === undefined ? [] : [{ after: max }]),
  ]
}
