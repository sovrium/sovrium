/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { runCronAutomation } from '@/application/use-cases/automations/run-cron-automation'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { CronSchedulerLive, disposeCronScheduler } from './cron-scheduler-live'
import type { App } from '@/domain/models/app'

// Re-export so server.ts can import everything cron-related from one place.
export { disposeCronScheduler }

type Automation = NonNullable<App['automations']>[number]
type CronTriggerLike = {
  readonly type: 'cron'
  readonly expression: string
  readonly timezone: string
}
type CronScheduleService = Effect.Effect.Success<typeof CronScheduler>

/**
 * Build the per-automation cron callback. Each invocation runs the shared
 * `runCronAutomation` Effect program through the production runtime layer
 * (DB-backed repositories) and absorbs all errors after logging — a
 * misbehaving automation must NOT stop the scheduler from re-arming for
 * the next tick.
 */
const buildCronCallback =
  (automation: Automation, app: App, processEnv: Readonly<Record<string, string | undefined>>) =>
  (): Effect.Effect<void, unknown> =>
    provideAutomationRuntime(runCronAutomation({ name: automation.name, app, processEnv })).pipe(
      Effect.tapError((err) =>
        Effect.sync(() => {
          console.error('[cron-scheduler] automation run failed', { name: automation.name, err })
        })
      ),
      // Tagged-error union is wide; narrow to `void` for the scheduler
      // callback signature so the timer keeps firing on the next tick.
      Effect.catchAll(() => Effect.void),
      Effect.asVoid
    )

/**
 * Schedule a single cron-triggered automation. Logged-and-recovered on
 * failure so one bad expression cannot block subsequent registrations.
 */
const scheduleOne = (
  scheduler: CronScheduleService,
  automation: Automation,
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>
): Effect.Effect<string, never> => {
  const trigger = automation.trigger as CronTriggerLike
  const callback = buildCronCallback(automation, app, processEnv)
  return scheduler
    .schedule(trigger.expression, callback, {
      jobId: automation.name,
      timezone: trigger.timezone,
    })
    .pipe(
      Effect.catchAll((err) =>
        Effect.sync(() => {
          console.error('[cron-scheduler] failed to schedule automation', {
            name: automation.name,
            err,
          })
          return automation.name // best-effort: return the intended id
        })
      )
    )
}

/**
 * Walk `app.automations`, filter cron-triggered entries, and arm them on
 * the live scheduler. Each scheduled callback runs the corresponding
 * automation through the shared `runCronAutomation` Effect program — same
 * persistence + run-history contract as the webhook/manual entry points.
 *
 * Called from `createServer` AFTER the database has been initialised but
 * BEFORE `Bun.serve` accepts requests, so by the time the test fixture's
 * `startServerWithSchema` resolves, cron jobs are already armed and the
 * first fire will appear in `system.automation_runs` within one schedule
 * period.
 *
 * Disabled automations are skipped silently. Schema validation already
 * guaranteed every cron expression parses, but `Cron.parse` is invoked
 * again inside `CronScheduler.schedule`; if it ever fails (Effect API
 * drift), the scheduler error is logged and the registration moves on so
 * one bad job cannot block the rest.
 */
export const registerCronAutomations = (
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>
): Effect.Effect<readonly string[], never> =>
  Effect.gen(function* () {
    const cronAutomations = (app.automations ?? []).filter(
      (automation) => automation.trigger.type === 'cron' && automation.enabled !== false
    )
    if (cronAutomations.length === 0) return [] as readonly string[]

    const scheduler = yield* CronScheduler
    return yield* Effect.forEach(
      cronAutomations,
      (automation) => scheduleOne(scheduler, automation, app, processEnv),
      { concurrency: 1 }
    )
  }).pipe(Effect.provide(CronSchedulerLive))
