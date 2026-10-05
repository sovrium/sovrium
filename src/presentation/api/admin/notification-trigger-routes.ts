/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The internal trigger routes of the operator-notification jobs.
 *
 *   - `POST /api/internal/automations/reap-interrupted` — close the automation
 *     runs a previous server left `running` or `queued`, then the runs of this
 *     server stuck `running` past their timeout, and alert each one. Answers
 *     `{ interrupted, stuck }`. The first sweep runs at every boot and the
 *     second every five minutes; this runs both on demand.
 *   - `POST /api/internal/automations/expire-approvals` — resolve the approval
 *     requests past their timeout by their `onTimeout`. Answers
 *     `{ expired: [approvalIds] }`. Runs at every boot and every minute on its
 *     own (`register-approval-expiry.ts`); this runs it on demand.
 *   - `POST /api/internal/notifications/automation-rollup` — send the hourly
 *     roll-up of the automation failures held back from immediate alerts.
 *   - `POST /api/internal/notifications/weekly-digest` — compute the weekly
 *     summary of the instance and, unless `SOVRIUM_NOTIFY_DIGEST=off`, store
 *     and send it. Answers `{ sent, recipients, digest }` either way.
 *
 * All four jobs run on their own in production (the boot sweep and the
 * five-minute stuck-run sweep in `register-stuck-run-sweep.ts`; the approval
 * expiry in `register-approval-expiry.ts`; the hourly
 * cron in `register-failure-rollup.ts`; the weekly cron and boot catch-up in
 * `register-weekly-digest.ts`). These routes exist so a test can run them
 * deterministically, and are gated exactly like `POST /api/account/purge-due`:
 * without a matching `X-Internal-Scheduler-Token` — and always, when
 * `INTERNAL_SCHEDULER_TOKEN` is unset, which is the production posture — they
 * answer 404 as if they did not exist.
 */

import { Effect } from 'effect'
import { sendWeeklyDigest } from '@/application/use-cases/admin/weekly-digest-send'
import { expireAutomationApprovals } from '@/application/use-cases/automations/expire-automation-approvals'
import { reapInterruptedRuns } from '@/application/use-cases/automations/reap-interrupted-runs'
import { sendFailureRollup } from '@/application/use-cases/automations/send-failure-rollup'
import { sweepStuckRuns } from '@/application/use-cases/automations/sweep-stuck-runs'
import { weeklyDigestTriggerResponseSchema } from '@/domain/models/api/admin/notifications/weekly-digest'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import {
  internalSchedulerNotFound,
  isInternalSchedulerRequest,
} from '@/presentation/api/runtime/internal-scheduler-gate'
import { runEffect } from '@/presentation/api/runtime/run-effect'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Run the interrupted-run reaper, then the stuck-run sweep; answers
 * `{ interrupted: [runIds], stuck: [runIds] }`. In that order, so a run a
 * previous server left behind is told as interrupted, never as stuck.
 */
async function handleReapInterrupted(c: Context, app: App): Promise<Response> {
  if (!isInternalSchedulerRequest(c)) return internalSchedulerNotFound(c)
  return runEffect(
    c,
    provideDomain(
      c,
      Effect.gen(function* () {
        const interrupted = yield* reapInterruptedRuns(app)
        const stuck = yield* sweepStuckRuns(app)
        return { interrupted, stuck }
      })
    )
  )
}

/** Resolve the approval requests past their timeout; answers `{ expired: [approvalIds] }`. */
async function handleExpireApprovals(c: Context, app: App): Promise<Response> {
  if (!isInternalSchedulerRequest(c)) return internalSchedulerNotFound(c)
  return runEffect(
    c,
    provideDomain(
      c,
      Effect.map(expireAutomationApprovals(app, process.env), (expired) => ({ expired }))
    )
  )
}

/** Run the failure roll-up; answers `{ sent, automations }`. */
async function handleAutomationRollup(c: Context, app: App): Promise<Response> {
  if (!isInternalSchedulerRequest(c)) return internalSchedulerNotFound(c)
  return runEffect(c, provideDomain(c, sendFailureRollup(app)))
}

/** Compute, store and send the weekly summary; answers `{ sent, recipients, digest }`. */
async function handleWeeklyDigest(c: Context, app: App): Promise<Response> {
  if (!isInternalSchedulerRequest(c)) return internalSchedulerNotFound(c)
  return runEffect(c, provideDomain(c, sendWeeklyDigest(app)), weeklyDigestTriggerResponseSchema)
}

/**
 * Chain the notification trigger routes onto a Hono app. Registered without a
 * session requirement: the scheduler token IS the gate.
 */
export function chainNotificationTriggerRoutes<T extends Hono>(
  honoApp: T,
  resolveApp: () => App
): T {
  return honoApp
    .post('/api/internal/automations/reap-interrupted', (c) =>
      handleReapInterrupted(c, resolveApp())
    )
    .post('/api/internal/automations/expire-approvals', (c) =>
      handleExpireApprovals(c, resolveApp())
    )
    .post('/api/internal/notifications/automation-rollup', (c) =>
      handleAutomationRollup(c, resolveApp())
    )
    .post('/api/internal/notifications/weekly-digest', (c) =>
      handleWeeklyDigest(c, resolveApp())
    ) as T
}
