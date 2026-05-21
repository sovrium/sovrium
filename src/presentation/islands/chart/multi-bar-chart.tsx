/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Group } from '@visx/group'
import { scaleBand, scaleLinear } from '@visx/scale'
import { Bar } from '@visx/shape'
import { BandScaleAxes } from './chart-axes'
import {
  CHART_MARGIN,
  numericValue,
  seriesColor,
  xKeys,
  type ChartSeriesConfig,
  type LegendPosition,
} from './chart-series-shared'
import { ChartShell } from './chart-shell'
import type { TableRecord } from '../shared/types'
import type { ReactElement } from 'react'

interface MultiBarChartProps {
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly series: readonly ChartSeriesConfig[]
  readonly legendPosition?: LegendPosition
  readonly legendVisible?: boolean
}

function isStacked(series: readonly ChartSeriesConfig[]): boolean {
  return (
    series.length > 0 && series.every((s) => s.stack !== undefined && s.stack === series[0]?.stack)
  )
}

function stackedTotal(
  record: TableRecord | undefined,
  series: readonly ChartSeriesConfig[]
): number {
  if (!record) return 0
  return series.reduce((sum, s) => sum + numericValue(record[s.field]), 0)
}

interface BarSpec {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly fill: string
  readonly field: string
}

interface ColumnGeometry {
  readonly base: number
  readonly groupWidth: number
  readonly innerHeight: number
  readonly yScale: ReturnType<typeof scaleLinear<number>>
}

interface ColumnAccumulator {
  readonly bars: readonly BarSpec[]
  readonly cumulative: number
}

function barFor(args: {
  readonly key: string
  readonly series: ChartSeriesConfig
  readonly index: number
  readonly value: number
  readonly stacked: boolean
  readonly geometry: ColumnGeometry
  readonly cumulative: number
}): BarSpec {
  const { key, series, index, value, stacked, geometry, cumulative } = args
  const { base, groupWidth, innerHeight, yScale } = geometry
  const fill = seriesColor(series, index)
  const common = { id: `${key}-${series.field}`, width: groupWidth, fill, field: series.field }
  if (stacked) {
    const y = yScale(cumulative + value)
    return { ...common, x: base, y, height: yScale(cumulative) - y }
  }
  const y = yScale(value)
  return { ...common, x: base + index * groupWidth, y, height: innerHeight - y }
}

function buildBars(args: {
  readonly records: readonly TableRecord[]
  readonly keys: readonly string[]
  readonly xField: string
  readonly series: readonly ChartSeriesConfig[]
  readonly stacked: boolean
  readonly xScale: ReturnType<typeof scaleBand<string>>
  readonly yScale: ReturnType<typeof scaleLinear<number>>
  readonly innerHeight: number
}): readonly BarSpec[] {
  const { records, keys, xField, series, stacked, xScale, yScale, innerHeight } = args
  const bandwidth = xScale.bandwidth()
  const groupWidth = stacked ? bandwidth : bandwidth / Math.max(1, series.length)
  return keys.flatMap((key) => {
    const record = records.find((r) => String(r[xField]) === key)
    const geometry: ColumnGeometry = { base: xScale(key) ?? 0, groupWidth, innerHeight, yScale }
    return series.reduce<ColumnAccumulator>(
      (acc, s, index) => {
        const value = record ? numericValue(record[s.field]) : 0
        const bar = barFor({
          key,
          series: s,
          index,
          value,
          stacked,
          geometry,
          cumulative: acc.cumulative,
        })
        return {
          bars: [...acc.bars, bar],
          cumulative: stacked ? acc.cumulative + value : acc.cumulative,
        }
      },
      { bars: [], cumulative: 0 }
    ).bars
  })
}

interface MultiBarSvgProps {
  readonly width: number
  readonly height: number
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly series: readonly ChartSeriesConfig[]
  readonly hidden: ReadonlySet<string>
}

function computeMaxY(args: {
  readonly records: readonly TableRecord[]
  readonly keys: readonly string[]
  readonly xField: string
  readonly series: readonly ChartSeriesConfig[]
  readonly stacked: boolean
}): number {
  const { records, keys, xField, series, stacked } = args
  return keys.reduce((max, k) => {
    const record = records.find((r) => String(r[xField]) === k)
    const columnMax = stacked
      ? stackedTotal(record, series)
      : series.reduce((m, s) => {
          const v = record ? numericValue(record[s.field]) : 0
          return v > m ? v : m
        }, 0)
    return columnMax > max ? columnMax : max
  }, 0)
}

interface BarLayout {
  readonly keys: readonly string[]
  readonly xScale: ReturnType<typeof scaleBand<string>>
  readonly innerWidth: number
  readonly innerHeight: number
  readonly bars: readonly BarSpec[]
}

function buildLayout(args: {
  readonly width: number
  readonly height: number
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly series: readonly ChartSeriesConfig[]
  readonly hidden: ReadonlySet<string>
}): BarLayout {
  const { width, height, records, xField, series, hidden } = args
  const innerWidth = Math.max(0, width - CHART_MARGIN.left - CHART_MARGIN.right)
  const innerHeight = Math.max(0, height - CHART_MARGIN.top - CHART_MARGIN.bottom)
  const keys = xKeys(records, xField)
  const visibleSeries = series.filter((s) => !hidden.has(s.field))
  const stacked = isStacked(visibleSeries)
  const xScale = scaleBand<string>({ domain: [...keys], range: [0, innerWidth], padding: 0.2 })
  const maxY = computeMaxY({ records, keys, xField, series: visibleSeries, stacked })
  const yScale = scaleLinear<number>({
    domain: [0, maxY === 0 ? 1 : maxY],
    range: [innerHeight, 0],
    nice: true,
  })
  const bars = buildBars({
    records,
    keys,
    xField,
    series: visibleSeries,
    stacked,
    xScale,
    yScale,
    innerHeight,
  })
  return { keys, xScale, innerWidth, innerHeight, bars }
}

function MultiBarSvg({
  width,
  height,
  records,
  xField,
  series,
  hidden,
}: MultiBarSvgProps): ReactElement {
  const { keys, xScale, innerWidth, innerHeight, bars } = buildLayout({
    width,
    height,
    records,
    xField,
    series,
    hidden,
  })

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Bar chart"
    >
      <Group
        left={CHART_MARGIN.left}
        top={CHART_MARGIN.top}
      >
        <BandScaleAxes
          keys={keys}
          xScale={xScale}
          innerWidth={innerWidth}
          innerHeight={innerHeight}
        />
        {bars.map((b) => (
          <Bar
            key={`bar-${b.id}`}
            x={b.x}
            y={b.y}
            width={b.width}
            height={b.height}
            fill={b.fill}
            data-bar-key={b.id}
            data-series-field={b.field}
          />
        ))}
      </Group>
    </svg>
  )
}

export function MultiBarChart({
  records,
  xField,
  series,
  legendPosition,
  legendVisible,
}: MultiBarChartProps): ReactElement {
  return (
    <ChartShell
      series={series}
      legendPosition={legendPosition}
      legendVisible={legendVisible}
    >
      {({ width, height, hidden }) => (
        <MultiBarSvg
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
