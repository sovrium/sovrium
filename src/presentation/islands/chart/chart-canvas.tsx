/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */
import { renderAggregatedChart } from './chart-aggregate-canvas'
import { renderCategoryChart } from './chart-category-canvas'
import { hasSeries, renderSeriesChart } from './chart-series-canvas'
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

/**
 * Chart canvas dispatch — picks the mark a chart draws from its declared
 * `chartType` and binding shape, once the island's guards have established
 * that there are rows to draw.
 *
 * It lives beside the island (capped by the per-island `max-lines` eco rule)
 * because "which canvas" is a decision worth reading on its own: every
 * `chartType` the schema accepts must land on a canvas that draws it, and a
 * type falling through to the wrong branch is silent — the SSR wrapper still
 * carries the declared `data-chart-type` either way.
 */

interface AxisBoundChartArgs {
  readonly records: readonly TableRecord[]
  readonly chartType: ChartType | undefined
  readonly xAxis: ChartAxisConfig | undefined
  readonly yAxis: ChartAxisConfig | undefined
  readonly tooltip: ChartTooltipConfig | undefined
  readonly legend: ChartLegendConfig | undefined
  readonly fields: ChartFieldContext
  readonly accessibleName: string | undefined
}

/**
 * Renders the raw `xAxis`/`yAxis` binding — no series array, no aggregate. The
 * axes name the fields and the canvas reduces the records itself.
 */
function renderAxisBoundChart(args: AxisBoundChartArgs): ReactElement {
  return renderCategoryChart({
    ...args,
    xField: args.xAxis?.field ?? '',
    yField: args.yAxis?.field ?? '',
  })
}

export interface ChartCanvasProps {
  readonly records: readonly TableRecord[]
  readonly chartType?: ChartType
  readonly xAxis?: ChartAxisConfig
  readonly yAxis?: ChartAxisConfig
  readonly series?: readonly ChartSeriesConfig[]
  readonly legend?: ChartLegendConfig
  readonly tooltip?: ChartTooltipConfig
  readonly chartAggregate?: ChartAggregateConfig
  readonly accessibleName?: string
  readonly fields?: ChartFieldContext
}

const NO_FIELD_CONTEXT: ChartFieldContext = {}

/**
 * Draws the chart itself. Three bindings, checked in precedence order: an
 * explicit `series` array, a `chartAggregate` config, then the raw
 * `xAxis`/`yAxis` field pair — and within each, the declared `chartType`
 * selects the mark.
 */
export function ChartCanvas({
  records,
  chartType,
  xAxis,
  yAxis,
  series,
  legend,
  tooltip,
  chartAggregate,
  accessibleName,
  fields = NO_FIELD_CONTEXT,
}: ChartCanvasProps): ReactElement {
  // A declared `chartAggregate` reduces the records to one `{ key, value }` series.
  if (chartAggregate) {
    return renderAggregatedChart({
      records,
      chartType,
      chartAggregate,
      series,
      xAxis,
      yAxis,
      tooltip,
      legend,
      fields,
      accessibleName,
    })
  }

  // A declared `series` array routes to the multi-series chart.
  if (hasSeries(series)) {
    // One value axis over every series: it prints the currency the series'
    // fields share, which the server resolved only when they all agree.
    const seriesAxis =
      fields.valueCurrency === undefined ? yAxis : { ...yAxis, currency: fields.valueCurrency }
    return renderSeriesChart({
      records,
      chartType,
      xAxis,
      yAxis: seriesAxis,
      series,
      legend,
      tooltip,
      accessibleName,
    })
  }

  const axisArgs = { records, chartType, xAxis, yAxis, tooltip, legend, fields, accessibleName }
  return renderAxisBoundChart(axisArgs)
}
