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
import type { BarDatum } from './bar-chart'
import type { ReactElement } from 'react'

interface LineChartProps {
  readonly data: readonly BarDatum[]
}

interface LineChartSvgProps extends LineChartProps {
  readonly width: number
  readonly height: number
}

const MARGIN = { top: 16, right: 16, bottom: 40, left: 56 }

interface PlottedPoint {
  readonly key: string
  readonly x: number
  readonly y: number
}
const accessX = (p: PlottedPoint): number => p.x
const accessY = (p: PlottedPoint): number => p.y

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
        stroke="#6b7280"
      />
      <line
        x1={0}
        x2={innerWidth}
        y1={innerHeight}
        y2={innerHeight}
        stroke="#6b7280"
      />
      {points.map((p) => (
        <text
          key={`x-label-${p.key}`}
          x={p.x}
          y={innerHeight + 18}
          fontSize={11}
          fill="#374151"
          textAnchor="middle"
        >
          {p.key}
        </text>
      ))}
    </g>
  )
}

function plotPoints(
  data: readonly BarDatum[],
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

function LineChartSvg({ width, height, data }: LineChartSvgProps): ReactElement {
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)
  const points = plotPoints(data, innerWidth, innerHeight)

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Line chart"
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
          stroke="#3b82f6"
          strokeWidth={2}
          fill="none"
        />
        {points.map((p) => (
          <circle
            key={`point-${p.key}`}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="#3b82f6"
            data-point-key={p.key}
          />
        ))}
      </Group>
    </svg>
  )
}

const CHART_CONTAINER_CLASSES = 'w-full h-80'

export function LineChartCanvas({ data }: LineChartProps): ReactElement {
  return (
    <div
      data-component="chart"
      className={CHART_CONTAINER_CLASSES}
    >
      <ParentSize>
        {({ width, height }) => {
          if (width <= 0 || height <= 0) return undefined
          return (
            <LineChartSvg
              width={width}
              height={height}
              data={data}
            />
          )
        }}
      </ParentSize>
    </div>
  )
}
