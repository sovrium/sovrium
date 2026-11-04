/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatByteCount } from '@/domain/kernel/format/byte-format'
import {
  formatCurrencyValue,
  type CurrencyDisplayOptions,
} from '@/domain/kernel/format/currency-format'
import { formatLongDuration } from '@/domain/kernel/format/uptime-duration'
import { usableLocale } from '@/domain/kernel/format/usable-locale'
import {
  type AggregateFunction,
  reduceAggregate,
} from '@/domain/models/app/tables/aggregate-reduce-service'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'

/**
 * A KPI's figure and how it reads: the aggregation over its records and the
 * formatting of the number. Pure, so the server draws the figure a tile shows
 * before its island starts, and the island prints the same text once it has.
 *
 * A KPI declares a single `kpiAggregate` ({ function, field }) applied over
 * the records returned for its `dataSource`, then an optional `kpiFormat`
 * controls how the resulting number is displayed.
 */

/** The numeric aggregate functions a KPI can apply (shared with charts). */
export type KpiAggregateFunction = AggregateFunction

/** One side of a ratio: the conditions a record of the data source must also meet. */
export interface KpiRatioSide {
  readonly filter: readonly DataFilter[]
}

export interface KpiAggregateConfig {
  /** A numeric function, or `ratio` — two counts the aggregate read answers. */
  readonly function: KpiAggregateFunction | 'ratio'
  readonly field?: string
  readonly numerator?: KpiRatioSide
  readonly denominator?: KpiRatioSide
  /** A ratio's footer: a sentence with `{numerator}`/`{denominator}`, or `false` for none. */
  readonly caption?: string | false
}

export type KpiFormatType = 'number' | 'currency' | 'percentage' | 'compact' | 'bytes' | 'duration'

export interface KpiFormatConfig {
  readonly type: KpiFormatType
  readonly options?: Readonly<Record<string, string>>
}

/**
 * Reduces the records down to a single numeric metric value.
 *
 * `count` ignores `field` entirely; every other function coerces the
 * `field` value to a number and skips non-finite entries.
 */
export function aggregateKpi(
  records: readonly Readonly<Record<string, unknown>>[],
  config: KpiAggregateConfig
): number {
  if (config.function === 'count') return records.length

  // A ratio is answered by the aggregate read only (`useKpiAggregate`).
  if (!config.field || config.function === 'ratio') return 0

  const { field } = config
  const values = records.map((record) => Number(record[field])).filter((n) => Number.isFinite(n))

  return reduceAggregate(config.function, values)
}

/**
 * Formats the aggregated metric value for display.
 *
 * - `currency` writes the amount in the page language. Over a field that
 *   declares its currency display (`display`, resolved server-side from the
 *   aggregated field), it goes through the shared currency formatter, so the
 *   field's precision and any declared separator hold — `€667,000` for a
 *   whole-euro field, `667 000 €` on a French page. `options.currency` names
 *   the currency when declared (defaults to the field's, then USD).
 * - `percentage` suffixes a `%` and inserts grouping separators, and applies
 *   `minimumFractionDigits` / `maximumFractionDigits` as `number` does. An optional
 *   `options.scale` multiplier scales the raw value before formatting — pass
 *   `scale: '100'` to render a 0–1 fraction as a percent (e.g. `0.95` -> `95 %`).
 * - `compact` uses the page language's compact notation (`12K`, `1,2 M` in French).
 * - `bytes` renders a byte count as a compact human-readable string
 *   (binary `B/KB/MB/GB`, `o/ko/Mo/Go` on a French page) — e.g. `0` -> `0 B`,
 *   `1536` -> `1.5 KB` (`1,5 ko`). THE SAME
 *   `formatByteCount` a column / `record-field` `format: 'bytes'` spends, so a
 *   tile and a row on one page cannot print one number two ways.
 * - `duration` renders an elapsed time as one compact readout (`8.9 s`,
 *   `2 min 50 s`, `6 d 4 h`) through the same `formatElapsedDuration` a column's
 *   `format: 'duration'` spends, with days past a day. The value is milliseconds unless
 *   `options.unit` is `s`.
 * - `number` (default) inserts thousands separators in the page's language
 *   (`locale`, read from `<html lang>` by the island) and applies the declared
 *   `minimumFractionDigits` / `maximumFractionDigits` options — so a French
 *   page writes an average of 493.875 with one fraction digit as `493,9`.
 */
