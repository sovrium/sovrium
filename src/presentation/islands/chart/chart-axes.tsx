/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared SVG axis primitives for the multi-series chart family. The
 * multi-line and multi-area canvases use a `scalePoint` X-axis; the
 * multi-bar canvas uses a `scaleBand` X-axis that needs a half-bandwidth
 * label offset. Both render the same baseline + tick-label structure.
 *
 * The VALUE axis lives here too, and that is the point of the module: a chart's
 * `yAxis.label`, `yAxis.format` and `yAxis.gridLines` were honoured by exactly
 * one canvas — the single-series aggregate one — and silently dropped by every
 * series-bound chart, because the layer that draws them had been written INSIDE
 * that canvas rather than beside the axes all of them share. One layer now, one
 * set of markers (`data-chart-axis-title`, `data-chart-grid`,
 * `data-chart-gridline`), whichever binding a chart declares.
 */

import {
  CHART_AXIS_LABEL_FILL,
  CHART_AXIS_LABEL_FONT_SIZE,
  CHART_AXIS_LABEL_FONT_WEIGHT,
  CHART_AXIS_STROKE,
  CHART_GRID_LINE_STROKE,
  CHART_TICK_FILL,
  CHART_TICK_FONT_SIZE,
  CHART_X_TICK_BASELINE_OFFSET,
  CHART_Y_TICK_GAP,
} from '@/presentation/design/chart-default-classes'
import { formatAxisValue } from './chart-format'
import { CHART_MARGIN } from './chart-series-shared'
import type { ChartAxisDisplay, ChartValueScale } from './chart-series-shared'
import type { scaleBand, scalePoint } from '@visx/scale'
import type { ReactElement } from 'react'

/**
 * What a canvas hands the axes so they can draw a value axis: the resolved
 * scale, plus whatever the author declared about how it should read.
 *
 * They are two props rather than one config object, deliberately. An object
 * assembled by a canvas and handed straight to a child is a fresh allocation on
 * every measure pass — the shape `react-perf/jsx-no-new-object-as-prop` exists
 * to catch — and a chart re-measures on every resize. Two scalars cost nothing.
 *
 * `valueAxis` is optional because most charts declare no `yAxis` at all. The
 * ticks are drawn either way — an unlabelled value axis is a plot nobody can
 * read a number off — so only the title and the grid are opt-in.
 */
interface ValueAxisProps {
  readonly valueScale: ChartValueScale | undefined
  readonly valueAxis: ChartAxisDisplay | undefined
}

/** The horizontal distance from the Y baseline at which the axis title sits. */
const AXIS_TITLE_INSET = 14

/** The two axis baselines (vertical Y line + horizontal X line). */
function AxisBaselines({
  innerWidth,
  innerHeight,
}: {
  readonly innerWidth: number
  readonly innerHeight: number
}): ReactElement {
  return (
    <>
      <line
        x1={0}
        x2={0}
        y1={0}
        y2={innerHeight}
        stroke={CHART_AXIS_STROKE}
      />
      <line
        x1={0}
        x2={innerWidth}
        y1={innerHeight}
        y2={innerHeight}
        stroke={CHART_AXIS_STROKE}
      />
    </>
  )
}

/** A single X-axis tick `<text>` label. */
function XTickLabel({
  label,
  x,
  y,
}: {
  readonly label: string
  readonly x: number
  readonly y: number
}): ReactElement {
  return (
    <text
      x={x}
      y={y}
      fontSize={CHART_TICK_FONT_SIZE}
      fill={CHART_TICK_FILL}
      textAnchor="middle"
    >
      {label}
    </text>
  )
}

/**
 * Horizontal reference lines aligned with the value-axis ticks — the
 * `gridLines: true` layer.
 *
 * It is drawn AFTER the baselines rather than under them, so the first `<line>`
 * in a chart's SVG is always an axis baseline whether or not a grid was asked
 * for. Specs that reach for `svg line` to prove the axis chrome takes its stroke
 * from the theme address it that way, and a grid line is painted from a
 * different token.
 */
function ValueGridLines({
  ticks,
  scale,
  innerWidth,
}: {
  readonly ticks: readonly number[]
  readonly scale: ChartValueScale
  readonly innerWidth: number
}): ReactElement {
  return (
    <g data-chart-grid="true">
      {ticks.map((t) => (
        <line
          key={`grid-${String(t)}`}
          x1={0}
          x2={innerWidth}
          y1={scale.toY(t)}
          y2={scale.toY(t)}
          stroke={CHART_GRID_LINE_STROKE}
          data-chart-gridline="true"
        />
      ))}
    </g>
  )
}

