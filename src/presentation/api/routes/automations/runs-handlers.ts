/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Name-less variants of the runs-by-id endpoints (replay + cancel).
 *
 * Extracted from `./index.ts` so the route-chaining module stays within
 * its `max-lines` cap. The "name-less" qualifier means these endpoints
 * derive the automation name from the persisted run row (looking it up
 * by id), rather than receiving the name as a URL path parameter — the
 * sibling `:name/runs/:id/replay` route in `./index.ts` is the name-bearing
 * counterpart.
 *
 * Used by [internal ref], and 007 (replay + cancel) which
 * post to `/api/automations/runs/:id/...` directly.
 */

import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import {
  replayAutomationRun,
  type ReplayAutomationRunError,
} from '@/application/use-cases/automations/replay-automation-run'
import {
  resolveAutomationApproval,
  type ResolveApprovalError,
} from '@/application/use-cases/automations/resolve-automation-approval'
import { signalCancellation } from '@/application/use-cases/automations/run/scheduler'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { provideAutomationLive } from './effect-runner'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Effect program that loads the run + its steps from the DB-backed
 * repository. Duplicated minimally from `index.ts::loadDbRunDetail` so
 * this module remains a leaf import (no cycle back to `index.ts`).
 */
const loadRunForReplay = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const run = yield* repo.findById(id)
    return run
  })

/**
 * Translate a replay error into the appropriate HTTP response. Mirrors
 * the identical helper inside `./index.ts`; kept here so the name-less
 * handler can self-contain its error mapping.
 */
const replayErrorResponse = (c: Context, error: ReplayAutomationRunError) => {
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
 * Handle POST /api/automations/runs/:id/replay
 *
 * Name-less variant of the replay endpoint. Resolves the automation name
 * from the persisted run row, then delegates to the same replay flow as
 * the `:name`-bearing endpoint. [internal ref].
 *
 * Response shape includes both `id` and `runId` so callers can use either
 * field. `status: 'accepted'` indicates the replay was queued (the
 * underlying run may have already completed synchronously by the time the
 * response is sent; `'accepted'` is purely a "the replay command was
 * honoured" signal).
 */
export async function handleReplayRunById(c: Context, app: App) {
  const id = c.req.param('id')
  if (id === undefined) {
    return c.json({ success: false, message: 'Run id required' }, 400)
  }

  const lookup = await runRequestEffect(
    c,
    Effect.either(provideAutomationLive(loadRunForReplay(id)))
  )
  if (lookup._tag === 'Left' || lookup.right === undefined) {
    return c.json({ success: false, message: 'Run not found' }, 404)
  }
  const name = lookup.right.automationName

  const body = (await c.req.json().catch(() => undefined)) as
    { triggerData?: Record<string, unknown>; fromStep?: string } | undefined
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
  const result = await runRequestEffect(c, Effect.either(provideAutomationLive(program)))

  if (result._tag === 'Left') {
    return replayErrorResponse(c, result.left)
  }
  // RUNS-005/006 contract: surface both `id` and `runId` plus `status: 'accepted'`.
  return c.json(
    {
      id: result.right.runId,
      runId: result.right.runId,
      status: 'accepted',
    },
    200
  )
}

/**
 * Handle POST /api/automations/runs/:id/cancel
 *
 * Mark a run as `'cancelled'` in `system.automation_runs` AND fire the
 * in-memory AbortController so the run loop's post-loop finaliser sees
 * the cancellation flag and forces the terminal status to `'cancelled'`
 * (regardless of whatever the action loop produced before the abort).
 * [internal ref].
 *
 * Two-pronged update keeps the contract robust:
 *   1. DB row updated synchronously so a follow-up `GET /runs/:id` reads
 *      `'cancelled'` immediately.
 *   2. Scheduler controller aborted so a long-running action's finaliser
 *      cannot race the cancel and overwrite the row back to `'completed'`.
 */
export async function handleCancelRun(c: Context, _app: App) {
  const id = c.req.param('id')
  if (id === undefined) {
    return c.json({ success: false, message: 'Run id required' }, 400)
  }

  // Fire the in-memory abort first so any concurrent finaliser sees the
  // flag before it updates the row. `signalCancellation` is a no-op when
  // no controller is registered (i.e. the run already terminated). We
  // ignore the boolean return — a missing controller is normal for runs
  // that already completed; the DB UPDATE below is the durable signal.
  // eslint-disable-next-line functional/no-expression-statements -- presentation-layer side-effect dispatch into the scheduler registry
  signalCancellation(id)

  const program = Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    return yield* repo.updateStatus({ id, status: 'cancelled' })
  })
  const result = await runRequestEffect(c, Effect.either(provideAutomationLive(program)))
  if (result._tag === 'Left' || result.right === undefined) {
    return c.json({ success: false, message: 'Run not found' }, 404)
  }
  return c.json({ id, status: 'cancelled' }, 200)
}

