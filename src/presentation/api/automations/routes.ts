/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cron, DateTime, Effect, Result } from 'effect'
import {
  AutomationRunRepository,
  type PersistedRun,
  type PersistedStep,
} from '@/application/ports/repositories/automations/automation-run-repository'
import { findPendingApprovalId } from '@/application/use-cases/automations/list-automation-approvals'
import {
  replayAutomationRun,
  type ReplayAutomationRunError,
} from '@/application/use-cases/automations/replay-automation-run'
import {
  type RunAutomationError,
  type RunAutomationResult,
} from '@/application/use-cases/automations/run-automation'
import { runPagePressedAutomation } from '@/application/use-cases/automations/run-page-pressed-automation'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { redactTriggerDataHeaders } from '@/domain/kernel/sanitize/http-header-redaction'
import { runDetailSchema } from '@/domain/models/api/automations/automations'
import { decodeOrThrow } from '@/domain/models/api/combinators/decode'
import {
  provideDomain,
  runDomainPromise,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import { requireSession, notFound } from '@/presentation/api/runtime/auth-helpers'
import { isAutomationStoreFailure } from '@/presentation/api/runtime/automation-error-responses'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { toErrorResponse } from '@/presentation/api/runtime/run-effect'
import { handleListApprovals } from './approvals-handlers'
import { automationsListedTo } from './automation-listing-reach'
import { admitPageAction, type PageSessionResolver } from './page-action-gate'
import { listedRuns } from './run-list-body'
import { publishedNestedSteps } from './run-nested-steps'
import { judgedRunOf, runDetailAsSeenByCaller, runsAsSeenByCaller } from './run-step-output-reach'
import {
  chainRunControlRoutes,
  gateActionableRun,
  gateReadableRun,
  gateRunAccess,
  replayTriggerData,
} from './runs-handlers'
import { selectTriggerProgram } from './trigger-program-selector'
import { redactTriggerSecrets } from './trigger-secret-redaction'
import { handleWebhookRequest } from './webhook-handler'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Map a `RunAutomationResult` (engine-internal: `success`/`failure`) into the
 * public trigger-response body. The public contract uses `'completed' |
 * 'failed'` to align with `system.automation_runs.status` and surfaces the
 * run identifier as `id` (matches the runs API).
 *
 * Surfaces only the **last action's output** as `output`, mirroring
 * n8n's "When Last Node Finishes" mode. The previous per-action `actions` map
 * is no longer exposed — per-action visibility lives at
 * `GET /api/automations/runs/:id` instead. `output` is omitted when no action
 * produced output (filter-only / state-set-only runs).
 *
 * When the run failed, the redacted `error` string is surfaced so callers
 * can distinguish disconnected/no-token failures from upstream HTTP errors
 * without a follow-up GET.
 */
const triggerResultBody = (result: RunAutomationResult) => {
  // `'completed-with-errors'` is surfaced verbatim so callers can distinguish
  // a degraded happy path (some action failed but `continueOnError` allowed
  // the run to complete — an automation retry spec) from both a clean
  // completion and a hard failure. `'success'` maps to `'completed'` for
  // API alignment with `system.automation_runs.status`; the engine-internal
  // failure/exhausted/timed-out variants collapse to `'failed'` here so the
  // public trigger response stays small — callers needing the richer label
  // can read it from `GET /api/automations/:name/runs`.
  return {
    success: true,
    id: result.runId,
    status: toPublicTriggerStatus(result.status),
    ...(result.lastOutput !== undefined ? { output: result.lastOutput } : {}),
    ...(result.error !== undefined ? { error: result.error } : {}),
  }
}

/** Map an engine run status to the public trigger-response status enum. */
const PUBLIC_TRIGGER_STATUS: Readonly<Record<string, string>> = {
  success: 'completed',
  'completed-with-errors': 'completed-with-errors',
  skipped: 'skipped',
  cancelled: 'cancelled',
  'waiting-approval': 'waiting-approval',
}
const toPublicTriggerStatus = (s: RunAutomationResult['status']): string =>
  PUBLIC_TRIGGER_STATUS[s] ?? 'failed'

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
  const tz = String(trigger['timezone'] ?? resolveOperatorTimezone())
  const zone = Result.try({
    try: () => DateTime.zoneMakeNamedUnsafe(tz),
    catch: () => undefined,
  })
  if (Result.isFailure(zone)) return {}
  const parsed = Cron.parse(expr, zone.success)
  if (Result.isFailure(parsed)) return {}
  return { timezone: tz, nextRunAt: Cron.next(parsed.success, new Date()).toISOString() }
}

