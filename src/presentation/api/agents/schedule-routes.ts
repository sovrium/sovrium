/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI agent scheduling routes.
 *
 * Mounts the per-agent schedule surface asserted by
 * `[internal ref]`:
 *
 *   GET  /api/agents/:name/schedule          — schedule readback. Returns the
 *                                              agent's cron expression, the
 *                                              resolved timezone (default:
 *                                              the operator timezone), the
 *                                              taskPrompt, and the
 *                                              computed `nextRunAt`.
 *   POST /api/agents/:name/schedule/trigger   — manually run the scheduled
 *                                              task once. The agent's
 *                                              `taskPrompt` is sent to the LLM
 *                                              as the user message. Returns
 *                                              200 `completed`, 202
 *                                              `pending_approval` (human review
 *                                              needed) or `queued` (over
 *                                              budget), 403 when the agent is
 *                                              disabled, 429 when it has
 *                                              tripped its action rate limit or
 *                                              exhausted its daily tokens, 503
 *                                              when the deployment configures
 *                                              no AI provider, and 404 when the
 *                                              agent is undeclared, carries no
 *                                              schedule, or the caller may not
 *                                              trigger it.
 *
 * The trigger runs under EXACTLY the gates `/execute` runs under, and shares
 * their implementation (`agent-execution-gates.ts`). Until it did, an operator
 * who capped an agent at two actions a minute got that cap on `/execute` and no
 * cap at all here, and a scheduled run's token cost was dropped on the floor
 * (an AI agent schedule spec. -012).
 *
 * BOTH routes are gated by `permissions.trigger`: the trigger is a second way
 * to run the same agent under the same privileged identity, and the readback
 * serves `taskPrompt`, which is prompt material exactly as `systemPrompt` is.
 *
 * Cron expression and timezone validity are enforced at schema-decode time by
 * `AgentScheduleSchema`; these handlers assume a well-formed schedule.
 */

import { Cron, DateTime, Effect, Result } from 'effect'
import { agentScheduleResponseSchema } from '@/domain/models/api/agents/agents'
import { ApiErrorCode } from '@/domain/models/api/error'
import { resolveAgentLimits } from '@/domain/models/app/agents/agent-gate-validation'
import { isAiProviderConfigured } from '@/domain/models/process-env/ai/ai-providers'
import {
  isTokenBudgetExhausted,
  releaseConcurrencySlot,
} from '@/infrastructure/ai/agents/agent-limits'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import { checkTriggerPermission } from '@/presentation/api/agents/agent-trigger-guard'
import { agentNotFound, findAgent } from '@/presentation/api/runtime/agent-lookup'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import { answerFailures, runHandlerEffect, shapedJson } from '@/presentation/api/runtime/run-effect'
import {
  chargeRun,
  checkExecutionGates,
  checkLimitGates,
  tokenBudgetExhausted,
} from './agent-execution-gates'
import { scheduledAgentTask } from './agent-schedule-runner'
import { answerCompleted, answerPendingApproval } from './approval-presenter'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Context, Hono } from 'hono'

/**
 * Compute the next cron fire time for a schedule. Returns an empty object when
 * the cron / timezone fail to parse (already rejected at schema-decode time,
 * so this is belt-and-braces).
 */
const computeNextRunAt = (cron: string, timezone: string): Record<string, string> => {
  const zone = Result.try({
    try: () => DateTime.zoneMakeNamedUnsafe(timezone),
    catch: () => undefined,
  })
  if (Result.isFailure(zone)) return {}
  const parsed = Cron.parse(cron, zone.success)
  if (Result.isFailure(parsed)) return {}
  return { nextRunAt: Cron.next(parsed.success, new Date()).toISOString() }
}

/**
 * Resolve the agent a schedule route addresses: the scheduled agent, or the
 * response that stands in for it.
 *
 * The trigger gate runs BEFORE the "has a schedule" check on purpose: an agent
 * that exists but declares no schedule must be indistinguishable from one that
 * was never declared and from one the caller may not reach, or the three
 * answers become an enumeration oracle keyed on the name in the URL.
 */
const resolveScheduleTarget = (c: Context, app: App | undefined) =>
  Effect.gen(function* () {
    const agent = findAgent(app, c.req.param('name') ?? '')
    if (!agent) return { refusal: agentNotFound(c) }
    const triggerRefusal = yield* checkTriggerPermission(c, agent, app)
    if (triggerRefusal) return { refusal: triggerRefusal }
    const { schedule } = agent
    if (schedule === undefined) return { refusal: agentNotFound(c) }
    return { agent, schedule }
  })

