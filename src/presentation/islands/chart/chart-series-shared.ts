/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared types and helpers for the multi-series chart family. Kept in a
 * non-component module so `chart-legend`, `chart-shell` and the
 * `multi-{line,bar,area}-chart` canvases can all import them without
 * forming an import cycle.
 */

import { scaleLinear } from '@visx/scale'
import type { ChartAxisFormat } from './chart-format'
import type { TableRecord } from '../runtime/types'

/**
 * One category of a chart: an x-key and the numeric value plotted against it.
 *
 * Shared rather than per-canvas because it is the same datum whichever mark
 * draws it — a bar's height, a line vertex's y, a pie slice's angle.
 */
export interface CategoryDatum {
  readonly key: string
  readonly value: number
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
  readonly color?: string
  /** Stack group name — series sharing a name stack together (bar/area). */
  readonly stack?: string
  /** Area fill opacity (0-1) for area-type series. */
  readonly fillOpacity?: number
}

/** Legend placement relative to the chart canvas. */
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right' | 'none'

/**
 * How many slots the chart palette declares (`--sv-chart-1` … `--sv-chart-5`,
 * defined in the default theme layer).
 *
 * All five are a fixed categorical ramp — five hues held at one lightness and
 * one chroma, which is what makes them read as peers rather than as a ranking,
 * and what keeps a multi-series chart from becoming N shades of one hue. Slot 1
 * used to follow the app's declared primary; that anchor was retired precisely
 * because an arbitrary brand colour pulls one series off that plane.
 *
 * Each slot is still author-settable, by NAME rather than by inference: a
 * `design.colors['chart-1']` reaches `--sv-chart-1` through the same bridge as
 * every other role.
 */
const PALETTE_SLOTS = 5

/**
 * The role names a `series[].color` may name instead of a hex.
 *
 * `ChartSeriesSchema.color` is documented as "theme token name or hex value"
 * and config validation accepts both, but the string used to reach SVG
 * verbatim — so `color: 'primary'` arrived as `fill="primary"`, which is not a
 * colour at all. Chromium resolved it to opaque black and left the matching
 * legend swatch fully transparent, meaning an author who followed the schema's
 * own description got a worse result than one who declared nothing.
 *
 * Only names the theme actually mints a `--color-*` variable for are accepted,
 * so a typo falls through to the palette — a visible, wrong-ish colour — rather
 * than to a black bar.
 */
const THEME_TOKEN_NAMES: ReadonlySet<string> = new Set([
  'primary',
  'secondary',
  'accent',
  'success',
  'warning',
  'error',
  'destructive',
  'info',
  'muted',
  'foreground',
  'background',
])

/**
 * The paint for the series at `index`, given whatever the author declared (if
 * anything).
 *
 * Precedence: an explicit hex wins outright, then a theme token name, then the
 * palette slot for this index.
 *
 * Resolution is keyed on the series INDEX — never on declaration order, and
 * never on which slots are still unused. Colouring one series must not repaint
 * its siblings, which is exactly what a "next unused colour" scheme would do
 * the moment an author touched a single series.
 *
 */
function resolveSeriesPaint(declared: string | undefined, index: number): string {
  if (declared !== undefined && declared.startsWith('#')) return declared
  if (declared !== undefined && THEME_TOKEN_NAMES.has(declared)) return `var(--color-${declared})`
  return `var(--sv-chart-${String((index % PALETTE_SLOTS) + 1)})`
}

/** Resolves a per-series colour from its config and its index in the series list. */
export function seriesColor(s: ChartSeriesConfig, index: number): string {
  return resolveSeriesPaint(s.color, index)
}

/**
 * The palette paint for slot `index`, for marks that are coloured by their
 * POSITION rather than by a series config — a pie or donut slice, where the
 * categories are the data and there is no `series[]` entry to carry a colour.
 *
 * Wraps around the five slots exactly as `seriesColor` does, so a six-category
 * pie repeats hue 1 rather than falling off the ramp into an unpainted mark.
 */
export function paletteColor(index: number): string {
  return resolveSeriesPaint(undefined, index)
}

