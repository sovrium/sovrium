/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'
import { periodPresetSchema } from '@/domain/models/api/admin/_shared/period-preset'

export const automationsOverviewQuerySchema = z
  .object({
    period: periodPresetSchema,
  })
  .openapi('AutomationsOverviewQuery')

export type AutomationsOverviewQuery = z.input<typeof automationsOverviewQuerySchema>

const seriesIntervalSchema = z
  .enum(['1h', '1d'])
  .describe('Bucket size for the rollup. 1h for 24h period; 1d for 7d/30d periods.')

const seriesPointSchema = z
  .object({
    timestamp: z
      .string()
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp at the start of the bucket. For 1h buckets, the minute and second components are zeroed; for 1d buckets, the time component is zeroed (start of day in UTC).'
      ),
    runs: z
      .number()
      .int()
      .nonnegative()
      .describe('Total automation runs that started within this bucket.'),
    failures: z
      .number()
      .int()
      .nonnegative()
      .describe('Subset of `runs` that ended with status = "failed".'),
  })
  .openapi('AutomationsOverviewSeriesPoint')

export const automationsOverviewResponseSchema = z
  .object({
    totals: z
      .object({
        automations: z
          .number()
          .int()
          .nonnegative()
          .describe('Number of automation definitions configured in the app schema.'),
        runs_24h: z
          .number()
          .int()
          .nonnegative()
          .describe(
            'Total automation runs that started in the last 24 hours, regardless of the requested period.'
          ),
        failures_24h: z
          .number()
          .int()
          .nonnegative()
          .describe(
            'Subset of `runs_24h` that ended with status = "failed". Same 24h window as `runs_24h`.'
          ),
        success_rate: z
          .number()
          .min(0)
          .max(1)
          .describe(
            'Fraction of successful runs over the requested period, in [0, 1]. Returns 1 when no runs occurred (the period is by convention 100% healthy).'
          ),
      })
      .describe('Period-aware aggregate counters surfaced as dashboard tiles.'),
    series: z
      .object({
        interval: seriesIntervalSchema,
        points: z
          .array(seriesPointSchema)
          .describe(
            'Dense, ascending-by-timestamp series of buckets covering the requested period. Empty buckets are present with zero counts.'
          ),
      })
      .describe('Bucketed time series for chart rendering.'),
  })
  .openapi('AutomationsOverviewResponse')

export type AutomationsOverviewResponse = z.infer<typeof automationsOverviewResponseSchema>
export type AutomationsOverviewSeriesPoint = z.infer<typeof seriesPointSchema>
