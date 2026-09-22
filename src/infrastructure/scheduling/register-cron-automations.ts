/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { runCronAutomation } from '@/application/use-cases/automations/run-cron-automation'
import { logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
import type { Context } from 'effect'

type Automation = NonNullable<App['automations']>[number]
type CronTriggerLike = {
  readonly type: 'cron'
  readonly expression: string
  readonly timezone: string
}
type CronScheduleService = Effect.Success<typeof CronScheduler>

/** Everything a cron run needs, taken from the server rather than rebuilt. */
type CronRunServices = Effect.Services<ReturnType<typeof runCronAutomation>>

/** One armed cron job's inputs, bundled so the builder stays within `max-params`. */
interface CronCallbackInput {
  readonly automation: Automation
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly services: Context.Context<CronRunServices>
}

/**
 * Build the per-automation cron callback. Each invocation runs the shared
 * `runCronAutomation` Effect program and absorbs all errors after logging — a
 * misbehaving automation must NOT stop the scheduler from re-arming for
 * the next tick.
 *
 * The services come from the SERVER's resolved context, captured once at
 * registration, not from a layer rebuilt per tick. Rebuilding meant every fire
 * constructed a fresh copy of every automation repository, the AI service and
 * the storage service — and, more importantly, a second composition of the
 * automation runtime, which is the one thing `AutomationRuntimeLayer`'s own
 * header says there must never be.
 */
const buildCronCallback = (input: CronCallbackInput) => (): Effect.Effect<void, unknown> =>
  runCronAutomation({
    name: input.automation.name,
    app: input.app,
    processEnv: input.processEnv,
  }).pipe(
    Effect.provide(input.services),
    Effect.tapError((err) =>
      Effect.sync(() => {
        logError('[cron-scheduler] automation run failed', err, {
          name: input.automation.name,
        })
      })
    ),
    // Tagged-error union is wide; narrow to `void` for the scheduler
    // callback signature so the timer keeps firing on the next tick.
    Effect.catch(() => Effect.void),
    Effect.asVoid
  )

/**
 * Schedule a single cron-triggered automation. Logged-and-recovered on
 * failure so one bad expression cannot block subsequent registrations.
 */
const scheduleOne = (
  scheduler: CronScheduleService,
  input: CronCallbackInput
): Effect.Effect<string, never> => {
  const { automation } = input
  const trigger = automation.trigger as CronTriggerLike
  const callback = buildCronCallback(input)
  return scheduler
    .schedule(trigger.expression, callback, {
      jobId: automation.name,
      timezone: trigger.timezone,
    })
    .pipe(
      Effect.catch((err) =>
        Effect.sync(() => {
          logError('[cron-scheduler] failed to schedule automation', err, {
            name: automation.name,
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
 * Config-disabled automations are skipped silently. Schema validation already
 * guaranteed every cron expression parses, but `Cron.parse` is invoked
 * again inside `CronScheduler.schedule`; if it ever fails (Effect API
 * drift), the scheduler error is logged and the registration moves on so
 * one bad job cannot block the rest.
 *
 * ## Why this site is DELIBERATELY EXCLUDED from the operational-pause gate
 *
 * This is the ONE `automation.enabled` check in the codebase that is NOT routed
 * through `isAutomationOperationallyEnabled`, and the omission is a decision,
 * not an oversight — recorded here so the next person to count the seams does
 * not "fix" it.
 *
 * Registration happens ONCE, at boot. Gating it on the pause table would mean a
 * paused cron automation is never armed — and would therefore create a standing
 * obligation to RE-ARM it the moment an operator resumes. That re-arm hook has a
 * silent failure mode: miss it, and a resumed cron automation stays dead until
 * the next process restart, with the console cheerfully reporting `active`. That
 * is the worst class of bug this whole feature exists to prevent.
 *
 * So the pause is enforced at FIRE time instead, in
 * `application/use-cases/automations/run-cron-automation.ts` — at
 * `resolveCronAutomation` (the scheduled path, reached from `buildCronCallback`
 * above) and again in `runCronAutomationOnDemand` (the manual-invoke path).
 * Those two gates are what make this exclusion safe: every route from a cron
 * schedule to a run row passes through one of them.
 *
 * The cost is a paused cron job still waking the scheduler on its schedule and
 * being dropped — wasted ticks, never a wrong outcome, and self-correcting the
 * instant the pause is lifted with no restart ([internal ref] pins
 * exactly that). Prefer the failure mode that is cheap and loud over the one
 * that is silent and wrong.
 */
export const registerCronAutomations = (
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>
): Effect.Effect<readonly string[], never, CronScheduler | CronRunServices> =>
  Effect.gen(function* () {
    // NOTE: `enabled !== false` only — no pause check. See the block comment
    // above; the pause is enforced at fire time in `run-cron-automation.ts`.
    const cronAutomations = (app.automations ?? []).filter(
      (automation) => automation.trigger.type === 'cron' && automation.enabled !== false
    )
    if (cronAutomations.length === 0) return [] as readonly string[]

    const scheduler = yield* CronScheduler
    // Captured ONCE, here, while the registrar is still running on the server's
    // context. A cron callback fires long after this returns, on a timer with
    // no request in sight, so the services have to be a value it closes over
    // rather than a requirement it could declare.
    const services = yield* Effect.context<CronRunServices>()
    return yield* Effect.forEach(
      cronAutomations,
      (automation) => scheduleOne(scheduler, { automation, app, processEnv, services }),
      { concurrency: 1 }
    )
  })
