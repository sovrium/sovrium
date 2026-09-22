/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/users/overview`.
 *
 * Second overview-shape endpoint after `[internal ref]` (story #1)
 * and the first to **consume** the shared period preset (CC-2) without re-declaring
 * it. Generalizes [internal ref] D5 (`series` rollup with fixed buckets) by re-using the
 * same `{ interval, points: [{ timestamp, ... }] }` envelope and adding domain-
 * specific per-point metrics (`signups`, `sessions_started`) plus a by-role
 * aggregate breakdown that the automations overview did not need.
 *
 * Source story: [internal ref]
 *
 * @see plan §6.4 (canonical `series` rollup shape — locked in story #1)
 * @see [internal ref] D5 (locked `series` rollup with fixed buckets)
 * @see src/domain/models/api/admin/envelope/period-preset.ts (CC-2 — story #1)
 */

import { Schema } from 'effect'
import { periodPresetSchema } from '@/domain/models/api/admin/envelope/period-preset'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'

/**
 * Query parameters accepted by `GET /api/admin/users/overview`.
 *
 * `period` is the only filter — by design. Operators wanting per-user drill-downs
 * read `/api/auth/admin/list-users` (sibling story `admin-user-management.md`);
 * the overview is a tile, not a report. Adding `?inactive_for=` later would not
 * break this contract.
 */
export const usersOverviewQuerySchema = Schema.Struct({
  period: periodPresetSchema,
}).annotate({ identifier: 'UsersOverviewQuery' })

/**
 * Use `typeof usersOverviewQuerySchema.Type` (resolved type with the default
 * applied) rather than `z.input<...>` so handler code can treat `period` as a
 * literal `PeriodPreset`, not `PeriodPreset | undefined`. Per the brief: the
 * default-fill happens at the Zod parse layer before the handler runs.
 * @public
 */
export type UsersOverviewQuery = typeof usersOverviewQuerySchema.Type

/**
 * Bucket interval used by the response `series.interval` field.
 *
 * Re-declared locally rather than re-exported from `envelope/period-preset.ts`
 * because the `1h` / `1d` literal union is a response-shape concern (visible
 * to OpenAPI consumers as part of `UsersOverviewResponse`) while the period
 * preset is a request-shape concern. Both schemas agree on the values; the
 * agreement is structural, not by import.
 */
const seriesIntervalSchema = Schema.Literals(['1h', '1d']).annotate({
  description: 'Bucket size for the rollup. 1h for 24h period; 1d for 7d/30d periods.',
})

/**
 * One bucketed point on the `series` rollup.
 *
 * `signups` counts users whose `created_at` falls inside the bucket; this is
 * the running counterpart of `totals.new_in_period` (their sum equals it for the
 * requested period). `sessions_started` counts session rows whose `created_at`
 * falls inside the bucket — it can exceed `signups` because returning users
 * open sessions without signing up. Both are integers ≥ 0, scoped to the
 * half-open bucket window `[bucket_start, bucket_start + interval)`.
 */
const seriesPointSchema = Schema.Struct({
  timestamp: looseIsoDateTime({
    description:
      'ISO 8601 UTC timestamp at the start of the bucket. For 1h buckets, the minute and second components are zeroed; for 1d buckets, the time component is zeroed (start of day in UTC).',
  }),
  signups: Schema.Int.annotate({
    description: 'Total users whose created_at falls within this bucket.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  sessions_started: Schema.Int.annotate({
    description:
      'Total sessions whose created_at falls within this bucket. May exceed `signups` because returning users open sessions without signing up.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
}).annotate({ identifier: 'UsersOverviewSeriesPoint' })

/**
 * Per-role count breakdown — exhaustive over the three installed Sovrium roles.
 *
 * `admin + operator + member` equals `totals.users` per the
 * single-role-per-user invariant (every user holds exactly one role). The
 * three roles are listed as REQUIRED integer fields rather than a `Record<role,
 * number>` so OpenAPI consumers see the full shape, response validation
 * catches a missing role count as a 500, and dashboard tiles can render the
 * by-role pie chart without conditional branches per role.
 *
 * If a fifth role is added in a future feature, this schema gets a
 * non-breaking additive field alongside the existing four.
 */
const byRoleSchema = Schema.Struct({
  admin: Schema.Int.annotate({ description: 'Users holding the `admin` role.' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  operator: Schema.Int.annotate({ description: 'Users holding the `operator` role.' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  member: Schema.Int.annotate({ description: 'Users holding the `member` role.' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
}).annotate({
  description: 'Per-role count breakdown. The sum across all three roles equals `totals.users`.',
})

/**
 * Response shape of `GET /api/admin/users/overview`.
 *
 * Two top-level fields:
 *
 * - `totals` — aggregate counters for the user base. `users` is the total
 *   live count (excluding soft-deleted rows). `active_24h` is always a
 *   24-hour aggregate of distinct session activity, regardless of the
 *   requested `period` (the dashboard footer always shows "today" no matter
 *   which tile filter is active). `new_in_period` scales with `?period` and
 *   equals the sum of `series.points[].signups`. `by_role` is the exhaustive
 *   per-role breakdown across the three installed roles.
 *
 * - `series` — the bucketed rollup. `interval` mirrors the period mapping
 * (`1h` for 24h period; `1d` for 7d/30d) — locked by [internal ref] D5 in story
 *   #1. `points` is ordered ascending by `timestamp` so the dashboard renders
 *   left-to-right without sorting. Empty buckets are present with
 *   `signups = 0` and `sessions_started = 0` — the response is dense, not
 *   sparse, so chart libraries do not have to fill gaps.
 *
 * - The response intentionally omits per-user records (id, email, name) —
 *   those are exposed via `admin-user-management.md`'s `/api/auth/admin/list-users`
 *   endpoint with its own RBAC, audit emit, and pagination. This overview is
 *   PII-free by construction (integer aggregates only) so it is safe to surface
 *   to the operator tier.
 */
export const usersOverviewResponseSchema = Schema.Struct({
  totals: Schema.Struct({
    users: Schema.Int.annotate({
      description:
        'Total live users in the auth.user table (excluding soft-deleted rows). Equals `by_role.admin + by_role.operator + by_role.member` per the single-role-per-user invariant.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    active_24h: Schema.Int.annotate({
      description:
        'Distinct users with session activity in the last 24 hours, regardless of the requested period.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    new_in_period: Schema.Int.annotate({
      description:
        'Users created within the requested period (24h / 7d / 30d). Equals the sum of `series.points[].signups` for the same period.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    by_role: byRoleSchema,
  }).annotate({ description: 'Period-aware aggregate counters surfaced as dashboard tiles.' }),
  series: Schema.Struct({
    interval: seriesIntervalSchema,
    points: Schema.Array(seriesPointSchema).annotate({
      description:
        'Dense, ascending-by-timestamp series of buckets covering the requested period. Empty buckets are present with zero counts.',
    }),
  }).annotate({ description: 'Bucketed time series for chart rendering.' }),
}).annotate({ identifier: 'UsersOverviewResponse' })

/**
 * Use `typeof usersOverviewResponseSchema.Type` (resolved type) so consumer
 * code can read response fields as plain non-optional values rather than the
 * pre-defaults input type. The handler is responsible for emitting all required
 * fields; the schema's `.parse()` is the contract gate at both ends.
 * @public
 */
export type UsersOverviewResponse = typeof usersOverviewResponseSchema.Type
/** @public */
export type UsersOverviewSeriesPoint = typeof seriesPointSchema.Type
