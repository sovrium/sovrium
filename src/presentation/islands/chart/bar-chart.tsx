/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scaleBand } from '@visx/scale'
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
  computeChartBodyClasses,
  computeChartShellClasses,
} from '@/presentation/design/chart-default-classes'
import { BarPlot } from './bar-chart-hover'
import { formatAxisLabel, formatAxisValue } from './chart-format'
import { buildCategoryData, buildValueScale, minPositiveInCategories } from './chart-series-shared'
import type { ChartTooltipDisplay } from './bar-chart-hover'
import type { CategoryDatum, ChartAxisDisplay, ChartValueScale } from './chart-series-shared'
import type { TableRecord } from '../runtime/types'
import type { ReactElement } from 'react'

interface BarChartProps {
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly yField: string
  /**
   * Pre-aggregated `{ key, value }` series. When supplied (chart declares
   * `chartAggregate`), it bypasses the record-driven `buildCategoryData` path.
   */
  readonly data?: readonly CategoryDatum[]
  readonly xAxis?: ChartAxisDisplay
  readonly yAxis?: ChartAxisDisplay
  /**
   * The chart's declared `tooltip` block. Present means the bars are hoverable
   * and draw a callout; absent means they are inert, exactly as before this
   * layer existed.
   */
  readonly tooltip?: ChartTooltipDisplay
  /** Operator-set `<svg role="img">` name; falls back to the "Bar chart" default. */
  readonly accessibleName?: string
}

interface BarChartSvgProps {
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly yField: string
  readonly data?: readonly CategoryDatum[]
  readonly width: number
  readonly height: number
  readonly xAxis?: ChartAxisDisplay
  readonly yAxis?: ChartAxisDisplay
  readonly tooltip?: ChartTooltipDisplay
  readonly accessibleName?: string
}

const MARGIN = { top: 16, right: 16, bottom: 56, left: 72 }

/** Horizontal grid lines aligned with the Y-axis ticks (gridLines: true). */
function GridLines({
  ticks,
  yScale,
  innerWidth,
}: {
  readonly ticks: readonly number[]
  readonly yScale: ChartValueScale
  readonly innerWidth: number
}): ReactElement {
  return (
    <g data-chart-grid="true">
      {ticks.map((t) => (
        <line
          key={`grid-${String(t)}`}
          x1={0}
          x2={innerWidth}
          y1={yScale.toY(t)}
          y2={yScale.toY(t)}
          stroke={CHART_GRID_LINE_STROKE}
          data-chart-gridline="true"
        />
      ))}
    </g>
  )
}

/**
 * Renders horizontal grid lines when either axis declares `gridLines`. Both
 * axes draw the same Y-tick-aligned horizontal lines, so a single layer is
 * emitted if X or Y opts in.
 */
function ChartGridLayers({
  xAxis,
  yAxis,
  ticks,
  yScale,
  innerWidth,
}: {
  readonly xAxis: ChartAxisDisplay | undefined
  readonly yAxis: ChartAxisDisplay | undefined
  readonly ticks: readonly number[]
  readonly yScale: ChartValueScale
  readonly innerWidth: number
}): ReactElement | undefined {
  if (!xAxis?.gridLines && !yAxis?.gridLines) return undefined
  return (
    <GridLines
      ticks={ticks}
      yScale={yScale}
      innerWidth={innerWidth}
    />
  )
}

/**
 * Renders the X-axis baseline + tick labels as plain `<text>` nodes (no
 * @visx/axis Axis component) — visx wraps each tick in a nested `<svg>`,
 * which breaks `locator('[data-component="chart"] svg')` strict-mode
 * lookups in the spec. Plain `<text>` keeps the SVG flat.
 */
function XAxisLabels({
  data,
  xScale,
  innerWidth,
  innerHeight,
  axis,
}: {
  readonly data: readonly CategoryDatum[]
  readonly xScale: ReturnType<typeof scaleBand<string>>
  readonly innerWidth: number
  readonly innerHeight: number
  readonly axis: ChartAxisDisplay | undefined
}): ReactElement {
  const bandwidth = xScale.bandwidth()
  return (
    <g>
      <line
        x1={0}
        x2={xScale.range()[1]}
        y1={innerHeight}
        y2={innerHeight}
        stroke={CHART_AXIS_STROKE}
      />
      {data.map((d) => {
        const x = (xScale(d.key) ?? 0) + bandwidth / 2
        return (
          <text
            key={`x-label-${d.key}`}
            x={x}
            y={innerHeight + CHART_X_TICK_BASELINE_OFFSET}
            fontSize={CHART_TICK_FONT_SIZE}
            fill={CHART_TICK_FILL}
            textAnchor="middle"
          >
            {formatAxisLabel(d.key, axis?.format)}
          </text>
        )
      })}
      {axis?.label ? (
        <text
          x={innerWidth / 2}
          y={innerHeight + 44}
          fontSize={CHART_AXIS_LABEL_FONT_SIZE}
          fontWeight={CHART_AXIS_LABEL_FONT_WEIGHT}
          fill={CHART_AXIS_LABEL_FILL}
          textAnchor="middle"
          data-chart-axis-title="x"
        >
          {axis.label}
        </text>
      ) : undefined}
    </g>
  )
}

