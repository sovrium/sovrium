/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Group } from '@visx/group'
import { scalePoint } from '@visx/scale'
import { AreaClosed } from '@visx/shape'
import {
  CHART_AREA_FILL_OPACITY,
  CHART_LINE_STROKE_WIDTH,
} from '@/presentation/design/chart-default-classes'
import { PointScaleAxes } from './chart-axes'
import {
  buildValueScale,
  CHART_MARGIN,
  maxAcrossSeries,
  minPositiveAcrossSeries,
  numericValue,
  seriesColor,
  xKeys,
  type ChartAxisDisplay,
  type ChartSeriesConfig,
  type ChartValueScale,
  type LegendPosition,
} from './chart-series-shared'
import { ChartShell } from './chart-shell'
import type { TableRecord } from '../runtime/types'
import type { ReactElement } from 'react'

interface MultiAreaChartProps {
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly series: readonly ChartSeriesConfig[]
  /** Value-axis display configuration forwarded from the chart's `yAxis`. */
  readonly yAxis?: ChartAxisDisplay
  readonly legendPosition?: LegendPosition
  readonly legendVisible?: boolean
  /** Operator-set `<svg role="img">` name; falls back to the "Area chart" default. */
  readonly accessibleName?: string
}

/** A single plotted vertex for one area series. */
interface PlottedPoint {
  readonly key: string
  readonly x: number
  readonly y: number
}

const accessX = (p: PlottedPoint): number => p.x
const accessY = (p: PlottedPoint): number => p.y

/** Builds the plotted points for one series across the shared X keys. */
function plotSeries(args: {
  readonly records: readonly TableRecord[]
  readonly keys: readonly string[]
  readonly xField: string
  readonly field: string
  readonly xScale: ReturnType<typeof scalePoint<string>>
  readonly yScale: ChartValueScale
}): PlottedPoint[] {
  const { records, keys, xField, field, xScale, yScale } = args
  return keys.map((k) => {
    const record = records.find((r) => String(r[xField]) === k)
    const value = record ? numericValue(record[field]) : 0
    return { key: k, x: xScale(k) ?? 0, y: yScale.toY(value) }
  })
}

interface MultiAreaSvgProps {
  readonly width: number
  readonly height: number
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly series: readonly ChartSeriesConfig[]
  readonly yAxis?: ChartAxisDisplay
  readonly hidden: ReadonlySet<string>
  readonly accessibleName?: string
}

/** The measured inner viewport, shared X keys, visible series, and X/Y scales. */
interface AreaLayout {
  readonly innerWidth: number
  readonly innerHeight: number
  readonly keys: readonly string[]
  readonly visibleSeries: readonly ChartSeriesConfig[]
  readonly xScale: ReturnType<typeof scalePoint<string>>
  readonly yScale: ChartValueScale
}

/** Builds the point (X) and value (Y) scales for the chart's inner area. */
function buildAreaLayout(args: MultiAreaSvgProps): AreaLayout {
  const { width, height, records, xField, series, yAxis, hidden } = args
  const innerWidth = Math.max(0, width - CHART_MARGIN.left - CHART_MARGIN.right)
  const innerHeight = Math.max(0, height - CHART_MARGIN.top - CHART_MARGIN.bottom)
  const keys = xKeys(records, xField)
  const visibleSeries = series.filter((s) => !hidden.has(s.field))
  const xScale = scalePoint<string>({ domain: [...keys], range: [0, innerWidth], padding: 0.5 })
  const yScale = buildValueScale({
    maxValue: maxAcrossSeries(records, visibleSeries),
    minPositiveValue: minPositiveAcrossSeries(records, visibleSeries),
    innerHeight,
    scale: yAxis?.scale,
  })
  return { innerWidth, innerHeight, keys, visibleSeries, xScale, yScale }
}

function MultiAreaSvg(props: MultiAreaSvgProps): ReactElement {
  const { width, height, records, xField, series, yAxis, accessibleName } = props
  const { innerWidth, innerHeight, keys, visibleSeries, xScale, yScale } = buildAreaLayout(props)

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={accessibleName ?? 'Area chart'}
    >
      <Group
        left={CHART_MARGIN.left}
        top={CHART_MARGIN.top}
      >
        <PointScaleAxes
          keys={keys}
          xScale={xScale}
          innerWidth={innerWidth}
          innerHeight={innerHeight}
          valueScale={yScale}
          valueAxis={yAxis}
        />
        {visibleSeries.map((s) => {
          const index = series.indexOf(s)
          const color = seriesColor(s, index)
          const points = plotSeries({
            records,
            keys,
            xField,
            field: s.field,
            xScale,
            yScale,
          })
          return (
            <AreaClosed<PlottedPoint>
              key={`area-${s.field}`}
              data={points}
              x={accessX}
              y={accessY}
              // The PIXEL scale, not the value axis: `AreaClosed` reads only
              // `range()[0]` off it, to find the baseline its fill closes onto.
              yScale={yScale.pixels}
              fill={color}
              fillOpacity={s.fillOpacity ?? CHART_AREA_FILL_OPACITY}
              stroke={color}
              strokeWidth={CHART_LINE_STROKE_WIDTH}
              data-series-field={s.field}
            />
          )
        })}
      </Group>
    </svg>
  )
}

/**
 * Multi-series area chart with an interactive legend.
 *
 * Each `series` entry renders its own filled `<AreaClosed>` path; the
 * `fillOpacity` series property drives the `fill-opacity` SVG attribute. The
 * legend lists every series label and clicking an item toggles visibility.
 */
export function MultiAreaChart({
  records,
  xField,
  series,
  yAxis,
  legendPosition,
  legendVisible,
  accessibleName,
}: MultiAreaChartProps): ReactElement {
  return (
    <ChartShell
      series={series}
      legendPosition={legendPosition}
      legendVisible={legendVisible}
    >
      {({ width, height, hidden }) => (
        <MultiAreaSvg
          width={width}
          height={height}
          records={records}
          xField={xField}
          series={series}
          yAxis={yAxis}
          hidden={hidden}
          accessibleName={accessibleName}
        />
      )}
    </ChartShell>
  )
}
