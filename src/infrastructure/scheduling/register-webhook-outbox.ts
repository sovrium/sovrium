/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Deliver the table-webhook deliveries that are due: a retry parked past its
 * in-process window, and a delivery its process stopped before attempting
 * (its lease expired) — `record-webhook-dispatcher-live.ts`.
 *
 * Once at start-up, in the background — a delivery parked or interrupted while
 * the server was stopped goes out without holding up the listening banner —
 * then every minute on the server's one `CronScheduler`. Each sweep claims at
 * most a bounded batch, oldest first, with the outbox's compare-and-set claim,
 * so two instances, or a sweep and a write's own attempt, never deliver the
 * same row at the same time; it also deletes deliveries settled more than
 * seven days ago with their delivery-log rows — at start-up, then at most once
 * an hour. A parked retry therefore runs within about a minute of its time.
 *
 * Registered only when some table declares `webhooks`: an app with none owes
 * no delivery and has no reason to query every minute. The token-gated
 * `POST /api/internal/webhooks/deliver-due` runs the same sweep on demand.
 */

import { Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { RecordWebhookDispatcher } from '@/application/ports/services/record-webhook-dispatcher'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import type { App } from '@/domain/models/app'

/** Every minute. */
const SWEEP_CRON_EXPRESSION = '* * * * *'

/** Stable scheduler job id so re-registration (config reload) is idempotent. */
const SWEEP_JOB_ID = 'webhook-outbox'

/** The id the start-up sweep's failures are logged under. */
const BOOT_SWEEP_JOB_ID = 'webhook-outbox-boot'

/** Whether any table of the app declares a webhook. */
const declaresWebhooks = (app: App): boolean =>
  (app.tables ?? []).some((table) => (table.webhooks ?? []).length > 0)

/** One sweep, its report logged at debug level. The dispatcher absorbs its own failures. */
const sweepOnce = (
  app: App,
  dispatcher: RecordWebhookDispatcher['Service'],
  when: 'boot' | 'scheduled'
): Effect.Effect<void> =>
  // Only the minute tick bounds retention to once an hour; the start-up sweep runs it.
  dispatcher.deliverDue(app, { retention: when === 'scheduled' ? 'hourly' : 'every-call' }).pipe(
    Effect.tap((report) =>
      Effect.sync(() => {
        const settled = report.delivered.length + report.retrying.length + report.dead.length
        if (settled > 0) {
          logDebug(
            `[webhook-outbox] ${when} sweep: ${String(report.delivered.length)} delivered, ${String(report.retrying.length)} retrying, ${String(report.dead.length)} dead`
          )
        }
      })
    ),
    Effect.asVoid
  )

export const registerWebhookOutboxScheduler = (
  app: App
): Effect.Effect<string | undefined, never, CronScheduler | RecordWebhookDispatcher> =>
  Effect.gen(function* () {
    if (!declaresWebhooks(app)) return undefined
    const dispatcher = yield* RecordWebhookDispatcher
    const scheduler = yield* CronScheduler
    yield* scheduler.runOnce(() => sweepOnce(app, dispatcher, 'boot'), {
      jobId: BOOT_SWEEP_JOB_ID,
    })
    return yield* scheduler
      .schedule(SWEEP_CRON_EXPRESSION, () => sweepOnce(app, dispatcher, 'scheduled'), {
        jobId: SWEEP_JOB_ID,
        timezone: resolveOperatorTimezone(),
      })
      .pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError('[webhook-outbox] failed to arm the webhook delivery sweep', err)
            return undefined
          })
        )
      )
  }).pipe(Effect.withSpan('scheduling.register-webhook-outbox'))