/** The value-axis tick `<text>` labels, rendered in the axis' declared format. */
function ValueTickLabels({
  ticks,
  scale,
  format,
}: {
  readonly ticks: readonly number[]
  readonly scale: ChartValueScale
  readonly format: ChartAxisDisplay['format']
}): ReactElement {
  return (
    <g>
      {ticks.map((t) => (
        <text
          key={`y-label-${String(t)}`}
          x={-CHART_Y_TICK_GAP}
          y={scale.toY(t)}
          fontSize={CHART_TICK_FONT_SIZE}
          fill={CHART_TICK_FILL}
          textAnchor="end"
          dominantBaseline="central"
        >
          {formatAxisValue(t, format)}
        </text>
      ))}
    </g>
  )
}

/** The rotated value-axis title — `yAxis.label`, and nothing when unset. */
function ValueAxisTitle({
  label,
  innerHeight,
}: {
  readonly label: string
  readonly innerHeight: number
}): ReactElement {
  const x = -CHART_MARGIN.left + AXIS_TITLE_INSET
  const y = innerHeight / 2
  return (
    <text
      x={x}
      y={y}
      fontSize={CHART_AXIS_LABEL_FONT_SIZE}
      fontWeight={CHART_AXIS_LABEL_FONT_WEIGHT}
      fill={CHART_AXIS_LABEL_FILL}
      textAnchor="middle"
      transform={`rotate(-90 ${String(x)} ${String(y)})`}
      data-chart-axis-title="y"
    >
      {label}
    </text>
  )
}

/**
 * The whole value axis for one plot: an optional grid, the tick labels, and an
 * optional title. Absent when the canvas supplied no scale, which is how a
 * canvas that has not been taught the value axis yet keeps its current drawing.
 */
function ValueAxisLayer({
  valueScale,
  valueAxis,
  innerWidth,
  innerHeight,
}: ValueAxisProps & {
  readonly innerWidth: number
  readonly innerHeight: number
}): ReactElement | undefined {
  if (!valueScale) return undefined
  const ticks = valueScale.tickValues
  return (
    <>
      {valueAxis?.gridLines ? (
        <ValueGridLines
          ticks={ticks}
          scale={valueScale}
          innerWidth={innerWidth}
        />
      ) : undefined}
      <ValueTickLabels
        ticks={ticks}
        scale={valueScale}
        format={valueAxis?.format}
      />
      {valueAxis?.label === undefined ? undefined : (
        <ValueAxisTitle
          label={valueAxis.label}
          innerHeight={innerHeight}
        />
      )}
    </>
  )
}

/**
 * Axis baselines + X-axis tick labels for a `scalePoint` X-axis (line and
 * area charts). Each key is centred on its point-scale position.
 */
export function PointScaleAxes({
  keys,
  xScale,
  innerWidth,
  innerHeight,
  valueScale,
  valueAxis,
}: ValueAxisProps & {
  readonly keys: readonly string[]
  readonly xScale: ReturnType<typeof scalePoint<string>>
  readonly innerWidth: number
  readonly innerHeight: number
}): ReactElement {
  return (
    <g>
      <AxisBaselines
        innerWidth={innerWidth}
        innerHeight={innerHeight}
      />
      <ValueAxisLayer
        valueScale={valueScale}
        valueAxis={valueAxis}
        innerWidth={innerWidth}
        innerHeight={innerHeight}
      />
      {keys.map((k) => (
        <XTickLabel
          key={`x-label-${k}`}
          label={k}
          x={xScale(k) ?? 0}
          y={innerHeight + CHART_X_TICK_BASELINE_OFFSET}
        />
      ))}
    </g>
  )
}

/**
 * Axis baselines + X-axis tick labels for a `scaleBand` X-axis (bar chart).
 * Each key is centred within its band by adding a half-bandwidth offset.
 */
export function BandScaleAxes({
  keys,
  xScale,
  innerWidth,
  innerHeight,
  valueScale,
  valueAxis,
}: ValueAxisProps & {
  readonly keys: readonly string[]
  readonly xScale: ReturnType<typeof scaleBand<string>>
  readonly innerWidth: number
  readonly innerHeight: number
}): ReactElement {
  const bandwidth = xScale.bandwidth()
  return (
    <g>
      <AxisBaselines
        innerWidth={innerWidth}
        innerHeight={innerHeight}
      />
      <ValueAxisLayer
        valueScale={valueScale}
        valueAxis={valueAxis}
        innerWidth={innerWidth}
        innerHeight={innerHeight}
      />
      {keys.map((k) => (
        <XTickLabel
          key={`x-label-${k}`}
          label={k}
          x={(xScale(k) ?? 0) + bandwidth / 2}
          y={innerHeight + CHART_X_TICK_BASELINE_OFFSET}
        />
      ))}
    </g>
  )
}
