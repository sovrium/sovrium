/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Every chart drawn against a pair of axes — `bar`, `line`, `area` and
 * `scatter`, one series or several — rendered through recharts.
 *
 * One component rather than one per mark: the axes, the value scale, the grid,
 * the legend, the hidden-series toggle and the tooltip are the same for all
 * four, and the mark is a choice made per series. The bindings that feed it
 * (an aggregate, a raw axis pair, a `series` array) differ only in how they
 * build the rows, which they do before they get here.
 */

import { useCallback, useMemo, useState } from 'react'
import { ComposedChart } from 'recharts'
import { ChartTooltip, ChartTooltipContent } from '../parts/chart-primitives'
import { categoryAxisElement, gridElement, valueAxisElement } from './cartesian-axes'
import { seriesMark, type CartesianMark, type CartesianSeries } from './cartesian-marks'
import {
  drawnRows,
  fieldOfDrawnKey,
  isStacked,
  valueAxisOver,
  type CartesianRow,
  type CartesianRowInput,
} from './cartesian-rows'
import { formatTooltipText } from './chart-format'
import { ChartFrame, type ChartFrameLegend } from './chart-frame'
import { toggleHidden, type LegendPosition } from './chart-series-shared'
import type { ChartTooltipConfig } from './chart-canvas-types'
import type { ValueAxisScale } from './value-axis'
import type { ChartConfig, ChartTooltipLine, ChartTooltipRow } from '../parts/chart-primitives'
import type { ReactElement } from 'react'
import type { TooltipPayloadEntry } from 'recharts'

/** The tooltip a chart draws on hover, when it draws one: the declared `tooltip`, and what `{label}` reads. */
export interface CartesianTooltip extends ChartTooltipConfig {
  /** Does `{label}` read the hovered category, or the hovered series? */
  readonly labelOf: 'category' | 'series'
}

export interface CartesianChartProps {
  readonly mark: CartesianMark
  readonly rows: readonly CartesianRowInput[]
  readonly series: readonly CartesianSeries[]
  readonly config: ChartConfig
  /** The declared `yAxis.scale`; the axis spans the series still shown. */
  readonly scale?: ValueAxisScale
  readonly categoryLabel: (key: string) => string
  readonly valueLabel: (value: number) => string
  /** A bar's `data-bar-key`: its category alone, or its category and series. */
  readonly barKeyOf: 'category' | 'series'
  readonly xTitle?: string
  readonly yTitle?: string
  readonly gridLines?: boolean
  readonly tooltip?: CartesianTooltip
  /** The declared legend; absent draws none. Its entries toggle their series. */
  readonly legend?: { readonly position?: LegendPosition; readonly visible?: boolean }
  readonly accessibleName: string
}

/** One callout row: the `format` line when declared, else the entry's name and value. */
function tooltipRow(
  tooltip: CartesianTooltip | undefined,
  row: CartesianRow,
  entry: { readonly seriesName: string; readonly value: string; readonly raw: number }
): ChartTooltipRow {
  if (tooltip?.format === undefined)
    return { name: row.name ?? entry.seriesName, value: entry.value }
  const label = tooltip.labelOf === 'category' ? (row.label ?? row.key) : entry.seriesName
  return { text: formatTooltipText(tooltip.format, label, entry.raw) }
}

const CHART_MARGIN = { top: 16, right: 16, bottom: 0, left: 0 } as const

/**
 * The callout for one hovered entry: the author's `format` line when declared,
 * else shadcn's anatomy — the category heading, then each entry's name and value.
 */
