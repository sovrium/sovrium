/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin endpoints for the automations domain.
 *
 * Three endpoints ([internal ref] — drain-admin-automations):
 *
 *   1. GET /api/admin/automations/overview
 *      Period-aware operator dashboard tile: totals (configured automations,
 *      24h runs + failures, period success rate) + bucketed series for chart
 *      rendering. Emits `automation.overview.queried` on success.
 *
 *   2. GET /api/admin/automations/runs
 *      Cursor-paginated run history with `_admin` envelope per item. Filters:
 *      ?status, ?automationName, ?automationId, ?from, ?to, ?include_deleted
 *      (D2 forward contract — `automation_runs.deleted_at` does not exist
 *      yet, so the parameter parses without 400 but is a no-op).
 *      Emits `automation.runs.list.queried` once per call.
 *
 *   3. GET /api/admin/automations/runs/:runId
 *      Single-run detail. Anti-enum 404 on unknown id. Successful read emits
 *      `automation.runs.detail.queried`; the 404 path emits nothing (handler
 *      short-circuits before the audit funnel runs).
 *
 * Auth gating is wired upstream by `requireAdminTier()` in
 * `infrastructure/server/route-setup/api-routes.ts`. Anti-enumeration 404
 * applies to every unauthorized-or-unknown path (keystone §6.4 / S1).
 *
 * Data access (the dialect-aware `automation_runs` reads) and all pure logic
 * (admin item building, overview series, cursor encode/decode) live in the
 * `automations-overview` use case + the `admin-automations` repository; this
 * handler keeps only HTTP, auth, query validation, the response-validation
 * mapping, the cursor-param parsing, and the audit emit, then calls the use
 * cases via the effect runner.
 *
 * Locks [internal ref] D2 (soft-delete default off — forward-contract honoured),
 * D3 (`_admin` envelope shape), and D5 (`series` rollup with fixed buckets).
 */

import { Effect } from 'effect'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import {
  BuildAutomationsCatalog,
  PauseAutomation,
  ResumeAutomation,
} from '@/application/use-cases/admin/automations-catalog'
import {
  BuildAdminRunDetail,
  BuildAdminRunsList,
  BuildAutomationsOverview,
} from '@/application/use-cases/admin/automations-overview'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import {
  retryAutomationRun,
  type RetryAutomationRunOptions,
} from '@/application/use-cases/automations/retry-automation-run'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  automationPauseParamsSchema,
  automationsOverviewQuerySchema,
  automationsRunsDetailParamsSchema,
  automationsRunsListQuerySchema,
  type AutomationRunAdminItem,
  type AutomationsRunsListQuery,
} from '@/domain/models/api/admin/automations'
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import {
  provideAdminAutomationsLive,
  provideAutomationPauseLive,
} from '@/presentation/api/routes/admin/automations/effect-runner'
import { provideAutomationLive } from '@/presentation/api/routes/automations/effect-runner'
import { requestLogAttributes } from '@/presentation/api/utils/context-helpers'
import type { ReplayAutomationRunError } from '@/application/use-cases/automations/replay-automation-run'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

/* eslint-disable functional/no-expression-statements -- request-handler code: the audit emit + response-header set + error log are intentional side-effects in a Hono handler, matching the sibling admin overview handlers. */

// ─── Overview handler ────────────────────────────────────────────────────────

