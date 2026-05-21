/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scaleBand, scaleLinear } from '@visx/scale'
import { Bar } from '@visx/shape'
import { formatAxisLabel, formatAxisValue } from './chart-format'
import type { ChartAxisFormat } from './chart-format'
import type { TableRecord } from '../shared/types'
import type { ReactElement } from 'react'

export interface BarDatum {
  readonly key: string
  readonly value: number
}

export interface ChartAxisDisplay {
  readonly label?: string
  readonly format?: ChartAxisFormat
  readonly gridLines?: boolean
}

interface BarChartProps {
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly yField: string
  readonly data?: readonly BarDatum[]
  readonly xAxis?: ChartAxisDisplay
  readonly yAxis?: ChartAxisDisplay
}

function buildBarData(
  records: readonly TableRecord[],
  xField: string,
  yField: string
): readonly BarDatum[] {
  const grouped = records.reduce<Readonly<Record<string, number>>>((acc, r) => {
    const xRaw = r[xField]
    const yRaw = r[yField]
    if (xRaw === undefined || xRaw === null) return acc
    const key = String(xRaw)
    const value = typeof yRaw === 'number' ? yRaw : Number(yRaw)
    if (!Number.isFinite(value)) return acc
    return { ...acc, [key]: (acc[key] ?? 0) + value }
  }, {})
  return Object.entries(grouped).map(([key, value]) => ({ key, value }))
}

interface BarChartSvgProps {
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly yField: string
  readonly data?: readonly BarDatum[]
  readonly width: number
  readonly height: number
  readonly xAxis?: ChartAxisDisplay
  readonly yAxis?: ChartAxisDisplay
}

const MARGIN = { top: 16, right: 16, bottom: 56, left: 72 }

function GridLines({
  ticks,
  yScale,
  innerWidth,
}: {
  readonly ticks: readonly number[]
  readonly yScale: ReturnType<typeof scaleLinear<number>>
  readonly innerWidth: number
}): ReactElement {
  return (
    <g data-chart-grid="true">
      {ticks.map((t) => (
        <line
          key={`grid-${String(t)}`}
          x1={0}
          x2={innerWidth}
          y1={yScale(t)}
          y2={yScale(t)}
          stroke="#e5e7eb"
          data-chart-gridline="true"
        />
      ))}
    </g>
  )
}

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
  readonly yScale: ReturnType<typeof scaleLinear<number>>
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

function XAxisLabels({
  data,
  xScale,
  innerWidth,
  innerHeight,
  axis,
}: {
  readonly data: readonly BarDatum[]
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
        stroke="#6b7280"
      />
      {data.map((d) => {
        const x = (xScale(d.key) ?? 0) + bandwidth / 2
        return (
          <text
            key={`x-label-${d.key}`}
            x={x}
            y={innerHeight + 18}
            fontSize={11}
            fill="#374151"
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
          fontSize={12}
          fontWeight={600}
          fill="#111827"
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
  readonly yScale: ReturnType<typeof scaleLinear<number>>
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
        stroke="#6b7280"
      />
      {ticks.map((t) => (
        <text
          key={`y-label-${String(t)}`}
          x={-8}
          y={yScale(t)}
          fontSize={11}
          fill="#374151"
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
          fontSize={12}
          fontWeight={600}
          fill="#111827"
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

function BarRects({
  data,
  xScale,
  yScale,
  innerHeight,
}: {
  readonly data: readonly BarDatum[]
  readonly xScale: ReturnType<typeof scaleBand<string>>
  readonly yScale: ReturnType<typeof scaleLinear<number>>
  readonly innerHeight: number
}): ReactElement {
  return (
    <g>
      {data.map((d) => {
        const barY = yScale(d.value)
        return (
          <Bar
            key={`bar-${d.key}`}
            x={xScale(d.key) ?? 0}
            y={barY}
            width={xScale.bandwidth()}
            height={innerHeight - barY}
            fill="#3b82f6"
            data-bar-key={d.key}
          />
        )
      })}
    </g>
  )
}

function buildScales(
  data: readonly BarDatum[],
  innerWidth: number,
  innerHeight: number
): {
  readonly xScale: ReturnType<typeof scaleBand<string>>
  readonly yScale: ReturnType<typeof scaleLinear<number>>
} {
  const xScale = scaleBand<string>({
    domain: data.map((d) => d.key),
    range: [0, innerWidth],
    padding: 0.2,
  })
  const maxY = data.reduce((acc, d) => (d.value > acc ? d.value : acc), 0)
  const yScale = scaleLinear<number>({
    domain: [0, maxY === 0 ? 1 : maxY],
    range: [innerHeight, 0],
    nice: true,
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
}: BarChartSvgProps): ReactElement {
  const data = preAggregated ?? buildBarData(records, xField, yField)
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)
  const { xScale, yScale } = buildScales(data, innerWidth, innerHeight)
  const yTicks = yScale.ticks(5)

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Bar chart"
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
        <BarRects
          data={data}
          xScale={xScale}
          yScale={yScale}
          innerHeight={innerHeight}
        />
      </Group>
    </svg>
  )
}

const CHART_CONTAINER_CLASSES = 'w-full h-80'

export function BarChartCanvas({
  records,
  xField,
  yField,
  data,
  xAxis,
  yAxis,
}: BarChartProps): ReactElement {
  return (
    <div
      data-component="chart"
      className={CHART_CONTAINER_CLASSES}
    >
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
            />
          )
        }}
      </ParentSize>
    </div>
  )
}
