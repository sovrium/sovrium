/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cron, DateTime, Effect, Either } from 'effect'
import {
  AutomationRunRepository,
  type PersistedRun,
  type PersistedStep,
} from '@/application/ports/repositories/automation-run-repository'
import { dispatchAutomationOnce } from '@/application/use-cases/automations/dispatch-automation-trigger'
import {
  replayAutomationRun,
  type ReplayAutomationRunError,
} from '@/application/use-cases/automations/replay-automation-run'
import {
  type RunAutomationError,
  type RunAutomationResult,
} from '@/application/use-cases/automations/run-automation'
import {
  getAutomationRun,
  listAutomationRuns,
  type AutomationRunRecord,
} from '@/application/use-cases/automations/run-history-store'
import { runManualAutomation } from '@/application/use-cases/automations/run-manual-automation'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { provideAutomationLive } from './effect-runner'
import { handleCancelRun, handleReplayRunById } from './runs-handlers'
import { handleWebhookRequest } from './webhook-handler'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Map a `RunAutomationResult` (engine-internal: `success`/`failure`) into the
 * public trigger-response body. The public contract uses `'completed' |
 * 'failed'` to align with `system.automation_runs.status` and surfaces the
 * run identifier as `id` (matches the runs API).
 *
 * DEC-021: surfaces only the **last action's output** as `output`, mirroring
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
  // the run to complete — APP-AUTOMATION-RETRY-014) from both a clean
  // completion and a hard failure. `'success'` maps to `'completed'` for
  // API alignment with `system.automation_runs.status`; the engine-internal
  // failure/exhausted/timed-out variants collapse to `'failed'` here so the
  // public trigger response stays small — callers needing the richer label
  // can read it from `GET /api/automations/:name/runs`.
  const toPublicStatus = (
    s: RunAutomationResult['status']
  ): 'completed' | 'completed-with-errors' | 'failed' => {
    if (s === 'success') return 'completed'
    if (s === 'completed-with-errors') return 'completed-with-errors'
    return 'failed'
  }
  return {
    success: true,
    id: result.runId,
    status: toPublicStatus(result.status),
    ...(result.lastOutput !== undefined ? { output: result.lastOutput } : {}),
    ...(result.error !== undefined ? { error: result.error } : {}),
  }
}

/**
 * Handle GET /api/automations
 *
 * List all configured automations. Used by admin UI / external integrations
 * to discover what triggers an app exposes. Auth secrets in trigger config
 * (`auth.token`, `auth.key`, `auth.secret`, `auth.password`) are NOT included
 * in the response — they are either resolved at runtime via `$env.X`
 * indirection (and so already absent from the schema) or stored as literals
 * which must be redacted here before being serialised
 * (APP-AUTOMATION-TRIGGER-WEBHOOK-020).
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
 * The `Cron.parse + zoneUnsafeMakeNamed` triplet is duplicated here, in the
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
  const tz = String(trigger['timezone'] ?? 'UTC')
  const zone = Either.try({
    try: () => DateTime.zoneUnsafeMakeNamed(tz),
    catch: () => undefined,
  })
  if (Either.isLeft(zone)) return {}
  const parsed = Cron.parse(expr, zone.right)
  if (Either.isLeft(parsed)) return {}
  return { nextRunAt: Cron.next(parsed.right, new Date()).toISOString() }
}

function handleListAutomations(c: Context, app: App) {
  const automations = (app.automations ?? []).map((automation) => {
    const trigger = automation.trigger as Record<string, unknown>
    const auth = trigger['auth'] as Record<string, unknown> | undefined
    const redactedAuth =
      auth === undefined
        ? undefined
        : {
            ...auth,
            // Redact secret fields irrespective of whether they are `$env.X`
            // references or literal strings — the public listing should
            // never leak literal credentials.
            ...(auth['token'] !== undefined ? { token: '[redacted]' } : {}),
            ...(auth['key'] !== undefined ? { key: '[redacted]' } : {}),
            ...(auth['secret'] !== undefined ? { secret: '[redacted]' } : {}),
            ...(auth['password'] !== undefined ? { password: '[redacted]' } : {}),
            ...(auth['username'] !== undefined ? { username: '[redacted]' } : {}),
          }
    const cronOverlay = computeCronNextRunOverlay(trigger)
    const redactedTrigger: Record<string, unknown> =
      redactedAuth === undefined
        ? { ...trigger, ...cronOverlay }
        : { ...trigger, auth: redactedAuth, ...cronOverlay }
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
    return c.json({ success: false, message: 'Automation not found' }, 404)
  }
  if (error._tag === 'AutomationManualRoleRequired') {
    return c.json(
      {
        success: false,
        message: `This automation requires the '${error.required}' role`,
        code: 'FORBIDDEN',
      },
      403
    )
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
  const userRole = session?.userId !== undefined ? await getUserRole(session.userId) : undefined

  // Capture optional input payload (may be {} for triggers without inputSchema).
  const body = await c.req.json().catch(() => undefined)

  const program = runManualAutomation({
    name,
    app,
    processEnv: process.env,
    userRole,
    triggerData: { body },
    ...(session?.userId !== undefined ? { userId: session.userId } : {}),
  })
  const result = await Effect.runPromise(Effect.either(provideAutomationLive(program)))

  if (result._tag === 'Left') {
    return manualTriggerErrorResponse(c, result.left)
  }
  return c.json(triggerResultBody(result.right), 200)
}

/**
 * Resolve a run's trigger type by looking up its automation in the schema.
 * Defaults to `'webhook'` when the automation has been removed from the schema
 * mid-flight (the run row outlives the definition reference).
 */