const handleGetSchedule = (app: App | undefined) => (c: Context) =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.map(resolveScheduleTarget(c, app), (target) => {
        if (target.refusal) return target.refusal
        const { agent, schedule } = target

        // An omitted zone is the operator timezone (SOVRIUM_TIMEZONE, UTC when unset).
        const timezone = schedule.timezone ?? resolveOperatorTimezone(process.env)
        return shapedJson(
          c,
          {
            agent: agent.name,
            cron: schedule.cron,
            timezone,
            taskPrompt: schedule.taskPrompt,
            ...computeNextRunAt(schedule.cron, timezone),
          },
          agentScheduleResponseSchema
        )
      })
    )
  )

/**
 * Run the manual trigger while a concurrency slot is held, mirroring
 * `executeWithinSlot` on the execute path — including the post-call
 * daily-token gate, so `maxTokensPerDay` can actually be reached through this
 * route.
 */
const triggerWithinSlot = (
  c: Context,
  agent: Agent,
  run: { readonly taskPrompt: string; readonly app: App | undefined }
) =>
  Effect.gen(function* () {
    const { taskPrompt, app } = run
    const outcome = yield* scheduledAgentTask(agent, taskPrompt, app)
    // The gates only asked; a run whose actions charged nothing is charged once.
    if (outcome.actionsCharged === 0) chargeRun(agent)
    const limits = resolveAgentLimits(agent.limits)
    if (isTokenBudgetExhausted(agent.name, limits.maxTokensPerDay)) {
      return tokenBudgetExhausted(c, agent.name)
    }
    if (outcome.kind === 'pending_approval') {
      return answerPendingApproval(c, outcome.approvalId, agent.name)
    }
    return answerCompleted(c, agent.name)
  })

const triggerProgram = (c: Context, app: App | undefined) =>
  Effect.gen(function* () {
    const target = yield* resolveScheduleTarget(c, app)
    if (target.refusal) return target.refusal
    const { agent, schedule } = target

    // An agent on a deployment with no AI provider is INERT —
    // declared and discoverable but not runnable. Degrade with 503 rather than
    // calling an unreachable provider and then reporting `completed` for a run
    // that never happened.
    if (!isAiProviderConfigured(process.env)) {
      return c.json(
        errorBody({
          error: 'AI provider not configured — the assistant is currently unavailable.',
          code: ApiErrorCode.SERVICE_UNAVAILABLE,
        }),
        503
      )
    }

    // Disabled → 403 (SCHEDULE-007); action rate limit → 429 (SCHEDULE-010).
    // Both gates ASK without counting: each action the run takes is charged as
    // it passes the agent's own gates, and an action-less run is charged once
    // after it (`chargeRun`) — so a run's first action is never counted twice.
    const gateResponse = checkExecutionGates(c, agent, { record: false })
    if (gateResponse) return gateResponse

    // Operational budget → 202 `queued` (SCHEDULE-011). Claims a concurrency
    // slot when it lets the run through.
    const limitGate = checkLimitGates(c, agent, { record: false })
    if (limitGate) return limitGate

    return yield* triggerWithinSlot(c, agent, { taskPrompt: schedule.taskPrompt, app }).pipe(
      Effect.ensuring(Effect.sync(() => releaseConcurrencySlot(agent.name)))
    )
  })

const handleTriggerSchedule = (app: App | undefined) => (c: Context) =>
  runHandlerEffect(c, answerFailures(c, triggerProgram(c, app)))

/**
 * Chain agent scheduling routes onto a Hono app.
 *
 * Always registered. When `app.agents` is unset every handler returns 404 for
 * the unknown agent, so the API shape stays stable across configurations. The
 * static `/schedule/trigger` route is registered before `/schedule` so the
 * more specific path takes precedence.
 */
export function chainAgentScheduleRoutes<T extends Hono>(honoApp: T, app?: App): T {
  return honoApp
    .post('/api/agents/:name/schedule/trigger', (c) => handleTriggerSchedule(app)(c))
    .get('/api/agents/:name/schedule', (c) => handleGetSchedule(app)(c)) as T
}