async function handleListAutomations(c: Context, app: App) {
  const userId = getSessionContext(c)?.userId
  const role = userId === undefined ? undefined : await runDomainPromise(c, getUserRole(userId))
  const automations = automationsListedTo(app, role).map((automation) => {
    const trigger = automation.trigger as Record<string, unknown>
    // Every secret field is replaced, `$env.X` reference or literal alike.
    const redactedTrigger = {
      ...redactTriggerSecrets(trigger),
      ...computeCronNextRunOverlay(trigger),
    }
    return {
      name: automation.name,
      enabled: automation.enabled ?? true,
      trigger: redactedTrigger,
    }
  })
  return c.json(automations, 200)
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
  // Resolve role from auth.users for the calling session — the manual
  // trigger schema's `requiredRole` is matched against this value. The
  // default role for unauthenticated callers is undefined; the engine
  // rejects undefined when `requiredRole` is set.
  const userRole =
    session?.userId !== undefined
      ? await runDomainPromise(c, getUserRole(session.userId))
      : undefined

  // Capture optional input payload (may be {} for triggers without inputSchema).
  const body = await c.req.json().catch(() => undefined)

  const program = selectTriggerProgram({
    name,
    app,
    userRole,
    body,
    userId: session?.userId,
  })
  // Run on the observability runtime under the request-edge root `http.server`
  // span so the shared `executeAutomationRun` seam's `automation.run` child span
  // chains under the request root (`Effect.either` already discharged reqs).
  const result = await runRequestEffect(c, Effect.result(provideDomain(c, program)))

  if (result._tag === 'Failure') {
    return manualTriggerErrorResponse(c, result.failure)
  }
  return c.json(triggerResultBody(result.success), 200)
}

/**
 * Handle GET /api/automations/:name/runs
 *
 * Returns persisted run history for ONE named automation as a FLAT array
 * (not a `{ runs }` envelope) including full step-level detail. Used by
 * the retry-and-failure spec corpus (timeout, partial-failure, etc.) so
 * test code can do `const runs = await res.json(); runs[0].steps[…]`.
 */
async function handleListRunsByName(c: Context, app: App) {
  const name = c.req.param('name')
  if (name === undefined) {
    return c.json({ success: false, message: 'Automation name required' }, 400)
  }
  // An automation the config does not declare answers the API's 404, as every
  // other `/:name` route does — an empty list would read as "never ran".
  if (!app.automations?.some((automation) => automation.name === name)) {
    return notFound(c, 'Automation not found')
  }

  const access = await gateRunAccess(c, app)
  if (!access.ok) return access.response
  const readableBy = access.value.kind === 'scoped' ? access.value.scope : undefined

  // DB-backed read: list runs by name, then enrich each with its steps.
  // Returns a flat array (newest first; `listByAutomationName` already
  // orders by created_at DESC at the SQL level).
  const program = Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const runs = yield* repo.listByAutomationName(name, readableBy)
    return yield* Effect.forEach(runs, (run) =>
      Effect.gen(function* () {
        const steps = yield* repo.findStepsByRunId(run.id)
        return { run, steps, detail: buildDbRunDetailBody(app, run, steps) }
      })
    )
  })

  const result = await runRequestEffect(c, Effect.result(provideDomain(c, program)))
  if (result._tag === 'Failure') {
    return c.json({ success: false, message: 'Failed to read run history' }, 500)
  }
  const seen = await Promise.all(
    result.success.map(({ run, steps, detail }) =>
      runDetailAsSeenByCaller(c, app, {
        access: { readsEveryRun: readableBy === undefined, run },
        detail,
        judged: judgedRunOf(run, steps),
      })
    )
  )
  return c.json(seen, 200)
}

/**
 * Handle GET /api/automations/runs
 *
 * Returns persisted run history from `system.automation_runs`. Query
 * parameters:
 *   - `automationName` — filter by automation user-facing name
 *   - `status`         — filter by run status (e.g. `completed`, `failed`)
 *   - `page`           — 1-indexed page number (paired with `pageSize`)
 *   - `pageSize`       — items per page; when present, `pagination` envelope
 *                        is included in the response
 *
 * The response is `{ runs, pagination? }`.
 */
