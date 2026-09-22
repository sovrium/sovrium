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
 * domain source is computed in its own scoped Effect that DECLARES the port it
 * reads AND catches every failure down to that domain's ZERO block
 * (`records.total: 0`, `storage.totalBytes: 0`, …), MARKED `degraded: true` and
 * with its cause logged — see {@link asDegraded}. `catchAll` rescues FAILURE
 * but not slowness, so each block is ADDITIONALLY wrapped in `withBlockTimeout`
 * (see `overview-block-timeout.ts`): a source that is merely slow-in-production
 * degrades to its zero block via the timeout instead of pushing the whole
 * concurrent request past the Hono `API_TIMEOUT_MS` (30s) ceiling → a 504
 * (observed on the live Partner deployment right after admin login). The nested
 * per-domain fan-outs (records + submissions) are bounded (`concurrency: 2`) so
 * the six concurrent blocks cannot exhaust bun:sql's small default pool. The
 * composed program therefore cannot fail (`never`) AND cannot hang.
 *
 * WHAT THE BLOCKS NO LONGER CATCH. Each block used to bind its own Live layer,
 * so a layer that failed to BUILD degraded that tile to zero. The ports are now
 * declared and resolved once at boot by the runtime `createServer` owns, which
 * means a build failure is a boot failure — loudly, before the listener binds —
 * rather than a permanently grey tile on a server that came up. Everything the
 * blocks were actually catching (a query that fails, a source that is slow) is
 * unchanged, and so is the `degraded: true` marker on both axes.
 */

