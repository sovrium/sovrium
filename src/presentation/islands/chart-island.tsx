/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { BarChartCanvas } from './chart/bar-chart'
import { aggregateRecords } from './chart/chart-aggregate'
import { type ChartSeriesConfig } from './chart/chart-series-shared'
import {
  ChartEmpty,
  ChartError,
  ChartLoading,
  ChartMissingAxes,
  ChartMissingTable,
} from './chart/chart-states'
import { LineChartCanvas } from './chart/line-chart'
import { MultiAreaChart } from './chart/multi-area-chart'
import { MultiBarChart } from './chart/multi-bar-chart'
import { MultiLineChart } from './chart/multi-line-chart'
import { useChartRecords } from './chart/use-chart-records'
import type { ChartAggregateConfig } from './chart/chart-aggregate'
import type { TableRecord } from './shared/types'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { ReactElement } from 'react'

interface ChartAxisConfig {
  readonly field: string
  readonly label?: string
  readonly format?: 'date' | 'currency' | 'number' | 'percent'
  readonly scale?: 'linear' | 'logarithmic'
  readonly gridLines?: boolean
}

interface ChartLegendConfig {
  readonly position?: 'top' | 'bottom' | 'left' | 'right' | 'none'
  readonly visible?: boolean
}

interface ChartTooltipConfig {
  readonly format?: string
}

interface ChartIslandProps {
  readonly dataSource?: {
    readonly table: string
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
  }
  readonly chartType?: 'bar' | 'line' | 'pie' | 'area' | 'donut' | 'scatter'
  readonly xAxis?: ChartAxisConfig
  readonly yAxis?: ChartAxisConfig
  readonly series?: readonly ChartSeriesConfig[]
  readonly legend?: ChartLegendConfig
  readonly tooltip?: ChartTooltipConfig
  readonly chartAggregate?: ChartAggregateConfig
  readonly emptyMessage?: string
}

interface ChartGuardResult {
  readonly element?: ReactElement
}

function isMissingAxes(args: {
  readonly xAxis: ChartIslandProps['xAxis']
  readonly yAxis: ChartIslandProps['yAxis']
  readonly chartAggregate: ChartIslandProps['chartAggregate']
  readonly series: ChartIslandProps['series']
}): boolean {
  if (args.chartAggregate) return false
  if (args.series && args.series.length > 0) return !args.xAxis?.field
  return !args.xAxis?.field || !args.yAxis?.field
}

function evaluateChartGuards(args: {
  readonly dataSource: ChartIslandProps['dataSource']
  readonly xAxis: ChartIslandProps['xAxis']
  readonly yAxis: ChartIslandProps['yAxis']
  readonly chartAggregate: ChartIslandProps['chartAggregate']
  readonly series: ChartIslandProps['series']
  readonly emptyMessage: string | undefined
  readonly isLoading: boolean
  readonly isError: boolean
  readonly error: unknown
  readonly records: readonly unknown[]
}): ChartGuardResult {
  if (!args.dataSource?.table) return { element: <ChartMissingTable /> }
  if (args.isLoading) return { element: <ChartLoading /> }
  if (args.isError) return { element: <ChartError error={args.error} /> }
  if (args.records.length === 0) return { element: <ChartEmpty message={args.emptyMessage} /> }
  if (isMissingAxes(args)) return { element: <ChartMissingAxes /> }
  return {}
}

function renderAggregatedChart(args: {
  readonly records: readonly TableRecord[]
  readonly chartType: ChartIslandProps['chartType']
  readonly chartAggregate: ChartAggregateConfig
  readonly xAxis: ChartIslandProps['xAxis']
  readonly yAxis: ChartIslandProps['yAxis']
}): ReactElement {
  const { records, chartType, chartAggregate, xAxis, yAxis } = args
  const aggregated = aggregateRecords(records, chartAggregate)
  if (chartType === 'line') return <LineChartCanvas data={aggregated} />
  return (
    <BarChartCanvas
      records={records}
      xField={chartAggregate.groupBy}
      yField={chartAggregate.field ?? ''}
      data={aggregated}
      xAxis={xAxis}
      yAxis={yAxis}
    />
  )
}

function hasSeries(series: ChartIslandProps['series']): series is readonly ChartSeriesConfig[] {
  return Array.isArray(series) && series.length > 0
}

interface SeriesChartArgs {
  readonly records: readonly TableRecord[]
  readonly chartType: ChartIslandProps['chartType']
  readonly xAxis: ChartIslandProps['xAxis']
  readonly series: readonly ChartSeriesConfig[]
  readonly legend: ChartIslandProps['legend']
  readonly tooltip: ChartIslandProps['tooltip']
}

function renderBarOrAreaSeries(args: SeriesChartArgs, xField: string): ReactElement {
  const { records, chartType, series, legend } = args
  const Chart = chartType === 'bar' ? MultiBarChart : MultiAreaChart
  return (
    <Chart
      records={records}
      xField={xField}
      series={series}
      legendPosition={legend?.position}
      legendVisible={legend?.visible}
    />
  )
}

function renderSeriesChart(args: SeriesChartArgs): ReactElement {
  const { records, chartType, xAxis, series, legend, tooltip } = args
  const xField = xAxis?.field ?? ''
  if (chartType === 'bar' || chartType === 'area') {
    return renderBarOrAreaSeries(args, xField)
  }
  return (
    <MultiLineChart
      records={records}
      xField={xField}
      series={series}
      legendPosition={legend?.position}
      legendVisible={legend?.visible}
      tooltipFormat={tooltip?.format}
    />
  )
}

export default function ChartIsland({
  dataSource,
  chartType,
  xAxis,
  yAxis,
  series,
  legend,
  tooltip,
  chartAggregate,
  emptyMessage,
}: ChartIslandProps): ReactElement {
  const { data, isLoading, isError, error } = useChartRecords(dataSource)
  const records = data?.records ?? []

  const guard = evaluateChartGuards({
    dataSource,
    xAxis,
    yAxis,
    chartAggregate,
    series,
    emptyMessage,
    isLoading,
    isError,
    error,
    records,
  })
  if (guard.element) return guard.element

  if (hasSeries(series)) {
    return renderSeriesChart({ records, chartType, xAxis, series, legend, tooltip })
  }

  if (chartAggregate) {
    return renderAggregatedChart({ records, chartType, chartAggregate, xAxis, yAxis })
  }

  return (
    <BarChartCanvas
      records={records}
      xField={xAxis?.field ?? ''}
      yField={yAxis?.field ?? ''}
      xAxis={xAxis}
      yAxis={yAxis}
    />
  )
}