async function handleListRuns(c: Context, app: App) {
  const automationName = c.req.query('automationName')
  const status = c.req.query('status')
  const pageStr = c.req.query('page')
  const pageSizeStr = c.req.query('pageSize')
  const page = pageStr !== undefined ? Number(pageStr) : undefined
  const pageSize = pageSizeStr !== undefined ? Number(pageSizeStr) : undefined
  // In the query, not after it: the total must count only the runs listed.
  const access = await gateRunAccess(c, app)
  if (!access.ok) return access.response
  const readableBy = access.value.kind === 'scoped' ? access.value.scope : undefined

  // Steps are fetched per-run so `attempt` reflects retry history
  // (an API automation runs spec reads `run.attempt`). The N+1 cost is acceptable
  // for the runs API (typically paginated to ≤50 rows); a JOIN-based reader
  // could replace this if the cost becomes material.
  const program = Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const result = yield* repo.listAll({
      ...(automationName !== undefined ? { automationName } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(page !== undefined ? { page } : {}),
      ...(pageSize !== undefined ? { pageSize } : {}),
      ...(readableBy !== undefined ? { readableBy } : {}),
    })
    const stepsPerRun = yield* Effect.forEach(result.runs, (run) => repo.findStepsByRunId(run.id))
    return { ...result, stepsPerRun }
  })

  const result = await runRequestEffect(c, Effect.result(provideDomain(c, program)))
  if (result._tag === 'Failure') {
    return c.json({ success: false, message: 'Failed to read run history' }, 500)
  }

  const { runs, total, stepsPerRun } = result.success
  // The trigger data a run captured is judged as its detail judges it.
  const runsBody = {
    runs: await runsAsSeenByCaller(c, app, {
      readsEveryRun: readableBy === undefined,
      runs: listedRuns(app, runs, stepsPerRun),
    }),
  }
  if (pageSize !== undefined) {
    const effectivePage = page !== undefined && page >= 1 ? page : 1
    const pagination = {
      page: effectivePage,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
    return c.json({ ...runsBody, pagination }, 200)
  }
  return c.json(runsBody, 200)
}

/**
 * Resolve the trigger type for a run by looking up the automation's schema
 * trigger.type. Defaults to `'webhook'` for runs whose automation has been
 * removed from the schema (mid-flight redeployment).
 */
const resolveTriggerType = (app: App, automationName: string): string =>
  app.automations?.find((a) => a.name === automationName)?.trigger.type ?? 'webhook'

/**
 * Pull per-attempt history off the last failing step's `output.attempts`
 * (populated by `dispatchWithRetry` when an action's retry budget is in
 * play — an automation retry spec). Returns an empty array when no step
 * has attempt records (most non-retrying runs).
 */
const extractAttempts = (
  steps: ReadonlyArray<{ readonly output?: unknown; readonly status?: string }>
): ReadonlyArray<Readonly<Record<string, unknown>>> => {
  const lastWithAttempts = steps.findLast(
    (s) =>
      s.output !== undefined &&
      s.output !== null &&
      typeof s.output === 'object' &&
      Array.isArray((s.output as { attempts?: unknown }).attempts)
  )
  if (!lastWithAttempts) return []
  const out = lastWithAttempts.output as { readonly attempts: ReadonlyArray<unknown> }
  return out.attempts as ReadonlyArray<Readonly<Record<string, unknown>>>
}

/** The runDetailSchema body of a run row and its step rows (`type: ''`: rows do not keep it). */
const buildDbRunDetailBody = (app: App, run: PersistedRun, steps: readonly PersistedStep[]) => ({
  id: run.id,
  automationName: run.automationName,
  status: run.status,
  triggerType: resolveTriggerType(app, run.automationName),
  // See `persistedRunToApi`: the captured inbound headers carry credentials.
  triggerData: redactTriggerDataHeaders(run.triggerData),
  startedAt: run.startedAt,
  completedAt: run.completedAt,
  durationMs: run.durationMs,
  attempt: 1,
  attempts: extractAttempts(steps),
  error: run.error,
  valuesErasedAt: run.valuesErasedAt,
  steps: steps.map((step) => ({
    name: step.actionName,
    type: '',
    status: step.status,
    startedAt: step.startedAt,
    completedAt: step.completedAt,
    durationMs: step.durationMs,
    output: step.output ?? null,
    error: step.error,
    ...(Array.isArray(step.logs) ? { logs: step.logs } : {}),
    ...publishedNestedSteps(step.nested, step),
  })),
})

/**
 * Effect program that loads the run + its steps from the DB-backed
 * repository. Returns `undefined` when the run id has no row, which the
 * route reports as 404. Errors propagate so the route can report them.
 */
const loadDbRunDetail = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const run = yield* repo.findById(id)
    if (run === undefined) return undefined
    const steps = yield* repo.findStepsByRunId(id)
    // The pending request the run waits on, so a client can resolve it.
    const approvalId = yield* findPendingApprovalId(id)
    return { run, steps, approvalId }
  })

