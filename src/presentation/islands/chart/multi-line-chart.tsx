/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Group } from '@visx/group'
import { scalePoint } from '@visx/scale'
import { LinePath } from '@visx/shape'
import { useCallback, useState } from 'react'
import {
  CHART_LINE_STROKE_WIDTH,
  CHART_POINT_FILL,
  CHART_POINT_RADIUS,
  CHART_POINT_STROKE_WIDTH,
} from '@/presentation/design/chart-default-classes'
import { PointScaleAxes } from './chart-axes'
import {
  buildValueScale,
  CHART_MARGIN,
  maxAcrossSeries,
  minPositiveAcrossSeries,
  numericValue,
  seriesColor,
  xKeys,
  type ChartAxisDisplay,
  type ChartSeriesConfig,
  type ChartValueScale,
  type LegendPosition,
} from './chart-series-shared'
import { ChartShell } from './chart-shell'
import { ChartTooltip, type TooltipState } from './chart-tooltip'
import type { TableRecord } from '../runtime/types'
import type { ReactElement } from 'react'

/**
 * Which mark each series is drawn as.
 *
 * `line` joins its vertices; `scatter` plots the same vertices and joins
 * nothing. The two share this canvas because everything else about them is
 * identical — the scales, the axes, the legend, the hover tooltip and the
 * hidden-series toggle — so the only real difference is whether the connecting
 * path is drawn at all.
 */
export type SeriesMarkVariant = 'line' | 'scatter'

interface MultiLineChartProps {
  readonly records: readonly TableRecord[]
  readonly xField: string
  readonly series: readonly ChartSeriesConfig[]
  /** Value-axis display configuration forwarded from the chart's `yAxis`. */
  readonly yAxis?: ChartAxisDisplay
  readonly legendPosition?: LegendPosition
  readonly legendVisible?: boolean
  readonly tooltipFormat?: string
  /** Mark drawn per series; defaults to the joined `line`. */
  readonly variant?: SeriesMarkVariant
  /** Operator-set `<svg role="img">` name; falls back to the per-variant default. */
  readonly accessibleName?: string
}

/** A single plotted vertex for one series. */
interface PlottedPoint {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly value: number
}

const accessX = (p: PlottedPoint): number => p.x
const accessY = (p: PlottedPoint): number => p.y

/** Builds the plotted points for one series across the shared X keys. */
function plotSeries(args: {
  readonly records: readonly TableRecord[]
  readonly keys: readonly string[]
  readonly xField: string
  readonly field: string
  readonly xScale: ReturnType<typeof scalePoint<string>>
  readonly yScale: ChartValueScale
}): PlottedPoint[] {
  const { records, keys, xField, field, xScale, yScale } = args
  return keys.map((k) => {
    const record = records.find((r) => String(r[xField]) === k)
    const value = record ? numericValue(record[field]) : 0
    return { key: k, x: xScale(k) ?? 0, y: yScale.toY(value), value }
  })
}

/** A single hoverable data-point vertex. */
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
      r={CHART_POINT_RADIUS}
      fill={CHART_POINT_FILL}
      stroke={color}
      strokeWidth={CHART_POINT_STROKE_WIDTH}
      data-point-key={point.key}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    />
  )
}

/** Renders the vertex markers for one series. */
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

/**
 * Renders the visible 2px line plus a wide transparent hit-path. The visible
 * line is too thin to receive a reliable pointer-center hover, so the fat
 * invisible stroke sits over it as the interaction surface (standard
 * charting pattern).
 */
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
        strokeWidth={CHART_LINE_STROKE_WIDTH}
        fill="none"
        pointerEvents="none"
      />
    </g>
  )
}

