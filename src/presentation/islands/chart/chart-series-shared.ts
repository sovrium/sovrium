/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared types and helpers of the chart bindings: the category datum, the
 * declared series, and the record readers every binding builds its rows with.
 * Kept in a non-component module so the canvases can all import them without
 * forming an import cycle.
 */

import type { ChartAxisFormat } from './chart-format'
import type { ValueAxisScale } from './value-axis'
import type { TableRecord } from '../runtime/types'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'

/**
 * One category of a chart: an x-key and the numeric value plotted against it.
 *
 * Shared rather than per-canvas because it is the same datum whichever mark
 * draws it — a bar's height, a line vertex's y, a pie slice's angle.
 */
export interface CategoryDatum {
  readonly key: string
  readonly value: number
  /** Display name — the grouping option's label, when the field declares one. */
  readonly label?: string
  /** Paint — the grouping option's declared colour, which wins over the palette. */
  readonly color?: string
}

/**
 * Reduces records into a `{ key, value }` series by mapping each record onto an
 * x-key (`xField`) and a numeric y-value (`yField`). When several records share
 * an x-key their values are summed — which keeps a chart honest when upstream
 * data has duplicates.
 */
export function buildCategoryData(
  records: readonly TableRecord[],
  xField: string,
  yField: string
): readonly CategoryDatum[] {
  // Reduce over records into an immutable record keyed by x-value, then
  // project to an array. Avoids in-place Map mutation.
  const grouped = records.reduce<Readonly<Record<string, number>>>((acc, r) => {
    const xRaw = r[xField]
    const yRaw = r[yField]
    if (xRaw === undefined || xRaw === null) return acc
    const key = String(xRaw)
    const value = typeof yRaw === 'number' ? yRaw : Number(yRaw)
    if (!Number.isFinite(value)) return acc
    return { ...acc, [key]: (acc[key] ?? 0) + value }
  }, {})
  return Object.entries(grouped).map(([key, value]) => ({ key, value }))
}

/** A resolved data series — field binding plus display metadata. */
export interface ChartSeriesConfig {
  readonly field: string
  readonly label?: string
  /** One colour, or one per colour scheme. */
  readonly color?: string | { readonly light: string; readonly dark: string }
  /** A Lucide icon's server-resolved geometry, drawn before the name in the legend. */
  readonly iconNode?: unknown
  /** Stack group name — series sharing a name stack together (bar/area). */
  readonly stack?: string
  /** Area fill opacity (0-1) for area-type series. */
  readonly fillOpacity?: number
}

/**
 * The series that styles an aggregated chart: its one declared `series` entry,
 * else a single series painted `chartAggregate.color`, else none (the palette's
 * first colour). `field` is a placeholder the styled aggregate overrides.
 */
export function aggregateStylingSeries(
  series: readonly ChartSeriesConfig[] | undefined,
  color: string | undefined,
  chartType?: string
): readonly ChartSeriesConfig[] | undefined {
  if (series !== undefined && series.length > 0) return series
  if (color !== undefined) return [{ field: '', color }]
  // An area has no one-mark-per-category canvas: it is always drawn as one
  // filled series, in the palette's first colour when none is named.
  return chartType === 'area' ? [{ field: '' }] : undefined
}

/** Legend placement relative to the chart canvas. */
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right' | 'none'

/** Coerces a record cell to a finite number, or 0 when not numeric. */
export function numericValue(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : 0
}

/** Extracts the ordered set of distinct X-axis keys from the records. */
export function xKeys(records: readonly TableRecord[], xField: string): readonly string[] {
  return records.reduce<readonly string[]>((acc, r) => {
    const raw = r[xField]
    if (raw === undefined || raw === null) return acc
    const key = String(raw)
    return acc.includes(key) ? acc : [...acc, key]
  }, [])
}

/** Toggles a series field in the hidden-set, returning a fresh immutable set. */
export function toggleHidden(prev: ReadonlySet<string>, field: string): ReadonlySet<string> {
  const remaining = [...prev].filter((f) => f !== field)
  return prev.has(field) ? new Set(remaining) : new Set([...prev, field])
}

/**
 * Per-axis display configuration, forwarded verbatim from the chart schema's
 * `xAxis`/`yAxis`: a custom title, a tick format, a scale, and grid lines.
 *
 * It lives here rather than beside one canvas because BOTH bindings honour it —
 * the single-series aggregate canvas and the multi-series family — and while it
 * was declared next to only one of them, only that one could be made to read it.
 */
export interface ChartAxisDisplay {
  readonly label?: string
  readonly format?: ChartAxisFormat
  readonly scale?: ValueAxisScale
  readonly gridLines?: boolean
  /** The plotted field's currency display, read by a `format: 'currency'` axis. */
  readonly currency?: CurrencyDisplayOptions
}
