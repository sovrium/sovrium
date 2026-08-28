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
 *                                              resolved timezone (default
 *                                              UTC), the taskPrompt, and the
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
 * ([internal ref].. -012).
 *
 * BOTH routes are gated by `permissions.trigger`: the trigger is a second way
 * to run the same agent under the same privileged identity, and the readback
 * serves `taskPrompt`, which is prompt material exactly as `systemPrompt` is
 *.
 *
 * Cron expression and timezone validity are enforced at schema-decode time by
 * `AgentScheduleSchema`; these handlers assume a well-formed schedule.
 */

import { Cron, DateTime, Result } from 'effect'
import { isAiProviderConfigured } from '@/domain/models/env/ai/ai-providers'
import { checkExecutionGates, checkLimitGates } from './agent-execution-gates'
import { isTokenBudgetExhausted, releaseConcurrencySlot, resolveAgentLimits } from './agent-limits'
import { agentNotFound, findAgent } from './agent-lookup'
import { runScheduledAgentTask } from './agent-schedule-runner'
import { checkTriggerPermission } from './agent-trigger-guard'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Context, Hono } from 'hono'

/** A declared agent schedule, once its presence has been established. */
type AgentSchedule = NonNullable<Agent['schedule']>

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

/** Either the addressed scheduled agent, or the response that stands in for it. */
type ScheduleTarget =
  { readonly agent: Agent; readonly schedule: AgentSchedule } | { readonly refusal: Response }

/**
 * Resolve the agent a schedule route addresses.
 *
 * The trigger gate runs BEFORE the "has a schedule" check on purpose: an agent
 * that exists but declares no schedule must be indistinguishable from one that
 * was never declared and from one the caller may not reach, or the three
 * answers become an enumeration oracle keyed on the name in the URL.
 */
const resolveScheduleTarget = async (
  c: Readonly<Context>,
  app: App | undefined
): Promise<ScheduleTarget> => {
  const agent = findAgent(app, c.req.param('name') ?? '')
  if (!agent) return { refusal: agentNotFound(c) }
  const triggerRefusal = await checkTriggerPermission(c, agent)
  if (triggerRefusal) return { refusal: triggerRefusal }
  const { schedule } = agent
  if (schedule === undefined) return { refusal: agentNotFound(c) }
  return { agent, schedule }
}

const handleGetSchedule =
  (app: App | undefined) =>
  async (c: Readonly<Context>): Promise<Response> => {
    const target = await resolveScheduleTarget(c, app)
    if ('refusal' in target) return target.refusal
    const { agent, schedule } = target

    // [internal ref]: timezone defaults to UTC when not specified.
    const timezone = schedule.timezone ?? 'UTC'
    return c.json(
      {
        agent: agent.name,
        cron: schedule.cron,
        timezone,
        taskPrompt: schedule.taskPrompt,
        ...computeNextRunAt(schedule.cron, timezone),
      },
      200
    )
  }

/**
 * Run the manual trigger while a concurrency slot is held, mirroring
 * `executeWithinSlot` on the execute path — including the post-call
 * daily-token gate, so `maxTokensPerDay` can actually be reached through this
 * route.
 */
const triggerWithinSlot = async (
  c: Readonly<Context>,
  agent: Agent,
  taskPrompt: string
): Promise<Response> => {
  const outcome = await runScheduledAgentTask(agent, taskPrompt)
  const limits = resolveAgentLimits(agent.limits)
  if (isTokenBudgetExhausted(agent.name, limits.maxTokensPerDay)) {
    return c.json({ error: `Daily token budget exhausted for agent '${agent.name}'.` }, 429)
  }
  if (outcome.kind === 'pending_approval') {
    return c.json(
      {
        status: 'pending_approval',
        approvalRequired: true,
        approvalId: outcome.approvalId,
        agent: agent.name,
      },
      202
    )
  }
  return c.json({ status: 'completed', approvalRequired: false, agent: agent.name }, 200)
}

const handleTriggerSchedule =
  (app: App | undefined) =>
  async (c: Readonly<Context>): Promise<Response> => {
    const target = await resolveScheduleTarget(c, app)
    if ('refusal' in target) return target.refusal
    const { agent, schedule } = target

    // [internal ref]: an agent on a deployment with no AI provider is INERT —
    // declared and discoverable but not runnable. Degrade with 503 rather than
    // calling an unreachable provider and then reporting `completed` for a run
    // that never happened.
    if (!isAiProviderConfigured(process.env)) {
      return c.json(
        { error: 'AI provider not configured — the assistant is currently unavailable.' },
        503
      )
    }

    // Disabled → 403 (SCHEDULE-007); action rate limit → 429 (SCHEDULE-010).
    const gateResponse = checkExecutionGates(c, agent)
    if (gateResponse) return gateResponse

    // Operational budget → 202 `queued` (SCHEDULE-011). Claims a concurrency
    // slot when it lets the run through.
    const limitGate = checkLimitGates(c, agent)
    if (limitGate) return limitGate

    try {
      return await triggerWithinSlot(c, agent, schedule.taskPrompt)
    } finally {
      releaseConcurrencySlot(agent.name)
    }
  }

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
    .post('/api/agents/:name/schedule/trigger', (c) =>
      handleTriggerSchedule(app)(c as unknown as Readonly<Context>)
    )
    .get('/api/agents/:name/schedule', (c) =>
      handleGetSchedule(app)(c as unknown as Readonly<Context>)
    ) as T
}
