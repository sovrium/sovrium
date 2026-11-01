/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cron, DateTime, Effect, Result } from 'effect'
import {
  replayAutomationRun,
  type ReplayAutomationRunError,
} from '@/application/use-cases/automations/replay-automation-run'
import { type RunAutomationError } from '@/application/use-cases/automations/run-automation'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { triggerResponseSchema } from '@/domain/models/api/automations/automations'
import { listAutomationsResponseSchema } from '@/domain/models/api/automations/runs'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import { requireSession, notFound } from '@/presentation/api/runtime/auth-helpers'
import { isAutomationStoreFailure } from '@/presentation/api/runtime/automation-error-responses'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { answerOnce } from '@/presentation/api/runtime/idempotency'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
  shapedJson,
  toErrorResponse,
} from '@/presentation/api/runtime/run-effect'
import { handleListApprovals } from './approvals-handlers'
import { automationsListedTo } from './automation-listing-reach'
import { admitPageAction, type PageSessionResolver } from './page-action-gate'
import { startPagePress } from './page-press'
import { handleGetRunDetail, handleListRuns, handleListRunsByName } from './run-read-handlers'
import {
  chainRunControlRoutes,
  gateActionableRun,
  readReplayBody,
  replayTriggerData,
} from './runs-handlers'
import { chainTelemetryIngestRoutes } from './telemetry-ingest-routes'
import { selectTriggerProgram } from './trigger-program-selector'
import { triggerResponseAsSeenByCaller } from './trigger-response-body'
import { redactTriggerSecrets } from './trigger-secret-redaction'
import { handleWebhookRequest } from './webhook-handler'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Handle GET /api/automations — the automations the caller may act on
 * ({@link automationsListedTo}). Every secret field of a trigger
 * (`auth.*`, `verification.verifyToken`, a top-level `secret`) is replaced by
 * `[redacted]` before it is serialised — see {@link redactTriggerSecrets}.
 */
/**
 * For a `cron`-typed trigger, derive a `{ nextRunAt }` overlay (ISO 8601)
 * from the cron expression + timezone using Effect's `Cron` module. Schema
 * validation already guaranteed both fields parse, so the failure branches
 * here are defensive (DST edge cases, future Effect API drift) and silently
 * elided.
 *
 * Returns an empty object for non-cron triggers (and for cron triggers
 * whose parse defensively fails) so callers can spread it unconditionally
 * into the redacted trigger response.
 *
 * The `Cron.parse + zoneMakeNamedUnsafe` triplet is duplicated here, in the
 * domain Schema filter (`cron.ts`), and in `cron-scheduler-live.ts`. Kept
 * inline at each site because the failure contracts diverge: the schema
 * filter wants a string error, the scheduler wants a tagged `CronSchedulerError`
 * that preserves the original throw, and this overlay must absorb failures
 * silently to keep the public listing endpoint response shape stable.
 */
const computeCronNextRunOverlay = (
  trigger: Readonly<Record<string, unknown>>
): Record<string, string> => {
  if (trigger['type'] !== 'cron') return {}
  const expr = String(trigger['expression'])
  // The listing reports the EFFECTIVE zone: the schema carries no default, so
  // an omitted `timezone` is shown as the operator timezone it runs in.
  const tz = String(trigger['timezone'] ?? resolveOperatorTimezone(process.env))
  const zone = Result.try({
    try: () => DateTime.zoneMakeNamedUnsafe(tz),
    catch: () => undefined,
  })
  if (Result.isFailure(zone)) return {}
  const parsed = Cron.parse(expr, zone.success)
  if (Result.isFailure(parsed)) return {}
  return { timezone: tz, nextRunAt: Cron.next(parsed.success, new Date()).toISOString() }
}

function handleListAutomations(c: Context, app: App): Promise<Response> | Response {
  const userId = getSessionContext(c)?.userId
  if (userId === undefined) return answerAutomations(c, app, undefined)
  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.map(getUserRole(userId), (role) => answerAutomations(c, app, role))
    )
  )
}

/** The listing the caller's role reaches, every secret field replaced. */
const answerAutomations = (c: Context, app: App, role: string | undefined) => {
  const automations = automationsListedTo(app, role).map((automation) => {
    // Every secret field is replaced, `$env.X` reference or literal alike.
    const triggers = automation.triggers.map((entry) => {
      const trigger = entry as Record<string, unknown>
      return { ...redactTriggerSecrets(trigger), ...computeCronNextRunOverlay(trigger) }
    })
    // `trigger` is the first entry, as before `triggers` existed.
    return {
      name: automation.name,
      enabled: automation.enabled ?? true,
      trigger: triggers[0],
      triggers,
    }
  })
  return shapedJson(c, automations, listAutomationsResponseSchema)
}