const lookupTriggerType = (app: App, name: string): string =>
  app.automations?.find((a) => a.name === name)?.trigger.type ?? 'webhook'

/**
 * Compute the attempt count for a run from its step rows. When a step has
 * an `attempts: [...]` array on its `output` (populated by
 * `dispatchWithRetry` — APP-AUTOMATION-RETRY-010), the run's attempt count
 * is the length of the largest such array across all steps. Falls back to
 * 1 when no step carried attempt history (the common no-retry path).
 */
const computeAttemptCount = (steps: ReadonlyArray<{ readonly output?: unknown }>): number => {
  const counts = steps
    .map(({ output }) => {
      if (output === null || output === undefined || typeof output !== 'object') return 0
      const { attempts } = output as { attempts?: unknown }
      return Array.isArray(attempts) ? attempts.length : 0
    })
    .filter((n) => n > 0)
  return counts.length === 0 ? 1 : Math.max(...counts)
}

/**
 * Map a `PersistedRun` row to the public `Run` shape (Zod `runSchema`).
 * Pulled out so the list/filter handler stays under the complexity cap.
 *
 * `attempt` defaults to 1 when no per-step attempt history is supplied.
 * Callers with access to the step rows (the list handler) pass them via
 * the `steps` parameter to surface the real retry count
 * (API-AUTOMATION-RUNS-010).
 */
const persistedRunToApi = (app: App, run: PersistedRun, steps?: ReadonlyArray<PersistedStep>) => ({
  id: run.id,
  automationName: run.automationName,
  status: run.status,
  triggerType: lookupTriggerType(app, run.automationName),
  triggerData: run.triggerData,
  startedAt: run.startedAt,
  completedAt: run.completedAt,
  durationMs: run.durationMs,
  attempt: steps !== undefined ? computeAttemptCount(steps) : 1,
  error: run.error,
})

/**
 * Handle GET /api/automations/:name/runs
 *
 * Returns persisted run history for ONE named automation as a FLAT array
 * (not a `{ runs }` envelope) including full step-level detail. Used by
 * the retry-and-failure spec corpus (timeout, partial-failure, etc.) so
 * test code can do `const runs = await res.json(); runs[0].steps[…]`.
 *
 * Falls back to the in-memory store for legacy/no-DB paths the same way
 * the list endpoint does.
 */
async function handleListRunsByName(c: Context, app: App) {
  const name = c.req.param('name')
  if (name === undefined) {
    return c.json({ success: false, message: 'Automation name required' }, 400)
  }

  // DB-backed read: list runs by name, then enrich each with its steps.
  // Returns a flat array (newest first; `listByAutomationName` already
  // orders by created_at DESC at the SQL level).
  const program = Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const runs = yield* repo.listByAutomationName(name)
    return yield* Effect.forEach(runs, (run) =>
      Effect.gen(function* () {
        const steps = yield* repo.findStepsByRunId(run.id)
        return buildDbRunDetailBody(app, run, steps)
      })
    )
  })

  const result = await Effect.runPromise(Effect.either(provideAutomationLive(program)))
  if (result._tag === 'Right' && result.right.length > 0) {
    return c.json(result.right, 200)
  }

  // Fallback: in-memory store. The flat-array contract is preserved.
  const inMemoryRuns = listAutomationRuns({ automationName: name })
  const body = inMemoryRuns.map((run) => buildInMemoryRunDetailBody(app, run))
  return c.json(body, 200)
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
 * When DB-backed read returns rows, the response is `{ runs, pagination? }`.
 * When the DB read fails (e.g. no definitions yet, no runs persisted), the
 * handler falls back to the in-memory store for legacy specs that observe
 * the in-memory shape directly (redact-secrets).
 */
