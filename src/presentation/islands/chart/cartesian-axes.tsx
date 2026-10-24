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
 * (`data-chart-axis-title`) are drawn here so each carries its hook.
 *
 * No axis draws a baseline (shadcn's chart anatomy: `axisLine={false}`): the
 * ticks name the scale, and the horizontal grid rules — in the border role an
 * author's `design.colors.border` repaints — are the only lines behind the data.
 */

import { CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  CHART_AXIS_LABEL_FILL,
  CHART_AXIS_LABEL_FONT_SIZE,
  CHART_AXIS_LABEL_FONT_WEIGHT,
  CHART_AXIS_TICK_FILL,
} from '@/presentation/design/chart-default-classes'
import { TIME_KEY, type CartesianRowInput } from './cartesian-rows'
import { timeKeyLabeller } from './chart-format'
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

/**
 * The tick a category axis draws: the category's display name, centred on it.
 * It carries recharts' own tick class because recharts reads the drawn font
 * size off the first node of that class to measure which labels fit; without
 * it every label is measured at the page's font size and labels that fit are
 * dropped.
 */
function categoryTick(labelOf: (key: string) => string): (props: TickProps) => ReactElement {
  return function CategoryTick({ x, y, payload }) {
    return (
      <text
        x={x}
        y={y}
        dy="0.71em"
        className="recharts-cartesian-axis-tick-value"
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

/** The horizontal grid, drawn only when an axis declares `gridLines`. */
export function gridElement(): ReactElement {
  return (
    <CartesianGrid
      vertical={false}
      horizontal={gridRule}
    />
  )
}

/**
 * The category axis, titled by `xAxis.label` when declared. A label is drawn
 * when it fits beside its neighbours, with a clear gap of about half its type
 * size, at the width the chart is drawn in, so a narrow chart of twelve months
 * names every other month and a wide one names all twelve; the first and last
 * stay labelled. Each label is measured as it is
 * shown (`labelOf`), not as its stored key, and recharts chooses the labels
 * again whenever the chart is resized.
 */
export function categoryAxisElement(
  labelOf: (key: string) => string,
  title: string | undefined
): ReactElement {
  return (
    <XAxis
      dataKey="key"
      interval="preserveStartEnd"
      minTickGap={6}
      tickFormatter={(key: unknown) => labelOf(String(key))}
      axisLine={false}
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
      axisLine={false}
      tickLine={false}
      tickSize={0}
      tickMargin={6}
      tick={valueTick(format)}
      label={title === undefined ? undefined : axisTitle('y', title)}
    />
  )
}

/** The tick steps a time axis may take, shortest first. */
const TIME_STEPS_MS = [
  60_000, 300_000, 900_000, 1_800_000, 3_600_000, 7_200_000, 10_800_000, 21_600_000, 43_200_000,
  86_400_000, 172_800_000, 604_800_000,
] as const

/** At most this many ticks: regular instants, never one per bucket. */
const MAX_TIME_TICKS = 8

/**
 * Regular instants over `[from, to]`: every multiple of the shortest step that
 * keeps them to {@link MAX_TIME_TICKS} — every 6 hours across two days.
 */
export function timeTicks(from: number, to: number): readonly number[] {
  const step: number =
    TIME_STEPS_MS.find((candidate) => (to - from) / candidate <= MAX_TIME_TICKS) ?? 604_800_000
  const first = Math.ceil(from / step) * step
  return Array.from({ length: Math.max(0, Math.floor((to - first) / step) + 1) }, (_, i) => {
    return first + i * step
  })
}

/** The span a time axis draws: its domain and its regular ticks. */
interface TimeSpan {
  readonly domain: [number, number]
  readonly ticks: number[]
}

/**
 * The domain reaches half the shortest gap between buckets past each end, so
 * the outer bars are drawn whole; the ticks are regular instants over it.
 */
function timeSpanOf(rows: readonly CartesianRowInput[]): TimeSpan {
  const sorted = rows
    .map((row) => Date.parse(row.key))
    .filter((time) => Number.isFinite(time))
    .toSorted((a, b) => a - b)
  const gaps = sorted.slice(1).map((time, index) => time - (sorted[index] ?? time))
  const pad = Math.max(30_000, Math.min(...gaps, 3_600_000) / 2)
  const from = (sorted[0] ?? 0) - pad
  const to = (sorted[sorted.length - 1] ?? 0) + pad
  return { domain: [from, to], ticks: [...timeTicks(from, to)] }
}

/**
 * The category axis of `xAxis.scale: time`: each bucket at its instant, so a
 * gap in time is a gap on the axis, labelled at regular instants rather than
 * once per bucket.
 */
export function timeAxisElement(
  rows: readonly CartesianRowInput[],
  title: string | undefined
): ReactElement {
  const span = timeSpanOf(rows)
  const label = timeKeyLabeller(span.ticks.map((tick) => new Date(tick).toISOString()))
  return (
    <XAxis
      dataKey={TIME_KEY}
      type="number"
      scale="time"
      domain={span.domain}
      ticks={span.ticks}
      interval={0}
      axisLine={false}
      tickLine={false}
      tickSize={0}
      tickMargin={8}
      height={title === undefined ? 28 : 44}
      tick={categoryTick((key) => label?.(new Date(Number(key)).toISOString()) ?? key)}
      label={title === undefined ? undefined : axisTitle('x', title)}
    />
  )
}