/**
 * The paint for a chart that declares no `series` array at all — the
 * `chartAggregate` shape, which is what every chart in the shipped templates
 * actually uses. It is slot 0 of the same palette, so a single-series chart is
 * on-brand for the same reason and by the same mechanism as a multi-series one,
 * instead of carrying a private literal that no theme could reach.
 */
export const PRIMARY_SERIES_PAINT = paletteColor(0)

/**
 * Shared SVG inner-area margin for the multi-series chart canvases.
 *
 * `left` is 72 rather than the 56 it was, and the 16px is not decoration: the
 * value axis now draws tick labels into that gutter, right-aligned 6px from the
 * baseline. A `$50,000` tick at the 10px tick size overruns 50px, so at 56 the
 * widest label on a real revenue series bled out of the card. 72 is the same
 * gutter the single-series bar canvas has always reserved for the same labels,
 * so the two bindings now frame their plots identically.
 */
export const CHART_MARGIN = { top: 16, right: 16, bottom: 40, left: 72 } as const

// The container/body classes that used to sit here moved to the chart recipe
// (`@/presentation/utils/recipes/chart-default-classes`). They were declared
// THREE times — once here as `relative w-full h-80`, and once each in
// `bar-chart.tsx` and `line-chart.tsx` as a LOCAL `CHART_CONTAINER_CLASSES`
// that shadowed this one and silently dropped the `relative`. The recipe is
// now the one place the chart card is described, and the SSR twin spends it too.

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

/** Computes the maximum Y value across every visible series. */
export function maxAcrossSeries(
  records: readonly TableRecord[],
  series: readonly ChartSeriesConfig[]
): number {
  return series.reduce((max, s) => {
    const seriesMax = records.reduce((m, r) => {
      const v = numericValue(r[s.field])
      return v > m ? v : m
    }, 0)
    return seriesMax > max ? seriesMax : max
  }, 0)
}

/** Toggles a series field in the hidden-set, returning a fresh immutable set. */
export function toggleHidden(prev: ReadonlySet<string>, field: string): ReadonlySet<string> {
  const remaining = [...prev].filter((f) => f !== field)
  return prev.has(field) ? new Set(remaining) : new Set([...prev, field])
}

// ──────────────────────────────────────────────────────────────────────────────
// VALUE AXIS — the scale every canvas maps a number onto, and how `yAxis` bends it
// ──────────────────────────────────────────────────────────────────────────────

/** How a value axis maps data onto pixels — the `yAxis.scale` literal. */
export type ChartAxisScale = 'linear' | 'logarithmic'

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
  readonly scale?: ChartAxisScale
  readonly gridLines?: boolean
}

/**
 * A resolved value axis: where each datum lands in pixels, and which values the
 * axis labels.
 *
 * A logarithmic axis is a LINEAR pixel scale over log-projected values — not a
 * `scaleLog`. The distinction is a payload one and it was measured, not assumed:
 * pulling `scaleLog` in costs the chart island ~4.35 KB, because d3's log scale
 * drags its tick formatter (and `d3-format` behind that) along with it. Every
 * visitor who mounts any chart would pay that for an option almost no chart
 * declares, which is exactly the "pay for what you do not use" shape the island
 * payload budget exists to catch. Projecting through `Math.log10` costs nothing
 * and places a mark identically.
 */
export interface ChartValueScale {
  /**
   * The pixel scale, in PROJECTED space — its input is `project(value)`, never a
   * raw datum. Exposed only for visx marks that read a scale's `range()` to find
   * their baseline (`AreaClosed`); every other caller wants `toY`.
   */
  readonly pixels: ReturnType<typeof scaleLinear<number>>
  /**
   * The pixel Y for one RAW data value, clamped into the plot.
   *
   * Every mark goes through this rather than touching `pixels` directly, because
   * a logarithmic projection is undefined at zero and below its floor — and an
   * `NaN` reaching a `height` attribute is a mark that silently does not draw.
   */
  readonly toY: (value: number) => number
  /**
   * The values this axis labels, in RAW data space. Named `tickValues` rather
   * than `ticks` so nothing reads it as d3's `ticks()` METHOD and calls it.
   */
  readonly tickValues: readonly number[]
}

/** The number of tick labels a linear value axis aims for. */
const VALUE_TICK_TARGET = 5

