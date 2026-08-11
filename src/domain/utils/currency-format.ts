/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Currency display formatting, shared by the records API's `?format=display`
 * path and the data-table's `format: 'currency'` column.
 *
 * A correct formatter already existed server-side — it honoured `currency`,
 * `precision`, `symbolPosition`, `negativeFormat` and `thousandsSeparator` —
 * but it was reachable only through `?format=display`, which the grid never
 * requests. The grid had its own one-liner that hard-coded `$` and `en-US`, so
 * a field declaring `currency: 'EUR'` rendered `$0.35`. Both now call this.
 *
 * Effect-free by construction: the data-table island imports this, and pulling
 * `effect` into a browser bundle for a number-to-string conversion is not a
 * trade worth making.
 */

/** Symbols for the currencies the platform names; any other code prints verbatim. */
const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: '$',
  AUD: '$',
}

export type ThousandsSeparator = 'comma' | 'period' | 'space' | 'none'
export type NegativeFormat = 'minus' | 'parentheses'

/**
 * The display properties a `currency` field may declare. Every one is optional:
 * a column formatted as currency over a plain numeric field declares none of
 * them and falls back to the USD defaults, which is what shipped before the
 * field-level code reached the browser.
 */
export interface CurrencyDisplayOptions {
  readonly currency?: string
  readonly precision?: number
  readonly symbolPosition?: 'before' | 'after'
  readonly negativeFormat?: NegativeFormat
  readonly thousandsSeparator?: ThousandsSeparator
}

const SEPARATOR_CHARS: Readonly<Record<ThousandsSeparator, string>> = {
  comma: ',',
  period: '.',
  space: ' ',
  none: '',
}

/**
 * European convention: when a period groups thousands, a comma separates the
 * decimal — otherwise the two roles would collide on the same glyph.
 */
const decimalSeparatorFor = (thousands: ThousandsSeparator): string =>
  thousands === 'period' ? ',' : '.'

/**
 * A zero-precision currency (JPY) reads as `¥1000`, not `¥1,000` — grouping a
 * whole-unit currency is a convention it does not share.
 */
const defaultThousandsSeparator = (precision: number): ThousandsSeparator =>
  precision === 0 ? 'none' : 'comma'

const applyNegative = (amount: string, isNegative: boolean, format: NegativeFormat): string =>
  isNegative ? (format === 'parentheses' ? `(${amount})` : `-${amount}`) : amount

/**
 * Render the magnitude — grouped integer part plus, when the precision asks for
 * one, a decimal part behind the separator the grouping implies.
 */
const formatMagnitude = (
  magnitude: number,
  precision: number,
  thousands: ThousandsSeparator
): string => {
  const [integerRaw, decimalPart] = magnitude.toFixed(precision).split('.')
  const integerBase = integerRaw ?? '0'
  const separatorChar = SEPARATOR_CHARS[thousands]
  const integerPart =
    separatorChar === '' ? integerBase : integerBase.replace(/\B(?=(\d{3})+(?!\d))/g, separatorChar)

  return precision > 0
    ? `${integerPart}${decimalSeparatorFor(thousands)}${decimalPart}`
    : integerPart
}

/**
 * Format a numeric amount as currency under the field's declared display
 * properties, defaulting to USD / 2 decimals / comma grouping / symbol first.
 */
export const formatCurrencyValue = (
  value: number,
  options: CurrencyDisplayOptions = {}
): string => {
  const code = options.currency ?? 'USD'
  const symbol = CURRENCY_SYMBOLS[code] ?? code
  const precision = options.precision ?? 2
  const thousands = options.thousandsSeparator ?? defaultThousandsSeparator(precision)
  const number = formatMagnitude(Math.abs(value), precision, thousands)

  const withSymbol =
    (options.symbolPosition ?? 'before') === 'before' ? `${symbol}${number}` : `${number}${symbol}`

  return applyNegative(withSymbol, value < 0, options.negativeFormat ?? 'minus')
}
