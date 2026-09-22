/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/overview` — the Native Admin Dashboard
 * "Tableau de bord" overview.
 *
 * This is the single aggregation endpoint that backs the reclaimed dashboard
 * ROOT (`/_admin`). It is a CROSS-DOMAIN ROLL-UP: rather than introducing new
 * database queries, the use case composes the EXISTING per-domain admin
 * aggregations (tables / users / automations / buckets / forms / connections)
 * and projects each one down to its single headline figure. The response is
 * therefore a flat `totals`-of-totals — one tiny block per domain — sized for a
 * grid of KPI tiles (`MetricCard`), not the per-domain deep-dive panels (those
 * keep their own `/api/admin/{domain}/overview` endpoints with full `series`).
 *
 * Why flat + headline-only (S4 hard allow-list):
 *  - The overview tile grid needs ONE number per domain, not a time series.
 *  - Keeping the shape to scalar counts means the response can NEVER carry a raw
 *    DB row or a secret (connections expose only a `total` + `healthy` count,
 *    never tokens/credentials).
 *  - Each field's value is sourced verbatim from an existing per-domain
 *    aggregation's `totals` block, so the numbers stay consistent with the
 *    domain deep-dive pages an operator drills into from a tile.
 *
 * Field-by-field provenance (which existing aggregation each value comes from):
 *  - `records.total`        ← tables-overview `totals.total_rows`
 *                             (`buildTablesOverview`, summed across all tables)
 *  - `submissions.total`    ← forms-overview, summed `aggregateForForm().submissionCount`
 *                             across `app.forms[]`. LIFETIME count (the forms
 *                             aggregate is not period-windowed) — see the field
 *                             JSDoc; a period-scoped "recent" figure is a
 *                             follow-up that needs a new repository query.
 *  - `runs.recent`          ← automations-overview `totals.runs_24h`
 *  - `runs.successRate`     ← automations-overview `totals.success_rate`
 *  - `users.total`          ← users-overview `totals.users`
 *  - `storage.totalBytes`   ← buckets overview `totals.totalBytes`
 *                             (StorageService.getTotalBytes — see endpoint plan)
 *  - `connections.total`    ← connections-list length
 *  - `connections.healthy`  ← count of connections whose derived `status` is
 *                             `active` (NOT `expiring-soon` / `expired`)
 *
 * Every block additionally carries an optional `degraded` marker. Each one
 * falls back to its zero shape when its source cannot be read, which makes a
 * genuinely empty instance and an unreachable source render identically; the
 * marker is what separates "there is nothing" from "I could not look". See
 * {@link degradedField}.
 *
 * Deliberately ABSENT (could not be sourced from any existing aggregation —
 * flagged rather than invented):
 *  - A cross-agent "recent conversations" count. The admin agent-conversations
 *    repository is AGENT-SCOPED + cursor-paginated only (no `COUNT(*)` across
 *    agents), so no headline conversations figure is sourceable today. Adding
 *    it later is a non-breaking additive `conversations: { … }` block once a
 *    cross-agent count primitive exists.
 *
 * @see src/application/use-cases/admin/tables-overview.ts (records source)
 * @see src/application/use-cases/admin/users-overview.ts (users source)
 * @see src/application/use-cases/admin/automations-overview.ts (runs source)
 * @see src/application/use-cases/admin/forms-overview.ts (submissions source)
 * @see src/application/use-cases/admin/connections.ts (connections source)
 * @see src/presentation/api/routes/admin/buckets.ts (storage source)
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * Marks a block whose source could not be read, so its figures are a FALLBACK
 * rather than a measurement.
 *
 * WHY IT SITS ON EACH BLOCK AND NOT AT THE TOP LEVEL
 * --------------------------------------------------
 * Every block degrades to its zero shape when its source fails, which makes a
 * real "0 records" and an unreachable tables source render identically — the
 * operator reads an empty instance where the truth is an outage. The marker is
 * what tells them apart.
 *
 * It belongs next to the number it qualifies because the consumer is a grid of
 * per-domain `MetricCard` tiles: a tile renders one block and can read its own
 * `degraded` without knowing its own name. A top-level `degraded: string[]`
 * would move that name into the client — every tile looking itself up in a
 * list, and a renamed block quietly clearing a tile's warning. Blocks carrying
 * two figures (`runs`, `connections`) degrade together because one
 * `orElseSucceed` covers the block, so one marker per block is exactly the
 * granularity the failure has.
 *
 * PRESENT MEANS DEGRADED; there is no `degraded: false`. One spelling per
 * state, so a client cannot read `false` as "unknown" or treat the key's
 * absence as a third case. Additive and optional, so every existing decoder
 * and every client already in production keeps working unchanged.
 *
 * Emitting it is the job of the roll-up (`buildAdminOverview`); the schema only
 * declares that a block MAY say so.
 */
const degradedField = optionalField(
  Schema.Literal(true).annotate({
    description:
      "Present (and always `true`) when this block's source could not be read, so its figures are the zero fallback rather than a measurement. Absent when the figures were measured. Never `false`.",
  })
)

/**
 * Records roll-up — the live record count across every configured table.
 *
 * `total` is the sum of `by_table[].rowCount` from tables-overview (live rows
 * only; soft-deleted rows are excluded, matching `totals.total_rows`).
 */
export const overviewRecordsSchema = Schema.Struct({
  total: Schema.Int.annotate({
    description:
      'Live record count across every configured table. Equals tables-overview `totals.total_rows` (soft-deleted rows excluded). `0` when no tables are configured.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  degraded: degradedField,
}).annotate({ identifier: 'AdminOverviewRecords' })

/**
 * Submissions roll-up — the lifetime submission count across every form.
 *
 * `total` is the sum of each form's `aggregateForForm().submissionCount`. This
 * is a LIFETIME count (non-deleted rows), NOT a period-windowed "recent" figure
 * — the forms submission aggregate exposes only `count(*)` + `max(submitted_at)`,
 * with no time-bucketing. `0` when no forms are configured or none have
 * received a submission.
 */
export const overviewSubmissionsSchema = Schema.Struct({
  total: Schema.Int.annotate({
    description:
      'Lifetime submission count across every configured form (sum of per-form `submissionCount`, non-deleted rows). `0` when no forms exist or none have submissions.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  degraded: degradedField,
}).annotate({ identifier: 'AdminOverviewSubmissions' })

/**
 * Automation-runs roll-up — recent run volume + period success rate.
 *
 * `recent` is the fixed-24h run count (`totals.runs_24h`); `successRate` is the
 * fraction of successful runs in the same window (`totals.success_rate`,
 * `0`–`1` inclusive; `1` when there were zero runs, the "healthy by default"
 * convention from automations-overview).
 */
export const overviewRunsSchema = Schema.Struct({
  recent: Schema.Int.annotate({
    description:
      'Automation runs in the last 24h. Sourced from automations-overview `totals.runs_24h`. `0` when no automations have run.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  successRate: Schema.Finite.annotate({
    description:
      'Fraction of the last-24h runs that succeeded (0–1). Sourced from automations-overview `totals.success_rate`. `1` when there were zero runs (healthy by default).',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1))),
  degraded: degradedField,
}).annotate({ identifier: 'AdminOverviewRuns' })

/**
 * Users roll-up — the live user count.
 *
 * `total` is the live `auth.user` count from users-overview (`totals.users`,
 * excluding soft-deleted rows). `0` when auth is disabled or no users exist.
 */
export const overviewUsersSchema = Schema.Struct({
  total: Schema.Int.annotate({
    description:
      'Live user count (excluding soft-deleted rows). Equals users-overview `totals.users`. `0` when auth is disabled or there are no users.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  degraded: degradedField,
}).annotate({ identifier: 'AdminOverviewUsers' })

/**
 * Storage roll-up — total bytes stored across every bucket.
 *
 * `totalBytes` is the sum of stored file sizes across all live buckets
 * (identical semantics to buckets-overview `totals.totalBytes`). `0` when
 * storage is disabled (no provider configured) or no files are stored.
 */
export const overviewStorageSchema = Schema.Struct({
  totalBytes: Schema.Int.annotate({
    description:
      'Total stored bytes across every live bucket. Equals buckets-overview `totals.totalBytes`. `0` when storage is disabled or no files are stored.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  degraded: degradedField,
}).annotate({ identifier: 'AdminOverviewStorage' })

/**
 * Connections roll-up — connection count + how many are healthy.
 *
 * `total` is the number of configured connections; `healthy` is the subset
 * whose derived `status` is `active` (a comfortably-future or absent expiry) —
 * EXCLUDING `expiring-soon` and `expired` connections. Secret-free by
 * construction: only two scalar counts, never tokens or credentials (S4).
 *
 * Invariant: `0 <= healthy <= total`.
 */
export const overviewConnectionsSchema = Schema.Struct({
  total: Schema.Int.annotate({
    description:
      'Number of configured connections (one per `system.connections` row). Equals the connections-list length. `0` when no connections are configured.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  healthy: Schema.Int.annotate({
    description:
      'Subset of `total` whose derived status is `active` (absent or comfortably-future expiry) — excludes `expiring-soon` and `expired`. Always `<= total`.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  degraded: degradedField,
}).annotate({ identifier: 'AdminOverviewConnections' })

/**
 * Response shape of `GET /api/admin/overview`.
 *
 * A flat cross-domain roll-up: one headline block per domain, each composed
 * from that domain's EXISTING admin aggregation. The dashboard root renders one
 * `MetricCard` per scalar figure. Every value is a non-negative scalar (or the
 * `0`–`1` `runs.successRate` fraction) so the response can never carry a raw DB
 * row or secret (S4).
 *
 * Aggregation provenance invariants (asserted by the E2E specs):
 *  - `records.total`       === tables-overview `totals.total_rows`
 *  - `users.total`         === users-overview `totals.users`
 *  - `runs.recent`         === automations-overview `totals.runs_24h`
 *  - `storage.totalBytes`  === buckets-overview `totals.totalBytes`
 *  - `connections.healthy` <= `connections.total`
 *  - a block carrying `degraded: true` is reporting its zero fallback, not a
 *    measurement — so its figures say nothing about the instance
 *
 * The shape is exposed under the OpenAPI name `AdminOverviewResponse` so
 * downstream tooling generates a stable type name.
 */
export const adminOverviewResponseSchema = Schema.Struct({
  records: overviewRecordsSchema,
  submissions: overviewSubmissionsSchema,
  runs: overviewRunsSchema,
  users: overviewUsersSchema,
  storage: overviewStorageSchema,
  connections: overviewConnectionsSchema,
}).annotate({ identifier: 'AdminOverviewResponse' })

/** @public */
export type AdminOverviewResponse = typeof adminOverviewResponseSchema.Type
/** @public */
export type AdminOverviewRecords = typeof overviewRecordsSchema.Type
/** @public */
export type AdminOverviewSubmissions = typeof overviewSubmissionsSchema.Type
/** @public */
export type AdminOverviewRuns = typeof overviewRunsSchema.Type
/** @public */
export type AdminOverviewUsers = typeof overviewUsersSchema.Type
/** @public */
export type AdminOverviewStorage = typeof overviewStorageSchema.Type
/** @public */
export type AdminOverviewConnections = typeof overviewConnectionsSchema.Type
