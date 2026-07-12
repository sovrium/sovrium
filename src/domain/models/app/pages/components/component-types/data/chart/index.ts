/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { ChartAggregateSchema } from './aggregate'
import { ChartAxisSchema } from './axis'
import { ChartDataSourceSchema } from './data-source'
import { ChartLegendSchema } from './legend'
import { ChartSeriesSchema } from './series'
import { ChartTooltipSchema } from './tooltip'


export const ChartTypeSchema = Schema.Literal(
  'bar',
  'line',
  'pie',
  'area',
  'donut',
  'scatter'
).annotations({
  title: 'Chart Type',
  description: 'Visualization type for the chart component',
})

export type ChartType = Schema.Schema.Type<typeof ChartTypeSchema>


export const ChartTypeLiteral = Schema.Literal('chart')

export const chartFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
  dataSource: Schema.optional(ChartDataSourceSchema),
  chartType: Schema.optional(ChartTypeSchema),
  xAxis: Schema.optional(ChartAxisSchema),
  yAxis: Schema.optional(ChartAxisSchema),
  series: Schema.optional(
    Schema.Array(ChartSeriesSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Data series definitions for chart component' })
    )
  ),
  legend: Schema.optional(ChartLegendSchema),
  tooltip: Schema.optional(ChartTooltipSchema),
  chartAggregate: Schema.optional(ChartAggregateSchema),
  emptyMessage: Schema.optional(
    Schema.String.annotations({
      description: 'Message displayed when the chart data source returns no records',
      examples: ['No sales data available', 'No metrics yet'],
    })
  ),
  emptyState: Schema.optional(
    Schema.Struct({
      role: Schema.Literal('region').annotations({
        description: 'ARIA landmark role for the empty-state region (currently only "region")',
      }),
      name: Schema.String.pipe(
        Schema.minLength(1),
        Schema.annotations({
          description:
            'Accessible name (aria-label) for the empty-state region, rendered when the chart data source returns zero rows',
          examples: ['Aucune donnée', 'No data'],
        })
      ),
      title: Schema.optional(
        Schema.String.annotations({
          description:
            'Body text inside the empty-state region (falls back to emptyMessage, then a default, when omitted)',
          examples: ['Aucune visite sur la période'],
        })
      ),
    }).annotations({
      title: 'Chart Empty State',
      description:
        'When set, the chart renders a NAMED ARIA region (role + accessible name) instead of the default unnamed empty placeholder when its data source returns zero rows. Present-when-empty, absent-when-populated.',
    })
  ),
} as const


export {
  AxisFormatSchema,
  AxisScaleSchema,
  ChartAxisSchema,
  type AxisFormat,
  type AxisScale,
  type ChartAxis,
} from './axis'

export {
  ChartDbDataSourceSchema,
  ChartSystemSourceSchema,
  ChartDataSourceSchema,
  type ChartSystemSource,
} from './data-source'

export { ChartSeriesSchema, type ChartSeries } from './series'

export {
  LegendPositionSchema,
  ChartLegendSchema,
  type LegendPosition,
  type ChartLegend,
} from './legend'

export { ChartTooltipSchema, type ChartTooltip } from './tooltip'

export {
  ChartAggregateFunctionSchema,
  ChartDateIntervalSchema,
  ChartAggregateSchema,
  type ChartAggregateFunction,
  type ChartDateInterval,
  type ChartAggregate,
} from './aggregate'
