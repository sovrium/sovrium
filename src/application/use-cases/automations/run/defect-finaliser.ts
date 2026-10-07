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
  INTERRUPTED_RUN_ERROR,
  RUN_DEFECT_ERROR,
} from '@/domain/models/app/automations/automation-run-outcome-service'
import { logError } from '@/infrastructure/logging/logger'
import { finaliseRun } from './run-persistence'
import { releaseSlot, unregisterCancellation } from './scheduler'
import type { TriggerData } from '../resolve-trigger-data'
import type { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'

/** What the guard needs to close a run the normal path did not. */
export interface AdmittedRun {
  readonly name: string
  readonly automationId: string
  readonly runId: string
  readonly triggerData: TriggerData
  readonly admittedAt: Date
  readonly userId: string | undefined
  /** Set to `true` by `finaliseAndRelease` once the run's row is finalised. */
  readonly finalised: Ref.Ref<boolean>
}

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
    })
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
