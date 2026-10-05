/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Display formatting for a single bound value, keyed by the declared
 * `ColumnFormat` literal.
 *
 * Shared by every surface that renders one record value through an author's
 * declared format:
 *
 *  - the data-table grid cell (`format` on a field column),
 *  - the data-table summary footer (a `sum` under a formatted column has to
 *    print the same units as the cells above it),
 *  - the `record-field` display component, server-rendered and in its
 *    `record-field-system` island form.
 *
 * It lives in the `tables` slug, beside the field `format` option it reads,
 * rather than beside the grid — for the reason `currency-format.ts` (which it
 * calls) already gives: the grid was not the
 * only consumer, and a second copy of the arithmetic is a second rounding
 * rule. `record-field` was the third consumer and could not import the grid's
 * module without dragging the island's React cell renderers into the SSR
 * graph.
 *
 * Effect-free and DOM-free by construction — the data-table island imports
 * this, and the `locale` the two date formats need is passed IN
 * (`resolvePageLocale()` reads `<html lang>` and stays on the island side).
 */

import { formatByteCount } from '../../../kernel/format/byte-format'
import {
  formatCurrencyValue,
  type CurrencyDisplayOptions,
} from '../../../kernel/format/currency-format'
import { usableLocale } from '../../../kernel/format/usable-locale'
import type { ColumnFormat } from '@/domain/models/app/pages/components/component-types/data/table/schema'

// ---------------------------------------------------------------------------
// Date formatting helpers
// ---------------------------------------------------------------------------

/** A value read as a date; `undefined` when it names none. */
function toDate(value: unknown): Readonly<Date> | undefined {
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatDate(
  value: unknown,
  locale: string,
  options: Readonly<Intl.DateTimeFormatOptions>,
  timeZone: string | undefined
): string {
  const date = toDate(value)
  if (date === undefined) return String(value)
  const zoned = timeZone === undefined ? options : { ...options, timeZone }
  try {
    return date.toLocaleDateString(locale, zoned)
  } catch {
    // An unknown zone (a `RangeError`) degrades to the runtime's own zone
    // rather than taking the whole grid down with it.
    return date.toLocaleDateString(locale, options)
  }
}

/** The month and the day; with {@link YEAR}, the three date formats' common ground. */
const MONTH_DAY = { month: 'short', day: 'numeric' } as const
const YEAR = { year: 'numeric' } as const

/**
 * A `short-date`: the day and the short month in the page language's order
 * ("Sep 22", « 22 sept. »), and the year only when the date falls in another
 * year than today — both years read in the operator time zone, so a date near
 * New Year is compared on the calendar the reader sees.
 */
const formatShortDate = (
  value: unknown,
  locale: string,
  timeZone: string | undefined,
  now: Readonly<Date> = new Date()
): string =>
  formatDate(
    value,
    locale,
    formatDate(value, 'en', YEAR, timeZone) === formatDate(now, 'en', YEAR, timeZone)
      ? MONTH_DAY
      : { ...MONTH_DAY, ...YEAR },
    timeZone
  )

/**
 * Past-only elapsed time, phrased in the page's language: "3 days ago" in
 * English, « il y a 3 jours » in French. The buckets are unchanged — whole
 * days under a month, 30-day months under a year, 365-day years beyond — and
 * only the phrasing moved to `Intl.RelativeTimeFormat`. `numeric: 'auto'` is
 * kept to the DAY unit, where it gives the familiar "today" / "yesterday";
 * a month or a year keeps its number ("1 month ago", not "last month").
 */
function formatRelativeDate(value: unknown, locale: string): string {
  const date = toDate(value)
  if (date === undefined) return String(value)
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (diffDays < 30) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-diffDays, 'day')
  }
  const phrase = new Intl.RelativeTimeFormat(locale, { numeric: 'always' })
  return diffDays < 365
    ? phrase.format(-Math.floor(diffDays / 30), 'month')
    : phrase.format(-Math.floor(diffDays / 365), 'year')
}

/**
 * The two answers of a `yes-no` column, by primary language subtag. `Intl`
 * carries no word for yes or no, so these few are written out; a language not
 * listed answers in English, the platform default every other format falls
 * back to.
 */
const YES_NO_WORDS: Readonly<Record<string, readonly [yes: string, no: string]>> = {
  en: ['Yes', 'No'],
  fr: ['Oui', 'Non'],
  de: ['Ja', 'Nein'],
  es: ['Sí', 'No'],
  it: ['Sì', 'No'],
  pt: ['Sim', 'Não'],
  nl: ['Ja', 'Nee'],
}

function formatYesNo(value: unknown, locale: string): string {
  const language = locale.split('-')[0]?.toLowerCase() ?? 'en'
  const [yes, no] = YES_NO_WORDS[language] ?? ['Yes', 'No']
  return value ? yes : no
}