async function handleListRuns(c: Context, app: App) {
  const automationName = c.req.query('automationName')
  const status = c.req.query('status')
  const pageStr = c.req.query('page')
  const pageSizeStr = c.req.query('pageSize')
  const page = pageStr !== undefined ? Number(pageStr) : undefined
  const pageSize = pageSizeStr !== undefined ? Number(pageSizeStr) : undefined

  // DB-backed list path. Always tried; falls back to in-memory only on error.
  // Steps are fetched per-run so `attempt` reflects retry history
  // (API-AUTOMATION-RUNS-010 reads `run.attempt`). The N+1 cost is acceptable
  // for the runs API (typically paginated to ≤50 rows); a JOIN-based reader
  // could replace this if the cost becomes material.
  const program = Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const result = yield* repo.listAll({
      ...(automationName !== undefined ? { automationName } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(page !== undefined ? { page } : {}),
      ...(pageSize !== undefined ? { pageSize } : {}),
    })
    const stepsPerRun = yield* Effect.forEach(result.runs, (run) => repo.findStepsByRunId(run.id))
    return { ...result, stepsPerRun }
  })

  const result = await Effect.runPromise(Effect.either(provideAutomationLive(program)))
  if (result._tag === 'Right') {
    const { runs, total, stepsPerRun } = result.right
    const runsBody = {
      runs: runs.map((run, i) => persistedRunToApi(app, run, stepsPerRun[i])),
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

  // Fallback: in-memory store. Used by redact-secrets specs and as a
  // safety net when the DB-read path errors. Schema is the legacy
  // shape (status: 'success'|'failure', no automationId).
  const runs = listAutomationRuns(automationName !== undefined ? { automationName } : undefined)
  return c.json({ runs }, 200)
}

/**
 * Map an in-memory step's status (`success`/`failure`/`skipped`) to the public
 * step status enum (`completed`/`failed`/`skipped`). `'skipped'` is propagated
 * verbatim — APP-AUTOMATION-RETRY-012 reads per-step status to distinguish
 * actions-that-ran-and-failed from actions-that-never-ran. `'filtered'` will
 * propagate verbatim once the filter handler tracks step-level state.
 */
const inMemoryStepStatusToApi = (status: 'success' | 'failure' | 'skipped'): string => {
  if (status === 'success') return 'completed'
  if (status === 'skipped') return 'skipped'
  return 'failed'
}

/**
 * Resolve the trigger type for a run by looking up the automation's schema
 * trigger.type. Defaults to `'webhook'` for runs whose automation has been
 * removed from the schema (mid-flight redeployment).
 */
const resolveTriggerType = (app: App, automationName: string): string =>
  app.automations?.find((a) => a.name === automationName)?.trigger.type ?? 'webhook'

/**
 * Build the runDetailSchema body from the DB-backed run + step rows. `null`
 * literals match `runDetailSchema`'s `.nullable()` declarations (triggerData,
 * completedAt, durationMs, error, step.output) so the response complies with
 * the public schema. `type: ''` on steps reflects that step-row persistence
 * doesn't carry the action's `type` yet — the in-memory fallback fills it in.
 */
/**
 * Pull per-attempt history off the last failing step's `output.attempts`
 * (populated by `dispatchWithRetry` when an action's retry budget is in
 * play — APP-AUTOMATION-RETRY-010). Returns an empty array when no step
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

/* eslint-disable unicorn/no-null -- runDetailSchema declares these fields nullable; null is the contracted shape */
const buildDbRunDetailBody = (app: App, run: PersistedRun, steps: readonly PersistedStep[]) => ({
  id: run.id,
  automationName: run.automationName,
  status: run.status,
  triggerType: resolveTriggerType(app, run.automationName),
  triggerData: run.triggerData,
  startedAt: run.startedAt,
  completedAt: run.completedAt,
  durationMs: run.durationMs,
  attempt: 1,
  attempts: extractAttempts(steps),
  error: run.error,
  steps: steps.map((step) => ({
    name: step.actionName,
    type: '',
    status: step.status,
    startedAt: step.startedAt,
    completedAt: step.completedAt,
    durationMs: step.durationMs,
    output: step.output ?? null,
    error: step.error,
  })),
})

/**
 * Build the runDetailSchema body from the in-memory store record. Used as
 * fallback for specs that observe in-memory state directly (redact-secrets)
 * or when DB persistence failed.
 */
/**
 * Map an in-memory run's engine status to the public API status enum.
 * `'success'` → `'completed'`, `'timed-out'`/`'exhausted'` pass through
 * verbatim (retry-and-failure spec corpus depends on the distinct labels),
 * everything else collapses to `'failed'`.
 */
const inMemoryRunStatusToApi = (
  status: 'success' | 'failure' | 'timed-out' | 'exhausted' | 'completed-with-errors'
): string => {
  if (status === 'success') return 'completed'
  if (status === 'timed-out') return 'timed-out'
  if (status === 'exhausted') return 'exhausted'
  if (status === 'completed-with-errors') return 'completed-with-errors'
  return 'failed'
}

const buildInMemoryRunDetailBody = (app: App, inMemoryRun: AutomationRunRecord) => ({
  id: inMemoryRun.id,
  automationName: inMemoryRun.automationName,
  status: inMemoryRunStatusToApi(inMemoryRun.status),
  triggerType: resolveTriggerType(app, inMemoryRun.automationName),
  triggerData: null,
  startedAt: inMemoryRun.startedAt,
  completedAt: inMemoryRun.finishedAt,
  durationMs: null,
  attempt: 1,
  attempts: extractAttempts(inMemoryRun.steps),
  error: inMemoryRun.error ?? null,
  steps: inMemoryRun.steps.map((step) => ({
    name: step.name,
    type: step.type,
    ...(step.operator !== undefined ? { operator: step.operator } : {}),
    status: inMemoryStepStatusToApi(step.status),
    startedAt: inMemoryRun.startedAt,
    completedAt: inMemoryRun.finishedAt,
    durationMs: null,
    output: step.output ?? null,
    error: step.error ?? null,
  })),
})
/* eslint-enable unicorn/no-null */

/**
 * Effect program that loads the run + its steps from the DB-backed
 * repository. Returns `undefined` when the run id has no row (caller falls
 * back to the in-memory store). Errors propagate so the route can convert
 * them to a fallback path.
 */
const loadDbRunDetail = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const run = yield* repo.findById(id)
    if (run === undefined) return undefined
    const steps = yield* repo.findStepsByRunId(id)
    return { run, steps }
  })

