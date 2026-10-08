/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resume the runs parked on a long wait whose time has come.
 *
 * A wait longer than a minute parks its run as `waiting-delay` with a resume
 * time (`action-handlers/delay.ts`). This sweep finds the parked runs that are
 * due — oldest first, at most {@link RESUME_BATCH} per sweep, so a backlog
 * after a long stop drains over successive sweeps — and resumes each:
 *
 *   1. it CLAIMS the run with a compare-and-set (`waiting-delay` → `running`),
 *      so two sweeps, a sweep and a boot, or a sweep and a cancel never resume
 *      it twice — a run another caller claimed is skipped;
 *   2. it plans the resume against the CURRENT configuration (`run/resume-plan.ts`):
 *      an automation, or a step it paused on, that is gone cancels the run,
 *      saying it changed while it waited;
 *   3. it runs the rest of the run in the run's own row (`run/resume-segment.ts`).
 *
 * A run whose automation is operationally paused is left waiting until it is
 * resumed. Runs at boot and every minute (`register-delayed-run-resume.ts`), and
 * on demand through the token-gated
 * `POST /api/internal/automations/resume-delayed-runs`.
 */

import { Clock, Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import { parseResumeCursor } from '@/domain/models/app/automations/run-resume-cursor-service'
import { logError } from '@/infrastructure/logging/logger'
import { defaultActionHandlers } from './action-handlers'
import { expandRefActions, type ActionTemplateLike } from './expand-action-refs'
import { loadPausedAutomationNames } from './paused-automation-names'
import { planResume } from './run/resume-plan'
import { runResumedSegment } from './run/resume-segment'
import {
  isCancelled,
  registerCancellationIfAbsent,
  unregisterCancellationOf,
} from './run/scheduler'
import type { RunRequirements } from './run/types'
import type { AutomationRunDatabaseError } from '@/application/ports/repositories/automations/automation-run-repository'
import type { App } from '@/domain/models/app'

/** The most runs one sweep resumes. */
export const RESUME_BATCH = 25

type Automation = NonNullable<App['automations']>[number]

/** The automation's actions with their `$ref` templates expanded, as a run executes them. */
const actionsOf = (app: App, automation: Automation): readonly Record<string, unknown>[] =>
  expandRefActions(
    automation.actions as readonly unknown[] as readonly Record<string, unknown>[],
    (app.actions ?? []) as readonly unknown[] as ReadonlyArray<ActionTemplateLike>
  ) as readonly Record<string, unknown>[]

/** End a claimed run as cancelled, saying why, without running anything. */
const cancelClaimed = (runId: string, error: string, now: Readonly<Date>) =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    yield* repo.finaliseRun({ id: runId, status: 'cancelled', error, completedAt: now as Date })
  })

type ResumeInput = {
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly runId: string
  readonly now: Date
}

/** Why a claimed run is cancelled before it runs anything, or `undefined`. */
const refusalBeforeStart = (
  automation: Automation | undefined,
  cursor: unknown,
  runId: string
): string | undefined => {
  if (automation === undefined) {
    return 'The automation changed while the run was waiting: it no longer exists.'
  }
  if (cursor === undefined) return 'The run could not read where it paused.'
  return isCancelled(runId) ? 'Run cancelled' : undefined
}

/**
 * Claim one due run and resume it. Answers its id once this call claimed it —
 * whether it then ran or was cancelled — or `undefined` when another caller
 * had claimed it, it was cancelled, or its time had not come.
 */
const claimAndResume = (
  input: ResumeInput
): Effect.Effect<string | undefined, AutomationRunDatabaseError, RunRequirements> =>
  Effect.gen(function* () {
    const { app, runId, now } = input
    const repo = yield* AutomationRunRepository
    const claimed = yield* repo.claimDelayedRun({ id: runId, now })
    if (claimed === undefined) return undefined
    const automation = app.automations?.find((a) => a.name === claimed.run.automationName)
    const cursor = parseResumeCursor(claimed.cursor)
    const refusal = refusalBeforeStart(automation, cursor, runId)
    if (automation === undefined || cursor === undefined || refusal !== undefined) {
      yield* cancelClaimed(runId, refusal ?? 'Run cancelled', now)
      return runId
    }
    const steps = yield* repo.findStepsByRunId(runId)
    const actions = actionsOf(app, automation)
    const plan = planResume({ actions, cursor, steps, resumedAt: now.toISOString() })
    if (plan.kind === 'cancel') {
      yield* cancelClaimed(runId, plan.error, now)
      return runId
    }
    yield* runResumedSegment({
      app,
      processEnv: input.processEnv,
      handlers: defaultActionHandlers,
      automation,
      automationId: claimed.run.automationId,
      run: claimed.run,
      segment: plan.segment,
    })
    return runId
  })

/**
 * Claim and resume one due run. Its canceller is registered BEFORE the claim,
 * so a cancel that loses the claim's compare-and-set still aborts it; a run
 * another caller in this process already holds is skipped.
 */
const resumeDelayedRun = (input: ResumeInput) =>
  Effect.gen(function* () {
    const controller = registerCancellationIfAbsent(input.runId)
    if (controller === undefined) return undefined
    return yield* claimAndResume(input).pipe(
      Effect.ensuring(Effect.sync(() => unregisterCancellationOf(input.runId, controller)))
    )
  }).pipe(
    Effect.withSpan('automations.resume-delayed-run', {
      attributes: { 'automation.run_id': input.runId },
    })
  )

/** One run's resume, its failure logged and absorbed so the sweep goes on. */
const resumeLogged = (input: ResumeInput) =>
  resumeDelayedRun(input).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError(`[delayed-runs] resuming run ${input.runId} failed`, cause))
    ),
    // effect-swallow: logged above; one run that cannot resume must not hold back the others, and the stuck-run sweep closes a run left running.
    Effect.catchCause(() => Effect.void)
  )

/**
 * Resume every parked run whose time has come, up to {@link RESUME_BATCH}.
 * Answers the ids of the runs this sweep claimed.
 */
export const resumeDelayedRuns = (
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>
): Effect.Effect<readonly string[], AutomationRunDatabaseError, RunRequirements> =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const now = new Date(yield* Clock.currentTimeMillis)
    const pausedNames = yield* loadPausedAutomationNames
    // Filtered in the query, not after it: paused runs left in a batch of the
    // oldest would fill it on every sweep and starve every other automation.
    const exceptAutomations = (app.automations ?? [])
      .filter((automation) => !isAutomationOperationallyEnabled(automation, pausedNames))
      .map((automation) => automation.name)
    const due = yield* repo.listDueDelayedRuns({ now, limit: RESUME_BATCH, exceptAutomations })
    const resumed = yield* Effect.forEach(due, (run) =>
      resumeLogged({ app, processEnv, runId: run.id, now })
    )
    return resumed.filter((id): id is string => typeof id === 'string')
  }).pipe(Effect.withSpan('automations.resume-delayed-runs'))