/**
 * Translate a manual-trigger run error into the appropriate HTTP response.
 * Extracted so the handler stays under the complexity threshold.
 */
function manualTriggerErrorResponse(c: Context, error: RunAutomationError) {
  if (error._tag === 'AutomationNotFound' || error._tag === 'AutomationNotManualTriggered') {
    return notFound(c, 'Automation not found')
  }
  if (error._tag === 'AutomationManualRoleRequired') {
    return notFound(c, 'Automation not found')
  }
  if (error._tag === 'AutomationRegistrySeedError') {
    return c.json({ success: false, message: 'Failed to register automation in the database' }, 500)
  }
  return c.json({ success: false, message: 'Automation trigger is not manual' }, 400)
}

/**
 * Handle POST /api/automations/:name/trigger
 *
 * Manual trigger entry point. Mirrors the webhook handler but enforces:
 *   1. The named automation has `trigger.type === 'manual'` (404 otherwise
 *      so attackers cannot enumerate webhook automations through this route).
 *   2. The caller's role satisfies `trigger.requiredRole` (default `'admin'`).
 *
 * Anonymous callers are treated as having no role and rejected (403) unless
 * the trigger explicitly requires that role string — the schema currently
 * doesn't allow that, but it keeps the gate consistent with future expansion.
 */
async function handleManualTrigger(c: Context, app: App) {
  const name = c.req.param('name')
  if (name === undefined) {
    return c.json({ success: false, message: 'Automation name required' }, 400)
  }

  const session = getSessionContext(c)
  // Capture optional input payload (may be {} for triggers without inputSchema).
  const body = await c.req.json().catch(() => undefined)

  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        // Resolve role from auth.users for the calling session — the manual
        // trigger schema's `requiredRole` is matched against this value. The
        // default role for unauthenticated callers is undefined; the engine
        // rejects undefined when `requiredRole` is set.
        const userRole =
          session?.userId !== undefined ? yield* getUserRole(session.userId) : undefined

        const program = selectTriggerProgram({
          name,
          app,
          userRole,
          body,
          userId: session?.userId,
        })
        // On the request's root span, so the shared `executeAutomationRun` seam's
        // `automation.run` child span chains under it.
        const result = yield* Effect.result(program)
        if (result._tag === 'Failure') return manualTriggerErrorResponse(c, result.failure)
        const started = { automationName: name, result: result.success }
        return yield* respondWith(
          c,
          triggerResponseAsSeenByCaller(c, app, started),
          triggerResponseSchema
        )
      })
    )
  )
}

/**
 * Handle POST /api/automations/:name/form-action — a page press.
 *
 * Admits only a page-bound `manual` automation, under the page's `access` rule
 * and the trigger's declared `requiredRole` (`page-action-gate.ts`); every
 * refusal answers exactly as an unknown name does. Runs through
 * `runPagePressedAutomation`, which refuses a paused or switched-off automation
 * the same way and records a signed-in presser as the run's starter.
 */
function handleFormAction(c: Context, app: App, getSession?: PageSessionResolver) {
  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const name = c.req.param('name')
        if (name === undefined) {
          return c.json({ success: false, message: 'Automation name required' }, 400)
        }
        const admitted = yield* admitPageAction(c, app, name, getSession)
        if (admitted === undefined) return notFound(c, 'Automation not found')
        // A duplicate under its idempotency key is answered before anything starts.
        // effect-promise: total -- a body that is not JSON is caught here and read as none.
        const read = yield* Effect.promise(() => c.req.json().catch(() => undefined))
        const sent = (read ?? {}) as Record<string, unknown>
        const scope = { kind: 'automations', name, userId: admitted.userId } as const
        return yield* answerOnce(c, { scope, body: sent }, (body) =>
          // effect-promise: total -- the press answers its own failures as responses.
          Effect.promise(() => startPagePress(c, app, { name, admitted, body }))
        )
      })
    )
  )
}

/**
 * Translate a replay error into the appropriate HTTP response.
 */
function replayErrorResponse(c: Context, error: ReplayAutomationRunError) {
  // FIRST, before any not-found reading: a store that did not answer says
  // nothing about whether the run exists, so it must not leave here as a 404.
  if (isAutomationStoreFailure(error)) return toErrorResponse(c, error)
  if (
    error._tag === 'AutomationNotFound' ||
    error._tag === 'AutomationRunNotFound' ||
    error._tag === 'AutomationRunMismatch'
  ) {
    return notFound(c, 'Run not found')
  }
  if (error._tag === 'AutomationRunHistoryNotKept') {
    return c.json({ success: false, message: 'This run kept no trigger data to replay' }, 409)
  }
  if (error._tag === 'AutomationRegistrySeedError') {
    return c.json({ success: false, message: 'Failed to register automation in the database' }, 500)
  }
  return c.json({ success: false, message: 'Run not replayable' }, 400)
}