/**
 * Handle GET /api/automations/runs/:id
 *
 * Returns the runDetailSchema shape — run metadata plus per-step execution
 * results. This is the canonical endpoint for callers that need per-action
 * visibility (DEC-021): the trigger response only exposes the last action's
 * `output`, so anything richer (intermediate step outputs, skipped steps,
 * step-level error messages) lives here.
 *
 * DB-backed read path first; falls back to the in-memory `getAutomationRun`
 * for specs that observe in-memory state directly.
 */
async function handleGetRunDetail(c: Context, app: App) {
  const id = c.req.param('id')
  if (id === undefined) {
    return c.json({ success: false, message: 'Run id required' }, 400)
  }

  const dbResult = await Effect.runPromise(
    Effect.either(provideAutomationLive(loadDbRunDetail(id)))
  )
  if (dbResult._tag === 'Right' && dbResult.right !== undefined) {
    return c.json(buildDbRunDetailBody(app, dbResult.right.run, dbResult.right.steps), 200)
  }

  const inMemoryRun = getAutomationRun(id)
  if (inMemoryRun === undefined) {
    return c.json({ success: false, message: 'Run not found' }, 404)
  }
  return c.json(buildInMemoryRunDetailBody(app, inMemoryRun), 200)
}

/**
 * Handle POST /api/automations/:name/form-action
 *
 * Page-form automation entry point. Unlike the manual trigger, this endpoint
 * does NOT enforce `trigger.type === 'manual'` or any role requirement — it is
 * designed for anonymous page-form submissions that have `action.type === 'automation'`.
 *
 * Uses `dispatchAutomationOnce` directly (same path as form-submission and
 * record-event triggers) so seed errors are absorbed without rolling back the
 * caller's request.
 */
