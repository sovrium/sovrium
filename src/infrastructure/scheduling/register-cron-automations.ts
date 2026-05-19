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

export { disposeCronScheduler }

type Automation = NonNullable<App['automations']>[number]
type CronTriggerLike = {
  readonly type: 'cron'
  readonly expression: string
  readonly timezone: string
}
type CronScheduleService = Effect.Effect.Success<typeof CronScheduler>

const buildCronCallback =
  (automation: Automation, app: App, processEnv: Readonly<Record<string, string | undefined>>) =>
  (): Effect.Effect<void, unknown> =>
    provideAutomationRuntime(runCronAutomation({ name: automation.name, app, processEnv })).pipe(
      Effect.tapError((err) =>
        Effect.sync(() => {
          console.error('[cron-scheduler] automation run failed', { name: automation.name, err })
        })
      ),
      Effect.catchAll(() => Effect.void),
      Effect.asVoid
    )

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
          return automation.name
        })
      )
    )
}

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
