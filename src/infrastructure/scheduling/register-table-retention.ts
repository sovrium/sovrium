/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { purgeExpiredTableRows } from '@/infrastructure/database/table-retention'
import { logError } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import type { App } from '@/domain/models/app'

/**
 * Table retention scheduler registration: arms the daily sweep that deletes the
 * rows past each `tables[].retention` window.
 *
 * A clone of `registerActivityLogRetentionScheduler`: the same in-process
 * `CronScheduler`, whose scoped layer stops the timer with the server; the same
 * swallow-and-log posture so one failed sweep never stops the timer re-arming;
 * and the same relationship to its token-gated trigger route —
 * `POST /api/internal/tables/retention-due` runs the SAME
 * `purgeExpiredTableRows` for tests, never as the production path.
 *
 * Not at boot: a restart must not become a delete.
 */

/** Typed failure for a sweep; logged, then swallowed so the timer re-arms. */
class TableRetentionSweepError extends Data.TaggedError('TableRetentionSweepError')<{
  readonly cause: unknown
}> {}

/**
 * Daily, at 03:30 in the operator timezone (`SOVRIUM_TIMEZONE`, UTC when unset)
 * — after the account purge (03:00) and the activity-log sweep (03:15).
 */
const TABLE_RETENTION_CRON_EXPRESSION = '30 3 * * *'

/** Stable scheduler job id so re-registration (config reload) is idempotent. */
const TABLE_RETENTION_JOB_ID = 'table-retention'

/** Whether any table of the app declares a retention window. */
const declaresRetention = (app: App): boolean =>
  (app.tables ?? []).some((table) => table.retention !== undefined)

/**
 * Arm the daily table retention sweep. Yields the scheduled job id, or
 * `undefined` when no table declares a window or the scheduler could not be
 * armed (logged, non-fatal).
 */
export const registerTableRetentionScheduler = (
  app: App
): Effect.Effect<string | undefined, never, CronScheduler> =>
  Effect.gen(function* () {
    if (!declaresRetention(app)) return undefined
    const scheduler = yield* CronScheduler
    return yield* scheduler
      .schedule(
        TABLE_RETENTION_CRON_EXPRESSION,
        () =>
          Effect.tryPromise({
            try: () => purgeExpiredTableRows(app),
            catch: (cause) => new TableRetentionSweepError({ cause }),
          }).pipe(
            Effect.tapError((error) =>
              Effect.sync(() => {
                logError('[table-retention] scheduled retention sweep failed', error.cause)
              })
            ),
            Effect.catch(() => Effect.void),
            Effect.asVoid
          ),
        { jobId: TABLE_RETENTION_JOB_ID, timezone: resolveOperatorTimezone() }
      )
      .pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError('[table-retention] failed to arm the table retention sweep', err)
            return undefined
          })
        )
      )
  }).pipe(Effect.withSpan('scheduling.register-table-retention'))