async function handleAutomationsOverview(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  // Parse period preset (default '24h' enforced at the Zod layer).
  const parsedQuery = automationsOverviewQuerySchema.safeParse({
    period: c.req.query('period'),
  })
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query', code: 'BAD_REQUEST' }, 400)
  }
  const period = parsedQuery.data.period ?? '24h'

  // Build the overview body (data access + pure bucketing) via the use case.
  const outcome = await runRequestEffect(
    c,
    BuildAutomationsOverview(app, period).pipe(provideAdminAutomationsLive)
  )
  if (outcome._tag === 'ValidationFailed') {
    logError(
      '[admin] automations overview response validation failed',
      outcome.error,
      requestLogAttributes(c)
    )
    return c.json(
      { success: false, message: 'Failed to build automations overview', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Emit audit entry (canonical resource.type 'automation' — derived by emit
  // use-case from the ACTION_CATALOG entry for AUTOMATION_OVERVIEW_QUERIED).
  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.AUTOMATION_OVERVIEW_QUERIED,
    actor,
    resourceId: app.name,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(outcome.body, 200)
}

// ─── Runs list handler ───────────────────────────────────────────────────────

/**
 * Project the parsed query onto the use case's input shape. Every knob is
 * forwarded explicitly — including `q`, whose omission at THIS seam is what made
 * the endpoint answer a search it was never asked to run.
 */
function runsListInput(query: AutomationsRunsListQuery): Parameters<typeof BuildAdminRunsList>[1] {
  return {
    status: query.status,
    automationName: query.automationName,
    automationId: query.automationId,
    from: query.from,
    to: query.to,
    q: query.q,
    cursor: query.cursor,
    limit: query.limit,
  }
}

async function handleListRuns(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  // Parse against the canonical schema (cursor / limit / status / filters /
  // include_deleted defaults). This literal is an ALLOW-LIST — Hono drops any
  // parameter not named here, which is how `?q=` returned a confident 200 over
  // the wrong rows; it is READ here, not merely declared on the schema.
  const parsedQuery = automationsRunsListQuerySchema.safeParse({
    cursor: c.req.query('cursor'),
    limit: c.req.query('limit'),
    status: c.req.query('status'),
    automationName: c.req.query('automationName'),
    automationId: c.req.query('automationId'),
    from: c.req.query('from'),
    to: c.req.query('to'),
    include_deleted: c.req.query('include_deleted'),
    q: c.req.query('q'),
  })
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query', code: 'BAD_REQUEST' }, 400)
  }
  const query = parsedQuery.data

  // Reject from > to early — saves a DB round-trip.
  if (query.from && query.to && new Date(query.from).getTime() > new Date(query.to).getTime()) {
    return c.json({ success: false, message: 'from > to', code: 'BAD_REQUEST' }, 400)
  }

  // Build the body (filters → cursor read → admin items) via the use case; the
  // cursor decode lives there alongside the rest of the pure logic.
  const outcome = await runRequestEffect(
    c,
    BuildAdminRunsList(app, runsListInput(query)).pipe(provideAdminAutomationsLive)
  )
  if (outcome._tag === 'ValidationFailed') {
    logError('[admin] automations runs list response validation failed', outcome.error)
    return c.json(
      { success: false, message: 'Failed to build runs list', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Emit audit entry — exactly ONE per HTTP call (NOT one-per-cursor) per the
  // audit-log pagination de-dupe rule.
  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.AUTOMATION_RUNS_LIST_QUERIED,
    actor,
    resourceId: app.name,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(outcome.body, 200)
}

// ─── Runs detail handler ─────────────────────────────────────────────────────

async function handleRunDetail(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  // Validate `:runId` as a UUID. Per the spec [internal ref],
  // unknown ids return 404 (anti-enum). For invalid UUIDs we ALSO 404 so the
  // 400-vs-404 distinction doesn't leak whether ids of a given shape exist.
  const parsedParams = automationsRunsDetailParamsSchema.safeParse({
    runId: c.req.param('runId'),
  })
  if (!parsedParams.success) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  const { runId } = parsedParams.data

  const outcome = await runRequestEffect(
    c,
    BuildAdminRunDetail(app, runId).pipe(provideAdminAutomationsLive)
  )

  if (outcome._tag === 'NotFound') {
    // Anti-enum 404 — short-circuit BEFORE the audit emit (the spec asserts
    // that the unknown-id path does NOT produce an audit entry).
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  if (outcome._tag === 'ValidationFailed') {
    logError(
      '[admin] automations run detail response validation failed',
      outcome.error,
      requestLogAttributes(c)
    )
    return c.json(
      { success: false, message: 'Failed to build run detail', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Emit audit entry — only after the successful read (404 path emits nothing
  // per the spec contract).
  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.AUTOMATION_RUNS_DETAIL_QUERIED,
    actor,
    resourceId: runId,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(outcome.body, 200)
}

// ─── Run retry handler ───────────────────────────────────────────────────────

/**
 * Map a replay-engine error onto an HTTP response. An unknown run (or a
 * disabled/missing automation) surfaces as a 404 (anti-enumeration, S1 — the
 * caller must not learn whether a run id of that shape exists); the registry
 * seed failure is a 500; anything else means the run is not retryable (400).
 * Mirrors the schema-author `replayErrorResponse` helper.
 */
function retryErrorResponse(c: Context, error: ReplayAutomationRunError): Response {
  if (
    error._tag === 'AutomationNotFound' ||
    error._tag === 'AutomationRunNotFound' ||
    error._tag === 'AutomationRunMismatch'
  ) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  if (error._tag === 'AutomationRegistrySeedError') {
    return c.json(
      { success: false, message: 'Failed to register automation', code: 'INTERNAL_ERROR' },
      500
    )
  }
  return c.json({ success: false, message: 'Run not retryable', code: 'BAD_REQUEST' }, 400)
}

async function handleRetryRun(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  // Validate `:runId` as a UUID — like the run-detail read, a malformed id
  // 404s (NOT 400) so the shape of valid ids never leaks (anti-enum, S1).
  const parsedParams = automationsRunsDetailParamsSchema.safeParse({
    runId: c.req.param('runId'),
  })
  if (!parsedParams.success) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  const { runId } = parsedParams.data

  // Re-fire the run through the existing replay engine (resolves run → its
  // automation → a fresh skip-executed run). The full automation runtime
  // (repository + execute requirements) is provided by `provideAutomationLive`,
  // NOT the read-only admin layer.
  const options: RetryAutomationRunOptions = {
    runId,
    app,
    processEnv: process.env,
    userId: session.userId,
  }
  const result = await runRequestEffect(
    c,
    Effect.result(provideAutomationLive(retryAutomationRun(options)))
  )
  if (result._tag === 'Failure') {
    return retryErrorResponse(c, result.failure)
  }

  // 202 Accepted — the retry created a NEW run (`runId`); the original run's
  // row is untouched. Hand-shaped ack (no raw DB row leaks, S4).
  return c.json({ runId: result.success.runId, status: 'accepted' }, 202)
}

// ─── Catalog handler ─────────────────────────────────────────────────────────

/**
 * `GET /api/admin/automations` — every automation declared in config, in config
 * order, with its operator-visible state.
 *
 * Uncursored by design: this enumerates CONFIG, bounded by the app file, unlike
 * the cursor-paginated `/runs` sibling whose source grows without bound.
 */
async function handleAutomationsCatalog(c: Context, app: App): Promise<Response> {
  const result = await runRequestEffect(
    c,
    Effect.result(provideAutomationPauseLive(BuildAutomationsCatalog(app)))
  )
  if (result._tag === 'Failure') {
    logError('[admin] automations catalog read failed', result.failure, requestLogAttributes(c))
    return c.json(
      { success: false, message: 'Failed to build automations catalog', code: 'INTERNAL_ERROR' },
      500
    )
  }

  c.header('Cache-Control', 'no-store')
  return c.json(result.success, 200)
}

// ─── Pause / resume handlers ─────────────────────────────────────────────────

/**
 * Shared body of `POST /:name/pause` and `POST /:name/resume`.
 *
 * The two differ only in which mutation they run and which audit action they
 * emit; every status-code decision is identical and lives here so the pair
 * cannot drift — a resume that 404'd where pause 409'd would leak the
 * config-disabled state through a status-code difference.
 *
 * The audit emit happens ONLY on the 200 path. The 404 and 409 paths write
 * nothing: an audit row for a refused mutation on a name that may not exist
 * would itself become an enumeration surface for anyone who can read the log.
 */
async function handlePauseMutation(
  c: Context,
  app: App,
  mutation: 'pause' | 'resume'
): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  const parsedParams = automationPauseParamsSchema.safeParse({ name: c.req.param('name') })
  if (!parsedParams.success) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  const { name } = parsedParams.data

  const program =
    mutation === 'pause' ? PauseAutomation(app, name, session.userId) : ResumeAutomation(app, name)
  const result = await runRequestEffect(c, Effect.result(provideAutomationPauseLive(program)))

  if (result._tag === 'Failure') {
    logError(`[admin] automation ${mutation} failed`, result.failure, requestLogAttributes(c))
    return c.json(
      { success: false, message: `Failed to ${mutation} automation`, code: 'INTERNAL_ERROR' },
      500
    )
  }

  const outcome = result.success
  if (outcome._tag === 'NotFound') {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  if (outcome._tag === 'Conflict') {
    return c.json(
      {
        success: false,
        message: 'Automation is disabled in config',
        code: 'CONFLICT',
      },
      409
    )
  }

  // These are the FIRST audited automation MUTATIONS — every existing
  // `automation.*` action is a readback. `emitAuditEvent` SILENTLY DROPS an
  // action missing from ACTION_CATALOG (a warning, not a throw), so
  // `automation.paused` / `automation.resumed` being registered there is what
  // makes these rows appear at all; [internal ref] asserts they do.
  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action:
      mutation === 'pause' ? AUDIT_ACTIONS.AUTOMATION_PAUSED : AUDIT_ACTIONS.AUTOMATION_RESUMED,
    actor,
    resourceId: name,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(outcome.body, 200)
}

// ─── Route registration ──────────────────────────────────────────────────────

/**
 * Chain the admin/automations routes onto a Hono app.
 *
 * Auth gating is wired upstream in `createApiRoutes` (authMiddleware +
 * requireAdminTier on `/api/admin/automations/*`). Route order matters:
 * the more-specific `/runs/:runId` path is registered BEFORE the bare
 * `/runs` path so Hono matches the specific route first (`.get` overlaps
 * resolve in registration order).
 *
 * The handler resolves the live App via the `resolveApp` thunk so a
 * `POST /draft/publish` (which swaps the live App + applies additive DDL
 * without a restart) is reflected in the overview's `totals.automations`
 * count without restart.
 *
 * The `POST /runs/:runId/retry` write endpoint is registered alongside the
 * read endpoints (distinct method + path, so it never shadows — and is never
 * shadowed by — the bare `/runs` GET). It re-fires a run through the replay
 * engine (CAP-3 — the one net-new admin-dashboard backend).
 */
export function chainAdminAutomationsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return (
    honoApp
      .get('/api/admin/automations/overview', (c) => handleAutomationsOverview(c, resolveApp()))
      .post('/api/admin/automations/runs/:runId/retry', (c) => handleRetryRun(c, resolveApp()))
      .get('/api/admin/automations/runs/:runId', (c) => handleRunDetail(c, resolveApp()))
      .get('/api/admin/automations/runs', (c) => handleListRuns(c, resolveApp()))
      // The pause/resume mutations are POSTs on a two-segment path
      // (`/:name/pause`), so they cannot shadow — nor be shadowed by — the
      // three-segment `/runs/:runId/retry` POST above. Registered after it
      // regardless, keeping the file's "most specific first" ordering.
      .post('/api/admin/automations/:name/pause', (c) =>
        handlePauseMutation(c, resolveApp(), 'pause')
      )
      .post('/api/admin/automations/:name/resume', (c) =>
        handlePauseMutation(c, resolveApp(), 'resume')
      )
      // The bare catalog path, registered last: it is the least specific GET on
      // this prefix and must not intercept `/overview` or `/runs`.
      .get('/api/admin/automations', (c) => handleAutomationsCatalog(c, resolveApp())) as T
  )
}

// Re-export the schema type so the api-routes wiring's `import type` stays
// minimal (no need to also import the schema module).
export type { AutomationRunAdminItem }

/* eslint-enable functional/no-expression-statements */
