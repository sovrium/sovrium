/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import {
  purgeDueAccounts,
  resolvePurgeTableAuthorship,
} from '@/infrastructure/database/account-purge'
import { logError } from '@/infrastructure/logging/logger'
import { CronSchedulerLive } from './cron-scheduler-live'
import type { App } from '@/domain/models/app'

/**
 * GDPR Art. 17 erasure scheduler registration.
 *
 * `purgeDueAccounts` (`infrastructure/database/account-purge.ts`) hard-deletes
 * every account whose `scheduledErasureAt` grace window has elapsed. On its own
 * it is just a function — nothing fires it. This module arms it on the live
 * `CronScheduler` so a running production server actually completes scheduled
 * erasures.
 *
 * Without this wiring, a confirmed account-deletion request would schedule an
 * erasure date that nothing ever acts on: the personal data would survive
 * indefinitely, silently breaching Art. 17. The deterministic test trigger
 * (`POST /api/account/purge-due`) exercises the SAME `purgeDueAccounts` logic,
 * but it is gated behind an internal-only token — it is not, and must not be,
 * the production erasure path.
 *
 * Cadence: hourly. Erasures are not time-critical to the minute — a user's
 * grace window is measured in days — so an hourly sweep keeps the worst-case
 * delay between "grace window elapsed" and "data physically gone" under an
 * hour while imposing negligible load.
 */

/**
 * Typed failure for a `purgeDueAccounts` sweep — keeps the scheduler
 * callback's error channel typed instead of `unknown`. The cause is the
 * underlying DB error; it is logged and then swallowed so the timer re-arms.
 */
class AccountPurgeSweepError extends Data.TaggedError('AccountPurgeSweepError')<{
  readonly cause: unknown
}> {}

/** Hourly — top of every hour. Erasures tolerate up to an hour of latency. */
const PURGE_CRON_EXPRESSION = '0 * * * *'

/** Stable scheduler job id so re-registration (config reload) is idempotent. */
const PURGE_JOB_ID = 'account-purge-due'

/**
 * Arm the recurring account-erasure purge on the live cron scheduler.
 *
 * Mirrors `registerCronAutomations`: it runs through `CronSchedulerLive`,
 * never blocks startup, and absorbs every error after logging so a transient
 * failure (e.g. an empty or unreachable database) cannot stop the server from
 * coming up or the scheduler from re-arming on the next tick.
 *
 * The scheduled callback delegates to `purgeDueAccounts`, which itself tolerates
 * a missing/empty database: the `SELECT ... FROM auth.user` simply returns no
 * due rows and the sweep is a no-op. Any unexpected error is caught here so the
 * timer keeps firing.
 *
 * @param app - Validated application configuration (its `tables[]` names are
 *   scanned for authored records during a purge).
 * @returns Effect yielding the scheduled job id, or `undefined` when the
 *   scheduler could not be armed (logged, non-fatal).
 */
export const registerAccountPurgeScheduler = (app: App): Effect.Effect<string | undefined, never> =>
  Effect.gen(function* () {
    // Authorship columns resolved from the DECLARED FIELD TYPES, matching the
    // `/api/account/purge-due` trigger. Passing bare names let the sweep assume
    // the literal `created_by`, so a config naming the field anything else had
    // zero app-table rows deleted on this — the PRODUCTION — path.
    const appTables = (app.tables ?? []).map((table) =>
      resolvePurgeTableAuthorship(app.tables, table.name)
    )

    const scheduler = yield* CronScheduler
    return yield* scheduler
      .schedule(
        PURGE_CRON_EXPRESSION,
        () =>
          // `purgeDueAccounts` resolves to a count; the scheduler callback
          // signature is `void`. Any DB error is caught and logged so the
          // timer re-arms for the next hourly tick.
          Effect.tryPromise({
            try: () => purgeDueAccounts(appTables),
            catch: (cause) => new AccountPurgeSweepError({ cause }),
          }).pipe(
            Effect.tapError((error) =>
              Effect.sync(() => {
                logError('[account-purge] scheduled erasure sweep failed', error.cause)
              })
            ),
            Effect.catch(() => Effect.void),
            Effect.asVoid
          ),
        { jobId: PURGE_JOB_ID, timezone: 'UTC' }
      )
      .pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError('[account-purge] failed to arm erasure scheduler', err)
            return undefined
          })
        )
      )
  }).pipe(Effect.provide(CronSchedulerLive))
