/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Group } from '@visx/group'
import { scalePoint, scaleLinear } from '@visx/scale'
import { AreaClosed } from '@visx/shape'
import { PointScaleAxes } from './chart-axes'
import {
  CHART_MARGIN,
  maxAcrossSeries,
  numericValue,
  seriesColor,
  xKeys,
  type ChartSeriesConfig,
  type LegendPosition,
} from './chart-series-shared'
import { ChartShell } from './chart-shell'
import type { TableRecord } from '../shared/types'
import type { ReactElement } from 'react'

interface MultiAreaChartProps {
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly series: readonly ChartSeriesConfig[]
  readonly legendPosition?: LegendPosition
  readonly legendVisible?: boolean
}

interface PlottedPoint {
  readonly key: string
  readonly x: number
  readonly y: number
}

const accessX = (p: PlottedPoint): number => p.x
const accessY = (p: PlottedPoint): number => p.y

function plotSeries(args: {
  readonly records: readonly TableRecord[]
  readonly keys: readonly string[]
  readonly xField: string
  readonly field: string
  readonly xScale: ReturnType<typeof scalePoint<string>>
  readonly yScale: ReturnType<typeof scaleLinear<number>>
}): PlottedPoint[] {
  const { records, keys, xField, field, xScale, yScale } = args
  return keys.map((k) => {
    const record = records.find((r) => String(r[xField]) === k)
    const value = record ? numericValue(record[field]) : 0
    return { key: k, x: xScale(k) ?? 0, y: yScale(value) }
  })
}

interface MultiAreaSvgProps {
  readonly width: number
  readonly height: number
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly series: readonly ChartSeriesConfig[]
  readonly hidden: ReadonlySet<string>
}

function MultiAreaSvg({
  width,
  height,
  records,
  xField,
  series,
  hidden,
}: MultiAreaSvgProps): ReactElement {
  const innerWidth = Math.max(0, width - CHART_MARGIN.left - CHART_MARGIN.right)
  const innerHeight = Math.max(0, height - CHART_MARGIN.top - CHART_MARGIN.bottom)
  const keys = xKeys(records, xField)
  const visibleSeries = series.filter((s) => !hidden.has(s.field))
  const xScale = scalePoint<string>({ domain: [...keys], range: [0, innerWidth], padding: 0.5 })
  const maxY = maxAcrossSeries(records, visibleSeries)
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
      aria-label="Area chart"
    >
      <Group
        left={CHART_MARGIN.left}
        top={CHART_MARGIN.top}
      >
        <PointScaleAxes
          keys={keys}
          xScale={xScale}
          innerWidth={innerWidth}
          innerHeight={innerHeight}
        />
        {visibleSeries.map((s) => {
          const index = series.indexOf(s)
          const color = seriesColor(s, index)
          const points = plotSeries({ records, keys, xField, field: s.field, xScale, yScale })
          return (
            <AreaClosed<PlottedPoint>
              key={`area-${s.field}`}
              data={points}
              x={accessX}
              y={accessY}
              yScale={yScale}
              fill={color}
              fillOpacity={s.fillOpacity ?? 0.3}
              stroke={color}
              strokeWidth={2}
              data-series-field={s.field}
            />
          )
        })}
      </Group>
    </svg>
  )
}

export function MultiAreaChart({
  records,
  xField,
  series,
  legendPosition,
  legendVisible,
}: MultiAreaChartProps): ReactElement {
  return (
    <ChartShell
      series={series}
      legendPosition={legendPosition}
      legendVisible={legendVisible}
    >
      {({ width, height, hidden }) => (
        <MultiAreaSvg
          width={width}
          height={height}
          records={records}
          xField={xField}
          series={series}
          hidden={hidden}
        />
      )}
    </ChartShell>
  )
}
