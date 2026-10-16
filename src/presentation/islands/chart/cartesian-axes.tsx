/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The axes of a cartesian chart, and the grid that follows its value ticks.
 *
 * The value axis spans the domain and labels the ticks {@link ValueAxis}
 * decided, rather than the ones recharts would pick. Its ticks, the category
 * ticks, the grid rules (`data-chart-gridline`) and the axis titles
 * (`data-chart-axis-title`) are drawn here so each carries its hook; the two
 * baselines keep the border role an author's `design.colors.border` repaints.
 */

import { CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  CHART_AXIS_LABEL_FILL,
  CHART_AXIS_LABEL_FONT_SIZE,
  CHART_AXIS_LABEL_FONT_WEIGHT,
  CHART_AXIS_STROKE,
  CHART_AXIS_TICK_FILL,
} from '@/presentation/design/chart-default-classes'
import type { ValueAxis } from './value-axis'
import type { ReactElement } from 'react'

/** The geometry and stroke recharts hands a grid rule. */
interface GridRuleProps {
  readonly x1?: number | string
  readonly y1?: number | string
  readonly x2?: number | string
  readonly y2?: number | string
  readonly stroke?: string
  readonly strokeWidth?: number | string
}

/**
 * A horizontal grid rule, marked as one. It keeps recharts' own `#ccc` stroke,
 * which the chart container repaints as a faint border.
 */
function gridRule({
  x1,
  y1,
  x2,
  y2,
  stroke,
  strokeWidth,
}: GridRuleProps): ReactElement<SVGElement> {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="none"
      data-chart-gridline="true"
    />
  )
}

/** The props recharts hands a custom tick. */
interface TickProps {
  readonly x: number | string
  readonly y: number | string
  readonly payload: { readonly value: unknown }
}

/** The tick a category axis draws: the category's display name, centred on it. */
function categoryTick(labelOf: (key: string) => string): (props: TickProps) => ReactElement {
  return function CategoryTick({ x, y, payload }) {
    return (
      <text
        x={x}
        y={y}
        dy="0.71em"
        fill={CHART_AXIS_TICK_FILL}
        textAnchor="middle"
      >
        {labelOf(String(payload.value))}
      </text>
    )
  }
}

/** The tick a value axis draws: the value in the axis' format, right-aligned on it. */
function valueTick(format: (value: number) => string): (props: TickProps) => ReactElement {
  return function ValueTick({ x, y, payload }) {
    return (
      <text
        x={x}
        y={y}
        fill={CHART_AXIS_TICK_FILL}
        textAnchor="end"
        dominantBaseline="central"
      >
        {format(Number(payload.value))}
      </text>
    )
  }
}

/** The box recharts hands an axis label: the axis' own area on the chart. */
interface AxisViewBox {
  readonly viewBox?: {
    readonly x?: number
    readonly y?: number
    readonly width?: number
    readonly height?: number
  }
}

/** An axis title: `xAxis.label` under the categories, `yAxis.label` turned along the values. */
function axisTitle(axis: 'x' | 'y', text: string): (props: AxisViewBox) => ReactElement {
  return function AxisTitle({ viewBox }) {
    const { x = 0, y = 0, width = 0, height = 0 } = viewBox ?? {}
    const tx = axis === 'x' ? x + width / 2 : x + CHART_AXIS_LABEL_FONT_SIZE
    const ty = axis === 'x' ? y + height - 2 : y + height / 2
    return (
      <text
        x={tx}
        y={ty}
        fontSize={CHART_AXIS_LABEL_FONT_SIZE}
        fontWeight={CHART_AXIS_LABEL_FONT_WEIGHT}
        fill={CHART_AXIS_LABEL_FILL}
        textAnchor="middle"
        transform={axis === 'y' ? `rotate(-90 ${String(tx)} ${String(ty)})` : undefined}
        data-chart-axis-title={axis}
      >
        {text}
      </text>
    )
  }
}

/** The two axis baselines, in the border role. */
const AXIS_LINE = { stroke: CHART_AXIS_STROKE } as const

/** The horizontal grid, drawn only when an axis declares `gridLines`. */
export function gridElement(): ReactElement {
  return (
    <CartesianGrid
      vertical={false}
      horizontal={gridRule}
    />
  )
}

/** The category axis: every category labelled, titled by `xAxis.label` when declared. */
export function categoryAxisElement(
  labelOf: (key: string) => string,
  title: string | undefined
): ReactElement {
  return (
    <XAxis
      dataKey="key"
      interval={0}
      axisLine={AXIS_LINE}
      tickLine={false}
      tickSize={0}
      tickMargin={8}
      height={title === undefined ? 28 : 44}
      tick={categoryTick(labelOf)}
      label={title === undefined ? undefined : axisTitle('x', title)}
    />
  )
}

/** The value axis over `axis`, its ticks worded by `format`, titled by `yAxis.label`. */
export function valueAxisElement(
  axis: ValueAxis,
  format: (value: number) => string,
  title: string | undefined
): ReactElement {
  return (
    <YAxis
      type="number"
      domain={axis.domain}
      ticks={axis.ticks as number[]}
      scale={axis.scale}
      allowDataOverflow
      interval={0}
      width={72}
      axisLine={AXIS_LINE}
      tickLine={false}
      tickSize={0}
      tickMargin={6}
      tick={valueTick(format)}
      label={title === undefined ? undefined : axisTitle('y', title)}
    />
  )
}