function YAxisLabels({
  ticks,
  yScale,
  innerHeight,
  axis,
}: {
  readonly ticks: readonly number[]
  readonly yScale: ChartValueScale
  readonly innerHeight: number
  readonly axis: ChartAxisDisplay | undefined
}): ReactElement {
  return (
    <g>
      <line
        x1={0}
        x2={0}
        y1={0}
        y2={innerHeight}
        stroke={CHART_AXIS_STROKE}
      />
      {ticks.map((t) => (
        <text
          key={`y-label-${String(t)}`}
          x={-CHART_Y_TICK_GAP}
          y={yScale.toY(t)}
          fontSize={CHART_TICK_FONT_SIZE}
          fill={CHART_TICK_FILL}
          textAnchor="end"
          dominantBaseline="central"
        >
          {formatAxisValue(t, axis?.format)}
        </text>
      ))}
      {axis?.label ? (
        <text
          x={-MARGIN.left + 14}
          y={innerHeight / 2}
          fontSize={CHART_AXIS_LABEL_FONT_SIZE}
          fontWeight={CHART_AXIS_LABEL_FONT_WEIGHT}
          fill={CHART_AXIS_LABEL_FILL}
          textAnchor="middle"
          transform={`rotate(-90 ${String(-MARGIN.left + 14)} ${String(innerHeight / 2)})`}
          data-chart-axis-title="y"
        >
          {axis.label}
        </text>
      ) : undefined}
    </g>
  )
}

/**
 * Builds the band (X) and value (Y) scales for the chart's inner area.
 *
 * The value scale reads `yAxis.scale`, which this binding used to ignore as
 * completely as the series binding did — the axis config reached the canvas,
 * but the scale was a hardcoded `scaleLinear`, so `logarithmic` was a key the
 * schema accepted and nothing anywhere honoured.
 *
 * Both scales are handed WHOLE to `BarPlot`, which draws the bars and anchors
 * the hover callout off the same geometry. Two scales — one for the rects, one
 * for the callout — would put a tooltip somewhere the bar is not the moment the
 * axis stops being linear, which is precisely when it is hardest to notice.
 */
function buildScales(args: {
  readonly data: readonly CategoryDatum[]
  readonly innerWidth: number
  readonly innerHeight: number
  readonly yAxis: ChartAxisDisplay | undefined
}): {
  readonly xScale: ReturnType<typeof scaleBand<string>>
  readonly yScale: ChartValueScale
} {
  const { data, innerWidth, innerHeight, yAxis } = args
  const xScale = scaleBand<string>({
    domain: data.map((d) => d.key),
    range: [0, innerWidth],
    padding: 0.2,
  })
  const yScale = buildValueScale({
    maxValue: data.reduce((acc, d) => (d.value > acc ? d.value : acc), 0),
    minPositiveValue: minPositiveInCategories(data),
    innerHeight,
    scale: yAxis?.scale,
  })
  return { xScale, yScale }
}

function BarChartSvg({
  width,
  height,
  records,
  xField,
  yField,
  data: preAggregated,
  xAxis,
  yAxis,
  tooltip,
  accessibleName,
}: BarChartSvgProps): ReactElement {
  const data = preAggregated ?? buildCategoryData(records, xField, yField)
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)
  const { xScale, yScale } = buildScales({ data, innerWidth, innerHeight, yAxis })
  const yTicks = yScale.tickValues

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={accessibleName ?? 'Bar chart'}
    >
      <Group
        left={MARGIN.left}
        top={MARGIN.top}
      >
        <ChartGridLayers
          xAxis={xAxis}
          yAxis={yAxis}
          ticks={yTicks}
          yScale={yScale}
          innerWidth={innerWidth}
        />
        <YAxisLabels
          ticks={yTicks}
          yScale={yScale}
          innerHeight={innerHeight}
          axis={yAxis}
        />
        <XAxisLabels
          data={data}
          xScale={xScale}
          innerWidth={innerWidth}
          innerHeight={innerHeight}
          axis={xAxis}
        />
        <BarPlot
          data={data}
          xScale={xScale}
          yScale={yScale}
          innerHeight={innerHeight}
          tooltip={tooltip}
        />
      </Group>
    </svg>
  )
}

// The chart card, from the one recipe — auto-height, like the multi-series
// shell's. It used to carry its own `h-80` and be the `ParentSize` parent
// itself, which after the card's 1px border and `py-2.5` left a 298px plot
// against the shell's 288: the same `chartType: 'bar'` over the same rows drew
// two different heights depending only on whether a `series[]` was declared.
// The measured element is now the body below, whose height is the subtree's
// single source of truth.
//
// This used to be a LOCAL constant of the same name as the shared one in
// `chart-series-shared.ts`, shadowing it and quietly dropping its `relative`.
const CHART_CANVAS_CLASSES = computeChartShellClasses()

// The measured interior — the same recipe the multi-series shell's body spends,
// so both canvases draw into a box of identical height.
const CHART_CANVAS_BODY_CLASSES = computeChartBodyClasses()

export function BarChartCanvas({
  records,
  xField,
  yField,
  data,
  xAxis,
  yAxis,
  tooltip,
  accessibleName,
}: BarChartProps): ReactElement {
  return (
    <div
      data-component="chart"
      className={CHART_CANVAS_CLASSES}
    >
      <div className={CHART_CANVAS_BODY_CLASSES}>
        <ParentSize>
          {({ width, height }) => {
            if (width <= 0 || height <= 0) return undefined
            return (
              <BarChartSvg
                width={width}
                height={height}
                records={records}
                xField={xField}
                yField={yField}
                data={data}
                xAxis={xAxis}
                yAxis={yAxis}
                tooltip={tooltip}
                accessibleName={accessibleName}
              />
            )
          }}
        </ParentSize>
      </div>
    </div>
  )
}
