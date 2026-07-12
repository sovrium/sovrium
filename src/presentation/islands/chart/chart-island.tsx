/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { BarChartCanvas } from './bar-chart'
import { aggregateRecords } from './chart-aggregate'
import { type ChartSeriesConfig } from './chart-series-shared'
import {
  ChartEmpty,
  ChartError,
  ChartLoading,
  ChartMissingAxes,
  ChartMissingTable,
  type ChartEmptyStateConfig,
} from './chart-states'
import { LineChartCanvas } from './line-chart'
import { MultiAreaChart } from './multi-area-chart'
import { MultiBarChart } from './multi-bar-chart'
import { MultiLineChart } from './multi-line-chart'
import { useChartRecords } from './use-chart-records'
import { useChartSystemRecords } from './use-chart-system-records'
import type { ChartAggregateConfig } from './chart-aggregate'
import type { TableRecord } from '../shared/types'
import type { ChartSystemSource } from '@/domain/models/app/pages/components/component-types/data/chart'
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

interface ChartTableSource {
  readonly table: string
  readonly view?: string
  readonly filter?: readonly DataFilter[]
  readonly sort?: readonly DataSort[]
}

type ChartDataSourceProp = ChartTableSource | { readonly system: ChartSystemSource }

interface ChartIslandProps {
  readonly dataSource?: ChartDataSourceProp
  readonly chartType?: 'bar' | 'line' | 'pie' | 'area' | 'donut' | 'scatter'
  readonly xAxis?: ChartAxisConfig
  readonly yAxis?: ChartAxisConfig
  readonly series?: readonly ChartSeriesConfig[]
  readonly legend?: ChartLegendConfig
  readonly tooltip?: ChartTooltipConfig
  readonly chartAggregate?: ChartAggregateConfig
  readonly emptyMessage?: string
  readonly ariaLabel?: string
  readonly emptyState?: ChartEmptyStateConfig
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

function isSystemSource(
  dataSource: ChartDataSourceProp | undefined
): dataSource is { readonly system: ChartSystemSource } {
  return Boolean(dataSource && 'system' in dataSource && dataSource.system)
}

function evaluateChartGuards(args: {
  readonly dataSource: ChartIslandProps['dataSource']
  readonly xAxis: ChartIslandProps['xAxis']
  readonly yAxis: ChartIslandProps['yAxis']
  readonly chartAggregate: ChartIslandProps['chartAggregate']
  readonly series: ChartIslandProps['series']
  readonly emptyMessage: string | undefined
  readonly emptyState: ChartIslandProps['emptyState']
  readonly isLoading: boolean
  readonly isError: boolean
  readonly error: unknown
  readonly records: readonly unknown[]
}): ChartGuardResult {
  const hasTable = isSystemSource(args.dataSource) || Boolean(args.dataSource?.table)
  if (!hasTable) return { element: <ChartMissingTable /> }
  if (args.isLoading) return { element: <ChartLoading /> }
  if (args.isError) return { element: <ChartError error={args.error} /> }
  if (args.records.length === 0)
    return {
      element: (
        <ChartEmpty
          message={args.emptyMessage}
          emptyState={args.emptyState}
        />
      ),
    }
  if (isMissingAxes(args)) return { element: <ChartMissingAxes /> }
  return {}
}

function renderAggregatedChart(args: {
  readonly records: readonly TableRecord[]
  readonly chartType: ChartIslandProps['chartType']
  readonly chartAggregate: ChartAggregateConfig
  readonly xAxis: ChartIslandProps['xAxis']
  readonly yAxis: ChartIslandProps['yAxis']
  readonly accessibleName: string | undefined
}): ReactElement {
  const { records, chartType, chartAggregate, xAxis, yAxis, accessibleName } = args
  const aggregated = aggregateRecords(records, chartAggregate)
  if (chartType === 'line') {
    return (
      <LineChartCanvas
        data={aggregated}
        accessibleName={accessibleName}
      />
    )
  }
  return (
    <BarChartCanvas
      records={records}
      xField={chartAggregate.groupBy}
      yField={chartAggregate.field ?? ''}
      data={aggregated}
      xAxis={xAxis}
      yAxis={yAxis}
      accessibleName={accessibleName}
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
  readonly accessibleName: string | undefined
}

function renderBarOrAreaSeries(args: SeriesChartArgs, xField: string): ReactElement {
  const { records, chartType, series, legend, accessibleName } = args
  const Chart = chartType === 'bar' ? MultiBarChart : MultiAreaChart
  return (
    <Chart
      records={records}
      xField={xField}
      series={series}
      legendPosition={legend?.position}
      legendVisible={legend?.visible}
      accessibleName={accessibleName}
    />
  )
}

function renderSeriesChart(args: SeriesChartArgs): ReactElement {
  const { records, chartType, xAxis, series, legend, tooltip, accessibleName } = args
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
      accessibleName={accessibleName}
    />
  )
}

interface ChartData {
  readonly records: readonly TableRecord[]
  readonly isLoading: boolean
  readonly isError: boolean
  readonly error: unknown
}

function useChartData(dataSource: ChartIslandProps['dataSource']): ChartData {
  const usesSystemSource = isSystemSource(dataSource)
  const systemSource = usesSystemSource ? dataSource.system : undefined
  const tableSource = usesSystemSource ? undefined : dataSource

  const systemQuery = useChartSystemRecords(systemSource)
  const tableQuery = useChartRecords(tableSource)
  const { data, isLoading, isError, error } = usesSystemSource ? systemQuery : tableQuery
  return { records: data?.records ?? [], isLoading, isError, error }
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
  emptyState,
  ariaLabel: accessibleName,
}: ChartIslandProps): ReactElement {
  const { records, isLoading, isError, error } = useChartData(dataSource)

  const guard = evaluateChartGuards({
    dataSource,
    xAxis,
    yAxis,
    chartAggregate,
    series,
    emptyMessage,
    emptyState,
    isLoading,
    isError,
    error,
    records,
  })
  if (guard.element) return guard.element

  if (hasSeries(series)) {
    return renderSeriesChart({ records, chartType, xAxis, series, legend, tooltip, accessibleName })
  }

  if (chartAggregate) {
    return renderAggregatedChart({
      records,
      chartType,
      chartAggregate,
      xAxis,
      yAxis,
      accessibleName,
    })
  }

  return (
    <BarChartCanvas
      records={records}
      xField={xAxis?.field ?? ''}
      yField={yAxis?.field ?? ''}
      xAxis={xAxis}
      yAxis={yAxis}
      accessibleName={accessibleName}
    />
  )
}