import { Cause, Effect, Semaphore } from 'effect'
import { AdminFormsRepository } from '@/application/ports/repositories/forms/admin-forms-repository'
import { TablesOverviewRepository } from '@/application/ports/repositories/tables/tables-overview-repository'
import { StorageService } from '@/application/ports/services/storage-service'
import { BuildAutomationsOverview } from '@/application/use-cases/admin/automations-overview'
import { BuildConnectionsList } from '@/application/use-cases/admin/connections'
import { withBlockTimeout } from '@/application/use-cases/admin/overview-block-timeout'
import { sumSubmissionCounts } from '@/application/use-cases/admin/overview-projections'
import { BuildUsersOverview } from '@/application/use-cases/admin/users-overview'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { deriveConnectionStatus } from '@/domain/models/app/admin/connection-status'
import { Logger } from '@/infrastructure/logging/logger'
import type { AdminAutomationsRepository } from '@/application/ports/repositories/automations/admin-automations-repository'
import type { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import type { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import type { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import type { UsersOverviewRepository } from '@/application/ports/repositories/tables/users-overview-repository'
import type { OAuthStateStore } from '@/application/ports/services/oauth-state-store'
import type {
  AdminOverviewConnections,
  AdminOverviewRecords,
  AdminOverviewResponse,
  AdminOverviewRuns,
  AdminOverviewStorage,
  AdminOverviewSubmissions,
  AdminOverviewUsers,
} from '@/domain/models/api/admin/overview/overview'
import type { App } from '@/domain/models/app'

/**
 * Per-domain ZERO blocks — each domain's cold/degraded tile value. Shared by
 * BOTH the block's own `catchAll` (failure → zero) and the `withBlockTimeout`
 * wrapper in `buildAdminOverview` (latency → zero), so the two axes degrade to
 * the exact same literal and the value is defined once per domain.
 */
/**
 * Every port the six blocks read, as one name.
 *
 * Stated once rather than repeated on `buildAdminOverview`'s signature: the
 * roll-up's requirement IS the union of its blocks', and writing it out twice
 * is how the two drift. All of them are carried by the server runtime, so the
 * route discharges the whole set with a single `provideDomain`.
 */
export type AdminOverviewServices =
  // The blocks log their own degradation, through the service rather than the
  // bare sink, so a test can assert on the reason a tile went grey instead of
  // reading stdout.
  | Logger
  | TablesOverviewRepository
  | UsersOverviewRepository
  | AdminAutomationsRepository
  | AutomationRunRepository
  | AdminFormsRepository
  | StorageService
  | ConnectionRepository
  | ConnectionTokenRepository
  | OAuthStateStore

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
 * The same zero block, marked as a FALLBACK rather than a measurement.
 *
 * A zero block on its own is a lie by omission: "0 submissions" and "the
 * submissions ledger is unreachable" reach the operator as the same pixel, so a
 * dashboard looks calm precisely when its sources are not — which is the
 * 2026-07-25 incident read from the operator's end. `degraded: true` is what
 * separates "there is nothing" from "nobody could look", and it rides on the
 * block rather than the response so one tile can warn while the other five keep
 * reporting real numbers.
 *
 * Applied on BOTH degradation axes, because both produce a fallback: the
 * block's own `orElseSucceed` (the source failed) and `withBlockTimeout` (the
 * source did not answer in time). A marker present on only one of them would
 * make the honesty of the tile depend on which way the source happened to
 * misbehave.
 *
 * PRESENT MEANS DEGRADED — there is no `degraded: false`, so a healthy block is
 * the untouched zero constant and never passes through here.
 */
const asDegraded = <A extends object>(zero: A): A & { readonly degraded: true } => ({
  ...zero,
  degraded: true,
})

/**
 * Record WHY a block degraded before swallowing the cause.
 *
 * The fallback itself is deliberate and stays (the tile must render), but
 * `orElseSucceed` on its own discards the only evidence of what went wrong: the
 * operator sees a marked tile and the logs say nothing at all. `Effect.tapCause`
 * runs ahead of the fallback and preserves the cause, so the block still cannot
 * fail while the reason survives — defects and interruptions included, which a
 * failure-only tap would drop.
 */
const logBlockFailure =
  (block: string) =>
  (cause: Cause.Cause<unknown>): Effect.Effect<void, never, Logger> =>
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.error(
        `Admin overview block '${block}' degraded to its zero value`,
        Cause.squash(cause),
        { 'sovrium.admin.overview.block': block }
      )
    })

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
const recordsBlock = (
  app: App
): Effect.Effect<AdminOverviewRecords, never, TablesOverviewRepository | Logger> => {
  const dbNames = (app.tables ?? []).map((t) => sanitizeTableName(t.name))
  return Effect.gen(function* () {
    const repo = yield* TablesOverviewRepository
    const counts = yield* repo.countLiveRows(dbNames)
    return { total: counts.reduce((acc, n) => acc + n, 0) }
  }).pipe(
    Effect.tapCause(logBlockFailure('records')),
    Effect.orElseSucceed(() => asDegraded(RECORDS_ZERO))
  )
}

/**
 * `users.total` — the live user count from users-overview `totals.users`. A
 * failure (or a validation miss) degrades to `0`.
 */
const usersBlock = (): Effect.Effect<AdminOverviewUsers, never, UsersOverviewRepository | Logger> =>
  BuildUsersOverview('24h').pipe(
    Effect.map((outcome) => ({
      total: outcome._tag === 'Ok' ? outcome.body.totals.users : 0,
    })),
    Effect.tapCause(logBlockFailure('users')),
    Effect.orElseSucceed(() => asDegraded(USERS_ZERO))
  )

/**
 * `runs.recent` / `runs.successRate` — the 24h automation-run volume +
 * success rate from automations-overview `totals.runs_24h` / `success_rate`.
 * A failure degrades to `{ recent: 0, successRate: 1 }` (the "healthy by
 * default when there are no runs" convention).
 */
const runsBlock = (
  app: App
): Effect.Effect<
  AdminOverviewRuns,
  never,
  AdminAutomationsRepository | AutomationRunRepository | Logger
