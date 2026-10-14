/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One scheduled agent run, with no HTTP shape attached.
 *
 * Two callers reach this module and they arrive by very different routes:
 *
 *  - `POST /api/agents/:name/schedule/trigger` — an EXTERNAL caller asking for
 *    the task to be run now. Subject to `permissions.trigger` and to every
 *    operational gate `/execute` enforces, all applied by the route handler
 *    before it gets here.
 *  - the live cron scheduler — not a caller at all. `permissions.trigger`
 *    governs who may invoke an agent from outside; a timer is inside, so it is
 *    deliberately NOT gated by it. A scheduler that posted to its own
 *    `/schedule/trigger` over loopback would arrive with no session and be
 *    refused by the very grant the agent declares — which is exactly what
 *    an AI agent schedule spec measures, and why the cron path calls
 *    {@link fireAgentSchedule} in-process instead, the way
 *    `registerAccountPurgeScheduler` calls `purgeDueAccounts` directly.
 *
 * Keeping the run itself context-free is what lets both share it: the HTTP
 * envelope belongs to the route, the work belongs here.
 */

import { Effect, Option } from 'effect'
import { dispatchAgentAction } from '@/application/use-cases/agents/agent-action-dispatch'
import {
  runAgentTurnToEnd,
  type AgentTurnResult,
} from '@/application/use-cases/agents/agent-runtime'
import { resolveAgentLimits } from '@/domain/models/app/agents/agent-gate-validation'
import {
  buildAgentActionTools,
  buildAgentSystemPrompt,
  isAgentActionName,
} from '@/domain/models/app/agents/agent-turn-service'
import { isAiProviderConfigured } from '@/domain/models/process-env/ai/ai-providers'
import { logError } from '@/infrastructure/logging/logger'
import { runOnDomain } from '@/infrastructure/logging/request-effect'
import {
  acquireConcurrencySlot,
  releaseConcurrencySlot,
} from '@/infrastructure/process/agent-limits'
import { recordAgentActivity } from './agent-activity-log'
import { recordFeedAction } from './approval-store-access'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

/** Generic action label recorded for a scheduled agent run. */
export const SCHEDULE_ACTION = 'agent.scheduled'

/** Model calls a scheduled run may make before it stops asking for tools. */
const SCHEDULE_MAX_STEPS = 10

/** What a completed scheduled run decided, before any HTTP mapping. */
export type ScheduledRunOutcome = (
  | { readonly kind: 'completed' }
  | { readonly kind: 'pending_approval'; readonly approvalId: string }
) & {
  /** Actions the run took past the agent's rate and window gates — each charged as it passed. */
  readonly actionsCharged: number
}

/** Agent actions a run's gates admitted: each one was charged to the agent's counters. */
const chargedActions = (turn: AgentTurnResult | undefined): number =>
  (turn?.toolResults ?? []).filter(
    (result) => isAgentActionName(result.name) && result.outcome !== 'denied'
  ).length

/** The scheduled run itself, on the agent runtime; `undefined` when it could not run. */
const runScheduledTurn = (
  agent: Agent,
  taskPrompt: string,
  services: DomainContext,
  app: App
): Promise<AgentTurnResult | undefined> =>
  runOnDomain(
    services,
    runAgentTurnToEnd({
      surface: 'schedule',
      agent,
      app,
      tools: {
        runAction: (action, props) =>
          dispatchAgentAction({ app, agentName: agent.name, action, props }),
      },
      messages: [
        { role: 'system', content: buildAgentSystemPrompt(agent) },
        { role: 'user', content: taskPrompt },
      ],
      toolDefinitions: buildAgentActionTools(agent),
      maxSteps: SCHEDULE_MAX_STEPS,
      model: { model: agent.model, temperature: agent.temperature, maxTokens: agent.maxTokens },
    }).pipe(
      Effect.asSome,
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError('[agents] scheduled run failed', cause, { agent: agent.name })
        })
      ),
      // effect-swallow: a run whose provider failed is still a run the schedule fired — it is recorded like any other, and the failure is logged above.
      Effect.catchCause(() => Effect.succeedNone),
      Effect.map(Option.getOrUndefined)
    )
  )

/**
 * Run the scheduled task once, on the agent runtime: `taskPrompt` is the user
 * message, the agent's allowlisted actions are its tools, and each call the
 * model makes runs through the agent's gates. Approval is per CALL: a run
 * starts at once, and only an action the agent's approval rule covers waits for
 * a human — the run's outcome is then `pending_approval`, naming it.
 *
 * The run is charged to the agent's daily token budget and recorded on the
 * activity feeds as `agent.scheduled`; each action it took is recorded as
 * itself. The caller owns the concurrency slot.
 */
export const runScheduledAgentTask = async (
  agent: Agent,
  taskPrompt: string,
  services: DomainContext,
  app: App | undefined
): Promise<ScheduledRunOutcome> => {
  const agentName = agent.name
  const turn =
    app === undefined ? undefined : await runScheduledTurn(agent, taskPrompt, services, app)

  await recordAgentActivity(services, {
    actorName: agentName,
    action: SCHEDULE_ACTION,
    targetTable: undefined,
    surface: 'schedule',
  })
  await recordFeedAction(services, {
    action: SCHEDULE_ACTION,
    agentName,
    targetTable: undefined,
    recordId: undefined,
    runStartedById: undefined,
  })

  const pending = turn?.toolResults.find((result) => result.approvalId !== undefined)
  const actionsCharged = chargedActions(turn)
  return pending?.approvalId === undefined
    ? { kind: 'completed', actionsCharged }
    : { kind: 'pending_approval', approvalId: pending.approvalId, actionsCharged }
}

/**
 * The cron entry point: fire one scheduled run in-process, or skip it silently.
 *
 * Skips — rather than erroring — when the agent has no schedule, is disabled
 * the deployment has no AI provider (the inert-AI-agent boot rule: a
 * declared agent is then INERT, and recording an `agent.scheduled` row for a
 * run that reached no provider would report work the deployment cannot have
 * done), or the agent is already at `maxConcurrentTasks` — which is what stops
 * a fast cron piling up in-flight runs behind a slow provider.
 *
 * Deliberately NOT subject to `permissions.trigger`, nor to the caller-facing
 * action rate limiter: the cron expression the operator wrote IS the rate.
 */
export const fireAgentSchedule = async (
  agent: Agent,
  services: DomainContext,
  app: App
): Promise<void> => {
  const { schedule } = agent
  if (schedule === undefined || agent.enabled === false) return
  if (!isAiProviderConfigured(process.env)) return

  const limits = resolveAgentLimits(agent.limits)
  if (!acquireConcurrencySlot(agent.name, limits.maxConcurrentTasks)) return
  try {
    await runScheduledAgentTask(agent, schedule.taskPrompt, services, app)
  } finally {
    releaseConcurrencySlot(agent.name)
  }
}
