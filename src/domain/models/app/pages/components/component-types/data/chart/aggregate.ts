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
export const ChartAggregateFunctionSchema = AggregateFunctionSchema.annotate({
  title: 'Chart Aggregate Function',
  description: 'Aggregate function applied to the Y-axis field',
})

/**
 * Date grouping interval for aggregate queries.
 */
export const ChartDateIntervalSchema = Schema.Literals([
  'day',
  'week',
  'month',
  'quarter',
  'year',
]).annotate({
  title: 'Date Interval',
  description: 'Time interval for date-based grouping',
})

/**
 * Order in which an aggregated chart draws its categories.
 *
 * `option` follows the declared option order of a `single-select` or `status`
 * grouping field — a pipeline reads Prospect, Qualified, Proposal, Won, Lost
 * rather than alphabetically. `label` sorts the category names as displayed
 * (an option's label, else its value); `value-asc` and `value-desc` sort by the
 * aggregated value. The effective default is `option` when the grouping field
 * declares options, otherwise `value-desc` for a pie or donut and `label` for
 * every other chart, so the default lives in the renderer rather than on this
 * node.
 */
export const ChartAggregateOrderSchema = Schema.Literals([
  'option',
  'label',
  'value-asc',
  'value-desc',
]).annotate({
  title: 'Category Order',
  description:
    "Order of the chart's categories: `option` follows the grouping field's declared options (the default for a single-select or status field), `label` sorts the category names as displayed (the default otherwise, except a pie or donut), `value-asc` and `value-desc` sort by the aggregated value (`value-desc` is a pie or donut's default).",
})

/**
 * Aggregate configuration for summarized chart data.
 */
export const ChartAggregateSchema = Schema.Struct({
  /** Aggregate function to apply */
  function: ChartAggregateFunctionSchema,
  /** Field to aggregate (not required for count) */
  field: Schema.optional(
    Schema.String.annotate({ description: 'Field to aggregate (omit for count)' })
  ),
  /** Field to group records by */
  groupBy: Schema.String.annotate({
    description: 'Field to group records by on the X-axis',
  }),
  /** Date grouping interval (when groupBy is a date field) */
  interval: Schema.optional(ChartDateIntervalSchema),
  /** Category order (defaults by grouping field type) */
  order: Schema.optional(ChartAggregateOrderSchema),
}).annotate({
  title: 'Chart Aggregate',
  description: 'Aggregate function and grouping configuration for summarized chart data',
})

/** @public */
export type ChartAggregateFunction = Schema.Schema.Type<typeof ChartAggregateFunctionSchema>
/** @public */
export type ChartDateInterval = Schema.Schema.Type<typeof ChartDateIntervalSchema>
/** @public */
export type ChartAggregateOrder = Schema.Schema.Type<typeof ChartAggregateOrderSchema>
/** @public */
export type ChartAggregate = Schema.Schema.Type<typeof ChartAggregateSchema>
