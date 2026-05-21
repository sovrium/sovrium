/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Group } from '@visx/group'
import { scalePoint, scaleLinear } from '@visx/scale'
import { LinePath } from '@visx/shape'
import { useCallback, useState } from 'react'
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
import { ChartTooltip, type TooltipState } from './chart-tooltip'
import type { TableRecord } from '../shared/types'
import type { ReactElement } from 'react'

interface MultiLineChartProps {
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly series: readonly ChartSeriesConfig[]
  readonly legendPosition?: LegendPosition
  readonly legendVisible?: boolean
  readonly tooltipFormat?: string
}

interface PlottedPoint {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly value: number
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
    return { key: k, x: xScale(k) ?? 0, y: yScale(value), value }
  })
}

function HoverPoint({
  point,
  label,
  color,
  format,
  onHover,
}: {
  readonly point: PlottedPoint
  readonly label: string
  readonly color: string
  readonly format: string | undefined
  readonly onHover: (state: TooltipState | undefined) => void
}): ReactElement {
  const handleEnter = useCallback(
    () => onHover({ x: point.x, y: point.y, label, value: point.value, format }),
    [onHover, point.x, point.y, point.value, label, format]
  )
  const handleLeave = useCallback(() => onHover(undefined), [onHover])
  return (
    <circle
      cx={point.x}
      cy={point.y}
      r={4}
      fill={color}
      data-point-key={point.key}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    />
  )
}

function SeriesPoints({
  points,
  field,
  label,
  color,
  tooltipFormat,
  onHover,
}: {
  readonly points: readonly PlottedPoint[]
  readonly field: string
  readonly label: string
  readonly color: string
  readonly tooltipFormat: string | undefined
  readonly onHover: (state: TooltipState | undefined) => void
}): ReactElement {
  return (
    <g>
      {points.map((p) => (
        <HoverPoint
          key={`pt-${field}-${p.key}`}
          point={p}
          label={label}
          color={color}
          format={tooltipFormat}
          onHover={onHover}
        />
      ))}
    </g>
  )
}

function SeriesPaths({
  points,
  color,
  onEnter,
  onLeave,
}: {
  readonly points: PlottedPoint[]
  readonly color: string
  readonly onEnter: () => void
  readonly onLeave: () => void
}): ReactElement {
  return (
    <g>
      <LinePath<PlottedPoint>
        data={points}
        x={accessX}
        y={accessY}
        stroke="transparent"
        strokeWidth={24}
        fill="none"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      />
      <LinePath<PlottedPoint>
        data={points}
        x={accessX}
        y={accessY}
        stroke={color}
        strokeWidth={2}
        fill="none"
        pointerEvents="none"
      />
    </g>
  )
}

function SeriesLine({
  config,
  index,
  points,
  tooltipFormat,
  onHover,
}: {
  readonly config: ChartSeriesConfig
  readonly index: number
  readonly points: PlottedPoint[]
  readonly tooltipFormat: string | undefined
  readonly onHover: (state: TooltipState | undefined) => void
}): ReactElement {
  const color = seriesColor(config, index)
  const label = config.label ?? config.field
  const firstPoint = points[0]
  const handleLineEnter = useCallback(() => {
    if (firstPoint) {
      onHover({
        x: firstPoint.x,
        y: firstPoint.y,
        label,
        value: firstPoint.value,
        format: tooltipFormat,
      })
    }
  }, [onHover, firstPoint, label, tooltipFormat])
  const handleLineLeave = useCallback(() => onHover(undefined), [onHover])
  return (
    <g data-series-field={config.field}>
      <SeriesPaths
        points={points}
        color={color}
        onEnter={handleLineEnter}
        onLeave={handleLineLeave}
      />
      <SeriesPoints
        points={points}
        field={config.field}
        label={label}
        color={color}
        tooltipFormat={tooltipFormat}
        onHover={onHover}
      />
    </g>
  )
}

interface SvgChartProps {
  readonly width: number
  readonly height: number
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly series: readonly ChartSeriesConfig[]
  readonly hidden: ReadonlySet<string>
  readonly tooltip: TooltipState | undefined
  readonly tooltipFormat: string | undefined
  readonly onHover: (state: TooltipState | undefined) => void
}

function MultiLineSvg({
  width,
  height,
  records,
  xField,
  series,
  hidden,
  tooltip,
  tooltipFormat,
  onHover,
}: SvgChartProps): ReactElement {
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
      aria-label="Line chart"
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
        {visibleSeries.map((s) => (
          <SeriesLine
            key={`series-${s.field}`}
            config={s}
            index={series.indexOf(s)}
            points={plotSeries({ records, keys, xField, field: s.field, xScale, yScale })}
            tooltipFormat={tooltipFormat}
            onHover={onHover}
          />
        ))}
        <ChartTooltip state={tooltip} />
      </Group>
    </svg>
  )
}

export function MultiLineChart({
  records,
  xField,
  series,
  legendPosition,
  legendVisible,
  tooltipFormat,
}: MultiLineChartProps): ReactElement {
  const [tooltip, setTooltip] = useState<TooltipState | undefined>(undefined)

  return (
    <ChartShell
      series={series}
      legendPosition={legendPosition}
      legendVisible={legendVisible}
    >
      {({ width, height, hidden }) => (
        <MultiLineSvg
          width={width}
          height={height}
          records={records}
          xField={xField}
          series={series}
          hidden={hidden}
          tooltip={tooltip}
          tooltipFormat={tooltipFormat}
          onHover={setTooltip}
        />
      )}
    </ChartShell>
  )
}
