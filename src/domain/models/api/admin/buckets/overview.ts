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
 * The deprecation window has elapsed and the legacy `/quota` route is
 * **removed**: it now answers 404. External monitoring scripts read
 * `totals.totalBytes` here instead, which preserves the retired
 * `quota.totalBytes` semantics exactly.
 *
 * Source story: [internal ref]
 *
 * @see plan-design §10 — story #5 in the authoring sequence
 * @see plan-design §6.3 series rollup contract
 * @see ./list.ts — sibling list endpoint
 * @see plan-design §5.4 reshape pre-authoring grep — confirmed external
 *      reference scope
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { periodPresetSchema, seriesIntervalSchema } from '../envelope/period-preset'

/**
 * Query schema for `GET /api/admin/buckets/overview`.
 *
 * Single knob: the `period` preset. The bucket interval is derived from
 * the preset by the server (24h → 1h, 7d/30d → 1d) — see
 * `periodPresetSchema` for the locked mapping.
 */
export const bucketsOverviewQuerySchema = Schema.Struct({
  period: periodPresetSchema,
})

/**
 * Per-bucket-interval point in the storage time series.
 *
 * Each point reports two scalars accumulated within its interval:
 *
 * - `uploads` — count of stored files whose `created_at` falls inside this
 *   bucket.
 * - `bytes` — sum of those files' byte sizes.
 *
 * **Source: `system.file_storage_metadata`, NOT the audit log.** An earlier
 * revision of this doc named the audit log's `bucket.file.uploaded` entries as
 * the source. It cannot be: those entries carry no byte size (the emit passes
 * no `metadata`), and the public upload route
 * (`POST /api/buckets/:name/files`) emits no audit entry at all — so an
 * audit-derived series would report no bytes and systematically under-count
 * uploads. The storage catalog carries `size` (int NOT NULL) and `created_at`
 * (timestamptz NOT NULL) for every file, written by every provider (s3 / local
 * / bytea) on every upload path, and is the same source the file-browser
 * endpoint reads.
 *
 * The `totals` block reads the storage BACKEND instead (`StorageService.list`
 * / `.getTotalBytes()`). The two describe the same corpus, so summing this
 * series over the whole window must equal `totals.files` / `totals.totalBytes`
 * — a catalog row with no backing object, or an object with no catalog row,
 * breaks that identity.
 *
 * **Deletions are not history.** Catalog rows are hard-deleted with the file
 * (there is no soft-delete column), so a point counts files created in its
 * interval **that are still stored**. Deleting a file retroactively lowers the
 * bucket it was uploaded into. Stating this is the honest reading; a series
 * that claimed to be an immutable upload ledger would need an event source that
 * outlives the file, which Sovrium does not keep today.
 *
 * **Empty buckets are emitted with zeros, not omitted** — operators expect
 * a contiguous series for chart rendering; sparse arrays force frontends
 * to interpolate, which silently lies about idle periods.
 */
export const bucketsOverviewSeriesPointSchema = Schema.Struct({
  timestamp: looseIsoDateTime({
    description:
      "ISO 8601 UTC timestamp of the bucket's **start** edge (the bucket covers `[timestamp, timestamp + interval)`).",
  }),
  uploads: Schema.Int.annotate({
    description:
      'Count of stored files created during this bucket interval. Read from the storage catalog, so deleting a file lowers the interval it was uploaded into.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  bytes: Schema.Int.annotate({
    description: 'Sum of the byte sizes of the files counted by `uploads` for this interval.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
}).annotate({ identifier: 'BucketsOverviewSeriesPoint' })

/**
 * Per-provider aggregate snapshot. Reports current-state counts of buckets
 * configured per storage provider — operators read this to spot drift
 * (e.g. "we are supposed to be all-S3 in production but the count shows 1
 * local bucket leaked through").
 *
 * The three keys are present even when the count is zero — fixed-shape
 * objects are easier to render in the dashboard than sparse maps.
 */
export const bucketsOverviewByProviderSchema = Schema.Struct({
  s3: Schema.Int.annotate({ description: 'Count of S3 buckets currently configured.' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  local: Schema.Int.annotate({
    description: 'Count of local-filesystem buckets currently configured.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  bytea: Schema.Int.annotate({
    description: 'Count of Postgres-bytea buckets currently configured.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
}).annotate({ identifier: 'BucketsOverviewByProvider' })

/**
 * Right-edge "totals" block — the current-state snapshot complementing the
 * historical `series` block.
 */
export const bucketsOverviewTotalsSchema = Schema.Struct({
  buckets: Schema.Int.annotate({
    description:
      'Number of live (non-deleted) buckets the app declares in `app.buckets`, or 1 for the virtual `default` bucket when it declares none. Zero when no storage provider resolves — a declaration that cannot store a byte is not a bucket.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  files: Schema.Int.annotate({
    description:
      'Total number of stored files across every live bucket. A GLOBAL figure, never the per-bucket figure multiplied by the bucket count: Sovrium stores every upload under a flat `<uuid>-<filename>` key with no bucket component, so there is no per-bucket attribution to sum over.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  totalBytes: Schema.Int.annotate({
    description:
      'Sum of stored file sizes in bytes across every live bucket. Identical semantics to the retired `/api/admin/buckets/quota.totalBytes` (preserved for migration parity).',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  by_provider: bucketsOverviewByProviderSchema.annotate({
    description:
      'Per-provider bucket-count breakdown. The sum of `by_provider.{s3,local,bytea}` always equals `totals.buckets`.',
  }),
}).annotate({ identifier: 'BucketsOverviewTotals' })

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
export const bucketsOverviewSeriesSchema = Schema.Struct({
  interval: seriesIntervalSchema,
  points: Schema.Array(bucketsOverviewSeriesPointSchema).annotate({
    description:
      'Time-bucketed upload history. Length is fixed per preset (24, 7, or 30 entries). Empty intervals emit zeros, not gaps.',
  }),
}).annotate({ identifier: 'BucketsOverviewSeries' })

/**
 * Response schema for `GET /api/admin/buckets/overview`.
 */
export const bucketsOverviewResponseSchema = Schema.Struct({
  totals: bucketsOverviewTotalsSchema,
  series: bucketsOverviewSeriesSchema,
}).annotate({ identifier: 'BucketsOverviewResponse' })

/**
 * TypeScript types inferred from the schemas.
 * @public
 */
export type BucketsOverviewQuery = typeof bucketsOverviewQuerySchema.Type
/** @public */
export type BucketsOverviewSeriesPoint = typeof bucketsOverviewSeriesPointSchema.Type
/** @public */
export type BucketsOverviewByProvider = typeof bucketsOverviewByProviderSchema.Type
/** @public */
export type BucketsOverviewTotals = typeof bucketsOverviewTotalsSchema.Type
/** @public */
export type BucketsOverviewSeries = typeof bucketsOverviewSeriesSchema.Type
/** @public */
export type BucketsOverviewResponse = typeof bucketsOverviewResponseSchema.Type
