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
 * Whether an amount is grouped in the page language rather than by the
 * hand-written path below: a locale was given (the records API passes none and
 * stays locale-neutral), the field declares no separator (a declaration always
 * wins, `none` included), and the page is not English. English stays on the
 * hand-written path so nothing an English reader saw moves — `Intl` would
 * print `CA$` for CAD on an `en-US` page where the symbol table prints `$`.
 * A tag `Intl` rejects throws, and the caller falls back.
 */
const groupsInLocale = (
  locale: string | undefined,
  options: CurrencyDisplayOptions
): locale is string =>
  locale !== undefined && options.thousandsSeparator === undefined && !/^en(-|$)/i.test(locale)

/**
 * Format an amount in the page language. With no declared symbol position,
 * `Intl` places the symbol as that language does (`48 500 €` in French). A
 * declared position keeps its meaning: `Intl` then only groups the number, and
 * the symbol goes where the field says. A declared negative format is applied
 * around whichever of the two came out, so declaring parentheses never moves
 * the symbol to the front of a French amount.
 */
const formatInLocale = (value: number, locale: string, options: CurrencyDisplayOptions): string => {
  const precision = options.precision ?? 2
  const placesSymbol = options.symbolPosition !== undefined
  const signs = options.negativeFormat !== undefined
  const number = new Intl.NumberFormat(locale, {
    ...(placesSymbol ? {} : { style: 'currency', currency: options.currency ?? 'USD' }),
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(placesSymbol || signs ? Math.abs(value) : value)
  if (placesSymbol) return placeSymbolAndSign(value, number, options)
  return signs ? applyNegative(number, value < 0, options.negativeFormat ?? 'minus') : number
}

/** Put the currency symbol and the sign around an already-formatted magnitude. */
const placeSymbolAndSign = (
  value: number,
  number: string,
  options: CurrencyDisplayOptions
): string => {
  const code = options.currency ?? 'USD'
  const symbol = CURRENCY_SYMBOLS[code] ?? code
  const withSymbol =
    (options.symbolPosition ?? 'before') === 'before' ? `${symbol}${number}` : `${number}${symbol}`
  return applyNegative(withSymbol, value < 0, options.negativeFormat ?? 'minus')
}

/**
 * Format a numeric amount as currency under the field's declared display
 * properties, defaulting to USD / 2 decimals / comma grouping / symbol first.
 *
 * An amount is grouped by thousands unless the field declares
 * `thousandsSeparator` — whole-unit amounts included, so `precision: 0` reads
 * `€48,500`. `locale` is the page language: given, and with no declared
 * separator, a non-English page groups and places the symbol as its language
 * does. The records API passes none and always groups with a comma.
 */
export const formatCurrencyValue = (
  value: number,
  options: CurrencyDisplayOptions = {},
  locale?: string
): string => {
  if (groupsInLocale(locale, options)) {
    try {
      return formatInLocale(value, locale, options)
    } catch {
      // A malformed locale tag or an unknown currency code makes `Intl` throw;
      // the hand-written path prints the amount instead.
    }
  }
  const number = formatMagnitude(
    Math.abs(value),
    options.precision ?? 2,
    options.thousandsSeparator ?? 'comma'
  )
  return placeSymbolAndSign(value, number, options)
}

/**
 * The declared currency treatment of a bound field, or `undefined` when it
 * declares none — in which case a `format: 'currency'` rendering keeps the USD
 * defaults.
 *
 * **A DECLARED CODE drives the symbol, not the field TYPE.** A
 * `type === 'currency'` gate would get the wider question wrong: a `formula`
 * computing `unit_price * stock_on_hand` would print `$224,430.90` in the
 * column beside the `€28.63` it was multiplied from, although the author
 * declared the currency on the field. `currency` FIELDS always carry a code
 * (the currency field schema requires it), so the first arm matches every one.
 *
 * ONE rule for every surface that formats an amount — the grid cell, the
 * summary total beneath it and a kanban card's footer. A second copy once let
 * a cell and its total disagree about a currency symbol, which is worse than
 * either being wrong alone.
 */
export const resolveCurrencyOptions = (
  meta: { readonly type: string; readonly display?: CurrencyDisplayOptions | undefined } | undefined
): CurrencyDisplayOptions | undefined =>
  meta !== undefined && (meta.type === 'currency' || meta.display?.currency !== undefined)
    ? meta.display
    : undefined
