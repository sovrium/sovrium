/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use case for the Native Admin Dashboard "Tableau de bord" overview
 * (`GET /api/admin/overview`, [internal ref]) — the reclaimed dashboard ROOT.
 *
 * This is a CROSS-DOMAIN ROLL-UP. Rather than issuing new database queries, it
 * COMPOSES the existing per-domain admin aggregations (tables / users /
 * automations / forms / buckets / connections) and projects each one down to its
 * single headline scalar. The output is a flat `totals`-of-totals — one tiny
 * block per domain — sized for the dashboard's KPI tile grid (`MetricCard`), not
 * the per-domain deep-dive panels (those keep their own
 * `/api/admin/{domain}/overview` endpoints with full `series`).
 *
 * Field provenance (see `src/domain/models/api/admin/overview/overview.ts`):
 *  - `records.total`        ← summed live row count across every configured
 *                             table (the LEAN `countLiveRows` path — same live
 *                             `COUNT(*) WHERE deleted_at IS NULL` figure as
 *                             tables-overview `totals.total_rows`, WITHOUT the
 *                             deep-dive page's ~24-bucket write-volume series)
 *  - `submissions.total`    ← sum of per-form `aggregateForForm().submissionCount`
 *  - `runs.recent`          ← automations-overview `totals.runs_24h`
 *  - `runs.successRate`     ← automations-overview `totals.success_rate`
 *  - `users.total`          ← users-overview `totals.users`
 *  - `storage.totalBytes`   ← `StorageService.getTotalBytes()`
 *  - `connections.total`    ← connections-list length
 *  - `connections.healthy`  ← count of connections whose derived `status` is
 *                             `active` (NOT `expiring-soon` / `expired`)
 *
 * RESILIENCE + LATENCY: the overview is a TILE, never an operator error. Every
 * domain source is computed in its own scoped Effect that provides its own Live
 * layer AND catches every failure down to that domain's ZERO block
 * (`records.total: 0`, `storage.totalBytes: 0`, …). `catchAll` rescues FAILURE
 * but not slowness, so each block is ADDITIONALLY wrapped in `withBlockTimeout`
 * (see `overview-block-timeout.ts`): a source that is merely slow-in-production
 * degrades to its zero block via the timeout instead of pushing the whole
 * concurrent request past the Hono `API_TIMEOUT_MS` (30s) ceiling → a 504
 * (observed on the live Partner deployment right after admin login). The nested
 * per-domain fan-outs (records + submissions) are bounded (`concurrency: 2`) so
 * the six concurrent blocks cannot exhaust bun:sql's small default pool. The
 * composed program therefore requires no environment and cannot fail
 * (`never`/`never`) AND now cannot hang.
 *
 * Each block provides its own infrastructure / application Live layer directly
 * (the application-layer dependency-inversion seam) — never a presentation-layer
 * effect-runner — so the use case stays within the application→infrastructure
 * boundary.
 */

import { Effect, Semaphore } from 'effect'
import { AdminFormsRepository } from '@/application/ports/repositories/forms/admin-forms-repository'
import { TablesOverviewRepository } from '@/application/ports/repositories/tables/tables-overview-repository'
import { StorageService } from '@/application/ports/services/storage-service'
import {
  AdminAutomationsLayer,
  BuildAutomationsOverview,
} from '@/application/use-cases/admin/automations-overview'
import {
  AdminConnectionsLayer,
  BuildConnectionsList,
} from '@/application/use-cases/admin/connections'
import { withBlockTimeout } from '@/application/use-cases/admin/overview-block-timeout'
import { sumSubmissionCounts } from '@/application/use-cases/admin/overview-projections'
import {
  BuildUsersOverview,
  UsersOverviewLayer,
} from '@/application/use-cases/admin/users-overview'
import { deriveConnectionStatus } from '@/domain/services/admin/connection-status'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { AdminFormsRepositoryLive } from '@/infrastructure/database/repositories/forms/admin-forms-repository-live'
import { TablesOverviewRepositoryLive } from '@/infrastructure/database/repositories/tables/tables-overview-repository-live'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import type { AdminOverviewResponse } from '@/domain/models/api/admin/overview/overview'
import type { App } from '@/domain/models/app'

/**
 * Per-domain ZERO blocks — each domain's cold/degraded tile value. Shared by
 * BOTH the block's own `catchAll` (failure → zero) and the `withBlockTimeout`
 * wrapper in `buildAdminOverview` (latency → zero), so the two axes degrade to
 * the exact same literal and the value is defined once per domain.
 */
const RECORDS_ZERO: { readonly total: number } = { total: 0 }
const SUBMISSIONS_ZERO: { readonly total: number } = { total: 0 }
const USERS_ZERO: { readonly total: number } = { total: 0 }
const RUNS_ZERO: { readonly recent: number; readonly successRate: number } = {
  recent: 0,
  successRate: 1,
}
const STORAGE_ZERO: { readonly totalBytes: number } = { totalBytes: 0 }
const CONNECTIONS_ZERO: { readonly total: number; readonly healthy: number } = {
  total: 0,
  healthy: 0,
}

/**
 * Per-block latency budget (milliseconds). Each of the six domain blocks is
 * wrapped in `withBlockTimeout(..., BLOCK_TIMEOUT_MS)`, so a slow-in-production
 * source degrades to its zero block instead of pushing the concurrent roll-up
 * past the Hono `API_TIMEOUT_MS` (30s) ceiling. The blocks run concurrently, so
 * 8s is comfortably under the outer ceiling while still letting a genuinely
 * slow-but-reachable source answer.
 *
 * Operator-overridable via the `ADMIN_OVERVIEW_BLOCK_TIMEOUT_MS` env var (a
 * deployment/latency concern, so an env var — never the app schema). A missing
 * or non-positive value falls back to the default.
 */
const DEFAULT_BLOCK_TIMEOUT_MS = 8000
const parseBlockTimeoutMs = (raw: string | undefined): number => {
  const parsed = raw === undefined ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BLOCK_TIMEOUT_MS
}
const BLOCK_TIMEOUT_MS = parseBlockTimeoutMs(process.env.ADMIN_OVERVIEW_BLOCK_TIMEOUT_MS)

/**
 * How many overview roll-ups may run AT ONCE, process-wide.
 *
 * The per-request budget documented on `buildAdminOverview` (~8 peak
 * connections, under the `DATABASE_POOL_MAX` default of 10) is defeated by any
 * concurrency at all: the 2026-07-25 production incident logged three overview
 * requests within 8 ms (`07:50:35.591/.595/.599`), i.e. ~24 connections against
 * a ~10-connection pool. Every query queued behind the pool, nothing finished,
 * and all three failures landed together on the 30 s `API_TIMEOUT_MS` wall.
 *
 * A semaphore restores the invariant the budget assumed. Serializing is the
 * right trade for a dashboard tile: the per-block `withBlockTimeout` timers
 * start only AFTER a permit is acquired, so a queued request is never falsely
 * zeroed, and the worst case (wait one full roll-up, then run one) stays under
 * the outer ceiling. Operator-overridable via `ADMIN_OVERVIEW_MAX_CONCURRENT`
 * for deployments that provisioned a larger pool.
 */
const DEFAULT_MAX_CONCURRENT_OVERVIEWS = 1
const parseMaxConcurrent = (raw: string | undefined): number => {
  const parsed = raw === undefined ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CONCURRENT_OVERVIEWS
}
const overviewSemaphore = Semaphore.makeUnsafe(
  parseMaxConcurrent(process.env.ADMIN_OVERVIEW_MAX_CONCURRENT)
)

/**
 * `records.total` — the live record count summed across every configured table.
 *
 * Uses the LEAN `countLiveRows` repository path: one `COUNT(*) WHERE deleted_at
 * IS NULL` per table (bounded fan-out), summed. This is the same live figure as
 * tables-overview `totals.total_rows`, but WITHOUT eagerly computing the
 * deep-dive page's ~24-bucket write-volume series + per-table aggregate queries
 * (the amplifier behind the observed production 504). A failure (or no
 * configured tables) degrades to `0`.
 */
const recordsBlock = (app: App): Effect.Effect<{ readonly total: number }> => {
  const dbNames = (app.tables ?? []).map((t) => sanitizeTableName(t.name))
  return Effect.gen(function* () {
    const repo = yield* TablesOverviewRepository
    const counts = yield* repo.countLiveRows(dbNames)
    return { total: counts.reduce((acc, n) => acc + n, 0) }
  }).pipe(
    Effect.provide(TablesOverviewRepositoryLive),
    Effect.orElseSucceed(() => RECORDS_ZERO)
  )
}

/**
 * `users.total` — the live user count from users-overview `totals.users`. A
 * failure (or a validation miss) degrades to `0`.
 */
const usersBlock = (): Effect.Effect<{ readonly total: number }> =>
  BuildUsersOverview('24h').pipe(
    Effect.map((outcome) => ({
      total: outcome._tag === 'Ok' ? outcome.body.totals.users : 0,
    })),
    Effect.provide(UsersOverviewLayer),
    Effect.orElseSucceed(() => USERS_ZERO)
  )

/**
 * `runs.recent` / `runs.successRate` — the 24h automation-run volume +
 * success rate from automations-overview `totals.runs_24h` / `success_rate`.
 * A failure degrades to `{ recent: 0, successRate: 1 }` (the "healthy by
 * default when there are no runs" convention).
 */
const runsBlock = (
  app: App
): Effect.Effect<{ readonly recent: number; readonly successRate: number }> =>
  BuildAutomationsOverview(app, '24h').pipe(
    Effect.map((outcome) =>
      outcome._tag === 'Ok'
        ? { recent: outcome.body.totals.runs_24h, successRate: outcome.body.totals.success_rate }
        : RUNS_ZERO
    ),
    Effect.provide(AdminAutomationsLayer),
    Effect.orElseSucceed(() => RUNS_ZERO)
  )

/**
 * `submissions.total` — the LIFETIME submission count summed across every
 * configured form (`aggregateForForm().submissionCount`, non-deleted rows). A
 * failure (or no forms) degrades to `0`. The per-form fan-out is bounded
 * (`concurrency: 2`) so a form-heavy app cannot exhaust the connection pool
 * while the other domain blocks run concurrently.
 *
 * The summation itself lives in `sumSubmissionCounts` (`overview-projections.ts`)
 * — a dependency-free projection, because this block welds `AdminFormsRepositoryLive`
 * in place and is therefore untestable from both the unit and the HTTP tier.
 * It coerces every entry through `toFiniteCount`, so an aggregate that yields no
 * usable count contributes `0` rather than `NaN`. That matters because `NaN` is
 * a SUCCESSFUL value: neither the `catchAll` below nor `withBlockTimeout` can
 * see it, and it only surfaces at the route's response gate as a 500.
 */
const submissionsBlock = (app: App): Effect.Effect<{ readonly total: number }> => {
  const forms = app.forms ?? []
  return Effect.gen(function* () {
    const repo = yield* AdminFormsRepository
    const aggregates = yield* Effect.all(
      forms.map((form) => repo.aggregateForForm(form.name)),
      { concurrency: 2 }
    )
    return { total: sumSubmissionCounts(aggregates) }
  }).pipe(
    Effect.provide(AdminFormsRepositoryLive),
    Effect.orElseSucceed(() => SUBMISSIONS_ZERO)
  )
}

/**
 * `storage.totalBytes` — total stored bytes across every live bucket
 * (`StorageService.getTotalBytes()`). Storage being disabled (no provider) or a
 * read failure degrades to `0` rather than failing the roll-up.
 */
const storageBlock = (): Effect.Effect<{ readonly totalBytes: number }> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const totalBytes = yield* storage.getTotalBytes
    return { totalBytes }
  }).pipe(
    Effect.provide(StorageServiceLive),
    Effect.orElseSucceed(() => STORAGE_ZERO)
  )