/**
 * Handle GET /api/automations/runs/:id
 *
 * Returns the runDetailSchema shape — run metadata plus per-step execution
 * results. This is the canonical endpoint for callers that need per-action
 * visibility: the trigger response only exposes the last action's
 * `output`, so anything richer (intermediate step outputs, skipped steps,
 * step-level error messages) lives here.
 */
async function handleGetRunDetail(c: Context, app: App) {
  const id = c.req.param('id')
  if (id === undefined) {
    return c.json({ success: false, message: 'Run id required' }, 400)
  }
  // A run the caller may not read answers exactly what an unknown id answers.
  const gate = await gateReadableRun(c, app, id)
  if (!gate.ok) return gate.response

  const dbResult = await runRequestEffect(c, Effect.result(provideDomain(c, loadDbRunDetail(id))))
  if (dbResult._tag === 'Success' && dbResult.success !== undefined) {
    // S4: the body leaves through its published contract, so a field the
    // OpenAPI document does not declare cannot reach a client.
    const { run, steps, approvalId } = dbResult.success
    // A step's output is what it read under the run's authority: a reader who
    // does not read every run sees it only within her own reach.
    const detail = await runDetailAsSeenByCaller(c, app, {
      access: { readsEveryRun: gate.value.readsEveryRun, run },
      detail: buildDbRunDetailBody(app, run, steps),
      judged: judgedRunOf(run, steps),
    })
    const body = { ...detail, approvalId: approvalId ?? null }
    return c.json(decodeOrThrow(runDetailSchema)(body), 200)
  }
  return notFound(c, 'Run not found')
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
async function handleFormAction(c: Context, app: App, getSession?: PageSessionResolver) {
  const name = c.req.param('name')
  if (name === undefined) {
    return c.json({ success: false, message: 'Automation name required' }, 400)
  }
  const admitted = await admitPageAction(c, app, name, getSession)
  if (admitted === undefined) return notFound(c, 'Automation not found')

  const body = (await c.req.json().catch(() => ({}))) as { inputData?: Record<string, unknown> }
  const inputData = body.inputData ?? {}
  // Expose the page-form payload at BOTH `trigger.data.body.X` (the form/webhook
  // shape) AND `trigger.input.X` (the manual-trigger input shape). A page button
  // that fires a `trigger: manual` automation carries the manual trigger's
  // declared `inputSchema` values, so actions that read `{{trigger.input.X}}`
  // (the manual-trigger convention) resolve identically to a direct manual call.
  const triggerData = { body: inputData, input: inputData }
  // A paused or switched-off automation is refused like an unknown name; a
  // signed-in presser (the session the gate judged) is recorded as the starter.
  const program = runPagePressedAutomation({
    ...admitted,
    app,
    processEnv: process.env,
    triggerData,
  })
  const result = await runRequestEffect(c, Effect.result(provideDomain(c, program)))
  if (result._tag === 'Failure') return notFound(c, 'Automation not found')
  if (result.success === undefined) {
    return c.json({ success: false, message: 'Automation dispatch failed' }, 500)
  }
  return c.json(triggerResultBody(result.success), 200)
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
async function handleReplayRun(c: Context, app: App) {
  const name = c.req.param('name')
  const id = c.req.param('id')
  if (name === undefined || id === undefined) {
    return c.json({ success: false, message: 'Automation name and run id required' }, 400)
  }
  // Replaying a run is acting on it: an admin, or its starter who may still start it.
  const gate = await gateActionableRun(c, app, id)
  if (!gate.ok) return gate.response

  // Body is optional — empty / non-JSON bodies degrade to undefined. New
  // trigger data is an admin's alone (`replayTriggerData`).
  const body = (await c.req.json().catch(() => undefined)) as { triggerData?: unknown } | undefined
  const supplied = replayTriggerData(c, gate.value, body)
  if (!supplied.ok) return supplied.response
  const overrideTriggerData = supplied.value

  const program = replayAutomationRun({
    name,
    runId: id,
    app,
    processEnv: process.env,
    ...(overrideTriggerData !== undefined ? { triggerData: overrideTriggerData } : {}),
  })
  const result = await runRequestEffect(c, Effect.result(provideDomain(c, program)))

  if (result._tag === 'Failure') {
    return replayErrorResponse(c, result.failure)
  }
  return c.json(triggerResultBody(result.success), 200)
}

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

export function chainAutomationRoutes<T extends Hono>(
  honoApp: T,
  app: App,
  getSession?: PageSessionResolver
): T {
  const withCore = honoApp
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
  return chainRunControlRoutes(withCore, app) as T
}