/**
 * Signed, locale-aware relative-time format — the bidirectional counterpart to
 * the past-only `relative-date`. A FUTURE date renders forward
 * ("dans 5 j" in fr), a PAST date backward ("il y a 5 j"), via
 * `Intl.RelativeTimeFormat(locale, { style: 'short' }).format(diffDays, 'day')`.
 * `diffDays` is positive for the future (so a grace-window "scheduled erasure"
 * date reads as a countdown) and negative for the past.
 */
function formatRelativeTime(value: unknown, locale: string): string {
  const date = toDate(value)
  if (date === undefined) return String(value)
  const diffDays = Math.round((date.getTime() - Date.now()) / 86_400_000)
  return new Intl.RelativeTimeFormat(locale, { style: 'short' }).format(diffDays, 'day')
}

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

/** The per-value context a format may need beyond the locale. */
export interface CellFormatOptions {
  /** The bound field's declared currency treatment (`currency` format). */
  readonly currency?: CurrencyDisplayOptions
  /** IANA zone the three date formats render in (the operator timezone). */
  readonly timeZone?: string
  /**
   * The instant `short-date` reads "this year" at; the runtime's clock when
   * unset. The server passes its own `now` so a development clock
   * (`SOVRIUM_DEV_CLOCK`) decides the year there too; a browser's clock is its own.
   */
  readonly now?: Readonly<Date>
}

/**
 * Formats a bound value according to its declared display format.
 *
 * `locale` is the active page locale. Every format that writes a word or a
 * date follows it — the three date formats, `relative-date`, `relative-time`,
 * `compact` and `yes-no` — so a French page reads « 15 mars 2026 », « Oui » and
 * « 13 k ». The purely symbolic ones (`percentage`, `check-cross`, `bytes`,
 * `truncate`) do not need it. `currency` follows the field's own declared
 * treatment, and groups in the page language when the field declares no
 * separator.
 *
 * `options.currency` carries the bound field's declared currency treatment. It
 * used to be unreachable: this formatter hard-coded `$` and `en-US` while the
 * field's own `currency` never crossed into the browser, so a field declaring
 * `currency: 'EUR'` rendered `$0.35`. The arithmetic now lives in
 * `./currency-format`, shared with the records API's `?format=display` path,
 * so a grid cell and the formatted API value agree. With no declared
 * properties it falls back to the USD / 2-decimal / comma defaults this
 * formatter always emitted.
 *
 * `options.timeZone` is the IANA zone the three date formats render in: the operator
 * timezone (`SOVRIUM_TIMEZONE`, UTC when unset). The server passes it directly;
 * an island reads it off the page (`resolvePageTimezone`), which the server
 * stamped. Left `undefined`, a date renders in the runtime's own zone — the
 * host's POSIX `TZ` on the server, the visitor's zone in a browser — which is
 * why every caller that knows the operator zone passes it.
 *
 * The dispatch is a TOTAL `Record<ColumnFormat, …>` on purpose: adding a
 * literal to `ColumnFormatSchema` without teaching this function what it means
 * is a type error rather than a value that decodes and then renders verbatim.
 */
export function formatCellValue(
  value: unknown,
  format: ColumnFormat,
  locale: string,
  options: CellFormatOptions = {}
): string {
  const { currency: currencyOptions, timeZone, now } = options
  if (value === undefined || value === null) return ''
  const str = String(value)
  const tag = usableLocale(locale)

  const formatters: Readonly<Record<ColumnFormat, () => string>> = {
    truncate: () => (str.length > 50 ? `${str.slice(0, 50)}…` : str),
    currency: () => {
      const num = Number(value)
      return Number.isNaN(num) ? str : formatCurrencyValue(num, currencyOptions, tag)
    },
    percentage: () => {
      const num = Number(value)
      return Number.isNaN(num) ? str : `${num}%`
    },
    compact: () => {
      const num = Number(value)
      return Number.isNaN(num) ? str : Intl.NumberFormat(tag, { notation: 'compact' }).format(num)
    },
    // A byte count is NOT `compact`: SI decimal `11.5K` and binary `11 KB` are
    // different units, and a size printed in the wrong base beside a real file
    // is worse than no figure at all.
    bytes: () => {
      const num = Number(value)
      return Number.isNaN(num) ? str : formatByteCount(num)
    },
    'relative-date': () => formatRelativeDate(value, tag),
    // Signed counterpart to the past-only `relative-date`:
    // a future date renders "dans 5 j" (fr) and a past one "il y a 5 j" via
    // `Intl.RelativeTimeFormat(<page locale>, { style: 'short' })`.
    'relative-time': () => formatRelativeTime(value, tag),
    'short-date': () => formatShortDate(value, tag, timeZone, now),
    'long-date': () => formatDate(value, tag, { ...MONTH_DAY, ...YEAR, month: 'long' }, timeZone),
    datetime: () =>
      formatDate(
        value,
        tag,
        { ...MONTH_DAY, ...YEAR, hour: '2-digit', minute: '2-digit' },
        timeZone
      ),
    'yes-no': () => formatYesNo(value, tag),
    'check-cross': () => (value ? '✓' : '✗'),
  }

  return formatters[format]()
}
