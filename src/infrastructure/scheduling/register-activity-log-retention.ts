/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { purgeExpiredActivityLogs } from '@/infrastructure/database/activity-log-retention'
import { logError } from '@/infrastructure/logging/logger'

/**
 * Activity-log retention scheduler registration.
 *
 * The one-year retention on `system.activity_logs` was documented on the schema
 * and promised in the published privacy policy, and implemented ONLY as a read
 * filter. Rows past the window were hidden from the record-history API and kept
 * indefinitely. This arms the executor that actually removes them.
 *
 * Mirrors `registerAccountPurgeScheduler` deliberately: same in-process
 * `CronSchedulerLive`, same swallow-and-log posture so one failed sweep never
 * stops the timer re-arming, and the same relationship to its
 * token-gated trigger route — `POST /api/account/retention-due` exercises the
 * SAME `purgeExpiredActivityLogs` logic for tests but is not, and must not be,
 * the production path. In-process, never over loopback HTTP: a sweep that
 * depended on the server reaching its own port would stop running the moment
 * the instance sat behind a proxy that did not route back to it.
 *
 * Cadence: daily. The window is a year, so the worst-case overshoot of a daily
 * sweep is one day out of 365 — while an hourly sweep would run a whole-table
 * range delete 24 times a day to shave hours off a boundary nobody observes.
 */

/**
 * Typed failure for a retention sweep — keeps the scheduler callback's error
 * channel typed instead of `unknown`. The cause is the underlying DB error; it
 * is logged and then swallowed so the timer re-arms.
 */
class ActivityLogRetentionSweepError extends Data.TaggedError('ActivityLogRetentionSweepError')<{
  readonly cause: unknown
}> {}

/** Daily, at 03:15 UTC — off the top of the hour the account purge occupies. */
const RETENTION_CRON_EXPRESSION = '15 3 * * *'

/** Stable scheduler job id so re-registration (config reload) is idempotent. */
const RETENTION_JOB_ID = 'activity-log-retention'

/**
 * Arm the recurring activity-log retention sweep on the live cron scheduler.
 *
 * A VALUE, not a zero-argument function — unlike its `registerAccountPurgeScheduler`
 * sibling, which takes the app config. An Effect is already a lazy description,
 * so nothing runs until the caller executes it; wrapping it in a thunk would add
 * indirection without adding laziness (and `effect(lazyEffect)` says so).
 *
 * Yields the scheduled job id, or `undefined` when the scheduler could not be
 * armed (logged, non-fatal).
 */
export const registerActivityLogRetentionScheduler: Effect.Effect<
  string | undefined,
  never,
  CronScheduler
> = Effect.gen(function* () {
  const scheduler = yield* CronScheduler
  return yield* scheduler
    .schedule(
      RETENTION_CRON_EXPRESSION,
      () =>
        // `purgeExpiredActivityLogs` resolves to a count; the scheduler
        // callback signature is `void`. Any DB error is caught and logged so
        // the timer re-arms for the next daily tick.
        Effect.tryPromise({
          try: () => purgeExpiredActivityLogs(),
          catch: (cause) => new ActivityLogRetentionSweepError({ cause }),
        }).pipe(
          Effect.tapError((error) =>
            Effect.sync(() => {
              logError('[activity-log-retention] scheduled retention sweep failed', error.cause)
            })
          ),
          Effect.catch(() => Effect.void),
          Effect.asVoid
        ),
      { jobId: RETENTION_JOB_ID, timezone: 'UTC' }
    )
    .pipe(
      Effect.catch((err) =>
        Effect.sync(() => {
          logError('[activity-log-retention] failed to arm retention scheduler', err)
          return undefined
        })
      )
    )
})
