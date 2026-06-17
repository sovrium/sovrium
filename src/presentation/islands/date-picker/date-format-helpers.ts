/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isInRange(day: Date, range: DateRange): boolean {
  if (!range.from) return false
  if (!range.to) return isSameDay(day, range.from)
  return day >= range.from && day <= range.to
}

export function isOutOfBounds(day: Date, min: Date | undefined, max: Date | undefined): boolean {
  if (min && day < min) return true
  if (max && day > max) return true
  return false
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const
