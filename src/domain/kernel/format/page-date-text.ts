/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A calendar day as a person types it on the page, and back.
 *
 * A browser's native date input follows the BROWSER's locale, so an English
 * (UK) page read in a US browser shows `10/14/2026`. A box editing a date in
 * the page's own format shows `14/10/2026` there instead, and reads what the
 * reader types the same way: on that page `21/10/2026` is 21 October, never
 * the tenth of a twenty-first month. The day is stored as `YYYY-MM-DD`.
 *
 * The page locale arrives from `<html lang>`; {@link usableLocale} keeps a
 * malformed tag from throwing.
 */
import { usableLocale } from './usable-locale'

type DatePart = 'year' | 'month' | 'day'

/** The order `locale` writes a numeric date's parts in. */
function partOrderOf(locale: string): readonly DatePart[] {
  const parts = new Intl.DateTimeFormat(usableLocale(locale), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).formatToParts(new Date(Date.UTC(2026, 9, 21)))
  return parts
    .map((part) => part.type)
    .filter((type): type is DatePart => type === 'year' || type === 'month' || type === 'day')
}

/** A stored day (`YYYY-MM-DD`) as `locale` writes it (`DD/MM/YYYY` in English (UK)); anything else as written. */
export function formatPageDate(value: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (match === null) return value
  const [, year = '', month = '', day = ''] = match
  return new Intl.DateTimeFormat(usableLocale(locale), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))))
}

/** Whether year, month and day name a real calendar day. */
const isRealDay = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

/**
 * What a reader typed, read in `locale`'s order of day, month and year, as
 * the stored day (`DD/MM/YYYY` → `YYYY-MM-DD` on an English (UK) page). Text
 * that names no real day is returned as typed, so the save refuses it rather
 * than this guessing at it; a blank box stays blank.
 */
export function parsePageDate(text: string, locale: string): string {
  const numbers = text
    .trim()
    .split(/\D+/)
    .filter((chunk) => chunk !== '')
  if (numbers.length !== 3) return text
  const order = partOrderOf(locale)
  const at = (part: DatePart): number => Number(numbers[order.indexOf(part)])
  const year = at('year')
  const month = at('month')
  const day = at('day')
  if (year < 1000 || !isRealDay(year, month, day)) return text
  return `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
