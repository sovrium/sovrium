/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type AggregateFunction, reduceAggregate } from '../shared/aggregate-functions'
import type { TableRecord } from '../shared/types'

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
 * - `currency` renders via `Intl.NumberFormat` with the `currency` option
 *   (defaults to USD) — e.g. `1500` -> `$1,500.00`.
 * - `percentage` suffixes a `%` and inserts grouping separators. An optional
 *   `options.scale` multiplier scales the raw value before formatting — pass
 *   `scale: '100'` to render a 0–1 fraction as a percent (e.g. `0.95` -> `95 %`).
 * - `compact` uses compact notation (e.g. `12000` -> `12K`).
 * - `bytes` renders a byte count as a compact human-readable string (French
 *   units `B/KB/MB/GB`) — e.g.
 *   `0` -> `0 B`, `1536` -> `2 KB`.
 * - `number` (default) inserts thousands separators.
 */
export function formatKpiValue(value: number, format: KpiFormatConfig | undefined): string {
  if (!format || format.type === 'number') {
    return new Intl.NumberFormat('en-US').format(value)
  }

  if (format.type === 'currency') {
    const currency = format.options?.currency ?? 'USD'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
  }

  if (format.type === 'percentage') {
    return formatPercentage(value, format.options?.scale)
  }

  if (format.type === 'bytes') {
    return formatBytes(value)
  }

  // compact
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value)
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
 * Formats a byte count into a compact human-readable string using French units
 * (`B/KB/MB/GB`), matching the admin Overview tile convention so a converted
 * tile renders byte-identically. Below 1024 bytes the raw count is suffixed with
 * `B`; larger values are rounded into the next unit.
 */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '0 B'
  if (bytes < 1024) return `${String(bytes)} B`
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${String(Math.round(bytes / (1024 * 1024)))} MB`
  return `${String(Math.round(bytes / (1024 * 1024 * 1024)))} GB`
}

/**
 * Conditional color threshold for the KPI metric value.
 *
 * Thresholds form ascending boundaries — the metric resolves to the color of
 * the highest threshold whose `value` it meets or exceeds. If the metric is
 * below every threshold, the lowest threshold's color applies.
 */
export interface KpiThresholdConfig {
  readonly value: number
  readonly color: string
}

/**
 * Resolves the threshold color for a metric value.
 *
 * Returns `undefined` when no thresholds are configured.
 */
export function resolveKpiThresholdColor(
  value: number,
  thresholds: readonly KpiThresholdConfig[] | undefined
): string | undefined {
  if (!thresholds || thresholds.length === 0) return undefined

  const sorted = thresholds.toSorted((a, b) => a.value - b.value)
  const met = sorted.filter((t) => value >= t.value)

  if (met.length > 0) return met[met.length - 1]?.color
  // Below every boundary — apply the lowest threshold's color.
  return sorted[0]?.color
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