/**
 * Handle POST /api/automations/:name/runs/:id/replay
 *
 * Replay a previously-failed run. The replay creates a NEW run that skips
 * every action that already executed in the original (success or failure)
 * and runs only the previously-skipped tail.
 *
 * The request body is optional. When omitted (or `{}`), the replay reuses
 * the original run's `triggerData`. A body of `{ triggerData: {...} }`
 * (matching `replayRunRequestSchema`) lets the caller differentiate the
 * replay from the original trigger context.
 */
function handleReplayRun(c: Context, app: App): Promise<Response> | Response {
  const name = c.req.param('name')
  const id = c.req.param('id')
  if (name === undefined || id === undefined) {
    return c.json({ success: false, message: 'Automation name and run id required' }, 400)
  }
  return runHandlerEffect(c, replayRunProgram(c, app, { name, id }))
}

/** Replay a run, once the caller may act on it and may supply what she supplied. */
const replayRunProgram = (
  c: Context,
  app: App,
  target: { readonly name: string; readonly id: string }
) =>
  Effect.gen(function* () {
    const { name, id } = target
    // Replaying a run is acting on it: an admin, or its starter who may still start it.
    const gate = yield* gateActionableRun(c, app, id)
    if (!gate.ok) return gate.response

    // New trigger data is an admin's alone (`replayTriggerData`).
    const supplied = replayTriggerData(c, gate.value, yield* readReplayBody(c))
    if (!supplied.ok) return supplied.response
    const overrideTriggerData = supplied.value

    const result = yield* Effect.result(
      replayAutomationRun({
        name,
        runId: id,
        app,
        ...(overrideTriggerData !== undefined ? { triggerData: overrideTriggerData } : {}),
      })
    )
    if (result._tag === 'Failure') return replayErrorResponse(c, result.failure)
    const started = { automationName: name, result: result.success }
    return yield* respondWith(
      c,
      triggerResponseAsSeenByCaller(c, app, started),
      triggerResponseSchema
    )
  })

/**
 * Chain automation routes onto a Hono app: list/trigger/form-action, the runs
 * read surface (`/runs`, `/runs/:id`, `/:name/runs`), the run-control endpoints
 * (`/runs/:id/{replay,cancel}`), and the run-scoped approval-resolution
 * endpoints (`/runs/:runId/approvals/:approvalId/{approve,reject}`, the approval-pause design).
 *
 * The webhook route is mounted for every supported HTTP method so the handler
 * can return 405 + the configured `allowed` list — Hono's
 * `app.on(['GET', 'POST', ...], path, handler)` canonical pattern.
 */
/**
 * Wrap a run-history handler in a session gate.
 *
 * `/api/automations/*` carries `authMiddleware` but NOT `requireAuth`, because
 * `/:name/webhook` must stay anonymously callable — that is the whole point of
 * an inbound webhook. The convention is then that each handler gates itself,
 * and these four did not: an anonymous caller could list every run of every
 * automation, read each one's captured trigger payload, and replay any of them
 * — which drives record writes, outbound HTTP with stored credentials, and
 * emails. The run list also falsified the premise replay relied on, since
 * replay's only protection was that run ids are "unguessable" and the list
 * hands them out.
 *
 * A session is the FLOOR, not the ceiling: past it, each handler applies the
 * run-reader rule (`run-access.ts`) — an admin reads every run, anyone else the
 * runs they started by hand and the runs a request names them an approver of.
 */
const withSession =
  (handler: (c: Context, app: App) => Promise<Response> | Response, app: App) =>
  (c: Context): Promise<Response> | Response => {
    const auth = requireSession(c)
    if (!auth.ok) return auth.response
    return handler(c, app)
  }

export function chainAutomationRoutes(
  honoApp: Hono,
  app: App,
  getSession?: PageSessionResolver
): Hono {
  const withCore = chainTelemetryIngestRoutes(honoApp, app)
    .get('/api/automations', (c) => handleListAutomations(c, app))
    .on(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], '/api/automations/:name/webhook', (c) =>
      handleWebhookRequest(c, app)
    )
    .post('/api/automations/:name/trigger', (c) => handleManualTrigger(c, app))
    .post('/api/automations/:name/form-action', (c) => handleFormAction(c, app, getSession))
    // Before every `/:name` route: `approvals` is not an automation name.
    .get('/api/automations/approvals', (c) => handleListApprovals(c, app))
    .get('/api/automations/runs', withSession(handleListRuns, app))
    .get('/api/automations/runs/:id', withSession(handleGetRunDetail, app))
    .get('/api/automations/:name/runs', withSession(handleListRunsByName, app))
    .post('/api/automations/:name/runs/:id/replay', withSession(handleReplayRun, app))
  // Name-less run-control + approval-resolution endpoints.
  return chainRunControlRoutes(withCore, app)
}