> =>
  BuildAutomationsOverview(app, '24h').pipe(
    Effect.map((outcome) =>
      outcome._tag === 'Ok'
        ? { recent: outcome.body.totals.runs_24h, successRate: outcome.body.totals.success_rate }
        : RUNS_ZERO
    ),
    Effect.tapCause(logBlockFailure('runs')),
    Effect.orElseSucceed(() => asDegraded(RUNS_ZERO))
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
const submissionsBlock = (
  app: App
): Effect.Effect<AdminOverviewSubmissions, never, AdminFormsRepository | Logger> => {
  const forms = app.forms ?? []
  return Effect.gen(function* () {
    const repo = yield* AdminFormsRepository
    const aggregates = yield* Effect.all(
      forms.map((form) => repo.aggregateForForm(form.name)),
      { concurrency: 2 }
    )
    return { total: sumSubmissionCounts(aggregates) }
  }).pipe(
    Effect.tapCause(logBlockFailure('submissions')),
    Effect.orElseSucceed(() => asDegraded(SUBMISSIONS_ZERO))
  )
}

/**
 * `storage.totalBytes` — total stored bytes across every live bucket
 * (`StorageService.getTotalBytes()`). Storage being disabled (no provider) or a
 * read failure degrades to `0` rather than failing the roll-up.
 */
const storageBlock = (): Effect.Effect<AdminOverviewStorage, never, StorageService | Logger> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const totalBytes = yield* storage.getTotalBytes
    return { totalBytes }
  }).pipe(
    Effect.tapCause(logBlockFailure('storage')),
    Effect.orElseSucceed(() => asDegraded(STORAGE_ZERO))
  )

/**
 * `connections.total` / `connections.healthy` — the connection count + how many
 * derive an `active` status (NOT `expiring-soon` / `expired`). A failure (or no
 * connections) degrades to `{ total: 0, healthy: 0 }`.
 */
const connectionsBlock = (): Effect.Effect<
  AdminOverviewConnections,
  never,
  ConnectionRepository | ConnectionTokenRepository | OAuthStateStore | Logger
> =>
  BuildConnectionsList.pipe(
    Effect.map((outcome) => {
      if (outcome._tag !== 'Ok') return CONNECTIONS_ZERO
      const { connections } = outcome.body
      const healthy = connections.filter(
        (connection) => deriveConnectionStatus(connection.expiresAt) === 'active'
      ).length
      return { total: connections.length, healthy }
    }),
    Effect.tapCause(logBlockFailure('connections')),
    Effect.orElseSucceed(() => asDegraded(CONNECTIONS_ZERO))
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
export const buildAdminOverview = (
  app: App
): Effect.Effect<AdminOverviewResponse, never, AdminOverviewServices> =>
  Effect.gen(function* () {
    // Fixed-width fan-out: exactly six literal blocks, not data-dependent. The
    // `sovrium/no-unbounded-promise-fanout` suppression that used to sit here
    // was retired on 2026-09-01, when that rule's `unboundedConcurrency`
    // matcher gained the fixed-width-literal exemption its runner matcher
    // already had — so this shape is now exempt by RULE rather than by
    // hand-written exception, which is the direction [internal ref] asks for. The two
    // other guarantees the old comment carried are still load-bearing and are
    // NOT what the exemption covers: each block has its own timeout, and the
    // whole overview is serialized process-wide by `overviewSemaphore` below.
    const [records, submissions, runs, users, storage, connections] = yield* Effect.all(
      [
        withBlockTimeout(recordsBlock(app), asDegraded(RECORDS_ZERO), BLOCK_TIMEOUT_MS),
        withBlockTimeout(submissionsBlock(app), asDegraded(SUBMISSIONS_ZERO), BLOCK_TIMEOUT_MS),
        withBlockTimeout(runsBlock(app), asDegraded(RUNS_ZERO), BLOCK_TIMEOUT_MS),
        withBlockTimeout(usersBlock(), asDegraded(USERS_ZERO), BLOCK_TIMEOUT_MS),
        withBlockTimeout(storageBlock(), asDegraded(STORAGE_ZERO), BLOCK_TIMEOUT_MS),
        withBlockTimeout(connectionsBlock(), asDegraded(CONNECTIONS_ZERO), BLOCK_TIMEOUT_MS),
      ],
      { concurrency: 'unbounded' }
    )
    return { records, submissions, runs, users, storage, connections }
  }).pipe(overviewSemaphore.withPermits(1), Effect.withSpan('admin.build-admin-overview'))
