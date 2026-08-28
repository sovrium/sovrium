/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Agent-schedule registration — the thing that makes `agent.schedule.cron` fire.
 *
 * `AgentScheduleSchema` has always decoded a cron expression and a timezone,
 * and `GET /api/agents/:name/schedule` has always echoed them back with a
 * `nextRunAt` computed on demand by `Cron.next()`. Nothing ever armed a timer:
 * `src/infrastructure/scheduling/` registers `app.automations` and the GDPR
 * erasure sweep, and had never contained the string "agent". A scheduled agent
 * was a promise the binary did not keep — and the readback made it look kept,
 * because `nextRunAt` is present whether or not anything is scheduled
 *.
 *
 * ## Why the fire is IN-PROCESS
 *
 * The callback calls `fireAgentSchedule` directly, the way
 * `registerAccountPurgeScheduler` calls `purgeDueAccounts` — never a loopback
 * POST to the route. That is not merely tidier: a loopback caller would arrive
 * with no session and be refused by the agent's own `permissions.trigger` gate,
 * so an agent declaring `trigger: ['admin']` would silently never run. A cron
 * fire is not an external caller and is deliberately not subject to that grant
 *.
 *
 * ## Why this module lives under `infrastructure/server/` and not `scheduling/`
 *
 * The run itself needs the agent runtime — the provider round-trip, the token
 * ledger, the activity feed — which lives in the presentation layer alongside
 * the routes that also use it. `infrastructure-scheduling` may not import
 * presentation; `infrastructure-server`, the composition root that already
 * wires every route, may. Putting the wiring where the boundary allows it beats
 * widening the boundary for one caller.
 */

import { Data, Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { logError } from '@/infrastructure/logging/logger'
import { CronSchedulerLive } from '@/infrastructure/scheduling/cron-scheduler-live'
import { fireAgentSchedule } from '@/presentation/api/routes/agents/agent-schedule-runner'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'

/**
 * Typed failure for one scheduled agent run — keeps the scheduler callback's
 * error channel typed rather than `unknown`. Logged, then swallowed, so a
 * misbehaving agent cannot stop the timer re-arming for the next tick.
 */
class AgentScheduleRunError extends Data.TaggedError('AgentScheduleRunError')<{
  readonly cause: unknown
}> {}

/**
 * Namespaced scheduler job id.
 *
 * `registerCronAutomations` keys its jobs by the bare automation name, so an
 * agent and an automation sharing a name would otherwise cancel one another on
 * the shared registry.
 */
const jobIdFor = (agent: Agent): string => `agent-schedule:${agent.name}`

/** Build the per-agent cron callback: one in-process run, errors absorbed. */
const buildAgentCallback = (agent: Agent) => (): Effect.Effect<void, never> =>
  Effect.tryPromise({
    try: () => fireAgentSchedule(agent),
    catch: (cause) => new AgentScheduleRunError({ cause }),
  }).pipe(
    Effect.tapError((error) =>
      Effect.sync(() => {
        logError('[agent-scheduler] scheduled agent run failed', error.cause, {
          name: agent.name,
        })
      })
    ),
    // Logged above, then dropped: a misbehaving agent must not stop the timer
    // re-arming for its next tick.
    Effect.ignore
  )

/**
 * Arm one agent's schedule. Logged-and-recovered on failure so one bad
 * expression cannot block the registrations that follow it.
 */
const scheduleOne = (
  scheduler: Effect.Success<typeof CronScheduler>,
  agent: Agent,
  cron: string,
  timezone: string
): Effect.Effect<string, never> =>
  scheduler.schedule(cron, buildAgentCallback(agent), { jobId: jobIdFor(agent), timezone }).pipe(
    Effect.catch((err) =>
      Effect.sync(() => {
        logError('[agent-scheduler] failed to schedule agent', err, { name: agent.name })
        return jobIdFor(agent) // best-effort: return the intended id
      })
    )
  )

/**
 * Walk `app.agents`, arm every enabled agent that declares a schedule, and
 * return the scheduled job ids.
 *
 * Called from `createServer` after the port is bound, alongside
 * `registerCronAutomations` and `registerAccountPurgeScheduler`. Disabled
 * agents are skipped at registration — never armed, so they never wake the
 * scheduler at all; `fireAgentSchedule` re-checks
 * the flag so the invariant holds for any other caller too.
 *
 * Teardown rides on the shared registry: `disposeCronScheduler()` in
 * `createStopEffect` clears every timer, and re-registering the same job id
 * cancels the previous one — so a restart leaves no zombie timer firing an
 * agent that the new configuration no longer schedules
 *.
 */
export const registerAgentSchedules = (app: App): Effect.Effect<readonly string[], never> =>
  Effect.gen(function* () {
    const scheduled = (app.agents ?? []).filter(
      (agent) => agent.schedule !== undefined && agent.enabled !== false
    )
    if (scheduled.length === 0) return [] as readonly string[]

    const scheduler = yield* CronScheduler
    return yield* Effect.forEach(
      scheduled,
      (agent) =>
        scheduleOne(
          scheduler,
          agent,
          agent.schedule?.cron ?? '',
          agent.schedule?.timezone ?? 'UTC'
        ),
      { concurrency: 1 }
    )
  }).pipe(Effect.provide(CronSchedulerLive))
