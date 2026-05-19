/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'
import { periodPresetSchema, seriesIntervalSchema } from '../_shared/period-preset'

export const bucketsOverviewQuerySchema = z.object({
  period: periodPresetSchema,
})

export const bucketsOverviewSeriesPointSchema = z
  .object({
    timestamp: z
      .string()
      .datetime()
      .describe(
        "ISO 8601 UTC timestamp of the bucket's **start** edge (the bucket covers `[timestamp, timestamp + interval)`)."
      ),
    uploads: z
      .number()
      .int()
      .nonnegative()
      .describe('Count of files uploaded during this bucket interval.'),
    bytes: z
      .number()
      .int()
      .nonnegative()
      .describe('Sum of file sizes (bytes) uploaded during this bucket interval.'),
  })
  .openapi('BucketsOverviewSeriesPoint')

export const bucketsOverviewByProviderSchema = z
  .object({
    s3: z.number().int().nonnegative().describe('Count of S3 buckets currently configured.'),
    local: z
      .number()
      .int()
      .nonnegative()
      .describe('Count of local-filesystem buckets currently configured.'),
    bytea: z
      .number()
      .int()
      .nonnegative()
      .describe('Count of Postgres-bytea buckets currently configured.'),
  })
  .openapi('BucketsOverviewByProvider')

export const bucketsOverviewTotalsSchema = z
  .object({
    buckets: z
      .number()
      .int()
      .nonnegative()
      .describe('Total number of live (non-deleted) buckets currently configured.'),
    files: z
      .number()
      .int()
      .nonnegative()
      .describe('Total number of stored files across every live bucket.'),
    totalBytes: z
      .number()
      .int()
      .nonnegative()
      .describe(
        "Sum of stored file sizes in bytes across every live bucket. Identical semantics to today's `/api/admin/buckets/quota.totalBytes` (preserved for migration parity)."
      ),
    by_provider: bucketsOverviewByProviderSchema.describe(
      'Per-provider bucket-count breakdown. The sum of `by_provider.{s3,local,bytea}` always equals `totals.buckets`.'
    ),
  })
  .openapi('BucketsOverviewTotals')

export const bucketsOverviewSeriesSchema = z
  .object({
    interval: seriesIntervalSchema,
    points: z
      .array(bucketsOverviewSeriesPointSchema)
      .describe(
        'Time-bucketed upload history. Length is fixed per preset (24, 7, or 30 entries). Empty intervals emit zeros, not gaps.'
      ),
  })
  .openapi('BucketsOverviewSeries')

export const bucketsOverviewResponseSchema = z
  .object({
    totals: bucketsOverviewTotalsSchema,
    series: bucketsOverviewSeriesSchema,
  })
  .openapi('BucketsOverviewResponse')

export type BucketsOverviewQuery = z.infer<typeof bucketsOverviewQuerySchema>
export type BucketsOverviewSeriesPoint = z.infer<typeof bucketsOverviewSeriesPointSchema>
export type BucketsOverviewByProvider = z.infer<typeof bucketsOverviewByProviderSchema>
export type BucketsOverviewTotals = z.infer<typeof bucketsOverviewTotalsSchema>
export type BucketsOverviewSeries = z.infer<typeof bucketsOverviewSeriesSchema>
export type BucketsOverviewResponse = z.infer<typeof bucketsOverviewResponseSchema>
