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
 *                                              200 `completed` for an agent
 *                                              whose approval mode allows
 *                                              immediate execution, 202
 *                                              `pending_approval` when the
 *                                              schedule action needs human
 *                                              review, 403 when the agent is
 *                                              disabled, 404 when the agent or
 *                                              its schedule is not declared.
 *
 * Cron expression and timezone validity are enforced at schema-decode time by
 * `AgentScheduleSchema`; these handlers assume a well-formed schedule.
 */

import { Cron, DateTime, Either } from 'effect'
import { MirrorApprovalCreate } from '@/application/use-cases/agents/approval'
import { recordAgentActivity } from './agent-activity-log'
import { callAgentAi } from './agent-ai-call'
import { agentNotFound, findAgent } from './agent-lookup'
import { buildApprovalRecord } from './approval-presenter'
import { appendAgentActivityEntry, putApproval } from './approval-store'
import { runApprovalMirror, toMirrorRecord } from './effect-runner'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Context, Hono } from 'hono'

/** Generic action label recorded for a scheduled agent run. */
const SCHEDULE_ACTION = 'agent.scheduled'

/** Standard 404 body for an agent that has no `schedule` configuration. */
const scheduleNotFound = (c: Readonly<Context>, agentName: string): Response =>
  c.json({ error: `Agent '${agentName}' has no schedule configured.` }, 404)

/**
 * Compute the next cron fire time for a schedule. Returns an empty object when
 * the cron / timezone fail to parse (already rejected at schema-decode time,
 * so this is belt-and-braces).
 */
const computeNextRunAt = (cron: string, timezone: string): Record<string, string> => {
  const zone = Either.try({
    try: () => DateTime.zoneUnsafeMakeNamed(timezone),
    catch: () => undefined,
  })
  if (Either.isLeft(zone)) return {}
  const parsed = Cron.parse(cron, zone.right)
  if (Either.isLeft(parsed)) return {}
  return { nextRunAt: Cron.next(parsed.right, new Date()).toISOString() }
}

/**
 * Decide whether the agent's approval configuration requires its scheduled
 * action to be queued for human review. `mode: 'all'` pauses every action;
 * `mode: 'selective'` pauses only listed actions; `mode: 'none'` never pauses.
 */
const scheduleRequiresApproval = (agent: Agent): boolean => {
  const mode = agent.approval?.mode ?? 'none'
  if (mode === 'all') return true
  if (mode === 'selective') {
    return (agent.approval?.required ?? []).includes(SCHEDULE_ACTION)
  }
  return false
}

const handleGetSchedule =
  (app: App | undefined) =>
  (c: Readonly<Context>): Response => {
    const agentName = c.req.param('name') ?? ''
    const agent = findAgent(app, agentName)
    if (!agent) return agentNotFound(c, agentName)
    const { schedule } = agent
    if (schedule === undefined) return scheduleNotFound(c, agentName)

    // [internal ref]: timezone defaults to UTC when not specified.
    const timezone = schedule.timezone ?? 'UTC'
    return c.json(
      {
        agent: agentName,
        cron: schedule.cron,
        timezone,
        taskPrompt: schedule.taskPrompt,
        ...computeNextRunAt(schedule.cron, timezone),
      },
      200
    )
  }

const handleTriggerSchedule =
  (app: App | undefined) =>
  async (c: Readonly<Context>): Promise<Response> => {
    const agentName = c.req.param('name') ?? ''
    const agent = findAgent(app, agentName)
    if (!agent) return agentNotFound(c, agentName)
    const { schedule } = agent
    if (schedule === undefined) return scheduleNotFound(c, agentName)

    // [internal ref]: a disabled agent skips scheduled execution.
    if (agent.enabled === false) {
      return c.json(
        { error: `Agent '${agentName}' is disabled and cannot run scheduled tasks.` },
        403
      )
    }

    // [internal ref]: the agent's taskPrompt is sent to the LLM as
    // the user message for the scheduled execution.
    // eslint-disable-next-line functional/no-expression-statements -- observational AI round-trip
    await callAgentAi(agent, SCHEDULE_ACTION, schedule.taskPrompt)

    // eslint-disable-next-line functional/no-expression-statements -- best-effort activity write
    await recordAgentActivity({
      actorName: agentName,
      action: SCHEDULE_ACTION,
      targetTable: undefined,
    })
    appendAgentActivityEntry({
      id: crypto.randomUUID(),
      action: SCHEDULE_ACTION,
      agentName,
      actor: { type: 'agent', name: agentName },
      targetTable: undefined,
      createdAt: new Date().toISOString(),
    })

    // [internal ref]: scheduled execution respects the agent's
    // approval config — `mode: all` queues the action for human review.
    if (scheduleRequiresApproval(agent)) {
      const record = buildApprovalRecord(agent, SCHEDULE_ACTION, {
        action: SCHEDULE_ACTION,
        taskPrompt: schedule.taskPrompt,
      })
      putApproval(record)
      // eslint-disable-next-line functional/no-expression-statements -- best-effort DB mirror write; failure is discarded by the runner
      await runApprovalMirror(MirrorApprovalCreate(toMirrorRecord(record)))
      return c.json(
        {
          status: 'pending_approval',
          approvalRequired: true,
          approvalId: record.id,
          agent: agentName,
        },
        202
      )
    }

    return c.json({ status: 'completed', approvalRequired: false, agent: agentName }, 200)
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
