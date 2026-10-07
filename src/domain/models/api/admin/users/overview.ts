/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/users/overview`.
 *
 * Second overview-shape endpoint after the admin automations overview requirement (story #1)
 * and the first to **consume** the shared period preset (CC-2) without re-declaring
 * it. Generalizes [internal ref] D5 (`series` rollup with fixed buckets) by re-using the
 * same `{ interval, points: [{ timestamp, ... }] }` envelope and adding domain-
 * specific per-point metrics (`signups`, `sessions_started`) plus a per-role
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
 * One row of the per-role breakdown: a role the app can assign, and how many
 * accounts hold it.
 *
 * The row set is the app's assignable vocabulary — exactly the names
 * `GET /api/admin/roles` answers (built-in, admin-tier and declared) — in the
 * same order, every role present with `count: 0` when nobody holds it. So the
 * list has the same length for every period and data state, and a console
 * binds it with the same `name` key as the roles endpoint. An array of rows
 * rather than an object keyed by role name: the order is stated, OpenAPI
 * describes it without an open `additionalProperties`, and a role name never
 * becomes a JSON key.
 */
const roleCountSchema = Schema.Struct({
  name: Schema.String.annotate({
    description:
      'A role this app can assign: a built-in (`admin`, `member`, `viewer`), an admin-tier name (`admin-editor`, `admin-viewer`, `operator`), or one declared in `auth.roles`.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  count: Schema.Int.annotate({
    description: 'Accounts whose role is this name. Zero when nobody holds it.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
}).annotate({ identifier: 'UsersOverviewRoleCount' })

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
 *   equals the sum of `series.points[].signups`. `roles` counts the accounts
 *   per assignable role, `without_role` the accounts no role recognises, and
 *   `invited` the accounts of invitations nobody has accepted (outside
 *   `users`).
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
        'Live accounts (excluding soft-deleted rows and accounts an unaccepted invitation provisioned). Equals the sum of `roles[].count` plus `without_role`: every account is counted exactly once.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    active_24h: Schema.Int.annotate({
      description:
        'Distinct users with session activity in the last 24 hours, regardless of the requested period.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    new_in_period: Schema.Int.annotate({
      description:
        'Users created within the requested period (24h / 7d / 30d). Equals the sum of `series.points[].signups` for the same period.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    roles: Schema.Array(roleCountSchema).annotate({
      description:
        'Accounts per role the app can assign, one row per role, sorted by name as `GET /api/admin/roles` sorts its rows. Every assignable role is listed, with a count of 0 when nobody holds it. Invited accounts are not counted here.',
    }),
    without_role: Schema.Int.annotate({
      description:
        'Accounts whose stored role is empty or is not a role this app can assign — for example a role removed from the configuration. Such an account is granted nothing. Invited accounts are not counted here.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    invited: Schema.Int.annotate({
      description:
        'Accounts provisioned by an invitation nobody has accepted yet, expired or not. They cannot sign in, so they are counted here and nowhere else: not in `users`, `roles`, `without_role`, `new_in_period` or the series.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
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
/** @public */
export type UsersOverviewRoleCount = typeof roleCountSchema.Type
