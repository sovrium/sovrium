/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Enforce approval timeouts: close the requests nobody answered
 * before their deadline (`expire-automation-approvals.ts`).
 *
 * Once at start-up, in the background — a request that expired while the
 * server was stopped is resolved without holding up the listening banner,
 * since an `onTimeout: approve` resumes its run inline and a run's tail can
 * take minutes — then every minute on the server's one `CronScheduler`, beside
 * the stuck-run sweep. The boot run belongs to the scheduler's scope, so a
 * server that stops mid-sweep interrupts it; the claim on each request is a
 * compare-and-set, so the first tick overlapping it resolves nothing twice. One cadence for
 * every request, no per-request timer: the deadline decides the outcome, the
 * tick only decides how soon a run that nobody touches moves on.
 *
 * The token-gated `POST /api/internal/automations/expire-approvals` runs the
 * same sweep on demand.
 *
 * A cron callback carries no requirements, so the services the sweep reads —
 * the approval and run repositories and everything a resumed run needs — are
 * captured from the registering fiber, the server's domain context, and
 * provided to each tick. Registered only when the app declares automations: an
 * app with none has no request to expire, and no reason to query every minute.
 */

import { Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { expireAutomationApprovals } from '@/application/use-cases/automations/expire-automation-approvals'
import { logDebug, logError, logInfo } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import type { ResolveRequirements } from '@/application/use-cases/automations/resolve-automation-approval'
import type { App } from '@/domain/models/app'

/** Every minute. */
const EXPIRY_CRON_EXPRESSION = '* * * * *'

/** Stable scheduler job id so re-registration (config reload) is idempotent. */
const EXPIRY_JOB_ID = 'approval-expiry'

/** The id the start-up sweep's failures are logged under. */
const BOOT_SWEEP_JOB_ID = 'approval-expiry-boot'

/** One sweep, its failure logged and absorbed: the next tick retries. */
const sweepOnce = (
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>,
  when: 'boot' | 'scheduled'
): Effect.Effect<void, never, ResolveRequirements> =>
  expireAutomationApprovals(app, processEnv).pipe(
    // The boot run's result is logged with its count; it lands after the
    // listening banner, so a boot that resolved nothing says so at debug level
    // only rather than adding a line to every start.
    Effect.tap((resolved) =>
      when === 'boot'
        ? Effect.sync(() => {
            const message = `[approval-expiry] boot sweep resolved ${String(resolved.length)} expired approval request(s)`
            return resolved.length === 0 ? logDebug(message) : logInfo(message)
          })
        : Effect.void
    ),
    Effect.tapCause((cause) =>
      Effect.sync(() => logError(`[approval-expiry] ${when} sweep failed`, cause))
    ),
    // effect-swallow: logged above; a failed sweep never fails the boot, and the timer re-arms in a minute.
    Effect.catchCause(() => Effect.void),
    Effect.asVoid
  )

export const registerApprovalExpiryScheduler = (
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>
): Effect.Effect<string | undefined, never, CronScheduler | ResolveRequirements> =>
  Effect.gen(function* () {
    if ((app.automations ?? []).length === 0) return undefined
    const services = yield* Effect.context<ResolveRequirements>()
    const scheduler = yield* CronScheduler
    yield* Effect.sync(() => logDebug('[approval-expiry] boot sweep started'))
    yield* scheduler.runOnce(
      () => sweepOnce(app, processEnv, 'boot').pipe(Effect.provide(services)),
      { jobId: BOOT_SWEEP_JOB_ID }
    )
    return yield* scheduler
      .schedule(
        EXPIRY_CRON_EXPRESSION,
        () => sweepOnce(app, processEnv, 'scheduled').pipe(Effect.provide(services)),
        { jobId: EXPIRY_JOB_ID, timezone: resolveOperatorTimezone() }
      )
      .pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError('[approval-expiry] failed to arm the approval-expiry sweep', err)
            return undefined
          })
        )
      )
  })
