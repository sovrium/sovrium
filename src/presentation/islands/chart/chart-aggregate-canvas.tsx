/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { aggregateRecords, decorateCategories, paintEvery } from './chart-aggregate'
import { PIE_DEFAULT_ORDER, isArcChart, renderCategoryChart } from './chart-category-canvas'
import { hasSeries, renderSeriesChart } from './chart-series-canvas'
import { aggregateStylingSeries } from './chart-series-shared'
import type { ChartAggregateConfig } from './chart-aggregate'
import type {
  ChartAxisConfig,
  ChartFieldContext,
  ChartLegendConfig,
  ChartTooltipConfig,
  ChartType,
} from './chart-canvas-types'
import type { ChartSeriesConfig } from './chart-series-shared'
import type { TableRecord } from '../runtime/types'
import type { ReactElement } from 'react'

interface AggregatedChartArgs {
  readonly records: readonly TableRecord[]
  readonly chartType: ChartType | undefined
  readonly chartAggregate: ChartAggregateConfig
  /** The chart's `series` — its one entry, when declared, styles the aggregate. */
  readonly series?: readonly ChartSeriesConfig[] | undefined
  readonly xAxis: ChartAxisConfig | undefined
  readonly yAxis: ChartAxisConfig | undefined
  readonly tooltip: ChartTooltipConfig | undefined
  readonly legend: ChartLegendConfig | undefined
  readonly fields: ChartFieldContext
  readonly accessibleName: string | undefined
}

/**
 * Renders an aggregated chart from a `chartAggregate` config: the aggregate
 * names the category field and the value field, and the reduced series is
 * handed to the canvas ready-made.
 *
 * It chooses no mark of its own: every type is decided in one place, and this
 * function's job is to reduce the records before handing them over.
 */
export function renderAggregatedChart(args: AggregatedChartArgs): ReactElement {
  const { records, chartAggregate, fields } = args
  // ONE series styles the aggregated value — its declared entry, or
  // `chartAggregate.color`. A second entry is refused at boot.
  const series = aggregateStylingSeries(args.series, chartAggregate.color, args.chartType)
  // A bar chart only COLOURED keeps the aggregate drawing, every bar in that colour.
  const paintOnly = !hasSeries(args.series) && (args.chartType ?? 'bar') === 'bar'
  if (hasSeries(series) && !isArcChart(args.chartType) && !paintOnly) {
    return renderStyledAggregate({ ...args, series })
  }
  const data = aggregateRecords(
    records,
    chartAggregate,
    fields.categoryOptions,
    isArcChart(args.chartType) ? PIE_DEFAULT_ORDER : 'label'
  )
  return renderCategoryChart({
    ...args,
    xField: chartAggregate.groupBy,
    yField: chartAggregate.field ?? '',
    data: paintOnly ? paintEvery(data, series) : data,
  })
}

/** The row field a styled aggregate's value is drawn from — never a table field. */
const AGGREGATE_VALUE_FIELD = '__aggregate'

/**
 * An aggregated chart styled by its one series: each group becomes a row
 * `{ <groupBy>: <category name>, __aggregate: <value> }`, drawn by the series
 * chart with the series' label and colour.
 */
function renderStyledAggregate(
  args: AggregatedChartArgs & { readonly series: readonly ChartSeriesConfig[] }
): ReactElement {
  const { records, chartAggregate, fields, series } = args
  const groups = decorateCategories(
    aggregateRecords(records, chartAggregate, fields.categoryOptions, 'label'),
    fields.categoryOptions
  )
  const rows = groups.map((group) => ({
    [chartAggregate.groupBy]: group.label ?? group.key,
    [AGGREGATE_VALUE_FIELD]: group.value,
  }))
  const [styled] = series
  return renderSeriesChart({
    ...args,
    records: rows,
    xAxis: { field: chartAggregate.groupBy },
    series: [{ ...styled, field: AGGREGATE_VALUE_FIELD }],
  })
}
