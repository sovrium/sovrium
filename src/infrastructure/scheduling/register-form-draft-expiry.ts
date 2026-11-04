/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { purgeExpiredFormDrafts } from '@/application/use-cases/forms/purge-expired-form-drafts'
import { describeSweepFailure } from '@/infrastructure/database/read-write-sweep'
import { logError, logInfo } from '@/infrastructure/logging/logger'
import { armHourlySweep } from './arm-sweep-schedule'
import type { FormSubmissionRepository } from '@/application/ports/repositories/forms/form-submission-repository'
import type { App } from '@/domain/models/app'

/** Stable scheduler job ids so re-registration (config reload) is idempotent. */
const DRAFT_EXPIRY_JOB_ID = 'form-draft-expiry'
const BOOT_SWEEP_JOB_ID = 'form-draft-expiry-boot'

/**
 * One sweep, its outcome logged every time (zero included, so the journal
 * shows it ran) and its failure absorbed: the next tick retries.
 */
const sweepOnce = (app: App, when: 'boot' | 'scheduled') =>
  purgeExpiredFormDrafts(app).pipe(
    Effect.tap((removed) =>
      Effect.sync(() =>
        logInfo(`[form-drafts] ${when} sweep deleted ${String(removed)} expired draft(s)`)
      )
    ),
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError(
          describeSweepFailure(`[form-drafts] ${when} sweep failed`, Cause.squash(cause)),
          cause
        )
      )
    ),
    // effect-swallow: logged above; a failed sweep never fails the boot, and the next hour retries.
    Effect.catchCause(() => Effect.void),
    Effect.asVoid
  )

/**
 * Delete expired form drafts (`saveAndResume`) once at start-up — for the
 * links that expired while the server was stopped — and then every hour, at
 * the app's hourly maintenance minute.
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
    // Hourly, at the app's maintenance minute: a resume link's life is counted
    // in minutes at the finest.
    return yield* armHourlySweep(scheduler, app.name, {
      jobId: DRAFT_EXPIRY_JOB_ID,
      armFailure: '[form-drafts] failed to arm the draft-expiry sweep',
      sweep: sweepOnce(app, 'scheduled').pipe(Effect.provide(services)),
    })
  })