export function formatKpiValue(
  value: number,
  format: KpiFormatConfig | undefined,
  locale = 'en-US',
  display?: CurrencyDisplayOptions
): string {
  const options = format?.options
  const tag = usableLocale(locale)
  const formatters: Readonly<Record<KpiFormatType, () => string>> = {
    number: () => new Intl.NumberFormat(tag, fractionDigits(options)).format(value),
    currency: () => formatKpiCurrency(value, options?.currency, tag, display),
    percentage: () => formatPercentage(value, options, tag),
    bytes: () => formatByteCount(value, tag),
    duration: () =>
      formatLongDuration(value, tag, options?.unit === 's' ? 'seconds' : undefined) ??
      String(value),
    compact: () => new Intl.NumberFormat(tag, { notation: 'compact' }).format(value),
  }
  return formatters[format?.type ?? 'number']()
}

/**
 * A currency KPI. With the aggregated field's display known, the shared
 * formatter applies its precision and separators in the page language; with
 * none (a count, or a plain number field), `Intl` writes the amount in the
 * page language with the currency's own digits.
 */
function formatKpiCurrency(
  value: number,
  currency: string | undefined,
  locale: string,
  display: CurrencyDisplayOptions | undefined
): string {
  if (display !== undefined) {
    return formatCurrencyValue(
      value,
      { ...display, currency: currency ?? display.currency ?? 'USD' },
      locale
    )
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency ?? 'USD',
  }).format(value)
}

/**
 * The fraction-digit options a `number` format declares, as `Intl` options.
 * They arrive as strings (the option bag is `Record<string, string>`); a value
 * that is not a whole number in `Intl`'s 0–100 range is ignored rather than
 * allowed to throw a `RangeError` and take the card down with it.
 */
function fractionDigits(
  options: Readonly<Record<string, string>> | undefined
): Readonly<Intl.NumberFormatOptions> {
  const digits = (raw: string | undefined): number | undefined => {
    const n = Number(raw)
    return raw !== undefined && Number.isInteger(n) && n >= 0 && n <= 100 ? n : undefined
  }
  const max = digits(options?.maximumFractionDigits)
  const requestedMin = digits(options?.minimumFractionDigits)
  const min =
    requestedMin !== undefined && max !== undefined ? Math.min(requestedMin, max) : requestedMin
  return {
    ...(min !== undefined ? { minimumFractionDigits: min } : {}),
    ...(max !== undefined ? { maximumFractionDigits: max } : {}),
  }
}

/**
 * Formats a value as a percentage in the page language — `66.7%` in English,
 * `66,7 %` in French — with its grouping separators.
 *
 * An optional `scale` multiplier (a stringified number) scales the raw value
 * before formatting and rounds the result to a whole percent, so a 0–1 fraction
 * (e.g. an automation success rate) renders as a percent with `scale: '100'`
 * (`0.952` -> `95%`). Declared `minimumFractionDigits` / `maximumFractionDigits`
 * round it as they round a `number` (`66.7%` at one digit) and take over from
 * that whole-percent rounding. With neither, the value is formatted verbatim.
 */
function formatPercentage(
  value: number,
  options: Readonly<Record<string, string>> | undefined,
  locale: string
): string {
  const scale = Number(options?.scale)
  const digits = fractionDigits(options)
  const scaled = Number.isFinite(scale) && scale !== 0 ? value * scale : undefined
  const declared = Object.keys(digits).length > 0
  const display = scaled === undefined ? value : declared ? scaled : Math.round(scaled)
  // `percent` style multiplies by 100 and defaults to whole percents; the value
  // is already a percent, and an undeclared ceiling keeps a number's three digits.
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: Math.max(3, digits.minimumFractionDigits ?? 0),
    ...digits,
  }).format(display / 100)
}
