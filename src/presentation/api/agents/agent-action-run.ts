/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `POST /api/agents/:name/execute` once its gates passed: the action itself,
 * inside a concurrency slot. The route owns the gates and the answers they give.
 */

import { Effect } from 'effect'
import { mirrorApprovalCreate } from '@/application/use-cases/agents/approval'
import {
  requiresApproval,
  resolveAgentLimits,
} from '@/domain/models/app/agents/agent-gate-validation'
import { buildApprovalRecord } from '@/domain/models/app/agents/approval-record-service'
import {
  isTokenBudgetExhausted,
  recordTokenUsage,
  releaseConcurrencySlot,
} from '@/infrastructure/ai/agents/agent-limits'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { recordAgentActivity } from './agent-activity-log'
import { callAgentAi } from './agent-ai-call'
import { checkLimitGates, tokenBudgetExhausted } from './agent-execution-gates'
import { mirrorBestEffort, toMirrorRecord } from './approval-mirror'
import { answerCompleted, answerPendingApproval } from './approval-presenter'
import { openApproval, recordFeedAction } from './approval-store-access'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Context } from 'hono'

export interface ExecuteRequestBody {
  readonly action?: unknown
  readonly message?: unknown
  readonly table?: unknown
  readonly recordId?: unknown
  readonly fields?: unknown
}

/**
 * Log an agent action in both activity sinks and return who started its run.
 *
 * The action appears in activity monitoring with
 * actor_type='agent' and actor_name set to the agent name. An AI agent perms spec
 * / -007: it also joins the `GET /api/activity` `entries` feed, alongside
 * approval decisions, carrying the table and row it targets — the records read
 * gate a non-admin reader is held to — and the account id of whoever started
 * the run, the one identity the feed's audience rule trusts.
 */
const logAgentAction = (c: Context, agentName: string, action: string, body: ExecuteRequestBody) =>
  Effect.gen(function* () {
    const targetTable = typeof body.table === 'string' ? body.table : undefined
    const recordId =
      typeof body.recordId === 'string' || typeof body.recordId === 'number'
        ? String(body.recordId)
        : undefined
    const startedById = getSessionContext(c as Context)?.userId
    yield* recordAgentActivity({ actorName: agentName, action, targetTable })
    yield* recordFeedAction({
      action,
      agentName,
      targetTable,
      recordId,
      runStartedById: startedById,
    })
    return startedById
  })

/**
 * Run the agent action once it has passed all pre-flight gates: perform the
 * observational AI round-trip, write the activity-log entry, and either
 * complete immediately or queue an approval request.
 */
export const runAgentAction = (
  c: Context,
  agent: Agent,
  body: ExecuteRequestBody,
  action: string
) =>
  Effect.suspend(() => {
    const { name: agentName } = agent

    // Rate + concurrency gates. A `queued`
    // response is returned WITHOUT calling the AI provider — the action is
    // deferred, not executed.
    const limitGate = checkLimitGates(c, agent)
    if (limitGate) return Effect.succeed(limitGate)

    // A concurrency slot is now held — release it on every exit path below.
    return executeWithinSlot(c, agent, body, action).pipe(
      Effect.ensuring(Effect.sync(() => releaseConcurrencySlot(agentName)))
    )
  })

/**
 * Execute the agent action while holding a concurrency slot: AI round-trip,
 * token accounting, activity log, and the completed / approval-pending /
 * token-exhausted decision.
 */
const executeWithinSlot = (c: Context, agent: Agent, body: ExecuteRequestBody, action: string) =>
  Effect.gen(function* () {
    const { name: agentName } = agent
    const limits = resolveAgentLimits(agent.limits)
    const payload: Record<string, unknown> = {
      action,
      ...(typeof body.table === 'string' && { table: body.table }),
      ...(body.recordId !== undefined && { recordId: body.recordId }),
      ...(body.fields !== undefined && { fields: body.fields }),
    }

    // The AI round-trip is observational; its `usage.total_tokens` feeds the
    // per-day token budget.
    const tokensUsed = yield* callAgentAi(agent, action)
    recordTokenUsage(agentName, tokensUsed)

    // Once the daily token budget can no longer cover
    // another LLM round-trip, the action fails with an explicit error. The AI
    // call above has already been made (and observed) — the budget check is
    // post-call so the provider round-trip is never silently skipped.
    if (isTokenBudgetExhausted(agentName, limits.maxTokensPerDay)) {
      return tokenBudgetExhausted(c, agentName)
    }

    const startedById = yield* logAgentAction(c, agentName, action, body)

    if (!requiresApproval(agent, action)) {
      return answerCompleted(c, agentName)
    }

    const record = buildApprovalRecord({
      id: crypto.randomUUID(),
      nowMs: Date.now(),
      agent,
      action,
      payload,
      requestedById: startedById,
    })
    yield* openApproval(record)
    yield* mirrorBestEffort(mirrorApprovalCreate(toMirrorRecord(record)))

    return answerPendingApproval(c, record.id, agentName)
  })