async function handleFormAction(c: Context, app: App) {
  const name = c.req.param('name')
  if (name === undefined) {
    return c.json({ success: false, message: 'Automation name required' }, 400)
  }

  const automation = app.automations?.find((a) => a.name === name)
  if (automation === undefined) {
    return c.json({ success: false, message: 'Automation not found' }, 404)
  }

  const body = (await c.req.json().catch(() => ({}))) as { inputData?: Record<string, unknown> }
  const triggerData = { body: body.inputData ?? {} }
  const session = getSessionContext(c)

  const program = dispatchAutomationOnce({
    automation,
    app,
    processEnv: process.env,
    triggerData,
    userId: session?.userId,
  })

  const result = await Effect.runPromise(provideAutomationLive(program))
  if (result === undefined) {
    return c.json({ success: false, message: 'Automation dispatch failed' }, 500)
  }
  return c.json(triggerResultBody(result), 200)
}

/**
 * Translate a replay error into the appropriate HTTP response.
 */
function replayErrorResponse(c: Context, error: ReplayAutomationRunError) {
  if (
    error._tag === 'AutomationNotFound' ||
    error._tag === 'AutomationRunNotFound' ||
    error._tag === 'AutomationRunMismatch'
  ) {
    return c.json({ success: false, message: 'Run not found' }, 404)
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
 * and runs only the previously-skipped tail. APP-AUTOMATION-RETRY-013.
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

  // Body is optional — empty / non-JSON bodies degrade to undefined.
  const body = (await c.req.json().catch(() => undefined)) as
    | { triggerData?: Record<string, unknown> }
    | undefined
  const overrideTriggerData =
    body !== undefined && body.triggerData !== undefined && body.triggerData !== null
      ? (body.triggerData as Record<string, unknown>)
      : undefined

  const program = replayAutomationRun({
    name,
    runId: id,
    app,
    processEnv: process.env,
    ...(overrideTriggerData !== undefined ? { triggerData: overrideTriggerData } : {}),
  })
  const result = await Effect.runPromise(Effect.either(provideAutomationLive(program)))

  if (result._tag === 'Left') {
    return replayErrorResponse(c, result.left)
  }
  return c.json(triggerResultBody(result.right), 200)
}

/**
 * Chain automation routes onto a Hono app.
 *
 * Routes:
 *   GET    /api/automations                       → list automations (secrets redacted)
 *   ANY    /api/automations/:name/webhook         → webhook trigger (handler gates on
 *                                                   trigger.method, returns 405 otherwise)
 *   POST   /api/automations/:name/trigger         → invoke a manual automation
 *   GET    /api/automations/runs                  → list run history
 *   GET    /api/automations/runs/:id              → run detail with steps[] (DEC-021)
 *   GET    /api/automations/:name/runs            → list runs by automation (flat array)
 *   POST   /api/automations/:name/runs/:id/replay → resume a failed run from where it stopped
 *
 * The webhook route is mounted for every supported HTTP method so the
 * handler itself can return 405 + the configured `allowed` list. Hono's
 * `app.on(['GET', 'POST', ...], path, handler)` is the canonical pattern
 * (see `auth-routes.ts:on(['POST', 'GET'], '/api/auth/*', ...)`).
 */
export function chainAutomationRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .get('/api/automations', (c) => handleListAutomations(c, app))
    .on(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], '/api/automations/:name/webhook', (c) =>
      handleWebhookRequest(c, app)
    )
    .post('/api/automations/:name/trigger', (c) => handleManualTrigger(c, app))
    .post('/api/automations/:name/form-action', (c) => handleFormAction(c, app))
    .get('/api/automations/runs', (c) => handleListRuns(c, app))
    .get('/api/automations/runs/:id', (c) => handleGetRunDetail(c, app))
    .get('/api/automations/:name/runs', (c) => handleListRunsByName(c, app))
    .post('/api/automations/:name/runs/:id/replay', (c) => handleReplayRun(c, app))
    .post('/api/automations/runs/:id/replay', (c) => handleReplayRunById(c, app))
    .post('/api/automations/runs/:id/cancel', (c) => handleCancelRun(c, app)) as T
}
