/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../runtime/types'

/**
 * The KPI's threshold colour and sparkline series, reduced in the browser from
 * the records the tile read. Its figure and the figure's text are the domain's
 * (`kpi-figure-service.ts`), shared with the server, which draws them first.
 */

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
  readonly interval: 'minute' | 'hour' | 'day' | 'week' | 'month'
  readonly days: number
}

/**
 * The bucket key of a date value: its UTC minute or hour as an ISO instant,
 * else its ISO day (YYYY-MM-DD). Keys of one interval sort in time.
 */
function bucketKey(raw: unknown, interval: KpiSparklineConfig['interval']): string | undefined {
  if (raw === undefined || raw === null) return undefined
  const time = new Date(raw as string | number | Date).getTime()
  if (Number.isNaN(time)) return undefined
  const step = interval === 'hour' ? 3_600_000 : interval === 'minute' ? 60_000 : 0
  const iso = new Date(time - (step === 0 ? 0 : time % step)).toISOString()
  return step === 0 ? iso.slice(0, 10) : iso
}

/**
 * Buckets records into a time series for the sparkline mini-chart.
 *
 * Each record's `groupBy` date is bucketed by UTC minute or hour when the
 * interval asks for one, else by ISO day; the `field` values are summed per
 * bucket. Buckets are returned ordered ascending by date.
 */
export function computeSparklineSeries(
  records: readonly TableRecord[],
  config: KpiSparklineConfig
): readonly number[] {
  // Extract { day, value } pairs, dropping records with invalid dates/values.
  const points = records
    .map((record) => ({
      day: bucketKey(record[config.groupBy], config.interval),
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
