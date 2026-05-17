/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/buckets/overview`.
 *
 * **Reshape note**: This endpoint replaces the legacy
 * `GET /api/admin/buckets/quota` (which returned `{ totalBytes, fileCount }`
 * — a flat snapshot of global storage usage). The new shape adopts the
 * canonical overview contract used by every Phase-0 admin overview
 * endpoint:
 *
 * - **Query**: `?period=24h | 7d | 30d` — rolling-window selector via
 *   `periodPresetSchema`.
 * - **Response**: `{ totals: { ... }, series: { interval, points: [...] } }`
 *   where `totals` is the right-edge snapshot (current state) and `series`
 *   is the time-bucketed history.
 *
 * The legacy `/quota` route is **kept for one release cycle** to avoid
 * breaking external monitoring scripts; new dashboard code consumes
 * `/overview` and the migration is documented in the user story. After the
 * deprecation window, `/quota` is removed in a separate sibling commit
 * (out of scope for this story).
 *
 * Source story: docs/user-stories/as-business-admin/buckets/buckets-list.md
 *
 * @see plan-design §10 — story #5 in the authoring sequence
 * @see plan-design §6.3 series rollup contract
 * @see ./list.ts — sibling list endpoint
 * @see plan-design §5.4 reshape pre-authoring grep — confirmed external
 *      reference scope
 */

import { z } from '@hono/zod-openapi'
import { periodPresetSchema, seriesIntervalSchema } from '../_shared/period-preset'

/**
 * Query schema for `GET /api/admin/buckets/overview`.
 *
 * Single knob: the `period` preset. The bucket interval is derived from
 * the preset by the server (24h → 1h, 7d/30d → 1d) — see
 * `periodPresetSchema` for the locked mapping.
 */
export const bucketsOverviewQuerySchema = z.object({
  period: periodPresetSchema,
})

/**
 * Per-bucket-interval point in the storage time series.
 *
 * Each point reports two scalars accumulated within its interval:
 *
 * - `uploads` — count of files uploaded during the bucket's interval (the
 *   number of `bucket.file.uploaded` audit-log entries that fell inside
 *   this bucket).
 * - `bytes` — sum of byte sizes uploaded during the bucket's interval.
 *
 * **Empty buckets are emitted with zeros, not omitted** — operators expect
 * a contiguous series for chart rendering; sparse arrays force frontends
 * to interpolate, which silently lies about idle periods.
 */
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

/**
 * Per-provider aggregate snapshot. Reports current-state counts of buckets
 * configured per storage provider — operators read this to spot drift
 * (e.g. "we are supposed to be all-S3 in production but the count shows 1
 * local bucket leaked through").
 *
 * The three keys are present even when the count is zero — fixed-shape
 * objects are easier to render in the dashboard than sparse maps.
 */
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

/**
 * Right-edge "totals" block — the current-state snapshot complementing the
 * historical `series` block.
 */
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

/**
 * The historical `series` block. `interval` is server-determined from the
 * `period` query parameter (the caller cannot configure it directly) so
 * the chart axis is implicit per design §6.3.
 *
 * `points` is always an array of fixed length matching the preset:
 * - `period=24h` → 24 points at `interval=1h`
 * - `period=7d`  → 7 points at `interval=1d`
 * - `period=30d` → 30 points at `interval=1d`
 *
 * The points are ordered ascending by `timestamp` (oldest first) — chart
 * components iterate left-to-right and operators expect the rightmost
 * point to be "now".
 */
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

/**
 * Response schema for `GET /api/admin/buckets/overview`.
 */
export const bucketsOverviewResponseSchema = z
  .object({
    totals: bucketsOverviewTotalsSchema,
    series: bucketsOverviewSeriesSchema,
  })
  .openapi('BucketsOverviewResponse')

/**
 * TypeScript types inferred from the schemas.
 * @public
 */
export type BucketsOverviewQuery = z.infer<typeof bucketsOverviewQuerySchema>
/** @public */
export type BucketsOverviewSeriesPoint = z.infer<typeof bucketsOverviewSeriesPointSchema>
/** @public */
export type BucketsOverviewByProvider = z.infer<typeof bucketsOverviewByProviderSchema>
/** @public */
export type BucketsOverviewTotals = z.infer<typeof bucketsOverviewTotalsSchema>
/** @public */
export type BucketsOverviewSeries = z.infer<typeof bucketsOverviewSeriesSchema>
/** @public */
export type BucketsOverviewResponse = z.infer<typeof bucketsOverviewResponseSchema>
