/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { MultiAreaChart } from './multi-area-chart'
import { MultiBarChart } from './multi-bar-chart'
import { MultiLineChart } from './multi-line-chart'
import type {
  ChartAxisConfig,
  ChartLegendConfig,
  ChartTooltipConfig,
  ChartType,
} from './chart-canvas-types'
import type { ChartAxisDisplay, ChartSeriesConfig } from './chart-series-shared'
import type { TableRecord } from '../runtime/types'
import type { ReactElement } from 'react'

/**
 * The series-bound canvases: one mark per declared `series` entry.
 */

/** True when the chart declares at least one explicit data series. */
export function hasSeries(
  series: readonly ChartSeriesConfig[] | undefined
): series is readonly ChartSeriesConfig[] {
  return Array.isArray(series) && series.length > 0
}

/**
 * Everything a series-bound canvas is handed.
 *
 * `yAxis` is a member of this list, and its ABSENCE from it was the whole
 * defect: the schema accepts `label`, `format`, `scale` and `gridLines` on a
 * series chart's value axis, the SSR wrapper forwards them and `ChartCanvas`
 * receives them — and this argument list dropped all four silently, so they
 * validated and drew nothing. A canvas cannot honour what it is never given.
 */
interface SeriesChartArgs {
  readonly records: readonly TableRecord[]
  readonly chartType: ChartType | undefined
  readonly xAxis: ChartAxisConfig | undefined
  readonly yAxis: ChartAxisDisplay | undefined
  readonly series: readonly ChartSeriesConfig[]
  readonly legend: ChartLegendConfig | undefined
  readonly tooltip: ChartTooltipConfig | undefined
  readonly accessibleName: string | undefined
}

/** `bar`/`area` series charts share the same prop shape (no tooltip). */
function renderBarOrAreaSeries(args: SeriesChartArgs, xField: string): ReactElement {
  const { records, chartType, yAxis, series, legend, accessibleName } = args
  const Chart = chartType === 'bar' ? MultiBarChart : MultiAreaChart
  return (
    <Chart
      records={records}
      xField={xField}
      xFormat={args.xAxis?.format}
      series={series}
      yAxis={yAxis}
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
 * filled area paths, `scatter` renders unjoined point marks, and every other
 * type falls back to line series with a hover tooltip. The legend lists every
 * series label.
 */
export function renderSeriesChart(args: SeriesChartArgs): ReactElement {
  const { records, chartType, xAxis, yAxis, series, legend, tooltip, accessibleName } = args
  const xField = xAxis?.field ?? ''
  if (chartType === 'bar' || chartType === 'area') {
    return renderBarOrAreaSeries(args, xField)
  }
  return (
    <MultiLineChart
      records={records}
      xField={xField}
      xFormat={xAxis?.format}
      series={series}
      yAxis={yAxis}
      legendPosition={legend?.position}
      legendVisible={legend?.visible}
      tooltipFormat={tooltip?.format}
      variant={chartType === 'scatter' ? 'scatter' : 'line'}
      accessibleName={accessibleName}
    />
  )
}
