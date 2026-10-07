/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin endpoints for the automations domain.
 *
 * The four READS — `GET /api/admin/automations`, `/overview`, `/runs` and
 * `/runs/:runId` — are entries of the admin read-operation registry
 * (`src/application/use-cases/admin/automations-read-operations.ts`) and are
 * mounted here through its HTTP adapter (`read-operation-routes.ts`). The same
 * entries yield their OpenAPI operations and their MCP admin tools, so the
 * request decoding, the use-case, the response body and the audit event are
 * declared once for every surface. The registry entry is where a read's
 * contract lives — anti-enumeration 404 on an unknown or malformed run id, one
 * audit event per list call (never one per page), none for the catalog.
 *
 * The three WRITES stay hand-written below: `POST /runs/:runId/retry` (re-fires
 * a run through the replay engine) and `POST /:name/pause` | `/:name/resume`.
 *
 * Auth gating is wired upstream by `requireAdminTier()` in
 * `infrastructure/server/route-setup/api-routes.ts`. Anti-enumeration 404
 * applies to every unauthorized-or-unknown path (keystone §6.4 / S1).
 *
 * Locks [internal ref] D2 (soft-delete default off — forward-contract honoured),
 * D3 (`_admin` envelope shape), and D5 (`series` rollup with fixed buckets).
 */

import { Effect } from 'effect'
import {
  PauseAutomation,
  ResumeAutomation,
} from '@/application/use-cases/admin/automations-catalog'
import { AUTOMATIONS_READ_OPERATIONS } from '@/application/use-cases/admin/automations-read-operations'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import {
  retryAutomationRun,
  type RetryAutomationRunOptions,
} from '@/application/use-cases/automations/retry-automation-run'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  automationPauseParamsSchema,
  automationsRunsDetailParamsSchema,
} from '@/domain/models/api/admin/automations'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { logError } from '@/infrastructure/logging/logger'
import {
  provideDomain,
  runDomainPromise,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import { emitAuditEvent } from '@/presentation/api/admin/audit-events'
import { chainAdminReadRoutes } from '@/presentation/api/admin/read-operation-routes'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { isAutomationStoreFailure } from '@/presentation/api/runtime/automation-error-responses'
import { requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
import { toErrorResponse } from '@/presentation/api/runtime/run-effect'
import type { ReplayAutomationRunError } from '@/application/use-cases/automations/replay-automation-run'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

// ─── Run retry handler ───────────────────────────────────────────────────────

/**
 * Map a replay-engine error onto an HTTP response. An unknown run (or a
 * disabled/missing automation) surfaces as a 404 (anti-enumeration, S1 — the
 * caller must not learn whether a run id of that shape exists); the registry
 * seed failure is a 500; anything else means the run is not retryable (400).
 * Mirrors the schema-author `replayErrorResponse` helper.
 */
function retryErrorResponse(c: Context, error: ReplayAutomationRunError): Response {
  // FIRST, before any not-found reading: a store that did not answer says
  // nothing about whether the run exists, so it must not leave here as a 404.
  if (isAutomationStoreFailure(error)) return toErrorResponse(c, error)
  if (
    error._tag === 'AutomationNotFound' ||
    error._tag === 'AutomationRunNotFound' ||
    error._tag === 'AutomationRunMismatch'
  ) {
    return notFound(c, 'Not found')
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
  const parsedParams = decodeSafe(automationsRunsDetailParamsSchema)({
    runId: c.req.param('runId'),
  })
  if (!parsedParams.success) {
    return notFound(c, 'Not found')
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
    Effect.result(provideDomain(c, retryAutomationRun(options)))
  )
  if (result._tag === 'Failure') {
    return retryErrorResponse(c, result.failure)
  }

  // 202 Accepted — the retry created a NEW run (`runId`); the original run's
  // row is untouched. Hand-shaped ack (no raw DB row leaks, S4).
  return c.json({ runId: result.success.runId, status: 'accepted' }, 202)
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

  const parsedParams = decodeSafe(automationPauseParamsSchema)({ name: c.req.param('name') })
  if (!parsedParams.success) {
    return notFound(c, 'Not found')
  }
  const { name } = parsedParams.data

  const program =
    mutation === 'pause'
      ? PauseAutomation(app, name, session.userId)
      : ResumeAutomation(app, name, session.userId)
  const result = await runRequestEffect(c, Effect.result(provideDomain(c, program)))

  if (result._tag === 'Failure') {
    logError(`[admin] automation ${mutation} failed`, result.failure, requestLogAttributes(c))
    return c.json(
      { success: false, message: `Failed to ${mutation} automation`, code: 'INTERNAL_ERROR' },
      500
    )
  }

  const outcome = result.success
  if (outcome._tag === 'NotFound') {
    return notFound(c, 'Not found')
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
  // makes these rows appear at all; an admin automations pause spec asserts they do.
  const actor = await runDomainPromise(c, resolveActor(session.userId))
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
 * requireAdminTier on `/api/admin/automations/*`). The four reads come from the
 * registry; no read path overlaps another (each has a distinct segment count or
 * a literal segment), so their order is the registry's. The three POSTs never
 * shadow — and are never shadowed by — a GET.
 *
 * The handlers resolve the live App via the `resolveApp` thunk so a config
 * swap without restart is reflected on the next request.
 */
export function chainAdminAutomationsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return (
    chainAdminReadRoutes(honoApp, resolveApp, AUTOMATIONS_READ_OPERATIONS)
      .post('/api/admin/automations/runs/:runId/retry', (c) => handleRetryRun(c, resolveApp()))
      // The pause/resume mutations are POSTs on a two-segment path
      // (`/:name/pause`), so they cannot shadow — nor be shadowed by — the
      // three-segment `/runs/:runId/retry` POST above.
      .post('/api/admin/automations/:name/pause', (c) =>
        handlePauseMutation(c, resolveApp(), 'pause')
      )
      .post('/api/admin/automations/:name/resume', (c) =>
        handlePauseMutation(c, resolveApp(), 'resume')
      ) as T
  )
}
