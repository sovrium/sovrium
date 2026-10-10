/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Keep browser screenshots no longer than `BROWSER_ARTIFACT_RETENTION_DAYS`
 * (`sweep-browser-artifacts.ts`).
 *
 * Once at start-up, in the background, then every day on the server's one
 * `CronScheduler`. Registered only when the app declares a `browser/run`
 * action: an app with none has no picture to delete, and no reason to list
 * storage every day. The token-gated
 * `POST /api/internal/automations/sweep-browser-artifacts` runs the same sweep
 * on demand.
 */

import { Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { sweepBrowserArtifacts } from '@/application/use-cases/automations/sweep-browser-artifacts'
import { browserArtifactRetentionDays } from '@/domain/models/process-env/browser'
import { logError } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import type { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { App } from '@/domain/models/app'

/** Every day at 03:17. */
const SWEEP_CRON_EXPRESSION = '17 3 * * *'

const SWEEP_JOB_ID = 'browser-artifact-sweep'
const BOOT_SWEEP_JOB_ID = 'browser-artifact-sweep-boot'

type SweepRequirements = StorageService | AutomationRunRepository

/** Whether the app runs a browser anywhere. */
const usesBrowser = (app: App): boolean =>
  JSON.stringify(app.automations ?? []).includes('"browser"')

/** One sweep, its failure logged and absorbed: the next day retries. */
const sweepOnce = (
  processEnv: Readonly<Record<string, string | undefined>>
): Effect.Effect<void, never, SweepRequirements> =>
  sweepBrowserArtifacts(browserArtifactRetentionDays(processEnv)).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[browser-artifacts] retention sweep failed', cause))
    ),
    // effect-swallow: logged above; a failed sweep never fails the boot, and it runs again tomorrow.
    Effect.catchCause(() => Effect.void),
    Effect.asVoid
  )

export const registerBrowserArtifactSweepScheduler = (
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>
): Effect.Effect<string | undefined, never, CronScheduler | SweepRequirements> =>
  Effect.gen(function* () {
    if (!usesBrowser(app)) return undefined
    const services = yield* Effect.context<SweepRequirements>()
    const scheduler = yield* CronScheduler
    yield* scheduler.runOnce(() => sweepOnce(processEnv).pipe(Effect.provide(services)), {
      jobId: BOOT_SWEEP_JOB_ID,
    })
    return yield* scheduler
      .schedule(SWEEP_CRON_EXPRESSION, () => sweepOnce(processEnv).pipe(Effect.provide(services)), {
        jobId: SWEEP_JOB_ID,
        timezone: resolveOperatorTimezone(),
      })
      .pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError('[browser-artifacts] failed to arm the retention sweep', err)
            return undefined
          })
        )
      )
  })
