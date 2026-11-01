/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Data, Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { purgeExpiredAuthRows } from '@/infrastructure/database/auth-expired-rows-sweep'
import { Database, type DatabaseService } from '@/infrastructure/database/drizzle/layer'
import { describeSweepFailure } from '@/infrastructure/database/read-write-sweep'
import { logError } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'

/**
 * Arms the daily sweep of expired sign-in rows (`auth-expired-rows-sweep.ts`):
 * device codes and verification rows past their expiry. In-process on the
 * one cron scheduler, like its retention siblings; the internal trigger route
 * `POST /api/internal/auth/prune-expired` runs the same sweep for tests.
 *
 * Daily is enough: the rows live minutes, the routes that write them are
 * budgeted per client address, and the sweep only reclaims space.
 */

/** Typed failure of one sweep: logged, then swallowed so the timer re-arms. */
class AuthExpiredRowsSweepError extends Data.TaggedError('AuthExpiredRowsSweepError')<{
  readonly cause: unknown
}> {}

/** Daily, at 03:30 in the operator timezone, between its retention siblings. */
const SWEEP_CRON_EXPRESSION = '30 3 * * *'

/** Stable job id so re-registration (config reload) is idempotent. */
const SWEEP_JOB_ID = 'auth-expired-rows'

const sweepOnce = (database: DatabaseService) =>
  Effect.tryPromise({
    try: () => purgeExpiredAuthRows(database),
    catch: (cause) => new AuthExpiredRowsSweepError({ cause }),
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError(
          describeSweepFailure('[auth-expired-rows] scheduled sweep failed', Cause.squash(cause)),
          cause
        )
      )
    ),
    // effect-swallow: logged above; a failed sweep never stops the timer, and tomorrow retries.
    Effect.catchCause(() => Effect.void),
    Effect.asVoid
  )

/**
 * Arm the recurring sweep. Yields the scheduled job id, or `undefined` when
 * the scheduler could not be armed (logged, non-fatal).
 */
export const registerAuthExpiredRowsSweepScheduler: Effect.Effect<
  string | undefined,
  never,
  CronScheduler | Database
> = Effect.gen(function* () {
  const database = yield* Database
  const scheduler = yield* CronScheduler
  return yield* scheduler
    .schedule(SWEEP_CRON_EXPRESSION, () => sweepOnce(database), {
      jobId: SWEEP_JOB_ID,
      timezone: resolveOperatorTimezone(process.env),
    })
    .pipe(
      Effect.catch((err) =>
        Effect.sync(() => {
          logError('[auth-expired-rows] failed to arm the expired sign-in rows sweep', err)
          return undefined
        })
      )
    )
})
