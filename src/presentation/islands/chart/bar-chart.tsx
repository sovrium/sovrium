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
import type { TableRecord } from '../shared/types'
import type { ReactElement } from 'react'

interface BarDatum {
  readonly key: string
  readonly value: number
}

interface BarChartProps {
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly yField: string
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

interface BarChartSvgProps extends BarChartProps {
  readonly width: number
  readonly height: number
}

const MARGIN = { top: 16, right: 16, bottom: 40, left: 56 }

function XAxisLabels({
  data,
  xScale,
  innerHeight,
}: {
  readonly data: readonly BarDatum[]
  readonly xScale: ReturnType<typeof scaleBand<string>>
  readonly innerHeight: number
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
            {d.key}
          </text>
        )
      })}
    </g>
  )
}

function YAxisLabels({
  yScale,
  innerHeight,
}: {
  readonly yScale: ReturnType<typeof scaleLinear<number>>
  readonly innerHeight: number
}): ReactElement {
  const ticks = yScale.ticks(5)
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
          {t}
        </text>
      ))}
    </g>
  )
}

function BarChartSvg({ width, height, records, xField, yField }: BarChartSvgProps): ReactElement {
  const data = buildBarData(records, xField, yField)
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)

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
        <YAxisLabels
          yScale={yScale}
          innerHeight={innerHeight}
        />
        <XAxisLabels
          data={data}
          xScale={xScale}
          innerHeight={innerHeight}
        />
        {data.map((d) => {
          const barX = xScale(d.key) ?? 0
          const barY = yScale(d.value)
          const barWidth = xScale.bandwidth()
          const barHeight = innerHeight - barY
          return (
            <Bar
              key={`bar-${d.key}`}
              x={barX}
              y={barY}
              width={barWidth}
              height={barHeight}
              fill="#3b82f6"
              data-bar-key={d.key}
            />
          )
        })}
      </Group>
    </svg>
  )
}

const CHART_CONTAINER_CLASSES = 'w-full h-80'

export function BarChartCanvas({ records, xField, yField }: BarChartProps): ReactElement {
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
            />
          )
        }}
      </ParentSize>
    </div>
  )
}
