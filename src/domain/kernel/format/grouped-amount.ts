/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An amount as a person types it, and back.
 *
 * A text box editing an amount shows it grouped as the page reads numbers —
 * `12,480` on an English page, `12 480` on a French one — and takes it back
 * grouped the same way: `9,450.50` is the number `9450.5`. Its own module, so
 * a control that edits an amount carries none of the currency ladder of
 * `currency-format.ts`.
 *
 * The page locale arrives from `<html lang>`; {@link usableLocale} keeps a
 * malformed tag from throwing.
 */
import { usableLocale } from './usable-locale'

/** The group and decimal marks `locale` writes a number with. */
function marksOf(locale: string): { readonly group: string; readonly decimal: string } {
  const parts = new Intl.NumberFormat(usableLocale(locale)).formatToParts(11_111.1)
  return {
    group: parts.find((part) => part.type === 'group')?.value ?? ',',
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
  }
}

/**
 * A stored amount (`'12480'`, `'9450.5'`) grouped as `locale` reads it, its
 * fraction kept as stored. A value that is not a number is returned as written.
 */
export function formatGroupedAmount(value: string, locale: string): string {
  const trimmed = value.trim()
  const amount = trimmed === '' ? Number.NaN : Number(trimmed)
  if (!Number.isFinite(amount)) return value
  const fraction = trimmed.split('.')[1]?.length ?? 0
  return new Intl.NumberFormat(usableLocale(locale), {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
    useGrouping: true,
  }).format(amount)
}

/**
 * What a reader typed, read as `locale` writes numbers, as the plain number the
 * records API stores (`'9,450.50'` → `'9450.5'`). Text that does not read as a
 * number is returned as typed, so the save refuses it rather than this
 * guessing at it.
 */
export function parseGroupedAmount(text: string, locale: string): string {
  const { group, decimal } = marksOf(locale)
  // A space of any width groups digits in some languages, and none is ever a decimal mark.
  const ungrouped = text
    .split(group)
    .join('')
    .replace(/[\s\u00A0\u202F]/g, '')
    .split(decimal)
    .join('.')
  if (ungrouped === '' || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(ungrouped)) return text
  return String(Number(ungrouped))
}

/**
 * The sign `locale` writes `currency` with (`€`, `$`, `£`), and whether it
 * comes before the amount there. An unknown code reads as written, before it.
 */
export function currencySignOf(
  currency: string,
  locale: string
): { readonly symbol: string; readonly before: boolean } {
  try {
    const parts = new Intl.NumberFormat(usableLocale(locale), {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(1)
    const at = parts.findIndex((part) => part.type === 'currency')
    const number = parts.findIndex((part) => part.type === 'integer')
    return { symbol: parts[at]?.value ?? currency, before: at < number }
  } catch {
    return { symbol: currency, before: true }
  }
}
