/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { Pie } from '@visx/shape'
import { useMemo } from 'react'
import {
  CHART_TICK_FILL,
  CHART_TICK_FONT_SIZE,
  computeChartBodyClasses,
  computeChartShellClasses,
} from '@/presentation/design/chart-default-classes'
import { buildCategoryData, paletteColor, type CategoryDatum } from './chart-series-shared'
import type { TableRecord } from '../runtime/types'
import type { ReactElement } from 'react'

/**
 * The arc canvas — one slice per category, for the `pie` and `donut` chart
 * types.
 *
 * A slice is a plain `<path>` carrying `data-arc-key="<category>"`, so it is
 * addressable exactly as a bar is by `data-bar-key` and a line vertex by
 * `data-point-key`. Both types share this canvas because a donut IS a pie with
 * an inner radius: nothing else about the geometry differs, and splitting them
 * into two components would duplicate the whole canvas to vary one number.
 */

/** Breathing room between the plot edge and the outermost arc, in pixels. */
const MARGIN = 16

/**
 * The donut's hole, as a fraction of its outer radius.
 *
 * This is the only value separating a donut from a pie. It is deliberately
 * large enough to read as a ring rather than as a pie with a pinhole, and small
 * enough to leave the band wide enough to carry a centroid label.
 */
const DONUT_INNER_RADIUS_RATIO = 0.58

/** Stable `pieValue` accessor — declared at module scope so no closure is
 * re-allocated on every measure pass (react-perf). */
const arcValue = (d: CategoryDatum): number => d.value

interface PieChartProps {
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly yField: string
  /**
   * Pre-aggregated `{ key, value }` series. When supplied (the chart declares
   * `chartAggregate`), it bypasses the record-driven path — the same contract
   * `BarChartCanvas` honours for its own `data` prop.
   */
  readonly data?: readonly CategoryDatum[]
  /** Draw the slices with a hole — the `donut` type rather than the `pie` one. */
  readonly donut?: boolean
  /** Operator-set `<svg role="img">` name; falls back to the per-type default. */
  readonly accessibleName?: string
}

interface PieChartSvgProps extends PieChartProps {
  readonly width: number
  readonly height: number
}

/**
 * One slice: the arc itself plus the category label at its centroid.
 *
 * Without the label a pie has no axis and therefore no way to name what each
 * wedge stands for — a bar chart gets that for free from its X-axis ticks.
 */
function ArcSlice({
  d,
  centroid,
  datum,
  fill,
}: {
  readonly d: string
  readonly centroid: readonly [number, number]
  readonly datum: CategoryDatum
  readonly fill: string
}): ReactElement {
  return (
    <g>
      <path
        d={d}
        fill={fill}
        data-arc-key={datum.key}
      />
      <text
        x={centroid[0]}
        y={centroid[1]}
        fontSize={CHART_TICK_FONT_SIZE}
        fill={CHART_TICK_FILL}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {datum.key}
      </text>
    </g>
  )
}

function PieChartSvg({
  width,
  height,
  records,
  xField,
  yField,
  data: preAggregated,
  donut,
  accessibleName,
}: PieChartSvgProps): ReactElement {
  // `Pie` takes a mutable array, so the series is copied. Memoised because
  // `ParentSize` re-renders this component on every resize tick and neither the
  // category reduction nor the copy depends on the measured viewport.
  const slices = useMemo(
    () => [...(preAggregated ?? buildCategoryData(records, xField, yField))],
    [preAggregated, records, xField, yField]
  )
  const outerRadius = Math.max(0, Math.min(width, height) / 2 - MARGIN)
  const innerRadius = donut ? outerRadius * DONUT_INNER_RADIUS_RATIO : 0

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={accessibleName ?? (donut ? 'Donut chart' : 'Pie chart')}
    >
      <Group
        left={width / 2}
        top={height / 2}
      >
        <Pie<CategoryDatum>
          data={slices}
          pieValue={arcValue}
          outerRadius={outerRadius}
          innerRadius={innerRadius}
        >
          {(pie) =>
            pie.arcs.map((arc, index) => (
              <ArcSlice
                key={`arc-${arc.data.key}`}
                d={pie.path(arc) ?? ''}
                centroid={pie.path.centroid(arc)}
                datum={arc.data}
                fill={paletteColor(index)}
              />
            ))
          }
        </Pie>
      </Group>
    </svg>
  )
}

// The chart card and its measured interior, from the one recipe — see the note
// in `bar-chart.tsx` for why the height moved off the card and onto the body.
const CHART_CANVAS_CLASSES = computeChartShellClasses()
const CHART_CANVAS_BODY_CLASSES = computeChartBodyClasses()

export function PieChartCanvas({
  records,
  xField,
  yField,
  data,
  donut,
  accessibleName,
}: PieChartProps): ReactElement {
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
              <PieChartSvg
                width={width}
                height={height}
                records={records}
                xField={xField}
                yField={yField}
                data={data}
                donut={donut}
                accessibleName={accessibleName}
              />
            )
          }}
        </ParentSize>
      </div>
    </div>
  )
}
