/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { parseSovriumAutomationRunRetentionDays } from '@/domain/models/process-env/automations'
import { pruneExpiredAutomationRuns } from '@/infrastructure/database/automation-run-retention'
import { logError } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'

/**
 * Run-history retention scheduler registration: arms the daily sweep that
 * deletes the ended runs older than `SOVRIUM_AUTOMATION_RUN_RETENTION_DAYS`.
 *
 * A clone of `registerActivityLogRetentionScheduler` — the same in-process
 * `CronScheduler`, the same swallow-and-log posture, and the same relationship
 * to its token-gated trigger route, `POST /api/internal/automations/prune-runs`.
 * Unset, the variable keeps every run, so nothing is armed.
 */

/** Typed failure for a sweep; logged, then swallowed so the timer re-arms. */
class AutomationRunRetentionSweepError extends Data.TaggedError(
  'AutomationRunRetentionSweepError'
)<{
  readonly cause: unknown
}> {}

/** Daily, at 03:45 in the operator timezone — after the table sweep (03:30). */
const RUN_RETENTION_CRON_EXPRESSION = '45 3 * * *'

/** Stable scheduler job id so re-registration (config reload) is idempotent. */
const RUN_RETENTION_JOB_ID = 'automation-run-retention'

/**
 * Arm the daily run-history sweep. Yields the scheduled job id, or `undefined`
 * when no window is set or the scheduler could not be armed (logged, non-fatal).
 *
 * @param env - the environment holding the window (validated at boot).
 */
export const registerAutomationRunRetentionScheduler = (
  env: Readonly<Record<string, string | undefined>>
): Effect.Effect<string | undefined, never, CronScheduler> =>
  Effect.gen(function* () {
    if (parseSovriumAutomationRunRetentionDays(env) === undefined) return undefined
    const scheduler = yield* CronScheduler
    return yield* scheduler
      .schedule(
        RUN_RETENTION_CRON_EXPRESSION,
        () =>
          Effect.tryPromise({
            try: () => pruneExpiredAutomationRuns(env),
            catch: (cause) => new AutomationRunRetentionSweepError({ cause }),
          }).pipe(
            Effect.tapError((error) =>
              Effect.sync(() => {
                logError('[automation-run-retention] scheduled sweep failed', error.cause)
              })
            ),
            Effect.catch(() => Effect.void),
            Effect.asVoid
          ),
        { jobId: RUN_RETENTION_JOB_ID, timezone: resolveOperatorTimezone() }
      )
      .pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError('[automation-run-retention] failed to arm the run-history sweep', err)
            return undefined
          })
        )
      )
  }).pipe(Effect.withSpan('scheduling.register-automation-run-retention'))
