/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sweep the signing requests every minute (`end-signature-request.ts`): an
 * open request past its deadline ends `expired`, and a request whose last
 * signature was given but never completed (a server stopped between the two)
 * is completed. Each move starts the flow's signature automations. Then the
 * signers due a reminder are reminded (`reminders-sweep.ts`), after the
 * expiries, so no reminder goes out for a request that just ended.
 *
 * Once at start-up, in the background, then every minute on the server's one
 * `CronScheduler`. Every move is a conditional transition, so a tick
 * overlapping a signer, a cancel or the boot sweep ends nothing twice.
 * Registered only when the app declares a signing flow; `signatures` is a
 * restart key, so a config that adds one boots through here again.
 *
 * A cron callback carries no requirements: the services a tick needs are
 * captured from the registering fiber, the server's domain context.
 */

import { Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { triggerSignatureEventAutomations } from '@/application/use-cases/automations/trigger-signature-event'
import { sweepSignatureRequests } from '@/application/use-cases/signatures/end-signature-request'
import { remindAwaitingSigners } from '@/application/use-cases/signatures/reminders-sweep'
import { roadRecordWriter } from '@/application/use-cases/signatures/road-record-writer'
import { logDebug, logError, logInfo } from '@/infrastructure/logging/logger'
import { withDevTimelineClock } from '@/infrastructure/process/dev-timeline-clock'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import type { App } from '@/domain/models/app'

/** Every minute. */
const SWEEP_CRON_EXPRESSION = '* * * * *'

/** Stable scheduler job ids, so a re-registration is idempotent. */
const SWEEP_JOB_ID = 'signature-request-sweep'
const BOOT_SWEEP_JOB_ID = 'signature-request-sweep-boot'

/** One pass of the reminders, on the same timeline; its failure logged and absorbed. */
const remindOnce = (app: App, when: 'boot' | 'scheduled') =>
  withDevTimelineClock(remindAwaitingSigners(app)).pipe(
    Effect.tap((reminded) =>
      Effect.sync(() => {
        if (reminded > 0)
          logInfo(`[signature-requests] ${when} sweep reminded ${String(reminded)} signer(s)`)
      })
    ),
    Effect.tapCause((cause) =>
      Effect.sync(() => logError(`[signature-requests] ${when} reminders failed`, cause))
    ),
    // effect-swallow: logged above; an unsent reminder is due again at the next tick.
    Effect.catchCause(() => Effect.void)
  )

/** One sweep and the automations of its moves; its failure logged and absorbed, the next tick retries. */
const sweepOnce = (app: App, when: 'boot' | 'scheduled') =>
  // On the development timeline when `SOVRIUM_DEV_CLOCK` pins one, as the evidence sweep.
  withDevTimelineClock(sweepSignatureRequests(roadRecordWriter, app)).pipe(
    Effect.tap((moves) =>
      Effect.forEach(
        moves,
        (move) =>
          triggerSignatureEventAutomations({
            ...{ app, flow: move.flow, recordId: move.recordId },
            signature: move.trigger,
          }),
        { discard: true }
      )
    ),
    Effect.tap((moves) =>
      Effect.sync(() => {
        const message = `[signature-requests] ${when} sweep moved ${String(moves.length)} request(s)`
        return moves.length === 0 ? logDebug(message) : logInfo(message)
      })
    ),
    Effect.tapCause((cause) =>
      Effect.sync(() => logError(`[signature-requests] ${when} sweep failed`, cause))
    ),
    // effect-swallow: logged above; a failed sweep never fails the boot, and the timer re-arms in a minute.
    Effect.catchCause(() => Effect.void),
    Effect.andThen(remindOnce(app, when)),
    Effect.asVoid
  )

type SweepRequirements = Effect.Services<ReturnType<typeof sweepOnce>>

export const registerSignatureRequestSweepScheduler = (
  app: App
): Effect.Effect<string | undefined, never, CronScheduler | SweepRequirements> =>
  Effect.gen(function* () {
    if ((app.signatures ?? []).length === 0) return undefined
    const services = yield* Effect.context<SweepRequirements>()
    const scheduler = yield* CronScheduler
    yield* scheduler.runOnce(() => sweepOnce(app, 'boot').pipe(Effect.provide(services)), {
      jobId: BOOT_SWEEP_JOB_ID,
    })
    return yield* scheduler
      .schedule(
        SWEEP_CRON_EXPRESSION,
        () => sweepOnce(app, 'scheduled').pipe(Effect.provide(services)),
        { jobId: SWEEP_JOB_ID, timezone: resolveOperatorTimezone(process.env) }
      )
      .pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError('[signature-requests] failed to arm the signature request sweep', err)
            return undefined
          })
        )
      )
  }).pipe(Effect.withSpan('scheduling.register-signature-request-sweep'))
