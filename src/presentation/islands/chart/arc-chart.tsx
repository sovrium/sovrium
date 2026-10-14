/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `pie` and `donut` charts, rendered through recharts: one slice per
 * category, drawn clockwise from twelve o'clock in the categories' own order.
 *
 * A slice is a `<path data-arc-key="<category>">`, addressable as a bar is by
 * `data-bar-key` and a point by `data-point-key`. A donut is a pie with a hole:
 * the two share this component and differ by one radius.
 */

import { useMemo } from 'react'
import { Pie, PieChart, Sector } from 'recharts'
import { categoryTooltip } from './category-tooltip'
import { categoryConfig, categoryKey, chartColorVar, paletteColor } from './chart-config'
import { ChartFrame, type ChartFrameLegend } from './chart-frame'
import type { ChartTooltipConfig } from './chart-canvas-types'
import type { CategoryDatum, LegendPosition } from './chart-series-shared'
import type { ChartConfig } from '../parts/chart-primitives'
import type { ReactElement } from 'react'
import type { PieLabelRenderProps, PieSectorShapeProps } from 'recharts'

/**
 * The donut's hole, as a fraction of its outer radius: large enough to read
 * as a ring rather than a pie with a pinhole, small enough to leave the band
 * room for a slice label.
 */
const DONUT_INNER_RADIUS = '58%'

/** Breathing room between the card and the outermost arc, in pixels. */
const ARC_MARGIN = { top: 16, right: 16, bottom: 16, left: 16 } as const

const RADIAN = Math.PI / 180

/** One slice of the pie, as recharts reads it. */
interface Slice {
  readonly key: string
  readonly name: string
  readonly value: number
  readonly fill: string
}

/** A slice as a path addressable by its category. */
function SliceShape(props: PieSectorShapeProps): ReactElement {
  const slice = props.payload as Slice | undefined
  // recharts hands the sector its React `key` among the props; spreading it
  // into JSX is a React error, so it is dropped here.
  const { key: _key, ...sector } = props as PieSectorShapeProps & { readonly key?: unknown }
  return (
    <Sector
      {...sector}
      fill={slice?.fill ?? props.fill}
      stroke="none"
      data-arc-key={slice?.key}
    />
  )
}

/** The category's name, written at the middle of its slice. */
function SliceLabel(props: PieLabelRenderProps): ReactElement {
  const cx = Number(props.cx)
  const cy = Number(props.cy)
  const radius = (Number(props.innerRadius) + Number(props.outerRadius)) / 2
  const angle = -Number(props.midAngle) * RADIAN
  return (
    <text
      x={cx + radius * Math.cos(angle)}
      y={cy + radius * Math.sin(angle)}
      className="fill-foreground"
      textAnchor="middle"
      dominantBaseline="central"
    >
      {String(props.name)}
    </text>
  )
}

/** One slice per category, painted by the category's config entry. */
const toSlices = (data: readonly CategoryDatum[]): Slice[] =>
  data.map((datum, index) => ({
    key: datum.key,
    name: datum.label ?? datum.key,
    value: datum.value,
    fill: chartColorVar(categoryKey(index)),
  }))

export interface ArcChartProps {
  readonly data: readonly CategoryDatum[]
  readonly donut: boolean
  /** The chart's declared `legend`; absent draws none. */
  readonly legend?: { readonly position?: LegendPosition; readonly visible?: boolean }
  /** `dataLabels: false` leaves the category names off the ring; the legend still names them. */
  readonly dataLabels?: boolean
  /** The declared `tooltip`: a callout naming the hovered slice and its value. */
  readonly tooltip?: ChartTooltipConfig
  readonly accessibleName?: string
}

export function ArcChart({
  data,
  donut,
  legend,
  dataLabels,
  accessibleName,
  tooltip,
}: ArcChartProps): ReactElement {
  const config: ChartConfig = useMemo(() => categoryConfig(data, paletteColor), [data])
  const slices = useMemo(() => toSlices(data), [data])
  const frameLegend = useMemo<ChartFrameLegend | undefined>(
    () =>
      legend === undefined
        ? undefined
        : {
            ...legend,
            entries: data.map((datum, index) => ({
              id: datum.key,
              label: datum.label ?? datum.key,
              color: config[categoryKey(index)]?.color ?? 'currentColor',
            })),
          },
    [legend, data, config]
  )
  return (
    <ChartFrame
      config={config}
      legend={frameLegend}
    >
      <PieChart
        margin={ARC_MARGIN}
        role="img"
        aria-label={accessibleName ?? (donut ? 'Donut chart' : 'Pie chart')}
      >
        {categoryTooltip(tooltip)}
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          startAngle={90}
          endAngle={-270}
          outerRadius="100%"
          innerRadius={donut ? DONUT_INNER_RADIUS : 0}
          shape={SliceShape}
          label={dataLabels === false ? false : SliceLabel}
          labelLine={false}
          isAnimationActive={false}
        />
      </PieChart>
    </ChartFrame>
  )
}
