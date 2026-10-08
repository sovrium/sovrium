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
 * Used by an API automation runs spec, and 007 (replay + cancel) which
 * post to `/api/automations/runs/:id/...` directly.
 */

import { Effect } from 'effect'
import { AutomationApprovalRepository } from '@/application/ports/repositories/automations/automation-approval-repository'
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
import {
  findReadableRun,
  loadRunAccess,
  type ReadableRun,
  type RunAccess,
} from '@/application/use-cases/automations/run-access'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { mayRunManualAutomation } from '@/domain/models/app/automations/manual-trigger-role-service'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { forbidden, notFound, requireSession } from '@/presentation/api/runtime/auth-helpers'
import { isAutomationStoreFailure } from '@/presentation/api/runtime/automation-error-responses'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { toErrorResponse } from '@/presentation/api/runtime/run-effect'
import { resolveApprovalCaller } from './approvals-handlers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/** A gate's verdict: go on with the value, or send the response instead. */
type Gated<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly response: Response }

/**
 * The run `id` when the signed-in caller may read it (an admin, the person who
 * started it by hand, an approver a request on it names). No session → 401; a
 * run they may not read → the same 404 an unknown id gets; a store that did
 * not answer → the sanitized error, never a 404 that would claim absence.
 */
export const gateReadableRun = async (
  c: Context,
  app: App,
  id: string
): Promise<Gated<ReadableRun>> => {
  const auth = requireSession(c)
  if (!auth.ok) return { ok: false, response: auth.response }
  const program = findReadableRun({ runId: id, userId: auth.session.userId, app })
  const found = await runRequestEffect(c, Effect.result(provideDomain(c, program)))
  if (found._tag === 'Failure') return { ok: false, response: toErrorResponse(c, found.failure) }
  if (found.success === undefined) return { ok: false, response: notFound(c, 'Run not found') }
  return { ok: true, value: found.success }
}

/**
 * The run `id` when the signed-in caller may ACT on it — replay or cancel it.
 *
 * Reading a run and acting on it are two gates. An admin acts on every run. The
 * person who started it by hand acts on it while she may still start that
 * automation by hand (`mayRunManualAutomation`): a replay is a new start under
 * her name, so a role she has since lost is not borrowed from the day the run
 * began. An approver a request names reads the run so she can decide on the
 * REQUEST, through approve and reject; she does not act on the run. Every
 * refusal is the 404 an unknown id gets.
 */
export const gateActionableRun = async (
  c: Context,
  app: App,
  id: string
): Promise<Gated<ReadableRun>> => {
  const gate = await gateReadableRun(c, app, id)
  if (!gate.ok || gate.value.readsEveryRun) return gate
  const refused: Gated<ReadableRun> = { ok: false, response: notFound(c, 'Run not found') }
  const starter = handStarterOf(gate.value.run, getSessionContext(c)?.userId)
  // A run with no declared automation behind it — an MCP action template's
  // synthesised one-step run — has no manual trigger to re-check: admin only.
  const automation = app.automations?.find((a) => a.name === gate.value.run.automationName)
  if (starter === undefined || automation === undefined) return refused
  const role = await runRequestEffect(c, Effect.result(provideDomain(c, getUserRole(starter))))
  if (role._tag === 'Failure') return { ok: false, response: toErrorResponse(c, role.failure) }
  return mayRunManualAutomation(automation, app, role.success) ? gate : refused
}

/** The caller's id when she started `run` by hand, `undefined` otherwise. */
const handStarterOf = (run: ReadableRun['run'], userId: string | undefined): string | undefined =>
  userId !== undefined && run.startedByHand && run.triggeredByUserId === userId ? userId : undefined

/**
 * The trigger data a replay body carries, when it carries one — or the refusal
 * when the caller may not supply it.
 *
 * Replaying a run with its OWN payload is acting on the run, so whoever may
 * act on the run may do it. Replaying it with a NEW payload is starting the
 * automation over with input nobody checked: no manual trigger's input schema,
 * no filter or approval the original already passed (a replay skips the steps
 * that ran — an approval granted for 100 EUR would be reused for 100 000). Only
 * a caller who reads every run — an admin — may supply one; anyone else is
 * refused with 403, which discloses nothing: they may read the run.
 */
