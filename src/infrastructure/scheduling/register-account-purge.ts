/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { purgeDueAccounts } from '@/infrastructure/database/account-purge'
import { logError } from '@/infrastructure/logging/logger'
import { CronSchedulerLive } from './cron-scheduler-live'
import type { App } from '@/domain/models/app'


class AccountPurgeSweepError extends Data.TaggedError('AccountPurgeSweepError')<{
  readonly cause: unknown
}> {}

const PURGE_CRON_EXPRESSION = '0 * * * *'

const PURGE_JOB_ID = 'account-purge-due'

export const registerAccountPurgeScheduler = (app: App): Effect.Effect<string | undefined, never> =>
  Effect.gen(function* () {
    const appTableNames = (app.tables ?? []).map((table) => table.name)

    const scheduler = yield* CronScheduler
    return yield* scheduler
      .schedule(
        PURGE_CRON_EXPRESSION,
        () =>
          Effect.tryPromise({
            try: () => purgeDueAccounts(appTableNames),
            catch: (cause) => new AccountPurgeSweepError({ cause }),
          }).pipe(
            Effect.tapError((error) =>
              Effect.sync(() => {
                logError('[account-purge] scheduled erasure sweep failed', error.cause)
              })
            ),
            Effect.catchAll(() => Effect.void),
            Effect.asVoid
          ),
        { jobId: PURGE_JOB_ID, timezone: 'UTC' }
      )
      .pipe(
        Effect.catchAll((err) =>
          Effect.sync(() => {
            logError('[account-purge] failed to arm erasure scheduler', err)
            return undefined
          })
        )
      )
  }).pipe(Effect.provide(CronSchedulerLive))
