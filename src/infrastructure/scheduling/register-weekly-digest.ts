/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Arm the weekly summary email, and run
 * its boot catch-up.
 *
 * The summary goes out on `SOVRIUM_NOTIFY_DIGEST_CRON` (default Mondays at
 * 08:00), read in the operator's timezone, on the server's one `CronScheduler`
 * beside the erasure, retention and roll-up sweeps. With
 * `SOVRIUM_NOTIFY_DIGEST=off` nothing is armed and nothing is caught up. Both
 * variables were validated at boot, so a malformed value never reaches here.
 *
 * A cron callback carries no requirements, so the services the job reads are
 * captured from the registering fiber — the server's domain context — and
 * provided to each tick.
 */

import { Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import {
  catchUpWeeklyDigest,
  runScheduledWeeklyDigest,
  type WeeklyDigestSendServices,
} from '@/application/use-cases/admin/weekly-digest-send'
import {
  parseSovriumNotifyDigest,
  parseSovriumNotifyDigestCron,
} from '@/domain/models/process-env/notifications'
import { logError, logInfo } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import type { App } from '@/domain/models/app'

/** Stable scheduler job id so re-registration (config reload) is idempotent. */
const WEEKLY_DIGEST_JOB_ID = 'weekly-digest'

export const registerWeeklyDigestScheduler = (
  app: App
): Effect.Effect<string | undefined, never, CronScheduler | WeeklyDigestSendServices> =>
  Effect.gen(function* () {
    if (parseSovriumNotifyDigest() === 'off') return undefined
    const services = yield* Effect.context<WeeklyDigestSendServices>()
    const scheduler = yield* CronScheduler
    return yield* scheduler
      .schedule(
        parseSovriumNotifyDigestCron(),
        () =>
          runScheduledWeeklyDigest(app).pipe(
            Effect.provide(services),
            Effect.tapCause((cause) =>
              Effect.sync(() => logError('[weekly-digest] scheduled summary failed', cause))
            ),
            // effect-swallow: logged above; the timer re-arms for the next week.
            Effect.catchCause(() => Effect.void),
            Effect.asVoid
          ),
        { jobId: WEEKLY_DIGEST_JOB_ID, timezone: resolveOperatorTimezone() }
      )
      .pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError('[weekly-digest] failed to arm the weekly summary', err)
            return undefined
          })
        )
      )
  })

/**
 * Catch up a week missed while the server was down, or retry a recent summary
 * whose delivery failed. Best-effort: a catch-up that cannot run costs one
 * email, never the boot — the cause is logged.
 */
export const runWeeklyDigestCatchUp = (
  app: App
): Effect.Effect<void, never, WeeklyDigestSendServices> =>
  catchUpWeeklyDigest(app).pipe(
    Effect.tap((outcome) =>
      outcome === 'caught-up' || outcome === 'retried'
        ? Effect.sync(() => logInfo(`[weekly-digest] boot catch-up: ${outcome}`))
        : Effect.void
    ),
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[weekly-digest] boot catch-up failed', cause))
    ),
    // effect-swallow: logged above; a failed catch-up never fails the boot.
    Effect.catchCause(() => Effect.void),
    Effect.asVoid
  )
