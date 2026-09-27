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
import { usableLocale } from '@/domain/kernel/format/usable-locale'
import { type AggregateFunction, reduceAggregate } from '../runtime/aggregate-functions'
import type { TableRecord } from '../runtime/types'

/**
 * Client-side aggregation + formatting for the KPI component.
 *
 * A KPI declares a single `kpiAggregate` ({ function, field }) applied over
 * the records returned for its `dataSource`, then an optional `kpiFormat`
 * controls how the resulting number is displayed.
 */

/** The numeric aggregate functions a KPI can apply (shared with charts). */
export type KpiAggregateFunction = AggregateFunction

export interface KpiAggregateConfig {
  readonly function: KpiAggregateFunction
  readonly field?: string
}

export type KpiFormatType = 'number' | 'currency' | 'percentage' | 'compact' | 'bytes'

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
export function aggregateKpi(records: readonly TableRecord[], config: KpiAggregateConfig): number {
  if (config.function === 'count') return records.length

  if (!config.field) return 0

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
 * - `percentage` suffixes a `%` and inserts grouping separators. An optional
 *   `options.scale` multiplier scales the raw value before formatting — pass
 *   `scale: '100'` to render a 0–1 fraction as a percent (e.g. `0.95` -> `95 %`).
 * - `compact` uses the page language's compact notation (`12K`, `1,2 M` in French).
 * - `bytes` renders a byte count as a compact human-readable string
 *   (binary `B/KB/MB/GB`) — e.g. `0` -> `0 B`, `1536` -> `2 KB`. THE SAME
 *   `formatByteCount` a column / `record-field` `format: 'bytes'` spends, so a
 *   tile and a row on one page cannot print one number two ways.
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
    percentage: () => formatPercentage(value, options?.scale),
    bytes: () => formatByteCount(value),
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
): Intl.NumberFormatOptions {
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
 * Formats a value as a percentage with a trailing `%` and grouping separators.
 *
 * An optional `scale` multiplier (a stringified number) scales the raw value
 * before formatting and rounds the result to a whole percent, so a 0–1 fraction
 * (e.g. an automation success rate) renders as a percent with `scale: '100'`
 * (`0.952` -> `95%`). Without a usable scale the value is formatted verbatim
 * (byte-identical to the original percentage format — no rounding).
 */
function formatPercentage(value: number, scaleOption: string | undefined): string {
  const scale = Number(scaleOption)
  const display = Number.isFinite(scale) && scale !== 0 ? Math.round(value * scale) : value
  return `${new Intl.NumberFormat('en-US').format(display)}%`
}

/**
 * Conditional color threshold for the KPI metric value.
 *
 * Thresholds form ascending boundaries — the metric resolves to the color of
 * the highest threshold whose `value` it meets or exceeds. A metric below
 * every boundary has met none of them and takes no threshold color at all.
 */
export interface KpiThresholdConfig {
  readonly value: number
  readonly color: string
}

/**
 * Resolves the threshold color for a metric value.
 *
 * Returns `undefined` when no thresholds are configured, and when the metric
 * sits below every boundary.
 *
 * That second case used to fall back to the lowest threshold's color, which
 * inverted the option's own meaning: a threshold is described as applying
 * *when the metric meets or exceeds the boundary*, so the band underneath the
 * first boundary is by definition uncolored. Painting it the first band's
 * color made "just under the alert line" and "just over it" look identical —
 * the one comparison the whole option exists to make visible.
 */
export function resolveKpiThresholdColor(
  value: number,
  thresholds: readonly KpiThresholdConfig[] | undefined
): string | undefined {
  if (!thresholds || thresholds.length === 0) return undefined

  const met = thresholds.filter((t) => value >= t.value).toSorted((a, b) => a.value - b.value)

  return met[met.length - 1]?.color
}

/**
 * Sparkline configuration — declares a value field, a date field to group on,
 * a grouping interval, and a trailing window of days to include.
 */
export interface KpiSparklineConfig {
  readonly field: string
  readonly groupBy: string
  readonly interval: 'day' | 'week' | 'month'
  readonly days: number
}

/** ISO date key (YYYY-MM-DD) for an arbitrary date value. */
function dayKey(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined
  const date = new Date(raw as string | number | Date)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString().slice(0, 10)
}

/**
 * Buckets records into a time series for the sparkline mini-chart.
 *
 * Each record's `groupBy` date is bucketed by ISO day; the `field` values are
 * summed per bucket. Buckets are returned ordered ascending by date.
 */
export function computeSparklineSeries(
  records: readonly TableRecord[],
  config: KpiSparklineConfig
): readonly number[] {
  // Extract { day, value } pairs, dropping records with invalid dates/values.
  const points = records
    .map((record) => ({
      day: dayKey(record[config.groupBy]),
      value: Number(record[config.field]),
    }))
    .filter((p): p is { day: string; value: number } => Boolean(p.day) && Number.isFinite(p.value))

  // Group + sum per ISO day into a plain immutable object.
  const buckets = points.reduce<Readonly<Record<string, number>>>(
    (acc, point) => ({ ...acc, [point.day]: (acc[point.day] ?? 0) + point.value }),
    {}
  )

  return Object.keys(buckets)
    .toSorted((a, b) => a.localeCompare(b))
    .map((day) => buckets[day] ?? 0)
}
