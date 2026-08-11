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

import type { TableRecord } from '../shared/types'

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
 * defined in the default theme layer). Slot 1 follows the app's
 * `theme.colors.primary` when one is declared; the rest are a fixed categorical
 * ramp, so a multi-series chart stays readable instead of becoming N shades of
 * one hue.
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
 * The paint for a chart that declares no `series` array at all — the
 * `chartAggregate` shape, which is what every chart in the shipped templates
 * actually uses. It is slot 0 of the same palette, so a single-series chart is
 * on-brand for the same reason and by the same mechanism as a multi-series one,
 * instead of carrying a private literal that no theme could reach.
 */
export const PRIMARY_SERIES_PAINT = resolveSeriesPaint(undefined, 0)

/** Shared SVG inner-area margin for the multi-series chart canvases. */
export const CHART_MARGIN = { top: 16, right: 16, bottom: 40, left: 56 } as const

/** Container/body Tailwind classes shared by the multi-series chart shell. */
export const CHART_CONTAINER_CLASSES = 'relative w-full h-80'
export const CHART_BODY_CLASSES = 'relative h-72 w-full'

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