export const replayTriggerData = (
  c: Context,
  access: ReadableRun,
  body: { readonly triggerData?: unknown } | undefined
): Gated<Record<string, unknown> | undefined> => {
  const supplied =
    body !== undefined && body.triggerData !== undefined && body.triggerData !== null
      ? (body.triggerData as Record<string, unknown>)
      : undefined
  if (supplied !== undefined && !access.readsEveryRun) {
    return {
      ok: false,
      response: forbidden(c, 'Only an admin can replay a run with new trigger data'),
    }
  }
  return { ok: true, value: supplied }
}

/**
 * What the signed-in caller may read, for the run lists. Mounted behind the
 * session gate, so a missing session is answered 401 here too.
 */
export const gateRunAccess = async (c: Context, app: App): Promise<Gated<RunAccess>> => {
  const auth = requireSession(c)
  if (!auth.ok) return { ok: false, response: auth.response }
  const program = loadRunAccess({ userId: auth.session.userId, app })
  const loaded = await runRequestEffect(c, Effect.result(provideDomain(c, program)))
  if (loaded._tag === 'Failure') return { ok: false, response: toErrorResponse(c, loaded.failure) }
  return { ok: true, value: loaded.success }
}

/**
 * Translate a replay error into the appropriate HTTP response. Mirrors
 * the identical helper inside `./index.ts`; kept here so the name-less
 * handler can self-contain its error mapping.
 */
const replayErrorResponse = (c: Context, error: ReplayAutomationRunError) => {
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
 * Handle POST /api/automations/runs/:id/replay
 *
 * Name-less variant of the replay endpoint. Resolves the automation name
 * from the persisted run row, then delegates to the same replay flow as
 * the `:name`-bearing endpoint.
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

  const gate = await gateActionableRun(c, app, id)
  if (!gate.ok) return gate.response
  const name = gate.value.run.automationName

  const body = (await c.req.json().catch(() => undefined)) as
    { triggerData?: unknown; fromStep?: string } | undefined
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
  // RUNS-005/006 contract: surface both `id` and `runId` plus `status: 'accepted'`.
  return c.json(
    {
      id: result.success.runId,
      runId: result.success.runId,
      status: 'accepted',
    },
    200
  )
}

/**
 * The statuses a run can still be cancelled from: it waits for a slot, runs,
 * or waits for an approval (`pending` and `retrying` are never written by the
 * engine; a client that reads one may still cancel it). Every other status is
 * an ended run.
 */
const CANCELLABLE_RUN_STATUSES: ReadonlySet<string> = new Set([
  'queued',
  'running',
  'waiting-approval',
  'waiting-delay',
  'pending',
  'retrying',
])

/**
 * Handle POST /api/automations/runs/:id/cancel
 *
 * Mark a run as `'cancelled'` in `system.automation_runs` AND fire the
 * in-memory AbortController so the run loop's post-loop finaliser sees
 * the cancellation flag and forces the terminal status to `'cancelled'`
 * (regardless of whatever the action loop produced before the abort).
 *
 * Two-pronged update keeps the contract robust:
 *   1. DB row updated synchronously so a follow-up `GET /runs/:id` reads
 *      `'cancelled'` immediately.
 *   2. Scheduler controller aborted so a long-running action's finaliser
 *      cannot race the cancel and overwrite the row back to `'completed'`.
 *
 * A run that already ended — completed, failed, rejected, stopped by a filter,
 * timed out, or cancelled before — is not cancelled: 409, saying so, and the
 * row keeps its status. Replay is the road for a finished run. A run that
 * waits for an approval has its pending request rejected FIRST, so the
 * approver no longer finds it and a later answer resumes nothing. A run that
 * waits on a long delay is cancelled only while it still waits — a write
 * conditional on `waiting-delay`, so a cancel racing its resume ends in exactly
 * one of the two; a cancel that lost the race cancels the resumed, running run.
 */
