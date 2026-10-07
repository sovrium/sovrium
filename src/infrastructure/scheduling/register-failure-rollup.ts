/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Arm the hourly automation-failure roll-up.
 *
 * At the top of every hour, in the operator's timezone, the failures held back
 * from immediate alerts during the past hour are emailed as one summary
 * (`send-failure-rollup.ts`). Registered on the server's one `CronScheduler`
 * beside the erasure and retention sweeps.
 *
 * No catch-up after a restart, deliberately: every automation in a lost
 * roll-up had its first failure emailed at once, and its next failure starts
 * a new alert. The token-gated `POST /api/internal/notifications/automation-rollup`
 * runs the same job on demand.
 *
 * A cron callback carries no requirements, so the two services the job reads
 * are captured from the registering fiber — the server's domain context — and
 * provided to each tick.
 */

import { Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { sendFailureRollup } from '@/application/use-cases/automations/send-failure-rollup'
import { logError } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import type { EmailSender } from '@/application/ports/services/email-sender'
import type { App } from '@/domain/models/app'

/** Hourly — top of every hour. */
const ROLLUP_CRON_EXPRESSION = '0 * * * *'

/** Stable scheduler job id so re-registration (config reload) is idempotent. */
const ROLLUP_JOB_ID = 'failure-rollup'

export const registerFailureRollupScheduler = (
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
        ROLLUP_CRON_EXPRESSION,
        () =>
          sendFailureRollup(app).pipe(
            Effect.provide(services),
            Effect.tapCause((cause) =>
              Effect.sync(() => logError('[failure-rollup] scheduled roll-up failed', cause))
            ),
            // effect-swallow: logged above; the timer re-arms for the next hour.
            Effect.catchCause(() => Effect.void),
            Effect.asVoid
          ),
        { jobId: ROLLUP_JOB_ID, timezone: resolveOperatorTimezone() }
      )
      .pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError('[failure-rollup] failed to arm roll-up scheduler', err)
            return undefined
          })
        )
      )
  })
