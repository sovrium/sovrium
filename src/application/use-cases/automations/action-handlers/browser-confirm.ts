/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Clock, Effect } from 'effect'
import { AutomationApprovalRepository } from '@/application/ports/repositories/automations/automation-approval-repository'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { BrowserDriver } from '@/application/ports/services/browser-driver'
import { parseDuration } from '@/domain/kernel/time/parse-duration'
import { logError } from '@/infrastructure/logging/logger'
import { insertApprovalRequest, pinRequestApprovers } from './approval'
import { fillValue } from './browser-step-values'
import type { BrowserProgress, BrowserRunScope } from './browser-run-scope'
import type { RawStep } from './browser-step-values'
import type { StepRequirements } from '../run/types'

/**
 * Asking a person before an irreversible click ([internal ref] D9, Q2).
 *
 * The run stops on the filled form: a picture of it is kept, a pending
 * approval request is recorded with the question, and the LIVE browser is held
 * for at most `confirm.timeout` (never past `BROWSER_HOLD_MAX_MS`). An approval
 * resumes the run in the same browser, which clicks; a rejection closes it; no
 * answer in time closes it too and abandons the run. Nothing is submitted
 * unless a person said yes while the browser was still open.
 */

/** How long the browser is held: `confirm.timeout`, never past the operator's limit. */
export const holdMsOf = (confirm: Readonly<Record<string, unknown>>, holdMaxMs: number): number => {
  const { timeout } = confirm
  const asked = typeof timeout === 'string' ? parseDuration(timeout.replace(/\s+/g, '')) : NaN
  return Number.isFinite(asked) && asked > 0 ? Math.min(asked, holdMaxMs) : holdMaxMs
}

/**
 * End a run nobody confirmed in time: its request closed, the run failed with
 * the reason. The browser was already closed by the hold.
 */
export const abandon = (
  runId: string,
  holdMs: number,
  error = `abandoned: nobody answered the confirmation within ${String(holdMs)} ms, so the browser was closed and nothing was submitted`
): Effect.Effect<void, never, AutomationApprovalRepository | AutomationRunRepository> =>
  Effect.gen(function* () {
    const approvals = yield* AutomationApprovalRepository
    const runs = yield* AutomationRunRepository
    const pending = yield* approvals.findPendingIdByRunId(runId)
    const claimed =
      pending === undefined
        ? undefined
        : yield* approvals.resolvePending({ id: pending, status: 'rejected' })
    // Somebody answered first: their answer decides, not the timer.
    if (pending !== undefined && claimed === undefined) return
    yield* runs.finaliseRun({
      id: runId,
      status: 'failed',
      completedAt: new Date(yield* Clock.currentTimeMillis),
      error,
    })
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[browser] the abandoned run could not be recorded', cause))
    ),
    // effect-swallow: logged above; the browser is closed either way and the request's own deadline lets the approval sweep close it.
    Effect.ignoreCause,
    Effect.withSpan('automations.browser-abandon-confirmation')
  )

/** The approvers a `confirm` names, filled in. */
const approversOf = (scope: BrowserRunScope, progress: BrowserProgress, raw: unknown): unknown =>
  Array.isArray(raw)
    ? raw.map((entry) =>
        fillValue(
          { runContext: scope.runContext, stepName: scope.stepName, extracted: progress.extracted },
          entry
        )
      )
    : raw

/**
 * Park the run before the click at `index`: request a person's answer, hold the
 * browser. Answers how long it is held, or a reason it cannot be held.
 */
export const parkForConfirmation = (input: {
  readonly scope: BrowserRunScope
  readonly progress: BrowserProgress
  readonly index: number
  readonly holdMaxMs: number
}): Effect.Effect<
  { readonly holdMs: number } | { readonly refusal: string },
  never,
  StepRequirements
> =>
  Effect.gen(function* () {
    const { scope, progress, index } = input
    const { runId } = scope.automation
    if (runId === undefined) {
      return { refusal: 'the run was not recorded, so it cannot wait for a person to confirm' }
    }
    const step = scope.steps[index] as RawStep
    const confirm = (step['confirm'] ?? {}) as Readonly<Record<string, unknown>>
    const holdMs = holdMsOf(confirm, input.holdMaxMs)
    const message = fillValue(
      { runContext: scope.runContext, stepName: scope.stepName, extracted: progress.extracted },
      confirm['message']
    )
    const now = yield* Clock.currentTimeMillis
    yield* insertApprovalRequest({
      message,
      timeoutSeconds: Math.ceil(holdMs / 1000),
      expiresAt: new Date(now + holdMs),
      runId,
      stepIndex: scope.runContext?.stepIndex ?? 0,
      approvers: yield* pinRequestApprovers(approversOf(scope, progress, confirm['approvers'])),
    })
    const driver = yield* BrowserDriver
    yield* driver.hold({ runId, session: scope.session, holdMs, onExpire: abandon(runId, holdMs) })
    return { holdMs }
  }).pipe(Effect.withSpan('automations.browser-park-for-confirmation'))