export async function handleCancelRun(c: Context, app: App) {
  const id = c.req.param('id')
  if (id === undefined) {
    return c.json({ success: false, message: 'Run id required' }, 400)
  }
  // BEFORE the abort: a caller who may not act on the run must not stop it.
  const gate = await gateActionableRun(c, app, id)
  if (!gate.ok) return gate.response
  const current = gate.value.run.status
  if (!CANCELLABLE_RUN_STATUSES.has(current)) {
    return c.json({ success: false, message: `Run already ${current}`, status: current }, 409)
  }

  // Fire the in-memory abort first so any concurrent finaliser sees the
  // flag before it updates the row. `signalCancellation` is a no-op when
  // no controller is registered (i.e. the run already terminated). We
  // ignore the boolean return — a missing controller is normal for runs
  // that already completed; the DB UPDATE below is the durable signal.
  signalCancellation(id)

  const program = Effect.gen(function* () {
    const approvals = yield* AutomationApprovalRepository
    const pendingId = yield* approvals.findPendingIdByRunId(id)
    if (pendingId !== undefined) {
      yield* approvals.resolvePending({ id: pendingId, status: 'rejected' })
    }
    const repo = yield* AutomationRunRepository
    if (
      current === 'waiting-delay' &&
      (yield* repo.cancelWaitingRun({ id, error: 'Run cancelled' }))
    ) {
      return yield* repo.findById(id)
    }
    // A run resumed meanwhile has registered its canceller: abort it too.
    signalCancellation(id)
    return yield* repo.updateStatus({ id, status: 'cancelled' })
  })
  const result = await runRequestEffect(c, Effect.result(provideDomain(c, program)))
  // A store that did not answer is not a run that does not exist (E5).
  if (result._tag === 'Failure') return toErrorResponse(c, result.failure)
  if (result.success === undefined) return notFound(c, 'Run not found')
  return c.json({ id, status: 'cancelled' }, 200)
}

/**
 * Translate an approval-resolution error into the appropriate HTTP response.
 * A missing approval / run / automation, or a `runId` that does not match the
 * approval's link, surfaces as 404 (no enumeration); an already-resolved
 * request surfaces as 409 so a double-approve is observable.
 */
const resolveApprovalErrorResponse = (c: Context, error: ResolveApprovalError) => {
  // Checked ahead of the catch-all 404: this ladder's fallback is "not found",
  // so a repository failure reaching it would be reported as a missing approval.
  if (isAutomationStoreFailure(error)) return toErrorResponse(c, error)
  if (error._tag === 'AutomationRegistrySeedError') {
    return c.json({ success: false, message: 'Failed to register automation in the database' }, 500)
  }
  if (error._tag === 'ApprovalAlreadyResolved') {
    return c.json(
      { success: false, message: `Approval already ${error.status}`, status: error.status },
      409
    )
  }
  return notFound(c, 'Approval not found')
}

/**
 * Handle POST /api/automations/runs/:runId/approvals/:approvalId/{approve,reject}
 *
 * Run-scoped resolution of a paused approval. Approving resumes the
 * run (its downstream actions execute); rejecting terminates it (the remaining
 * actions never run).
 *
 * WHO MAY RESOLVE (THE NAMED-APPROVER RULE, superseding the approval-pause design's capability-token posture):
 *   - No session → the canonical 401, before anything is read. This holds for an
 *     app with no `app.auth` too: nobody can be an approver there.
 *   - A signed-in caller the request does not name (`all-admins` → an
 *     admin-tier role; a list → the caller's email ignoring case, or their
 *     role) → the SAME 404 an unknown id gets, checked before the status so a
 *     closed request is not confirmed by a 409.
 *   - An approver resolving a closed request → 409 with its status.
 *   The run stays `waiting-approval` after every refusal.
 */
export async function handleResolveApproval(c: Context, app: App, decision: 'approve' | 'reject') {
  const runId = c.req.param('runId')
  const approvalId = c.req.param('approvalId')
  if (runId === undefined || approvalId === undefined) {
    return c.json({ success: false, message: 'Run id and approval id required' }, 400)
  }

  const resolved = await resolveApprovalCaller(c)
  if (!resolved.ok) return resolved.response

  const program = resolveAutomationApproval({
    runId,
    approvalId,
    decision,
    app,
    processEnv: process.env,
    caller: resolved.caller,
  })
  const result = await runRequestEffect(c, Effect.result(provideDomain(c, program)))
  if (result._tag === 'Failure') {
    return resolveApprovalErrorResponse(c, result.failure)
  }
  return c.json({ success: true, runId, approvalId, status: result.success.decision }, 200)
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
