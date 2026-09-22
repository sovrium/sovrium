/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/automations/overview`.
 *
 * First overview-shape endpoint after the audit-log keystone. Locks [internal ref] D5
 * (`series` rollup with fixed buckets) and consumes CC-2 (the shared period
 * preset). Every subsequent overview endpoint — users, tables, buckets — MUST
 * reuse this shape rather than redefining it.
 *
 * Source story: [internal ref]
 *
 * @see plan §6.4 (canonical `series` rollup shape)
 * @see [internal ref] D5 (locked `series` rollup with fixed buckets)
 */

import { Schema } from 'effect'
import { periodPresetSchema } from '@/domain/models/api/admin/envelope/period-preset'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'

/**
 * Query parameters accepted by `GET /api/admin/automations/overview`.
 *
 * `period` is the only filter — by design. Operators wanting top-N
 * drill-downs (which automation failed most? which run took longest?) read
 * `/api/admin/automations/runs` (story #3); the overview is a tile, not a
 * report. Adding `?automationName=` later would not break this contract.
 */
export const automationsOverviewQuerySchema = Schema.Struct({
  period: periodPresetSchema,
}).annotate({ identifier: 'AutomationsOverviewQuery' })

/** @public */
export type AutomationsOverviewQuery = typeof automationsOverviewQuerySchema.Encoded

/**
 * Bucket interval used by the response `series.interval` field.
 *
 * Re-exported from the shared period-preset so consumers reading the response
 * schema do not need to import a second module. Locked to `1h` and `1d` only;
 * extending the set requires re-opening [internal ref] D5.
 */
const seriesIntervalSchema = Schema.Literals(['1h', '1d']).annotate({
  description: 'Bucket size for the rollup. 1h for 24h period; 1d for 7d/30d periods.',
})

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
const seriesPointSchema = Schema.Struct({
  timestamp: looseIsoDateTime({
    description:
      'ISO 8601 UTC timestamp at the start of the bucket. For 1h buckets, the minute and second components are zeroed; for 1d buckets, the time component is zeroed (start of day in UTC).',
  }),
  runs: Schema.Int.annotate({
    description: 'Total automation runs that started within this bucket.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  failures: Schema.Int.annotate({
    description: 'Subset of `runs` that ended with status = "failed".',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
}).annotate({ identifier: 'AutomationsOverviewSeriesPoint' })

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
export const automationsOverviewResponseSchema = Schema.Struct({
  totals: Schema.Struct({
    automations: Schema.Int.annotate({
      description: 'Number of automation definitions configured in the app schema.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    runs_24h: Schema.Int.annotate({
      description:
        'Total automation runs that started in the last 24 hours, regardless of the requested period.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    failures_24h: Schema.Int.annotate({
      description:
        'Subset of `runs_24h` that ended with status = "failed". Same 24h window as `runs_24h`.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    success_rate: Schema.Finite.annotate({
      description:
        'Fraction of successful runs over the requested period, in [0, 1]. Returns 1 when no runs occurred (the period is by convention 100% healthy).',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1))),
  }).annotate({ description: 'Period-aware aggregate counters surfaced as dashboard tiles.' }),
  series: Schema.Struct({
    interval: seriesIntervalSchema,
    points: Schema.Array(seriesPointSchema).annotate({
      description:
        'Dense, ascending-by-timestamp series of buckets covering the requested period. Empty buckets are present with zero counts.',
    }),
  }).annotate({ description: 'Bucketed time series for chart rendering.' }),
}).annotate({ identifier: 'AutomationsOverviewResponse' })

/** @public */
export type AutomationsOverviewResponse = typeof automationsOverviewResponseSchema.Type
/** @public */
export type AutomationsOverviewSeriesPoint = typeof seriesPointSchema.Type
