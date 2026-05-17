/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/automations/overview`.
 *
 * First overview-shape endpoint after the audit-log keystone. Locks ADR-012 D5
 * (`series` rollup with fixed buckets) and consumes CC-2 (the shared period
 * preset). Every subsequent overview endpoint — users, tables, buckets — MUST
 * reuse this shape rather than redefining it.
 *
 * Source story: docs/user-stories/as-business-admin/automations/automations-overview.md
 *
 * @see plan §6.4 (canonical `series` rollup shape)
 * @see ADR-012 D5 (locked `series` rollup with fixed buckets)
 */

import { z } from '@hono/zod-openapi'
import { periodPresetSchema } from '@/domain/models/api/admin/_shared/period-preset'

/**
 * Query parameters accepted by `GET /api/admin/automations/overview`.
 *
 * `period` is the only filter — by design. Operators wanting top-N
 * drill-downs (which automation failed most? which run took longest?) read
 * `/api/admin/automations/runs` (story #3); the overview is a tile, not a
 * report. Adding `?automationName=` later would not break this contract.
 */
export const automationsOverviewQuerySchema = z
  .object({
    period: periodPresetSchema,
  })
  .openapi('AutomationsOverviewQuery')

/** @public */
export type AutomationsOverviewQuery = z.input<typeof automationsOverviewQuerySchema>

/**
 * Bucket interval used by the response `series.interval` field.
 *
 * Re-exported from the shared period-preset so consumers reading the response
 * schema do not need to import a second module. Locked to `1h` and `1d` only;
 * extending the set requires re-opening ADR-012 D5.
 */
const seriesIntervalSchema = z
  .enum(['1h', '1d'])
  .describe('Bucket size for the rollup. 1h for 24h period; 1d for 7d/30d periods.')

/**
 * One bucketed point on the `series` rollup.
 *
 * `runs` is the total number of automation runs whose `startedAt` falls
 * inside the bucket (inclusive of the lower bound, exclusive of the upper —
 * the standard half-open convention for time bucketing). `failures` is the
 * subset that ended with `status = 'failed'`. The success count can be
 * derived as `runs - failures`; the response intentionally omits it to keep
 * the bucket payload compact.
 */
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

/**
 * Response shape of `GET /api/admin/automations/overview`.
 *
 * Three top-level fields:
 *
 * - `totals` — aggregate counters for the period. `runs_24h` and
 *   `failures_24h` are always 24-hour aggregates regardless of the requested
 *   `period` (the dashboard footer always shows "today" no matter which tile
 *   filter is active). `success_rate` is the period-scoped fraction
 *   `(runs - failures) / runs`, returned as a decimal in `[0, 1]`. When
 *   `runs = 0` the rate is `1` (a no-op period is by convention 100% healthy
 *   — operators get a clean tile, not an NaN).
 *
 * - `series` — the bucketed rollup. `interval` mirrors the period mapping
 *   (`1h` for 24h period; `1d` for 7d/30d). `points` is ordered ascending by
 *   `timestamp` so the dashboard renders left-to-right without sorting.
 *   Empty buckets are present with `runs = 0` and `failures = 0` — the
 *   response is dense, not sparse, so chart libraries do not have to fill
 *   gaps.
 *
 * - The response intentionally omits per-automation breakdowns and percentile
 *   latencies; both are out-of-scope for Phase 0 (covered by sibling stories
 *   in Phase 1).
 */
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

/** @public */
export type AutomationsOverviewResponse = z.infer<typeof automationsOverviewResponseSchema>
/** @public */
export type AutomationsOverviewSeriesPoint = z.infer<typeof seriesPointSchema>
