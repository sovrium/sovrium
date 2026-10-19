/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows a cartesian chart hands recharts, and the value axis they span.
 *
 * A row carries each series' value twice: as the author wrote it (`raw`, which
 * the tooltip prints) and as drawn, under the series' field. The two differ only
 * on a logarithmic axis, which cannot place zero, so a mark at zero is drawn at
 * the axis' floor while the tooltip still reads zero.
 */

import { buildValueAxis, plotValue, type ValueAxis, type ValueAxisScale } from './value-axis'

/** One category of a cartesian chart, with the value of each series at it. */
export interface CartesianRowInput {
  /** The category — the X axis key. */
  readonly key: string
  /** The category's display name, when its option declares one. */
  readonly label?: string
  /** The row's own paint, which wins over its series' (an option's colour). */
  readonly fill?: string
  /** The callout heading, read from the tooltip's `labelKey` field. */
  readonly heading?: string
  /** The name each callout entry takes, read from the tooltip's `nameKey` field. */
  readonly name?: string
  /** Each series' value, keyed by the series' field. */
  readonly raw: Readonly<Record<string, number>>
}

/** A row as recharts reads it: the input, plus each series' drawn value under {@link drawnKey}. */
export type CartesianRow = CartesianRowInput & { readonly [drawn: string]: unknown }

/**
 * Where a row holds the drawn value of `field` — prefixed, so a field named
 * `key`, `label` or `raw` can never overwrite the row's own properties.
 */
export const drawnKey = (field: string): string => `plot:${field}`

/** The field a drawn key was made from. */
export const fieldOfDrawnKey = (key: string): string =>
  key.startsWith('plot:') ? key.slice('plot:'.length) : key

/** The series a value axis is measured over: its field and its stack group. */
interface MeasuredSeries {
  readonly field: string
  readonly stack?: string
}

/** True when every shown series names one and the same stack group. */
export function isStacked(shown: readonly MeasuredSeries[]): boolean {
  const [first] = shown
  return first?.stack !== undefined && shown.every((series) => series.stack === first.stack)
}

/** The value of `field` in a row, or zero when the row has none. */
const valueOf = (row: CartesianRowInput, field: string): number => row.raw[field] ?? 0

/**
 * The value axis over the shown series: up to the tallest mark — the tallest
 * column when the bars stack — and, for a logarithmic axis, down from the
 * smallest positive value.
 */
export function valueAxisOver(
  rows: readonly CartesianRowInput[],
  shown: readonly MeasuredSeries[],
  options: { readonly stacked: boolean; readonly scale: ValueAxisScale | undefined }
): ValueAxis {
  const heights = rows.map((row) =>
    options.stacked
      ? shown.reduce((sum, series) => sum + valueOf(row, series.field), 0)
      : shown.reduce((max, series) => Math.max(max, valueOf(row, series.field)), 0)
  )
  const values = rows.flatMap((row) => shown.map((series) => valueOf(row, series.field)))
  const positives = values.filter((value) => value > 0)
  return buildValueAxis({
    maxValue: heights.reduce((max, height) => Math.max(max, height), 0),
    minPositiveValue: positives.reduce((min, value) => Math.min(min, value), Infinity),
    scale: options.scale,
    integral: values.every((value) => Number.isInteger(value)),
  })
}

/** Each row with every shown series' value as drawn on `axis`. */
export function drawnRows(
  rows: readonly CartesianRowInput[],
  shown: readonly MeasuredSeries[],
  axis: ValueAxis
): readonly CartesianRow[] {
  return rows.map((row) => ({
    ...row,
    ...Object.fromEntries(
      shown.map((series) => [drawnKey(series.field), plotValue(axis, valueOf(row, series.field))])
    ),
  }))
}
