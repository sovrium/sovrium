/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type AggregateFunction, reduceAggregate } from '../runtime/aggregate-functions'
import { readDisplayText } from '../runtime/record-display-label'
import { seriesColor, type ChartSeriesConfig } from './chart-series-shared'
import type { TableRecord } from '../runtime/types'

/**
 * Client-side aggregation for chart components.
 *
 * When a chart declares `chartAggregate`, records are grouped by the
 * `groupBy` field (optionally bucketed by a date interval) and a numeric
 * aggregate function is applied. The result is a `{ key, value }` series
 * ready for the bar/line canvases — the `groupBy` field becomes the X-axis
 * and the aggregated number becomes the Y-axis.
 */

export type DateInterval = 'day' | 'week' | 'month' | 'quarter' | 'year'

/** How the categories are ordered along the axis, or around the pie. */
export type CategoryOrder = 'option' | 'label' | 'value-asc' | 'value-desc'

export interface ChartAggregateConfig {
  readonly function: AggregateFunction
  readonly field?: string
  readonly groupBy: string
  readonly interval?: DateInterval
  readonly order?: CategoryOrder
  /** The aggregated series' colour — a theme role or a hex value. */
  readonly color?: string
  /** Draw at most this many categories; the rest fold into one named `otherLabel`. */
  readonly limit?: number
  /** Name of the folded remainder (default "Other"). */
  readonly otherLabel?: string
}

/**
 * One declared option of the grouping field, resolved server-side from
 * `app.tables` and forwarded in declared order. Present only when the chart
 * groups by a `single-select` or `status` field.
 */
export interface ChartCategoryOption {
  readonly value: string
  readonly label: string
  readonly color?: string
}

export interface AggregatedDatum {
  readonly key: string
  readonly value: number
  /** Display name of the category — the option's label when it declares one. */
  readonly label?: string
  /** Paint of the category — the option's declared colour, when it has one. */
  readonly color?: string
}

/**
 * Buckets a raw date value into a stable key for the requested interval.
 * Invalid dates fall back to the raw string so they still group together.
 */
function bucketDate(raw: unknown, interval: DateInterval): string {
  const date = new Date(String(raw))
  if (Number.isNaN(date.getTime())) return String(raw)

  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const pad = (n: number): string => String(n).padStart(2, '0')

  if (interval === 'year') return String(year)
  if (interval === 'quarter') return `${String(year)}-Q${String(Math.ceil(month / 3))}`
  if (interval === 'month') return `${String(year)}-${pad(month)}`
  if (interval === 'week') {
    // ISO-ish week bucket: anchor on the Thursday of the date's week.
    const anchor = new Date(Date.UTC(year, date.getUTCMonth(), day))
    const dayOfWeek = (anchor.getUTCDay() + 6) % 7
    anchor.setUTCDate(anchor.getUTCDate() - dayOfWeek)
    return `${String(anchor.getUTCFullYear())}-${pad(anchor.getUTCMonth() + 1)}-${pad(
      anchor.getUTCDate()
    )}`
  }
  // day (default)
  return `${String(year)}-${pad(month)}-${pad(day)}`
}

/** Resolves the X-axis grouping key for a single record. */
function groupKey(record: TableRecord, config: ChartAggregateConfig): string | undefined {
  const raw = record[config.groupBy]
  if (raw === undefined || raw === null) return undefined
  return config.interval ? bucketDate(raw, config.interval) : String(raw)
}

/**
 * Aggregates records into a `{ key, value }` series per `chartAggregate`.
 *
 * `count` ignores `field` entirely; every other function coerces the
 * `field` value to a number and skips non-finite entries.
 */
export function aggregateRecords(
  records: readonly TableRecord[],
  config: ChartAggregateConfig,
  options?: readonly ChartCategoryOption[],
  fallback: CategoryOrder = 'label'
): readonly AggregatedDatum[] {
  // Group raw numeric values (or `1`s for count) by their X-axis key.
  const buckets = records.reduce<Readonly<Record<string, readonly number[]>>>((acc, record) => {
    const key = groupKey(record, config)
    if (key === undefined) return acc

    if (config.function === 'count') {
      return { ...acc, [key]: [...(acc[key] ?? []), 1] }
    }

    if (!config.field) return acc
    const numeric = Number(record[config.field])
    if (!Number.isFinite(numeric)) return acc
    return { ...acc, [key]: [...(acc[key] ?? []), numeric] }
  }, {})

  const labels = categoryLabels(records, config)
  const data = Object.keys(buckets).map((key) => {
    const label = labels[key]
    return {
      key,
      value: reduceAggregate(config.function, buckets[key] ?? []),
      ...(label === undefined ? {} : { label }),
    }
  })
  return foldPastLimit(orderCategories(data, config.order, options, fallback), buckets, config)
}

/** The key the folded remainder is drawn under — no stored value can be it. */
export const OTHER_CATEGORY_KEY = '\u0000other'

