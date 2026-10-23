/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The marks of a cartesian chart: one recharts graphical item per shown series,
 * each drawing its marks itself so each carries the hook a reader of the page
 * addresses it by — a bar is a `<rect data-bar-key>`, a point a
 * `<circle data-point-key>`, a line sits in a `<g data-series-field>`.
 * recharts draws a bar as a `<path>` and a point without any of these, and none
 * of them is paint.
 */

import { Area, Bar, Line, LineDrawShape, Scatter } from 'recharts'
import {
  CHART_AREA_FILL_OPACITY,
  CHART_BAR_RADIUS,
  CHART_LINE_STROKE_WIDTH,
  CHART_POINT_FILL,
  CHART_POINT_RADIUS,
  CHART_POINT_STROKE_WIDTH,
} from '@/presentation/design/chart-default-classes'
import { drawnKey, type CartesianRow } from './cartesian-rows'
import { chartColorVar } from './chart-config'
import type { CSSProperties, ReactElement } from 'react'
import type { BarShapeProps, LineDrawShapeProps } from 'recharts'

/** The mark a cartesian series is drawn as. */
export type CartesianMark = 'bar' | 'line' | 'area' | 'scatter'

/** One series as the chart draws it. */
export interface CartesianSeries {
  /** Its `ChartConfig` key: the series is painted `var(--color-<key>)`. */
  readonly key: string
  /** The row field holding its values. */
  readonly field: string
  readonly label: string
  /** Stack group: bars of series sharing one group stack into one column. */
  readonly stack?: string
  readonly fillOpacity?: number
  /** A Lucide icon's server-resolved geometry, drawn before the name in the legend. */
  readonly iconNode?: unknown
}

/** A bar as a `<rect>` addressable by `data-bar-key`, painted by its row or its series. */
function barShape(
  field: string,
  color: string,
  keyOf: (row: CartesianRow) => string
): (props: BarShapeProps) => ReactElement {
  return function BarMark(props) {
    const row = props.payload as CartesianRow
    const bar = (
      <rect
        x={props.x}
        y={props.y}
        width={Math.max(0, props.width)}
        height={Math.max(0, props.height)}
        fill={row.fill ?? color}
        rx={CHART_BAR_RADIUS}
        data-bar-key={keyOf(row)}
        data-series-field={field}
      />
    )
    // A `barColor` tone reads a variable its group declares, so the role it
    // names resolves on the bar and on anything drawn beside it.
    return row.fillStyle === undefined ? bar : <g style={row.fillStyle as CSSProperties}>{bar}</g>
  }
}

/** The props a point renderer reads: where to draw it and which row it stands for. */
interface PointProps {
  readonly cx?: number
  readonly cy?: number
  readonly payload?: unknown
}

/** A point drawn as a ring in its series' colour, addressable by its row's key. */
function pointShape(color: string): (props: PointProps) => ReactElement {
  return function PointMark(props) {
    const row = props.payload as CartesianRow | undefined
    return (
      <circle
        key={`point-${row?.key ?? ''}`}
        cx={props.cx}
        cy={props.cy}
        r={CHART_POINT_RADIUS}
        fill={CHART_POINT_FILL}
        stroke={color}
        strokeWidth={CHART_POINT_STROKE_WIDTH}
        data-point-key={row?.key}
      />
    )
  }
}

/** A line drawn inside the series group it belongs to. */
function lineShape(field: string): (props: LineDrawShapeProps) => ReactElement {
  return function LineMark(props) {
    return (
      <g data-series-field={field}>
        <LineDrawShape {...props} />
      </g>
    )
  }
}

/** How one series is drawn, beyond its mark. */
export interface SeriesMarkContext {
  /** The area of a single row closes no shape, so its one point is drawn instead. */
  readonly singlePoint: boolean
  readonly stackId: string | undefined
  /** A bar's `data-bar-key`: its category alone, or its category and series. */
  readonly barKeyOf: 'category' | 'series'
}

function barMark(series: CartesianSeries, color: string, ctx: SeriesMarkContext): ReactElement {
  const keyOf =
    ctx.barKeyOf === 'category'
      ? (row: CartesianRow) => row.key
      : (row: CartesianRow) => `${row.key}-${series.field}`
  return (
    <Bar
      key={series.key}
      dataKey={drawnKey(series.field)}
      name={series.label}
      fill={color}
      stackId={ctx.stackId}
      shape={barShape(series.field, color, keyOf)}
      isAnimationActive={false}
    />
  )
}

function areaMark(series: CartesianSeries, color: string, ctx: SeriesMarkContext): ReactElement {
  return (
    <Area
      key={series.key}
      dataKey={drawnKey(series.field)}
      name={series.label}
      type="linear"
      stroke={color}
      strokeWidth={CHART_LINE_STROKE_WIDTH}
      fill={color}
      fillOpacity={series.fillOpacity ?? CHART_AREA_FILL_OPACITY}
      dot={ctx.singlePoint ? pointShape(color) : false}
      activeDot={false}
      isAnimationActive={false}
    />
  )
}

function lineMark(series: CartesianSeries, color: string): ReactElement {
  return (
    <Line
      key={series.key}
      dataKey={drawnKey(series.field)}
      name={series.label}
      type="linear"
      stroke={color}
      strokeWidth={CHART_LINE_STROKE_WIDTH}
      shape={lineShape(series.field)}
      dot={pointShape(color)}
      activeDot={false}
      isAnimationActive={false}
    />
  )
}

function scatterMark(series: CartesianSeries, color: string): ReactElement {
  return (
    <Scatter
      key={series.key}
      dataKey={drawnKey(series.field)}
      name={series.label}
      fill={color}
      shape={pointShape(color)}
      isAnimationActive={false}
    />
  )
}

/** The recharts item drawing one series as `mark`. */
export function seriesMark(
  series: CartesianSeries,
  mark: CartesianMark,
  ctx: SeriesMarkContext
): ReactElement {
  const color = chartColorVar(series.key)
  if (mark === 'bar') return barMark(series, color, ctx)
  if (mark === 'area') return areaMark(series, color, ctx)
  if (mark === 'scatter') return scatterMark(series, color)
  return lineMark(series, color)
}
