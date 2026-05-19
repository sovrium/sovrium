/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const SparklineDateIntervalSchema = Schema.Literal('day', 'week', 'month').annotations({
  title: 'Sparkline Interval',
  description: 'Date grouping interval for sparkline data points',
})

export const KPISparklineSchema = Schema.Struct({
  field: Schema.String.annotations({ description: 'Field to plot in the sparkline' }),
  groupBy: Schema.String.annotations({ description: 'Date field for grouping data points' }),
  interval: SparklineDateIntervalSchema,
  days: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThan(0),
    Schema.annotations({
      description: 'Number of trailing days of data to show',
      examples: [7, 30, 90],
    })
  ),
}).annotations({
  title: 'KPI Sparkline',
  description: 'Mini line chart showing recent trend for the KPI metric',
})

export type SparklineDateInterval = Schema.Schema.Type<typeof SparklineDateIntervalSchema>
export type KPISparkline = Schema.Schema.Type<typeof KPISparklineSchema>
