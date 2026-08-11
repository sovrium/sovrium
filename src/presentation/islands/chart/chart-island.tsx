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

/** DB-table chart binding (unchanged): series rendered over `/api/tables/:t/records`. */
interface ChartTableSource {
  readonly table: string
  readonly view?: string
  readonly filter?: readonly DataFilter[]
  readonly sort?: readonly DataSort[]
}

/**
 * Chart data source — discriminated: a DB table (`{ table, ... }`, series over
 * DB rows) OR a system read endpoint (`{ system: {...} }`, series over the
 * endpoint's rows at `rowsKey`).
 */
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
  /**
   * Operator-set accessible name for the rendered `<svg role="img">` (forwarded
   * from `props['aria-label']`); overrides the per-`chartType` default when set,
   * otherwise each canvas keeps its existing default (an additive override).
   */
  readonly ariaLabel?: string
  /**
   * Optional NAMED empty-state region: when set, the zero-rows branch renders an
   * accessible `role="region"` landmark (name + title) instead of the unnamed
   * default empty placeholder (purely additive — absent keeps the plain empty).
   */
  readonly emptyState?: ChartEmptyStateConfig
}

/**
 * Chart island — client-side data-bound visualisation entry point.
 *
 * Foundational implementation covers the bar chart used by [internal ref] / basic
 * chart specs. Other chart types (line/area/pie/donut/scatter) and the
 * aggregation/series/legend stories layer on top in subsequent specs.
 *
 * The island contract:
 * - Returns `ChartMissingTable` if no `dataSource.table` is configured.
 * - Returns `ChartLoading` while the records query is in flight.
 * - Returns `ChartError` on fetch failure.
 * - Returns `ChartEmpty` (with `emptyMessage`) when zero records come back.
 * - Otherwise renders a visx-backed SVG chart of the requested `chartType`.
 *
 * Each branch emits `data-component="chart"` so spec assertions on that
 * canonical attribute resolve in every state.
 */
interface ChartGuardResult {
  readonly element?: ReactElement
}

/**
 * Walks the early-exit ladder (missing table -> loading -> error -> empty ->
 * missing axes). Returning `element` short-circuits rendering. Pulling the
 * guards out keeps the parent component below the cyclomatic-complexity cap.
 */
/**
 * True when the chart still needs explicit `xAxis`/`yAxis` field bindings.
 * Charts with a `chartAggregate` derive both axes from the aggregate config
 * (`groupBy` -> X, aggregated value -> Y), and charts that declare a `series`
 * array derive Y from each series field — so axis bindings are optional in
 * both cases.
 */
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

/** Narrowing guard: is this data source the system read-endpoint variant? */
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
  // A system source has no declared table — the `app.tables` cross-validation /
  // missing-table guard is SKIPPED entirely; rows come from the endpoint instead.
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

/**
 * Renders an aggregated chart from a `chartAggregate` config. `line` charts
 * use the line canvas; every other type falls back to the bar canvas.
 */
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

/** True when the chart declares at least one explicit data series. */
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

/** `bar`/`area` series charts share the same prop shape (no tooltip). */
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

/**
 * Renders a multi-series chart with an interactive legend. Each
 * declared `series` entry gets its own visual mark whose shape depends on the
 * `chartType`: `bar` renders grouped/stacked coloured bars, `area` renders
 * filled area paths, and every other type falls back to line series with a
 * hover tooltip. The legend lists every series label.
 */
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

/** The read result shared by both chart bindings (records + query status). */
interface ChartData {
  readonly records: readonly TableRecord[]
  readonly isLoading: boolean
  readonly isError: boolean
  readonly error: unknown
}

/**
 * Discriminates the chart data source and reads its records: a system read
 * endpoint reads rows at `rowsKey` from `system.endpoint`; a DB table fetches
 * `/api/tables/:t/records`. Both hooks are called unconditionally (hook rules)
 * and gated internally via `enabled`, so only the active binding issues a fetch.
 */
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

  // A declared `series` array routes to the multi-series chart.
  if (hasSeries(series)) {
    return renderSeriesChart({ records, chartType, xAxis, series, legend, tooltip, accessibleName })
  }

  // When `chartAggregate` is declared, aggregate records into a `{ key, value }` series.
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

  // Foundational [internal ref] implementation renders the bar variant from raw
  // records. Other chart types layer on top in subsequent specs.
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
