/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AggregateFunctionSchema } from '../../../shared-schemas'

/**
 * Aggregate function for chart data summarization.
 *
 * Alias of the shared `AggregateFunctionSchema`. The chart-specific name is
 * kept for callsite clarity and a chart-targeted description annotation.
 */
export const ChartAggregateFunctionSchema = AggregateFunctionSchema.annotations({
  title: 'Chart Aggregate Function',
  description: 'Aggregate function applied to the Y-axis field',
})

/**
 * Date grouping interval for aggregate queries.
 */
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

/**
 * Aggregate configuration for summarized chart data.
 */
export const ChartAggregateSchema = Schema.Struct({
  /** Aggregate function to apply */
  function: ChartAggregateFunctionSchema,
  /** Field to aggregate (not required for count) */
  field: Schema.optional(
    Schema.String.annotations({ description: 'Field to aggregate (omit for count)' })
  ),
  /** Field to group records by */
  groupBy: Schema.String.annotations({
    description: 'Field to group records by on the X-axis',
  }),
  /** Date grouping interval (when groupBy is a date field) */
  interval: Schema.optional(ChartDateIntervalSchema),
}).annotations({
  title: 'Chart Aggregate',
  description: 'Aggregate function and grouping configuration for summarized chart data',
})

/** @public */
export type ChartAggregateFunction = Schema.Schema.Type<typeof ChartAggregateFunctionSchema>
/** @public */
export type ChartDateInterval = Schema.Schema.Type<typeof ChartDateIntervalSchema>
/** @public */
export type ChartAggregate = Schema.Schema.Type<typeof ChartAggregateSchema>
