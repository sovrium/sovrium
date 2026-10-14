/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `ChartConfig` a chart draws from: one entry per series, or per category
 * when the categories carry their own colours, each with the name the legend
 * and the tooltip show and the paint every mark of it takes.
 *
 * Entries are keyed by POSITION (`series-0`, `category-2`) rather than by the
 * field or the category they stand for. A key becomes a CSS variable name
 * (`--color-<key>`), and neither a category value (`GET /api/orders`) nor a
 * field named after a theme role (`primary`) is safe there: the second would
 * shadow the theme's own `--color-primary` inside the chart.
 */

import type { ChartConfig } from '../parts/chart-primitives'

/** The paint of a config entry, as a mark reads it inside the chart container. */
export const chartColorVar = (key: string): string => `var(--color-${key})`

/**
 * The series palette: shadcn's five chart slots, in slot order. Series `n`
 * takes slot `n mod 5`, so a sixth series repeats the first colour rather than
 * falling off the ramp. Each slot is author-settable by name
 * (`design.colors['chart-1']` repaints `--chart-1`).
 */
export const CHART_PALETTE: ChartConfig = {
  'chart-1': { color: 'var(--chart-1)' },
  'chart-2': { color: 'var(--chart-2)' },
  'chart-3': { color: 'var(--chart-3)' },
  'chart-4': { color: 'var(--chart-4)' },
  'chart-5': { color: 'var(--chart-5)' },
}

const PALETTE_COLORS: readonly string[] = Object.values(CHART_PALETTE).flatMap((entry) =>
  entry.color === undefined ? [] : [entry.color]
)

/** The palette paint for slot `index`, wrapping around the five slots. */
export function paletteColor(index: number): string {
  return PALETTE_COLORS[index % PALETTE_COLORS.length] ?? 'currentColor'
}

/**
 * The role names a `series[].color` may name instead of a hex value. Only
 * names the theme mints a `--color-*` variable for are accepted, so a typo
 * falls through to the palette rather than to a paint the browser reads as
 * black.
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

/** A series colour as declared: one for both schemes, or one per scheme. */
export type DeclaredSeriesColor = string | { readonly light: string; readonly dark: string }

/** One declared colour as a paint: a hex value, a theme role, else nothing. */
function declaredPaint(declared: string): string | undefined {
  if (declared.startsWith('#')) return declared
  return THEME_TOKEN_NAMES.has(declared) ? `var(--color-${declared})` : undefined
}

/**
 * The paint for the series at `index`, given what the author declared: an
 * explicit hex wins, then a theme role, then the palette slot of this index.
 * A `{ light, dark }` pair paints through `light-dark()`, which follows the
 * page's colour scheme. Keyed on the index, so colouring one series never
 * repaints another.
 */
export function resolveSeriesColor(
  declared: DeclaredSeriesColor | undefined,
  index: number
): string {
  if (declared === undefined) return paletteColor(index)
  if (typeof declared === 'string') return declaredPaint(declared) ?? paletteColor(index)
  const light = declaredPaint(declared.light) ?? paletteColor(index)
  const dark = declaredPaint(declared.dark) ?? paletteColor(index)
  return `light-dark(${light}, ${dark})`
}

/** The config key of the series at `index`. */
export const seriesKey = (index: number): string => `series-${String(index)}`

/** The config key of the category at `index`. */
export const categoryKey = (index: number): string => `category-${String(index)}`

/** One config entry per series, named by its label (else its field) and painted by its colour. */
export function seriesConfig(
  series: readonly {
    readonly field: string
    readonly label?: string
    readonly color?: DeclaredSeriesColor
  }[]
): ChartConfig {
  return Object.fromEntries(
    series.map((entry, index) => [
      seriesKey(index),
      { label: entry.label ?? entry.field, color: resolveSeriesColor(entry.color, index) },
    ])
  )
}

/**
 * One config entry per category, named by its label (else its key) and painted
 * by its own colour, else by `fallback(index)`.
 */
export function categoryConfig(
  data: readonly { readonly key: string; readonly label?: string; readonly color?: string }[],
  fallback: (index: number) => string
): ChartConfig {
  return Object.fromEntries(
    data.map((datum, index) => [
      categoryKey(index),
      { label: datum.label ?? datum.key, color: datum.color ?? fallback(index) },
    ])
  )
}
