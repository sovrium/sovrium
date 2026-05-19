/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AggregateFunctionSchema } from '../../../shared-schemas'

export const ChartAggregateFunctionSchema = AggregateFunctionSchema.annotations({
  title: 'Chart Aggregate Function',
  description: 'Aggregate function applied to the Y-axis field',
})

export const ChartDateIntervalSchema = Schema.Literal(
  'day',
  'week',
  'month',
  'quarter',
  'year'
).annotations({
  title: 'Date Interval',
  description: 'Time interval for date-based grouping',
})

export const ChartAggregateSchema = Schema.Struct({
  function: ChartAggregateFunctionSchema,
  field: Schema.optional(
    Schema.String.annotations({ description: 'Field to aggregate (omit for count)' })
  ),
  groupBy: Schema.String.annotations({
    description: 'Field to group records by on the X-axis',
  }),
  interval: Schema.optional(ChartDateIntervalSchema),
}).annotations({
  title: 'Chart Aggregate',
  description: 'Aggregate function and grouping configuration for summarized chart data',
})

export type ChartAggregateFunction = Schema.Schema.Type<typeof ChartAggregateFunctionSchema>
export type ChartDateInterval = Schema.Schema.Type<typeof ChartDateIntervalSchema>
export type ChartAggregate = Schema.Schema.Type<typeof ChartAggregateSchema>
