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
 * presentation; `infrastructure-server` may, at its ONE pinned composition
 * root. Putting the wiring where the boundary allows it beats widening the
 * boundary for one caller.
 *
 * ## Why the fire arrives as a PARAMETER (W5b)
 *
 * This module used to `import { fireAgentSchedule } from
 * '@/presentation/api/agents/agent-schedule-runner'`, and it was the last
 * infrastructure file in the tree reaching presentation outside the pinned
 * roots. The plan was to retire that by extracting a use-case. Re-measured in
 * W5b, that extraction is still not available: `agent-schedule-runner.ts`
 * imports SIX relative siblings — the activity log, the AI call, the limit
 * ledger, the approval mirror, the approval presenter and the in-memory
 * approval store — every one of which lives in `presentation/api/agents/`.
 * Relocating the runner alone would buy six application -> presentation edges
 * to remove one, so the whole agent-run cluster has to move together, which is
 * a wave of its own.
 *
 * What IS available is the inversion. The fire is a parameter, supplied by
 * `compose-hono-app.ts` — the one infrastructure file pinned to name
 * presentation. This module is now layer-clean, and it gained a test seam it
 * did not have: a fake fire proves the registration walk without an AI
 * provider, an approval store or a token ledger.
 */

import { Data, Effect } from 'effect'
import { CronScheduler } from '@/application/ports/services/cron-scheduler'
import { logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { DomainContext, DomainServices } from '@/infrastructure/server/domain-runtime'

/**
 * One scheduled agent run, as this module sees it.
 *
 * The whole of what the scheduler needs from the agent runtime: fire this
 * agent on these services, resolve when it is done. It returns `void` and never
 * rejects usefully — the outcome belongs to the run, not to the timer — so the
 * callback below only has to absorb a rejection.
 */
export type FireAgentSchedule = (agent: Agent, services: DomainContext) => Promise<void>

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

/**
 * Build the per-agent cron callback: one in-process run, errors absorbed.
 *
 * `services` is the server's resolved approval-mirror context, captured ONCE at
 * registration while this code is still running on the domain context. A cron
 * callback fires on a timer with no request underneath it, so the services have
 * to be a value it closes over rather than a requirement it could declare — and
 * closing over the server's set is what stopped this path building a second
 * copy of the approval repository per run.
 */
const buildAgentCallback =
  (fire: FireAgentSchedule, agent: Agent, services: DomainContext) =>
  (): Effect.Effect<void, never> =>
    Effect.tryPromise({
      try: () => fire(agent, services),
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
  schedule: { readonly cron: string; readonly timezone: string },
  run: { readonly fire: FireAgentSchedule; readonly services: DomainContext }
): Effect.Effect<string, never> =>
  scheduler
    .schedule(schedule.cron, buildAgentCallback(run.fire, agent, run.services), {
      jobId: jobIdFor(agent),
      timezone: schedule.timezone,
    })
    .pipe(
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
 * Teardown rides on the scheduler's SCOPE: `CronSchedulerLive` is built by the
 * server's domain runtime, and disposing that runtime in `createStopEffect`
 * interrupts every armed fiber. Re-registering the same job id still cancels
 * the previous one — so a restart leaves no zombie timer firing an agent that
 * the new configuration no longer schedules.
 */
export const registerAgentSchedules = (
  app: App,
  fire: FireAgentSchedule
): Effect.Effect<readonly string[], never, CronScheduler | DomainServices> =>
  Effect.gen(function* () {
    const scheduled = (app.agents ?? []).filter(
      (agent) => agent.schedule !== undefined && agent.enabled !== false
    )
    if (scheduled.length === 0) return [] as readonly string[]

    const scheduler = yield* CronScheduler
    const services = yield* Effect.context<DomainServices>()
    return yield* Effect.forEach(
      scheduled,
      (agent) =>
        scheduleOne(
          scheduler,
          agent,
          {
            cron: agent.schedule?.cron ?? '',
            timezone: agent.schedule?.timezone ?? 'UTC',
          },
          { fire, services }
        ),
      { concurrency: 1 }
    )
  })
