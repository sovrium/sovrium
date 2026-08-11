/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const KPIComparisonPeriodSchema = Schema.Literal(
  'previousDay',
  'previousWeek',
  'previousMonth',
  'previousQuarter',
  'previousYear'
).annotations({
  title: 'Comparison Period',
  description: 'Time period to compare the current metric value against',
})

export const KPITrendDirectionSchema = Schema.Literal('up', 'down', 'flat').annotations({
  title: 'Trend Direction',
  description: 'Direction of change compared to the previous period',
})

export const KPITrendColorSchema = Schema.Literal('green', 'red', 'yellow', 'gray').annotations({
  title: 'Trend Color',
  description: 'Color indicating whether the trend is positive, negative, or neutral',
})

export const KPITrendSchema = Schema.Struct({
  comparisonPeriod: KPIComparisonPeriodSchema,
  direction: KPITrendDirectionSchema,
  changePercent: Schema.Number.annotations({
    description: 'Percentage change from the comparison period',
  }),
  color: Schema.optional(KPITrendColorSchema),
}).annotations({
  title: 'KPI Trend',
  description: 'Trend comparison showing change direction and percentage from a previous period',
})

/** @public */
export type KPIComparisonPeriod = Schema.Schema.Type<typeof KPIComparisonPeriodSchema>
/** @public */
export type KPITrendDirection = Schema.Schema.Type<typeof KPITrendDirectionSchema>
/** @public */
export type KPITrendColor = Schema.Schema.Type<typeof KPITrendColorSchema>
/** @public */
export type KPITrend = Schema.Schema.Type<typeof KPITrendSchema>
