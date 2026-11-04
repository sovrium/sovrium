/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Let signing evidence go once its retention ends (`sweep-signature-evidence.ts`).
 *
 * At every boot, first, the chain's delete guard is put on the timeline the
 * server runs on (`signature-evidence-guard-clock.ts`): a server started with
 * `SOVRIUM_DEV_CLOCK` sweeps on its pinned instant, and the database must
 * judge `keep_until` on the same one.
 *
 * Then, once at start-up in the background and every hour on the server's one
 * `CronScheduler`, the sweep runs on the engine clock (on the development
 * timeline when one is pinned). A request goes within the hour after its
 * `keep_until`; a retention counted in years needs no finer cadence.
 *
 * Registered when the app declares a signing flow, or when a request already
 * holds a retention date (made under a config that has since dropped its
 * flows: its evidence still has to go on time). A probe that fails registers
 * the sweep. `signatures` is a restart key, so a config that adds a flow boots
 * through here again.
 *
 * A cron callback carries no requirements: the services a tick needs are
 * captured from the registering fiber, the server's domain context.
 */

import { Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { sweepSignatureEvidence } from '@/application/use-cases/signatures/sweep-signature-evidence'
import { DatabaseError } from '@/domain/errors'
import { Database, type DatabaseService } from '@/infrastructure/database/drizzle/layer'
import { alignSignatureEvidenceGuardClock } from '@/infrastructure/database/signature-evidence-guard-clock'
import { anyRetainedRequestOn } from '@/infrastructure/database/signature-evidence-retention-queries'
import { withPromiseTransaction } from '@/infrastructure/database/transaction'
import { logDebug, logError, logInfo } from '@/infrastructure/logging/logger'
import { withDevTimelineClock } from '@/infrastructure/process/dev-timeline-clock'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import type { App } from '@/domain/models/app'
import type { RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'

/** Every hour, at minute 23: off the top of the hour the account purge occupies. */
const SWEEP_CRON_EXPRESSION = '23 * * * *'

/** Stable scheduler job ids, so a re-registration is idempotent. */
const SWEEP_JOB_ID = 'signature-evidence-sweep'
const BOOT_SWEEP_JOB_ID = 'signature-evidence-sweep-boot'

/** One sweep on the engine clock; its failure logged and absorbed, the next tick retries. */
const sweepOnce = (when: 'boot' | 'scheduled') =>
  withDevTimelineClock(sweepSignatureEvidence).pipe(
    Effect.tap((gone) =>
      Effect.sync(() => {
        const message = `[signature-evidence] ${when} sweep let ${String(gone)} request(s) go`
        return gone === 0 ? logDebug(message) : logInfo(message)
      })
    ),
    Effect.tapCause((cause) =>
      Effect.sync(() => logError(`[signature-evidence] ${when} sweep failed`, cause))
    ),
    // effect-swallow: logged above; a failed sweep never fails the boot, and the timer re-arms in an hour.
    Effect.catchCause(() => Effect.void),
    Effect.asVoid
  )

type SweepRequirements = Effect.Services<ReturnType<typeof sweepOnce>>

/** Put the chain's delete guard on this boot's timeline; a failure is logged, never fatal. */
const alignGuard = ({ client, dialect }: DatabaseService) =>
  withPromiseTransaction(
    client,
    (tx) => alignSignatureEvidenceGuardClock(tx as Readonly<RawSqlRunner>, dialect),
    (cause) => cause
  ).pipe(
    Effect.tap((rewritten) =>
      rewritten
        ? Effect.sync(() => logInfo('[signature-evidence] evidence guard set to the boot clock'))
        : Effect.void
    ),
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[signature-evidence] could not align the evidence guard', cause))
    ),
    // effect-swallow: logged above; the guard keeps the database's own clock, which only ever keeps evidence longer.
    Effect.catchCause(() => Effect.succeed(false))
  )

/** Whether a request holds a retention date. A failed probe answers `true`. */
const anyRetained = ({ client, dialect }: DatabaseService) =>
  Effect.tryPromise({
    try: () => anyRetainedRequestOn(client as Readonly<RawSqlRunner>, dialect),
    catch: (cause) => new DatabaseError('Failed to probe the retained signature requests', cause),
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[signature-evidence] could not tell whether evidence is retained', cause)
      )
    ),
    // effect-swallow: logged above; on doubt the sweep is registered, which costs one query an hour.
    Effect.catchCause(() => Effect.succeed(true))
  )

export const registerSignatureEvidenceSweepScheduler = (
  app: App
): Effect.Effect<string | undefined, never, CronScheduler | Database | SweepRequirements> =>
  Effect.gen(function* () {
    const database = yield* Database
    yield* alignGuard(database)
    if ((app.signatures ?? []).length === 0 && !(yield* anyRetained(database))) return undefined
    const services = yield* Effect.context<SweepRequirements>()
    const scheduler = yield* CronScheduler
    yield* scheduler.runOnce(() => sweepOnce('boot').pipe(Effect.provide(services)), {
      jobId: BOOT_SWEEP_JOB_ID,
    })
    return yield* scheduler
      .schedule(
        SWEEP_CRON_EXPRESSION,
        () => sweepOnce('scheduled').pipe(Effect.provide(services)),
        { jobId: SWEEP_JOB_ID, timezone: resolveOperatorTimezone(process.env) }
      )
      .pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError('[signature-evidence] failed to arm the evidence retention sweep', err)
            return undefined
          })
        )
      )
  }).pipe(Effect.withSpan('scheduling.register-signature-evidence-sweep'))