/**
 * `connections.total` / `connections.healthy` — the connection count + how many
 * derive an `active` status (NOT `expiring-soon` / `expired`). A failure (or no
 * connections) degrades to `{ total: 0, healthy: 0 }`.
 */
const connectionsBlock = (): Effect.Effect<{
  readonly total: number
  readonly healthy: number
}> =>
  BuildConnectionsList.pipe(
    Effect.map((outcome) => {
      if (outcome._tag !== 'Ok') return CONNECTIONS_ZERO
      const { connections } = outcome.body
      const healthy = connections.filter(
        (connection) => deriveConnectionStatus(connection.expiresAt) === 'active'
      ).length
      return { total: connections.length, healthy }
    }),
    Effect.provide(AdminConnectionsLayer),
    Effect.orElseSucceed(() => CONNECTIONS_ZERO)
  )

/**
 * Build the cross-domain overview roll-up.
 *
 * Composes the six per-domain projections in parallel. Each projection is
 * self-contained — it provides its own Live layer and catches every failure down
 * to its zero block — and is additionally wrapped in `withBlockTimeout` so a
 * slow-in-production source degrades to that domain's zero block instead of
 * stalling the whole request past the Hono `API_TIMEOUT_MS` ceiling. The
 * composed program therefore requires no environment, cannot fail, and cannot
 * hang. The six blocks stay fully concurrent: with the nested fan-outs bounded
 * (records + submissions at `concurrency: 2`), peak connections
 * ≈ 2+2+1+1+1+1 = 8, under the stated `DATABASE_POOL_MAX` default of 10. The
 * route validates the assembled object against `adminOverviewResponseSchema`
 * before serializing (S4 hard allow-list).
 *
 * That ~8-connection figure is a PER-REQUEST budget, so the whole roll-up is
 * additionally gated by `overviewSemaphore` — otherwise N concurrent dashboard
 * loads multiply it by N and exhaust the pool (the 2026-07-25 incident: three
 * overlapping requests → ~24 against ~10). Serializing here is what makes the
 * per-request budget an actual process-wide bound.
 */
