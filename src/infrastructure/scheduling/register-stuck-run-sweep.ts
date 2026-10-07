/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Arm the stuck-run sweep.
 *
 * Every five minutes, the runs still `running` a minute past their timeout are
 * closed as `timed-out` and alerted (`sweep-stuck-runs.ts`). Registered on the
 * server's one `CronScheduler` beside the failure roll-up, in the operator's
 * timezone like every other platform job — for a five-minute cadence the zone
 * changes nothing, but one rule for all of them is easier to read than an
 * exception.
 *
 * The token-gated `POST /api/internal/automations/reap-interrupted` runs the
 * same sweep on demand, after the interrupted-run reaper.
 *
 * A cron callback carries no requirements, so the two services the job reads
 * are captured from the registering fiber — the server's domain context — and
 * provided to each tick.
 */

import { Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { sweepStuckRuns } from '@/application/use-cases/automations/sweep-stuck-runs'
import { logError } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import type { EmailSender } from '@/application/ports/services/email-sender'
import type { App } from '@/domain/models/app'

/** Every five minutes. */
const SWEEP_CRON_EXPRESSION = '*/5 * * * *'

/** Stable scheduler job id so re-registration (config reload) is idempotent. */
const SWEEP_JOB_ID = 'stuck-run-sweep'

export const registerStuckRunSweepScheduler = (
  app: App
): Effect.Effect<
  string | undefined,
  never,
  CronScheduler | AutomationRunOutcomeRepository | AuthRepository | EmailSender
> =>
  Effect.gen(function* () {
    const services = yield* Effect.context<
      AutomationRunOutcomeRepository | AuthRepository | EmailSender
    >()
    const scheduler = yield* CronScheduler
    return yield* scheduler
      .schedule(
        SWEEP_CRON_EXPRESSION,
        () =>
          sweepStuckRuns(app).pipe(
            Effect.provide(services),
            Effect.tapCause((cause) =>
              Effect.sync(() => logError('[stuck-run-sweep] scheduled sweep failed', cause))
            ),
            // effect-swallow: logged above; the timer re-arms in five minutes.
            Effect.catchCause(() => Effect.void),
            Effect.asVoid
          ),
        { jobId: SWEEP_JOB_ID, timezone: resolveOperatorTimezone() }
      )
      .pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError('[stuck-run-sweep] failed to arm the stuck-run sweep', err)
            return undefined
          })
        )
      )
  })
