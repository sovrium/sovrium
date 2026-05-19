/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Cron, DateTime, Either } from 'effect'
import { recordAgentActivity } from './agent-activity-log'
import { callAgentAi } from './agent-ai-call'
import { agentNotFound, findAgent } from './agent-lookup'
import { insertApprovalRow } from './approval-db'
import { buildApprovalRecord } from './approval-presenter'
import { appendAgentActivityEntry, putApproval } from './approval-store'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Context, Hono } from 'hono'

const SCHEDULE_ACTION = 'agent.scheduled'

const scheduleNotFound = (c: Readonly<Context>, agentName: string): Response =>
  c.json({ error: `Agent '${agentName}' has no schedule configured.` }, 404)

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

    if (agent.enabled === false) {
      return c.json(
        { error: `Agent '${agentName}' is disabled and cannot run scheduled tasks.` },
        403
      )
    }

    await callAgentAi(agent, SCHEDULE_ACTION, schedule.taskPrompt)

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

    if (scheduleRequiresApproval(agent)) {
      const record = buildApprovalRecord(agent, SCHEDULE_ACTION, {
        action: SCHEDULE_ACTION,
        taskPrompt: schedule.taskPrompt,
      })
      putApproval(record)
      await insertApprovalRow(record)
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

export function chainAgentScheduleRoutes<T extends Hono>(honoApp: T, app?: App): T {
  return honoApp
    .post('/api/agents/:name/schedule/trigger', (c) =>
      handleTriggerSchedule(app)(c as unknown as Readonly<Context>)
    )
    .get('/api/agents/:name/schedule', (c) =>
      handleGetSchedule(app)(c as unknown as Readonly<Context>)
    ) as T
}
