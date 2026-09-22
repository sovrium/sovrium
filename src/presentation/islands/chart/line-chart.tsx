/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scalePoint, scaleLinear } from '@visx/scale'
import { LinePath } from '@visx/shape'
import {
  CHART_AXIS_STROKE,
  CHART_LINE_STROKE_WIDTH,
  CHART_POINT_FILL,
  CHART_POINT_RADIUS,
  CHART_POINT_STROKE_WIDTH,
  CHART_TICK_FILL,
  CHART_TICK_FONT_SIZE,
  CHART_X_TICK_BASELINE_OFFSET,
  computeChartBodyClasses,
  computeChartShellClasses,
} from '@/presentation/design/chart-default-classes'
import { PRIMARY_SERIES_PAINT } from './chart-series-shared'
import type { CategoryDatum } from './chart-series-shared'
import type { ReactElement } from 'react'

interface LineChartProps {
  readonly data: readonly CategoryDatum[]
  /** Operator-set `<svg role="img">` name; falls back to the "Line chart" default. */
  readonly accessibleName?: string
}

interface LineChartSvgProps extends LineChartProps {
  readonly width: number
  readonly height: number
}

const MARGIN = { top: 16, right: 16, bottom: 40, left: 56 }

/** Stable accessors for `LinePath` — declared at module scope to avoid
 * re-allocating closures on every render (react-perf rule). */
interface PlottedPoint {
  readonly key: string
  readonly x: number
  readonly y: number
}
const accessX = (p: PlottedPoint): number => p.x
const accessY = (p: PlottedPoint): number => p.y

/** Renders the X/Y axis baselines plus the X-axis tick labels. */
function LineAxes({
  points,
  innerWidth,
  innerHeight,
}: {
  readonly points: readonly PlottedPoint[]
  readonly innerWidth: number
  readonly innerHeight: number
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
      <line
        x1={0}
        x2={innerWidth}
        y1={innerHeight}
        y2={innerHeight}
        stroke={CHART_AXIS_STROKE}
      />
      {points.map((p) => (
        <text
          key={`x-label-${p.key}`}
          x={p.x}
          y={innerHeight + CHART_X_TICK_BASELINE_OFFSET}
          fontSize={CHART_TICK_FONT_SIZE}
          fill={CHART_TICK_FILL}
          textAnchor="middle"
        >
          {p.key}
        </text>
      ))}
    </g>
  )
}

/**
 * Renders a single-series line chart from an aggregated `{ key, value }`
 * series. Emits a flat SVG (plain `<text>` axis labels) so spec strict-mode
 * locators on `[data-component="chart"] svg` resolve cleanly.
 */
/** Projects the aggregated series onto scaled SVG coordinates. */
function plotPoints(
  data: readonly CategoryDatum[],
  innerWidth: number,
  innerHeight: number
): PlottedPoint[] {
  const xScale = scalePoint<string>({
    domain: data.map((d) => d.key),
    range: [0, innerWidth],
    padding: 0.5,
  })
  const maxY = data.reduce((acc, d) => (d.value > acc ? d.value : acc), 0)
  const yScale = scaleLinear<number>({
    domain: [0, maxY === 0 ? 1 : maxY],
    range: [innerHeight, 0],
    nice: true,
  })
  return data.map((d) => ({ key: d.key, x: xScale(d.key) ?? 0, y: yScale(d.value) }))
}

function LineChartSvg({ width, height, data, accessibleName }: LineChartSvgProps): ReactElement {
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)
  const points = plotPoints(data, innerWidth, innerHeight)

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={accessibleName ?? 'Line chart'}
    >
      <Group
        left={MARGIN.left}
        top={MARGIN.top}
      >
        <LineAxes
          points={points}
          innerWidth={innerWidth}
          innerHeight={innerHeight}
        />
        <LinePath<PlottedPoint>
          data={points}
          x={accessX}
          y={accessY}
          stroke={PRIMARY_SERIES_PAINT}
          strokeWidth={CHART_LINE_STROKE_WIDTH}
          fill="none"
        />
        {points.map((p) => (
          <circle
            key={`point-${p.key}`}
            cx={p.x}
            cy={p.y}
            r={CHART_POINT_RADIUS}
            fill={CHART_POINT_FILL}
            stroke={PRIMARY_SERIES_PAINT}
            strokeWidth={CHART_POINT_STROKE_WIDTH}
            data-point-key={p.key}
          />
        ))}
      </Group>
    </svg>
  )
}

// The chart card and its measured interior, from the one recipe — see the note
// in `bar-chart.tsx` for why the height moved off the card and onto the body.
// The card constant was also once a local one shadowing the shared recipe.
const CHART_CANVAS_CLASSES = computeChartShellClasses()
const CHART_CANVAS_BODY_CLASSES = computeChartBodyClasses()

export function LineChartCanvas({ data, accessibleName }: LineChartProps): ReactElement {
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
              <LineChartSvg
                width={width}
                height={height}
                data={data}
                accessibleName={accessibleName}
              />
            )
          }}
        </ParentSize>
      </div>
    </div>
  )
}