export const buildAdminOverview = (app: App): Effect.Effect<AdminOverviewResponse> =>
  Effect.gen(function* () {
    // eslint-disable-next-line sovrium/no-unbounded-promise-fanout -- fixed-width fan-out: exactly six literal blocks (not data-dependent), each with its own timeout, and the whole overview is serialized process-wide by `overviewSemaphore` below.
    const [records, submissions, runs, users, storage, connections] = yield* Effect.all(
      [
        withBlockTimeout(recordsBlock(app), RECORDS_ZERO, BLOCK_TIMEOUT_MS),
        withBlockTimeout(submissionsBlock(app), SUBMISSIONS_ZERO, BLOCK_TIMEOUT_MS),
        withBlockTimeout(runsBlock(app), RUNS_ZERO, BLOCK_TIMEOUT_MS),
        withBlockTimeout(usersBlock(), USERS_ZERO, BLOCK_TIMEOUT_MS),
        withBlockTimeout(storageBlock(), STORAGE_ZERO, BLOCK_TIMEOUT_MS),
        withBlockTimeout(connectionsBlock(), CONNECTIONS_ZERO, BLOCK_TIMEOUT_MS),
      ],
      { concurrency: 'unbounded' }
    )
    return { records, submissions, runs, users, storage, connections }
  }).pipe(overviewSemaphore.withPermits(1))
