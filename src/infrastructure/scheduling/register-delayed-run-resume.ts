/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resume the runs parked on a long wait once their time has come
 * (`resume-delayed-runs.ts`).
 *
 * Once at start-up, in the background — a run whose time passed while the
 * server was stopped resumes without holding up the listening banner, since
 * its tail can take minutes — then every minute on the server's one
 * `CronScheduler`, beside the approval-expiry sweep. The boot run belongs to the
 * scheduler's scope, so a server that stops mid-sweep interrupts it; the claim
 * on each run is a compare-and-set, so the first tick overlapping it resumes
 * nothing twice. One cadence for every run, no per-run timer: a parked run
 * resumes within about a minute after its `resumeAt`.
 *
 * The token-gated `POST /api/internal/automations/resume-delayed-runs` runs the
 * same sweep on demand.
 *
 * A cron callback carries no requirements, so the services a resumed run needs
 * are captured from the registering fiber, the server's domain context, and
 * provided to each tick.
 *
 * Registered when the app declares a step that may park a run (a `delay/wait`,
 * or a `delay/webhook` with a `timeout`) OR when a run already waits — parked
 * under an earlier configuration that has since dropped its long waits. That
 * run still has to be resumed, which here means cancelled with the reason the
 * use-case gives (the step it waited on is gone). An app with neither has
 * nothing to resume and no reason to query every minute; it pays one indexed
 * probe at boot that stops at the first row. A probe that fails registers the
 * sweep: a minute's wasted query beats a run stranded forever.
 *
 * The decision is re-taken on every configuration change that could alter it,
 * and taken once: `automations` is a restart key (`classify-config-change.ts`),
 * so a save touching any automation stops the server, disposes the scoped
 * `CronScheduler` with its jobs, and boots through here again. The in-place
 * `--watch` swap re-runs no registration, and cannot change the answer — the
 * same automations, and a run can only park under a config that registered.
 */

import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { resumeDelayedRuns } from '@/application/use-cases/automations/resume-delayed-runs'
import { declaresParkingDelay } from '@/domain/models/app/automations/actions/delay/delay-wait-service'
import { logDebug, logError, logInfo } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import type { RunRequirements } from '@/application/use-cases/automations/run/types'
import type { App } from '@/domain/models/app'

/** Every minute. */
const RESUME_CRON_EXPRESSION = '* * * * *'

/** Stable scheduler job id so re-registration (config reload) is idempotent. */
const RESUME_JOB_ID = 'delayed-run-resume'

/** The id the start-up sweep's failures are logged under. */
const BOOT_SWEEP_JOB_ID = 'delayed-run-resume-boot'

/** One sweep, its failure logged and absorbed: the next tick retries. */
const sweepOnce = (
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>,
  when: 'boot' | 'scheduled'
): Effect.Effect<void, never, RunRequirements> =>
  resumeDelayedRuns(app, processEnv).pipe(
    Effect.tap((resumed) =>
      Effect.sync(() => {
        const message = `[delayed-runs] ${when} sweep resumed ${String(resumed.length)} run(s)`
        return resumed.length === 0 ? logDebug(message) : logInfo(message)
      })
    ),
    Effect.tapCause((cause) =>
      Effect.sync(() => logError(`[delayed-runs] ${when} sweep failed`, cause))
    ),
    // effect-swallow: logged above; a failed sweep never fails the boot, and the timer re-arms in a minute.
    Effect.catchCause(() => Effect.void),
    Effect.asVoid
  )

/**
 * Whether a run already waits on a long delay. A failed probe answers `true`:
 * registering a sweep that finds nothing is cheap, missing a parked run is not.
 */
const anyRunWaiting: Effect.Effect<boolean, never, AutomationRunRepository> = Effect.gen(
  function* () {
    const repo = yield* AutomationRunRepository
    return yield* repo.hasWaitingDelayRuns
  }
).pipe(
  Effect.tapCause((cause) =>
    Effect.sync(() => logError('[delayed-runs] could not tell whether a run waits', cause))
  ),
  // effect-swallow: logged above; on doubt the sweep is registered, which costs one query a minute.
  Effect.catchCause(() => Effect.succeed(true))
)

export const registerDelayedRunResumeScheduler = (
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>
): Effect.Effect<string | undefined, never, CronScheduler | RunRequirements> =>
  Effect.gen(function* () {
    if (!declaresParkingDelay(app) && !(yield* anyRunWaiting)) return undefined
    const services = yield* Effect.context<RunRequirements>()
    const scheduler = yield* CronScheduler
    yield* scheduler.runOnce(
      () => sweepOnce(app, processEnv, 'boot').pipe(Effect.provide(services)),
      { jobId: BOOT_SWEEP_JOB_ID }
    )
    return yield* scheduler
      .schedule(
        RESUME_CRON_EXPRESSION,
        () => sweepOnce(app, processEnv, 'scheduled').pipe(Effect.provide(services)),
        { jobId: RESUME_JOB_ID, timezone: resolveOperatorTimezone() }
      )
      .pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError('[delayed-runs] failed to arm the delayed-run resume sweep', err)
            return undefined
          })
        )
      )
  }).pipe(Effect.withSpan('scheduling.register-delayed-run-resume'))
