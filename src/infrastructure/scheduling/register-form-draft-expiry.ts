/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { purgeExpiredFormDrafts } from '@/application/use-cases/forms/purge-expired-form-drafts'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import type { FormSubmissionRepository } from '@/application/ports/repositories/forms/form-submission-repository'
import type { App } from '@/domain/models/app'

/** Every hour, on the hour: a resume link's life is counted in minutes at the finest. */
const DRAFT_EXPIRY_CRON_EXPRESSION = '0 * * * *'

/** Stable scheduler job ids so re-registration (config reload) is idempotent. */
const DRAFT_EXPIRY_JOB_ID = 'form-draft-expiry'
const BOOT_SWEEP_JOB_ID = 'form-draft-expiry-boot'

/** One sweep, its failure logged and absorbed: the next tick retries. */
const sweepOnce = (app: App, when: 'boot' | 'scheduled') =>
  purgeExpiredFormDrafts(app).pipe(
    Effect.tap((removed) =>
      Effect.sync(() =>
        logDebug(`[form-drafts] ${when} sweep deleted ${String(removed)} expired draft(s)`)
      )
    ),
    Effect.tapCause((cause) =>
      Effect.sync(() => logError(`[form-drafts] ${when} sweep failed`, cause))
    ),
    // effect-swallow: logged above; a failed sweep never fails the boot, and the next hour retries.
    Effect.catchCause(() => Effect.void),
    Effect.asVoid
  )

/**
 * Delete expired form drafts (`saveAndResume`) once at start-up — for the
 * links that expired while the server was stopped — and then every hour.
 * Registered whatever the config declares: drafts of a form since removed are
 * swept too.
 */
export const registerFormDraftExpiryScheduler = (
  app: App
): Effect.Effect<string | undefined, never, CronScheduler | FormSubmissionRepository> =>
  Effect.gen(function* () {
    const services = yield* Effect.context<FormSubmissionRepository>()
    const scheduler = yield* CronScheduler
    yield* scheduler.runOnce(() => sweepOnce(app, 'boot').pipe(Effect.provide(services)), {
      jobId: BOOT_SWEEP_JOB_ID,
    })
    return yield* scheduler
      .schedule(
        DRAFT_EXPIRY_CRON_EXPRESSION,
        () => sweepOnce(app, 'scheduled').pipe(Effect.provide(services)),
        { jobId: DRAFT_EXPIRY_JOB_ID, timezone: resolveOperatorTimezone() }
      )
      .pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError('[form-drafts] failed to arm the draft-expiry sweep', err)
            return undefined
          })
        )
      )
  })