function useTooltipContent(
  tooltip: CartesianTooltip | undefined,
  props: Pick<CartesianChartProps, 'series' | 'categoryLabel' | 'valueLabel'>
): ReactElement {
  const { series, categoryLabel, valueLabel } = props
  const line = useCallback<ChartTooltipLine>(
    (entry) => {
      const row = entry.payload as CartesianRow | undefined
      const field = fieldOfDrawnKey(String(entry.dataKey))
      const value = row?.raw[field]
      if (row === undefined || value === undefined) return undefined
      const seriesName = series.find((candidate) => candidate.field === field)?.label ?? field
      return tooltipRow(tooltip, row, { seriesName, value: valueLabel(value), raw: value })
    },
    [tooltip, series, valueLabel]
  )
  const heading = useCallback(
    (payload: readonly TooltipPayloadEntry[]) => {
      if (tooltip?.format !== undefined || tooltip?.hideLabel === true) return undefined
      const row = payload[0]?.payload as CartesianRow | undefined
      return row === undefined ? undefined : (row.heading ?? categoryLabel(row.label ?? row.key))
    },
    [tooltip, categoryLabel]
  )
  return useMemo(
    () => (
      <ChartTooltipContent
        line={line}
        heading={heading}
        indicator={tooltip?.indicator}
        hideIndicator={tooltip?.hideIndicator}
      />
    ),
    [line, heading, tooltip]
  )
}

/** The series shown, and the toggle the legend flips them with. */
function useShownSeries(series: readonly CartesianSeries[]): {
  readonly shown: readonly CartesianSeries[]
  readonly hidden: ReadonlySet<string>
  readonly toggle: (field: string) => void
} {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set<string>())
  const toggle = useCallback((field: string) => {
    setHidden((prev) => toggleHidden(prev, field))
  }, [])
  const shown = useMemo(() => series.filter((s) => !hidden.has(s.field)), [series, hidden])
  return { shown, hidden, toggle }
}

/** The legend the frame draws: one toggle per series, in declaration order. */
function useFrameLegend(
  props: CartesianChartProps,
  hidden: ReadonlySet<string>,
  onToggle: (field: string) => void
): ChartFrameLegend | undefined {
  const { legend, series, config } = props
  return useMemo(
    () =>
      legend === undefined
        ? undefined
        : {
            ...legend,
            onToggle,
            entries: series.map((s) => ({
              id: s.field,
              label: s.label,
              color: config[s.key]?.color ?? 'currentColor',
              hidden: hidden.has(s.field),
              iconNode: s.iconNode,
            })),
          },
    [legend, series, config, hidden, onToggle]
  )
}

export function CartesianChart(props: CartesianChartProps): ReactElement {
  const { mark, rows, series } = props
  const { shown, hidden, toggle } = useShownSeries(series)
  // Only bars stack: an area series is drawn over its siblings, as it always was.
  const stacked = mark === 'bar' && isStacked(shown)
  const axis = useMemo(
    () => valueAxisOver(rows, shown, { stacked, scale: props.scale }),
    [rows, shown, stacked, props.scale]
  )
  const data = useMemo(() => drawnRows(rows, shown, axis) as CartesianRow[], [rows, shown, axis])
  const content = useTooltipContent(props.tooltip, props)
  const legend = useFrameLegend(props, hidden, toggle)
  const ctx = {
    singlePoint: rows.length === 1,
    stackId: stacked ? 'stack' : undefined,
    barKeyOf: props.barKeyOf,
  }
  return (
    <ChartFrame
      config={props.config}
      legend={legend}
    >
      <ComposedChart
        data={data}
        margin={CHART_MARGIN}
        barCategoryGap="20%"
        barGap={0}
        role="img"
        aria-label={props.accessibleName}
      >
        {props.gridLines === true ? gridElement() : undefined}
        {categoryAxisElement(props.categoryLabel, props.xTitle)}
        {valueAxisElement(axis, props.valueLabel, props.yTitle)}
        {props.tooltip === undefined ? undefined : (
          <ChartTooltip
            cursor={false}
            isAnimationActive={false}
            content={content}
          />
        )}
        {shown.map((s) => seriesMark(s, mark, ctx))}
      </ComposedChart>
    </ChartFrame>
  )
}
