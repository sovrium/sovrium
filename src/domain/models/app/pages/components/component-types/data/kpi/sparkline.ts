/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The width of one sparkline point. `minute` and `hour` bucket by UTC minute
 * or hour; `days` still sets how far back the line reaches, so `hour` over
 * `days: 1` is the last 24 hours.
 */
export const SparklineDateIntervalSchema = Schema.Literals([
  'minute',
  'hour',
  'day',
  'week',
  'month',
]).annotate({
  title: 'Sparkline Interval',
  description:
    'Date grouping interval for sparkline data points: minute or hour (in UTC), day, week or month',
})

export const KPISparklineSchema = Schema.Struct({
  field: Schema.String.annotate({ description: 'Field to plot in the sparkline' }),
  groupBy: Schema.String.annotate({ description: 'Date field for grouping data points' }),
  interval: SparklineDateIntervalSchema,
  days: Schema.Finite.pipe(
    Schema.annotate({
      description: 'Number of trailing days of data to show',
      examples: [7, 30, 90],
    }),
    Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
  ),
}).annotate({
  title: 'KPI Sparkline',
  description: 'Mini line chart showing recent trend for the KPI metric',
})

/** @public */
export type SparklineDateInterval = Schema.Schema.Type<typeof SparklineDateIntervalSchema>
/** @public */
export type KPISparkline = Schema.Schema.Type<typeof KPISparklineSchema>