/** One series rendered as a hoverable LinePath plus its vertex circles. */
function SeriesLine({
  config,
  index,
  points,
  tooltipFormat,
  variant,
  onHover,
}: {
  readonly config: ChartSeriesConfig
  readonly index: number
  readonly points: PlottedPoint[]
  readonly tooltipFormat: string | undefined
  readonly variant: SeriesMarkVariant
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
      {variant === 'scatter' ? undefined : (
        <SeriesPaths
          points={points}
          color={color}
          onEnter={handleLineEnter}
          onLeave={handleLineLeave}
        />
      )}
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
  readonly yAxis: ChartAxisDisplay | undefined
  readonly hidden: ReadonlySet<string>
  readonly tooltip: TooltipState | undefined
  readonly tooltipFormat: string | undefined
  readonly variant: SeriesMarkVariant
  readonly accessibleName?: string
  readonly onHover: (state: TooltipState | undefined) => void
}

/** The measured inner viewport, shared X keys, visible series, and X/Y scales. */
interface LineLayout {
  readonly innerWidth: number
  readonly innerHeight: number
  readonly keys: readonly string[]
  readonly visibleSeries: readonly ChartSeriesConfig[]
  readonly xScale: ReturnType<typeof scalePoint<string>>
  readonly yScale: ChartValueScale
}

/** Builds the point (X) and value (Y) scales for the chart's inner area. */
function buildLineLayout(args: SvgChartProps): LineLayout {
  const { width, height, records, xField, series, yAxis, hidden } = args
  const innerWidth = Math.max(0, width - CHART_MARGIN.left - CHART_MARGIN.right)
  const innerHeight = Math.max(0, height - CHART_MARGIN.top - CHART_MARGIN.bottom)
  const keys = xKeys(records, xField)
  const visibleSeries = series.filter((s) => !hidden.has(s.field))
  const xScale = scalePoint<string>({ domain: [...keys], range: [0, innerWidth], padding: 0.5 })
  const yScale = buildValueScale({
    maxValue: maxAcrossSeries(records, visibleSeries),
    minPositiveValue: minPositiveAcrossSeries(records, visibleSeries),
    innerHeight,
    scale: yAxis?.scale,
  })
  return { innerWidth, innerHeight, keys, visibleSeries, xScale, yScale }
}

function MultiLineSvg(props: SvgChartProps): ReactElement {
  const { width, height, records, xField, series, yAxis, tooltip, tooltipFormat } = props
  const { variant, accessibleName, onHover } = props
  const { innerWidth, innerHeight, keys, visibleSeries, xScale, yScale } = buildLineLayout(props)

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={accessibleName ?? (variant === 'scatter' ? 'Scatter chart' : 'Line chart')}
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
          valueScale={yScale}
          valueAxis={yAxis}
        />
        {visibleSeries.map((s) => (
          <SeriesLine
            key={`series-${s.field}`}
            config={s}
            index={series.indexOf(s)}
            points={plotSeries({
              records,
              keys,
              xField,
              field: s.field,
              xScale,
              yScale,
            })}
            tooltipFormat={tooltipFormat}
            variant={variant}
            onHover={onHover}
          />
        ))}
        <ChartTooltip state={tooltip} />
      </Group>
    </svg>
  )
}

/**
 * Multi-series line or scatter chart with an interactive legend and hover
 * tooltip.
 *
 * Each `series` entry renders its own vertex circles, joined by a `<LinePath>`
 * under the default `line` variant and left unjoined under `scatter`. The
 * legend lists every series label and clicking a legend item toggles that
 * series' visibility. Hovering a data-point vertex surfaces a
 * `{label}: {value}` tooltip.
 *
 * Tooltip state lives here (not in `ChartShell`) because this is the only
 * multi-series canvas with a hover tooltip.
 */
export function MultiLineChart({
  records,
  xField,
  series,
  yAxis,
  legendPosition,
  legendVisible,
  tooltipFormat,
  variant = 'line',
  accessibleName,
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
          yAxis={yAxis}
          hidden={hidden}
          tooltip={tooltip}
          tooltipFormat={tooltipFormat}
          variant={variant}
          accessibleName={accessibleName}
          onHover={setTooltip}
        />
      )}
    </ChartShell>
  )
}