/**
 * Where a logarithmic value axis starts.
 *
 * A log axis cannot reach zero, so it needs a floor, and the floor is a CHOICE
 * that shows: put it at the smallest datum and that datum draws as nothing.
 * One decade below instead, so the smallest bar still has visible height and the
 * bound stays a round power of ten rather than an arbitrary number pulled off
 * the data.
 */
function logarithmicFloor(minPositive: number): number {
  return 10 ** (Math.floor(Math.log10(minPositive)) - 1)
}

/** Every power of ten inside `[floor, top]` — the labels a log axis carries. */
function decadeTicks(floor: number, top: number): readonly number[] {
  const first = Math.ceil(Math.log10(floor))
  const span = Math.floor(Math.log10(top)) - first + 1
  return Array.from({ length: Math.max(0, span) }, (_, i) => 10 ** (first + i))
}

/** Holds a pixel coordinate inside the plot, and answers the floor for a NaN. */
function clampToPlot(y: number, innerHeight: number): number {
  if (!Number.isFinite(y)) return innerHeight
  return Math.min(innerHeight, Math.max(0, y))
}

/** The logarithmic branch: a linear pixel scale over `log10` of each datum. */
function logarithmicScale(args: {
  readonly max: number
  readonly minPositive: number
  readonly innerHeight: number
}): ChartValueScale {
  const { max, minPositive, innerHeight } = args
  const floor = logarithmicFloor(minPositive)
  const top = max > floor ? max : floor * 10
  // Deliberately NOT `nice`d: rounding the top out to the next power of ten
  // would shrink the tallest mark away from the top of the plot, and two charts
  // differing only in `scale` would stop being comparable by height.
  const pixels = scaleLinear<number>({
    domain: [Math.log10(floor), Math.log10(top)],
    range: [innerHeight, 0],
  })
  const project = (value: number): number => (value > 0 ? Math.log10(value) : Math.log10(floor))
  return {
    pixels,
    toY: (value) => clampToPlot(pixels(project(value)), innerHeight),
    tickValues: decadeTicks(floor, top),
  }
}

/**
 * Builds the value scale for one plot from the declared `yAxis.scale`.
 *
 * Logarithmic is honoured only when the data can carry it — at least one
 * strictly positive value. A series that is all zeroes has no logarithmic
 * reading at all, so it falls back to linear rather than to an empty domain.
 */
export function buildValueScale(args: {
  readonly maxValue: number
  readonly minPositiveValue: number
  readonly innerHeight: number
  readonly scale: ChartAxisScale | undefined
}): ChartValueScale {
  const { maxValue, minPositiveValue, innerHeight, scale } = args
  const max = maxValue > 0 ? maxValue : 1
  const usable = Number.isFinite(minPositiveValue) && minPositiveValue > 0
  if (scale === 'logarithmic' && usable) {
    return logarithmicScale({ max, minPositive: minPositiveValue, innerHeight })
  }
  const pixels = scaleLinear<number>({ domain: [0, max], range: [innerHeight, 0], nice: true })
  return {
    pixels,
    toY: (value) => clampToPlot(pixels(value), innerHeight),
    tickValues: pixels.ticks(VALUE_TICK_TARGET),
  }
}

/**
 * The smallest strictly positive value across every visible series, or
 * `Infinity` when there is none. It is the input a logarithmic domain needs and
 * the maximum alone cannot supply.
 */
export function minPositiveAcrossSeries(
  records: readonly TableRecord[],
  series: readonly ChartSeriesConfig[]
): number {
  return series.reduce((min, s) => {
    const seriesMin = records.reduce((m, r) => {
      const v = numericValue(r[s.field])
      return v > 0 && v < m ? v : m
    }, Number.POSITIVE_INFINITY)
    return seriesMin < min ? seriesMin : min
  }, Number.POSITIVE_INFINITY)
}

/** The smallest strictly positive value in a reduced `{ key, value }` series. */
export function minPositiveInCategories(data: readonly CategoryDatum[]): number {
  return data.reduce(
    (min, d) => (d.value > 0 && d.value < min ? d.value : min),
    Number.POSITIVE_INFINITY
  )
}