/**
 * Past `limit`, the largest categories are kept — in the order already decided —
 * and every other one folds into ONE category named `otherLabel`, drawn last.
 * Its figure is the chart's own aggregate over the folded values: their sum
 * for a sum or a count, their average for an average.
 */
function foldPastLimit(
  data: readonly AggregatedDatum[],
  buckets: Readonly<Record<string, readonly number[]>>,
  config: ChartAggregateConfig
): readonly AggregatedDatum[] {
  const { limit } = config
  if (limit === undefined || data.length <= limit) return data
  const kept = new Set(
    data
      .toSorted((a, b) => b.value - a.value)
      .slice(0, limit)
      .map((datum) => datum.key)
  )
  const folded = data.filter((datum) => !kept.has(datum.key))
  const values = folded.flatMap((datum) => buckets[datum.key] ?? [])
  return [
    ...data.filter((datum) => kept.has(datum.key)),
    {
      key: OTHER_CATEGORY_KEY,
      label: config.otherLabel ?? 'Other',
      value: reduceAggregate(config.function, values),
    },
  ]
}

/**
 * The name each category is shown under when the grouping field stores a key
 * the records API labelled — a `user` column's account, a relationship's
 * related row (`_display`). The stored value stays the category's key, so two
 * accounts sharing a name are still two bars. Empty for a date-bucketed or an
 * unlabelled grouping.
 */
function categoryLabels(
  records: readonly TableRecord[],
  config: ChartAggregateConfig
): Readonly<Record<string, string>> {
  if (config.interval) return {}
  return records.reduce<Readonly<Record<string, string>>>((acc, record) => {
    const key = groupKey(record, config)
    if (key === undefined || acc[key] !== undefined) return acc
    const label = readDisplayText(record, config.groupBy)
    return label === undefined ? acc : { ...acc, [key]: label }
  }, {})
}

/** Position of a category in the declared options; undeclared ones sort last. */
const optionRank = (key: string, options: readonly ChartCategoryOption[]): number => {
  const index = options.findIndex((option) => option.value === key)
  return index === -1 ? options.length : index
}

/**
 * The name a category is SHOWN under: its option's label when the grouping
 * field declares one, else the label the records API resolved for its key,
 * else its value. `label` order sorts this, so the chart
 * reads alphabetically to the person looking at it rather than by stored values
 * they never see.
 */
const displayName = (
  datum: AggregatedDatum,
  options: readonly ChartCategoryOption[] | undefined
): string =>
  options?.find((option) => option.value === datum.key)?.label ?? datum.label ?? datum.key

/**
 * Orders the categories. With no declared `order`, a chart grouped by a select
 * field follows its options and any other grouping sorts by name; `fallback`
 * replaces that last default (a pie ranks its slices largest first). A category
 * the options do not declare goes after the declared ones, by name; ties on a
 * value order break by name too, so a redraw never reshuffles equal bars.
 * Names compare by the label shown, with the stored value as the tie-break.
 */
export function orderCategories<D extends AggregatedDatum>(
  data: readonly D[],
  order: CategoryOrder | undefined,
  options: readonly ChartCategoryOption[] | undefined,
  fallback: CategoryOrder = 'label'
): readonly D[] {
  const effective = order ?? (options && options.length > 0 ? 'option' : fallback)
  const byName = (a: D, b: D): number =>
    displayName(a, options).localeCompare(displayName(b, options)) || a.key.localeCompare(b.key)
  if (effective === 'value-asc') return data.toSorted((a, b) => a.value - b.value || byName(a, b))
  if (effective === 'value-desc') return data.toSorted((a, b) => b.value - a.value || byName(a, b))
  if (effective === 'option' && options) {
    return data.toSorted(
      (a, b) => optionRank(a.key, options) - optionRank(b.key, options) || byName(a, b)
    )
  }
  return data.toSorted(byName)
}

/**
 * Gives each category its option's label and colour, so every mark and the
 * legend read the same declaration. Categories without an option are returned
 * unchanged, and so is the whole series when the field declares none. A
 * colour the datum already carries — the chart's own `chartAggregate.color`,
 * painted on every bar — is kept: the author named it for this chart.
 */
export function decorateCategories<D extends AggregatedDatum>(
  data: readonly D[],
  options: readonly ChartCategoryOption[] | undefined
): readonly (D & { readonly label?: string; readonly color?: string })[] {
  if (!options || options.length === 0) return data
  return data.map((datum) => {
    const option = options.find((candidate) => candidate.value === datum.key)
    if (!option) return datum
    return {
      ...datum,
      label: option.label,
      ...(option.color === undefined || datum.color !== undefined ? {} : { color: option.color }),
    }
  })
}

/** Every datum in the one styling series' colour, or the data as they were without one. */
export const paintEvery = <T extends object>(
  data: readonly T[],
  series: readonly ChartSeriesConfig[] | undefined
): readonly T[] => {
  const styling = series?.[0]
  if (styling === undefined) return data
  const color = seriesColor(styling, 0)
  return data.map((datum) => ({ ...datum, color }))
}
