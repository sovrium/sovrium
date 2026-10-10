/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Settling the confirmation a `browser/run` asked for before an irreversible
 * click ([internal ref] D9, Q2).
 *
 * Unlike an `approval/request` step — which already ran, so its run resumes
 * AFTER it — a browser step paused in its middle, with the live browser held
 * on the filled form. So its run resumes IN ITS OWN ROW, re-entering the
 * browser step itself (`run/resume-segment.ts`), which takes the held browser
 * back and clicks. A rejection closes the held browser and ends the run;
 * nothing is submitted.
 */

import { Clock, Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { BrowserDriver } from '@/application/ports/services/browser-driver'
import { defaultActionHandlers } from './action-handlers'
import { expandRefActions, type ActionTemplateLike } from './expand-action-refs'
import { planConfirmationResume } from './run/resume-plan'
import { runResumedSegment } from './run/resume-segment'
import { registerCancellationIfAbsent, unregisterCancellationOf } from './run/scheduler'
import type {
  ApprovalRunTarget,
  ResolveApprovalError,
  ResolveApprovalResult,
  ResolveRequirements,
} from './resolve-automation-approval'
import type { App } from '@/domain/models/app'

/** Why a rejected run ended: a browser agent's submission, or a `browser/run` confirmation. */
const rejectionOf = (target: Pick<ApprovalRunTarget, 'automation' | 'stepIndex'>): string =>
  (target.automation.actions[target.stepIndex] as { readonly operator?: unknown } | undefined)
    ?.operator === 'agent'
    ? 'submission_rejected: a person rejected the submission, so the browser was closed and nothing was sent.'
    : 'The confirmation was rejected, so the browser was closed and nothing was submitted.'

/** Whether the paused step is a browser step that asked before its click. */
export const isBrowserConfirmation = (
  target: Pick<ApprovalRunTarget, 'automation' | 'stepIndex'>
): boolean =>
  (target.automation.actions[target.stepIndex] as { readonly type?: unknown } | undefined)?.type ===
  'browser'

const actionsOf = (app: App, target: ApprovalRunTarget): readonly Record<string, unknown>[] =>
  expandRefActions(
    target.automation.actions as readonly unknown[] as readonly Record<string, unknown>[],
    (app.actions ?? []) as readonly unknown[] as ReadonlyArray<ActionTemplateLike>
  ) as readonly Record<string, unknown>[]

/** Resume the paused run in its own row, from the browser step. */
const resumeApproved = (input: {
  readonly runId: string
  readonly target: ApprovalRunTarget
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
}) =>
  Effect.gen(function* () {
    const runs = yield* AutomationRunRepository
    const run = yield* runs.updateStatus({ id: input.runId, status: 'running' })
    if (run === undefined) return
    const now = new Date(yield* Clock.currentTimeMillis)
    const plan = planConfirmationResume({
      actions: actionsOf(input.app, input.target),
      steps: yield* runs.findStepsByRunId(input.runId),
      stepIndex: input.target.stepIndex,
      resumedAt: now.toISOString(),
    })
    if (plan.kind === 'cancel') {
      yield* runs.finaliseRun({
        id: input.runId,
        status: 'cancelled',
        error: plan.error,
        completedAt: now,
      })
      return
    }
    yield* runResumedSegment({
      app: input.app,
      processEnv: input.processEnv,
      handlers: defaultActionHandlers,
      automation: input.target.automation,
      automationId: run.automationId,
      run,
      segment: plan.segment,
    })
  })

/**
 * Settle a browser step's confirmation already claimed as `decision`: resume
 * the run on approval, or close the held browser and end the run.
 */
export const settleBrowserConfirmation = (input: {
  readonly runId: string
  readonly approvalId: string
  readonly target: ApprovalRunTarget
  readonly decision: 'approved' | 'rejected'
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
}): Effect.Effect<ResolveApprovalResult, ResolveApprovalError, ResolveRequirements> =>
  Effect.gen(function* () {
    const { runId, approvalId, decision } = input
    if (decision === 'rejected') {
      const driver = yield* BrowserDriver
      yield* driver.releaseHeld(runId)
      const runs = yield* AutomationRunRepository
      yield* runs.finaliseRun({
        id: runId,
        status: 'rejected',
        error: rejectionOf(input.target),
        completedAt: new Date(yield* Clock.currentTimeMillis),
      })
      return { decision, runId, approvalId }
    }
    const controller = registerCancellationIfAbsent(runId)
    const driver = yield* BrowserDriver
    yield* resumeApproved(input).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          if (controller !== undefined) unregisterCancellationOf(runId, controller)
        })
      ),
      // The resumed step takes the held browser back; a resume that never
      // reached it (the run was already settled, the automation changed, a
      // failure on the way) closes it here instead of leaving the filled form
      // open, and the next run waiting for its turn, until the hold runs out.
      Effect.ensuring(driver.releaseHeld(runId))
    )
    return { decision, runId, approvalId }
  }).pipe(Effect.withSpan('automations.settle-browser-confirmation'))
