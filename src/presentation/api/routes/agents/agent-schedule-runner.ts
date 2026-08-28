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
 * [internal ref] measures, and why the cron path calls
 *    {@link fireAgentSchedule} in-process instead, the way
 *    `registerAccountPurgeScheduler` calls `purgeDueAccounts` directly.
 *
 * Keeping the run itself context-free is what lets both share it: the HTTP
 * envelope belongs to the route, the work belongs here.
 */

import { MirrorApprovalCreate } from '@/application/use-cases/agents/approval'
import { isAiProviderConfigured } from '@/domain/models/env/ai/ai-providers'
import { recordAgentActivity } from './agent-activity-log'
import { callAgentAi } from './agent-ai-call'
import {
  acquireConcurrencySlot,
  recordTokenUsage,
  releaseConcurrencySlot,
  resolveAgentLimits,
} from './agent-limits'
import { buildApprovalRecord } from './approval-presenter'
import { appendAgentActivityEntry, putApproval } from './approval-store'
import { runApprovalMirror, toMirrorRecord } from './effect-runner'
import type { Agent } from '@/domain/models/app/agents/agent'

/** Generic action label recorded for a scheduled agent run. */
export const SCHEDULE_ACTION = 'agent.scheduled'

/** What a completed scheduled run decided, before any HTTP mapping. */
export type ScheduledRunOutcome =
  | { readonly kind: 'completed' }
  | { readonly kind: 'pending_approval'; readonly approvalId: string }

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

/**
 * Run the scheduled task once: the AI round-trip carrying `taskPrompt` as the
 * user message, the token accounting that charges
 * it to the agent's daily budget, the activity-feed
 * attribution, and the approval decision
 *.
 *
 * The caller owns the concurrency slot — see {@link fireAgentSchedule} and the
 * route handler.
 *
 * @returns the tokens the round-trip consumed alongside the outcome, so an HTTP
 *   caller can apply the post-call daily-budget gate `/execute` applies.
 */
export const runScheduledAgentTask = async (
  agent: Agent,
  taskPrompt: string
): Promise<ScheduledRunOutcome> => {
  const agentName = agent.name

  // The AI round-trip's `usage.total_tokens` feeds the per-day budget. Until
  // this path recorded it, scheduled runs cost real provider tokens that
  // `GET /usage` never saw and `maxTokensPerDay` could never be reached by.
  const tokensUsed = await callAgentAi(agent, SCHEDULE_ACTION, taskPrompt)
  recordTokenUsage(agentName, tokensUsed)

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

  if (!scheduleRequiresApproval(agent)) return { kind: 'completed' }

  const record = buildApprovalRecord(agent, SCHEDULE_ACTION, {
    action: SCHEDULE_ACTION,
    taskPrompt,
  })
  putApproval(record)
  // eslint-disable-next-line functional/no-expression-statements -- best-effort DB mirror write; failure is discarded by the runner
  await runApprovalMirror(MirrorApprovalCreate(toMirrorRecord(record)))
  return { kind: 'pending_approval', approvalId: record.id }
}

/**
 * The cron entry point: fire one scheduled run in-process, or skip it silently.
 *
 * Skips — rather than erroring — when the agent has no schedule, is disabled
 *, the deployment has no AI provider ([internal ref]: a
 * declared agent is then INERT, and recording an `agent.scheduled` row for a
 * run that reached no provider would report work the deployment cannot have
 * done), or the agent is already at `maxConcurrentTasks` — which is what stops
 * a fast cron piling up in-flight runs behind a slow provider.
 *
 * Deliberately NOT subject to `permissions.trigger`, nor to the caller-facing
 * action rate limiter: the cron expression the operator wrote IS the rate.
 */
export const fireAgentSchedule = async (agent: Agent): Promise<void> => {
  const { schedule } = agent
  if (schedule === undefined || agent.enabled === false) return
  if (!isAiProviderConfigured(process.env)) return

  const limits = resolveAgentLimits(agent.limits)
  if (!acquireConcurrencySlot(agent.name, limits.maxConcurrentTasks)) return
  try {
    // eslint-disable-next-line functional/no-expression-statements -- the outcome is the scheduler's, not a caller's
    await runScheduledAgentTask(agent, schedule.taskPrompt)
  } finally {
    releaseConcurrencySlot(agent.name)
  }
}
