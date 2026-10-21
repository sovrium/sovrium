/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The guard that keeps an admitted run from being left `running` for good.
 *
 * Once the scheduler admits a run it holds a concurrency slot, a registered
 * canceller, and a row marked `running`; the normal path hands all three back in
 * `finaliseAndRelease`. A defect (an action handler that throws instead of
 * failing, a bug in the engine) or an interruption skips that path, and before
 * this guard the row stayed `running`, the slot was never released — so a
 * `concurrency: 1` automation queued every later run forever — and the
 * canceller leaked.
 *
 * The guard runs on EVERY exit of the admitted part of the run and does nothing
 * when the normal path already finalised it: `finaliseAndRelease` sets the
 * `finalised` flag, so a completed run is never finalised twice.
 */

import { Cause, Effect, Exit, Ref } from 'effect'
import {
  AutomationRunRepository,
  type RunDefect,
} from '@/application/ports/repositories/automations/automation-run-repository'
import { operatorFixOf } from '@/domain/errors/operator-fixable-error'
import {
  INTERRUPTED_RUN_ERROR,
  RUN_DEFECT_ERROR,
} from '@/domain/models/app/automations/automation-run-outcome-service'
import { describeKeptFailure } from '@/infrastructure/logging/internal-error-report'
import { logError } from '@/infrastructure/logging/logger'
import { finaliseRun } from './run-persistence'
import { releaseSlot, unregisterCancellation } from './scheduler'
import type { TriggerData } from '../resolve-trigger-data'

/** What the guard needs to close a run the normal path did not. */
export interface AdmittedRun {
  readonly name: string
  readonly automationId: string
  readonly runId: string
  readonly triggerData: TriggerData
  readonly admittedAt: Date
  readonly userId: string | undefined
  /** A person started the run by hand: a fallback row keeps the marker. */
  readonly startedByHand?: boolean
  readonly startedAsGuest?: boolean
  /** Set to `true` by `finaliseAndRelease` once the run's row is finalised. */
  readonly finalised: Ref.Ref<boolean>
}

/**
 * What the bug report a run abandoned on an internal error offers: the error's
 * class, its signature and its scrubbed in-repository frames. The message is
 * not kept — it can quote a value the trigger sent. A cause the operator can
 * fix (their database, their environment) is no defect of the engine, so none
 * is recorded and the run offers no report.
 */
const defectOf = (error: unknown): RunDefect | undefined => {
  if (operatorFixOf(error) !== undefined) return undefined
  const { errorClass, signature, frames } = describeKeptFailure(error)
  return frames === '' ? { errorClass, signature } : { errorClass, signature, frames }
}

/**
 * Keep the defect on the run's row. Logged and swallowed: the run is already
 * closed as failed, and a missing defect only costs its page the report title.
 */
const recordDefect = (
  runId: string,
  defect: RunDefect
): Effect.Effect<void, never, AutomationRunRepository> =>
  AutomationRunRepository.use((repo) => repo.recordDefect(runId, defect)).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError(`[automation] could not record the defect of run ${runId}`, cause))
    ),
    // effect-swallow: stated above — the run is closed either way; the defect only titles its report.
    Effect.ignore
  )

/** Close an abandoned run as `failed`, then give back its slot and its canceller. */
const closeAbandonedRun = (
  run: AdmittedRun,
  cause: Cause.Cause<unknown>
): Effect.Effect<void, never, AutomationRunRepository> =>
  Effect.gen(function* () {
    // E6: the cause is logged BEFORE the run is closed over it — nothing below
    // carries it any further.
    // An interruption is not an internal error: it is the server stopping the
    // run (a shutdown that could not wait for it — the chained-run shutdown and cross-automation cycle rule), and the row says so.
    const interrupted = Cause.hasInterruptsOnly(cause)
    const defect = interrupted ? undefined : defectOf(Cause.squash(cause))
    logError(
      interrupted
        ? `[automation] run ${run.runId} of "${run.name}" was interrupted; closing it as stopped`
        : `[automation] run ${run.runId} of "${run.name}" stopped with an internal error; closing it as failed`,
      Cause.squash(cause)
    )
    yield* finaliseRun({
      runId: run.runId,
      automationId: run.automationId,
      engineStatus: 'failure',
      engineError: interrupted ? INTERRUPTED_RUN_ERROR : RUN_DEFECT_ERROR,
      triggerData: run.triggerData,
      startedAt: run.admittedAt,
      finishedAt: new Date(),
      steps: [],
      userId: run.userId,
      ...(run.startedByHand === true ? { startedByHand: true } : {}),
      ...(run.startedAsGuest === true ? { startedAsGuest: true } : {}),
    })
    if (defect !== undefined) yield* recordDefect(run.runId, defect)
    releaseSlot(run.name)
    unregisterCancellation(run.runId)
  })

/**
 * Run the admitted part of a run so that, whatever way it exits, the run ends
 * finalised with its slot and canceller released. A defect or an interruption
 * still propagates to the caller unchanged: the guard closes the run, it does
 * not hide why it stopped.
 */
export const finaliseOnAbandon = <A, R>(
  program: Effect.Effect<A, never, R>,
  run: AdmittedRun
): Effect.Effect<A, never, R | AutomationRunRepository> =>
  program.pipe(
    Effect.onExit((exit) =>
      Exit.isSuccess(exit)
        ? Effect.void
        : Ref.get(run.finalised).pipe(
            Effect.flatMap((finalised) =>
              finalised ? Effect.void : closeAbandonedRun(run, exit.cause)
            )
          )
    ),
    Effect.withSpan('automations.finalise-on-abandon')
  )
