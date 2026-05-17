/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/users/overview`.
 *
 * Second overview-shape endpoint after `US-ADMIN-AUTOMATIONS-OVERVIEW` (story #1)
 * and the first to **consume** the shared period preset (CC-2) without re-declaring
 * it. Generalizes ADR-012 D5 (`series` rollup with fixed buckets) by re-using the
 * same `{ interval, points: [{ timestamp, ... }] }` envelope and adding domain-
 * specific per-point metrics (`signups`, `sessions_started`) plus a by-role
 * aggregate breakdown that the automations overview did not need.
 *
 * Source story: docs/user-stories/as-business-admin/user-management/users-overview.md
 *
 * @see plan §6.4 (canonical `series` rollup shape — locked in story #1)
 * @see ADR-012 D5 (locked `series` rollup with fixed buckets)
 * @see src/domain/models/api/admin/_shared/period-preset.ts (CC-2 — story #1)
 */

import { z } from '@hono/zod-openapi'
import { periodPresetSchema } from '@/domain/models/api/admin/_shared/period-preset'

/**
 * Query parameters accepted by `GET /api/admin/users/overview`.
 *
 * `period` is the only filter — by design. Operators wanting per-user drill-downs
 * read `/api/auth/admin/list-users` (sibling story `admin-user-management.md`);
 * the overview is a tile, not a report. Adding `?inactive_for=` later would not
 * break this contract.
 */
export const usersOverviewQuerySchema = z
  .object({
    period: periodPresetSchema,
  })
  .openapi('UsersOverviewQuery')

/**
 * Use `z.infer<typeof usersOverviewQuerySchema>` (resolved type with the default
 * applied) rather than `z.input<...>` so handler code can treat `period` as a
 * literal `PeriodPreset`, not `PeriodPreset | undefined`. Per the brief: the
 * default-fill happens at the Zod parse layer before the handler runs.
 * @public
 */
export type UsersOverviewQuery = z.infer<typeof usersOverviewQuerySchema>

/**
 * Bucket interval used by the response `series.interval` field.
 *
 * Re-declared locally rather than re-exported from `_shared/period-preset.ts`
 * because the `1h` / `1d` literal union is a response-shape concern (visible
 * to OpenAPI consumers as part of `UsersOverviewResponse`) while the period
 * preset is a request-shape concern. Both schemas agree on the values; the
 * agreement is structural, not by import.
 */
const seriesIntervalSchema = z
  .enum(['1h', '1d'])
  .describe('Bucket size for the rollup. 1h for 24h period; 1d for 7d/30d periods.')

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
const seriesPointSchema = z
  .object({
    timestamp: z
      .string()
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp at the start of the bucket. For 1h buckets, the minute and second components are zeroed; for 1d buckets, the time component is zeroed (start of day in UTC).'
      ),
    signups: z
      .number()
      .int()
      .nonnegative()
      .describe('Total users whose created_at falls within this bucket.'),
    sessions_started: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Total sessions whose created_at falls within this bucket. May exceed `signups` because returning users open sessions without signing up.'
      ),
  })
  .openapi('UsersOverviewSeriesPoint')

/**
 * Per-role count breakdown — exhaustive over the four installed Sovrium roles.
 *
 * `admin + operator + auditor + member` equals `totals.users` per the
 * single-role-per-user invariant (every user holds exactly one role). The
 * four roles are listed as REQUIRED integer fields rather than a `Record<role,
 * number>` so OpenAPI consumers see the full shape, response validation
 * catches a missing role count as a 500, and dashboard tiles can render the
 * by-role pie chart without conditional branches per role.
 *
 * If a fifth role is added in a future feature, this schema gets a
 * non-breaking additive field alongside the existing four.
 */
const byRoleSchema = z
  .object({
    admin: z.number().int().nonnegative().describe('Users holding the `admin` role.'),
    operator: z.number().int().nonnegative().describe('Users holding the `operator` role.'),
    auditor: z.number().int().nonnegative().describe('Users holding the `auditor` role.'),
    member: z.number().int().nonnegative().describe('Users holding the `member` role.'),
  })
  .describe('Per-role count breakdown. The sum across all four roles equals `totals.users`.')

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
 *   per-role breakdown across the four installed roles.
 *
 * - `series` — the bucketed rollup. `interval` mirrors the period mapping
 *   (`1h` for 24h period; `1d` for 7d/30d) — locked by ADR-012 D5 in story
 *   #1. `points` is ordered ascending by `timestamp` so the dashboard renders
 *   left-to-right without sorting. Empty buckets are present with
 *   `signups = 0` and `sessions_started = 0` — the response is dense, not
 *   sparse, so chart libraries do not have to fill gaps.
 *
 * - The response intentionally omits per-user records (id, email, name) —
 *   those are exposed via `admin-user-management.md`'s `/api/auth/admin/list-users`
 *   endpoint with its own RBAC, audit emit, and pagination. This overview is
 *   PII-free by construction (integer aggregates only) so it is safe to surface
 *   to the auditor tier.
 */
export const usersOverviewResponseSchema = z
  .object({
    totals: z
      .object({
        users: z
          .number()
          .int()
          .nonnegative()
          .describe(
            'Total live users in the auth.user table (excluding soft-deleted rows). Equals `by_role.admin + by_role.operator + by_role.auditor + by_role.member` per the single-role-per-user invariant.'
          ),
        active_24h: z
          .number()
          .int()
          .nonnegative()
          .describe(
            'Distinct users with session activity in the last 24 hours, regardless of the requested period.'
          ),
        new_in_period: z
          .number()
          .int()
          .nonnegative()
          .describe(
            'Users created within the requested period (24h / 7d / 30d). Equals the sum of `series.points[].signups` for the same period.'
          ),
        by_role: byRoleSchema,
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
  .openapi('UsersOverviewResponse')

/**
 * Use `z.infer<typeof usersOverviewResponseSchema>` (resolved type) so consumer
 * code can read response fields as plain non-optional values rather than the
 * pre-defaults input type. The handler is responsible for emitting all required
 * fields; the schema's `.parse()` is the contract gate at both ends.
 * @public
 */
export type UsersOverviewResponse = z.infer<typeof usersOverviewResponseSchema>
/** @public */
export type UsersOverviewSeriesPoint = z.infer<typeof seriesPointSchema>