/**
 * Translate an approval-resolution error into the appropriate HTTP response.
 * A missing approval / run / automation, or a `runId` that does not match the
 * approval's link, surfaces as 404 (no enumeration); an already-resolved
 * request surfaces as 409 so a double-approve is observable.
 */
const resolveApprovalErrorResponse = (c: Context, error: ResolveApprovalError) => {
  if (error._tag === 'ApprovalAlreadyResolved') {
    return c.json(
      { success: false, message: `Approval already ${error.status}`, status: error.status },
      409
    )
  }
  return c.json({ success: false, message: 'Approval not found' }, 404)
}

/**
 * Handle POST /api/automations/runs/:runId/approvals/:approvalId/{approve,reject}
 *
 * Run-scoped resolution of a paused approval. Approving resumes the
 * run (its downstream actions execute); rejecting terminates it (the remaining
 * actions never run).
 *
 * AUTH POSTURE (capability-token model — matches the sibling `/runs/:id/cancel`
 * and `/runs/:id/replay` endpoints):
 *   - Resolution requires BOTH the `runId` AND the `approvalId`, and the two
 *     must link (the approval row's `run_id` must equal `runId`, else 404). Both
 *     are `gen_random_uuid()` v4 UUIDs (~122 bits each) — not enumerable, not
 *     sequential. They are the de-facto access tokens; no extra session gate is
 *     layered on top here. The `/api/automations/*` middleware extracts the
 *     session into context (when `app.auth` is configured) but intentionally
 *     does NOT `requireAuth()` on the wildcard — webhook triggers under the same
 *     prefix must stay anonymous-friendly.
 *   - Non-leak invariant the token model relies on: the `approvalId` is NEVER
 *     surfaced to an unprivileged HTTP surface. The `approval/request` handler's
 *     step `output` is `{ status: 'pending', timeout?, onTimeout? }` (no id);
 *     the webhook/manual response surfaces `status: 'waiting-approval'` (no id);
 *     the runs GET API surfaces `triggerData` + step output (no id); and the
 *     agent-approvals GET API reads a separate in-memory store filtered by
 *     `agentName`, so DB-only automation-step rows (`agent_name` null) are
 *     invisible there. An approver obtains the id out-of-band (e.g. the approval
 * notification), exactly as the [internal ref] RESUME contract assumes.
 *   - RESIDUAL RISK (platform-wide S5, NOT specific to this feature): when an
 *     app has no `app.auth` configured, the entire `/api/automations/*` surface
 *     — these endpoints, cancel, replay, the runs read API — is fully anonymous.
 *     The capability-token model is the only barrier in that configuration.
 * Tightening it to a mandatory admin session would EXCEED the locked [internal ref]
 *     spec (which authenticates the caller but asserts no gate); flagged for the
 *     main planner rather than changed unilaterally.
 */
export async function handleResolveApproval(c: Context, app: App, decision: 'approve' | 'reject') {
  const runId = c.req.param('runId')
  const approvalId = c.req.param('approvalId')
  if (runId === undefined || approvalId === undefined) {
    return c.json({ success: false, message: 'Run id and approval id required' }, 400)
  }

  const program = resolveAutomationApproval({
    runId,
    approvalId,
    decision,
    app,
    processEnv: process.env,
  })
  const result = await runRequestEffect(c, Effect.either(provideAutomationLive(program)))
  if (result._tag === 'Left') {
    return resolveApprovalErrorResponse(c, result.left)
  }
  return c.json({ success: true, runId, approvalId, status: result.right.decision }, 200)
}

/**
 * Register the name-less run-control endpoints onto a Hono app: replay/cancel
 * by id plus the run-scoped approval-resolution endpoints. Grouped
 * here (rather than inline in `index.ts`) so the route-chaining module stays
 * under its `max-lines` cap.
 */
export function chainRunControlRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .post('/api/automations/runs/:id/replay', (c) => handleReplayRunById(c, app))
    .post('/api/automations/runs/:id/cancel', (c) => handleCancelRun(c, app))
    .post('/api/automations/runs/:runId/approvals/:approvalId/approve', (c) =>
      handleResolveApproval(c, app, 'approve')
    )
    .post('/api/automations/runs/:runId/approvals/:approvalId/reject', (c) =>
      handleResolveApproval(c, app, 'reject')
    ) as T
}
