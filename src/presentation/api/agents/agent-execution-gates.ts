/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The operational pre-flight gates every agent run passes through.
 *
 * Shared by BOTH caller-facing entry points — `POST /api/agents/:name/execute`
 * and `POST /api/agents/:name/schedule/trigger`. They live in one module rather
 * than being re-stated per route on purpose: the manual schedule trigger is a
 * second way to run the same agent under the same privileged identity, and for
 * as long as it carried no gates of its own an operator who capped an agent at
 * two actions a minute got that cap on `/execute` and no cap at all here
 *. Sharing the code is what makes "the same
 * gates" true by construction instead of by two copies staying in step.
 */

import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import {
  checkChatRateLimit,
  resolveChatRateLimitConfig,
} from '@/presentation/api/ai/chat-rate-limit'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import { acquireConcurrencySlot, checkActionRateLimit, resolveAgentLimits } from './agent-limits'
import { checkAgentRateLimit } from './agent-rate-limit'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Context } from 'hono'

/**
 * Disabled-agent and action-rate-limit gates.
 *
 * Returns a short-circuit `Response` when the run must be denied — a disabled
 * agent (CROSS-004, SCHEDULE-007) or one that has tripped its action rate limit
 * (CROSS-005, SCHEDULE-010). Both run BEFORE the request body is parsed and
 * before any AI round-trip, so the provider is never called on a denied
 * request. Returns `undefined` when the run may proceed.
 */
export const checkExecutionGates = (c: Readonly<Context>, agent: Agent): Response | undefined => {
  if (agent.enabled === false) {
    return c.json(
      errorBody({
        error: `Agent '${agent.name}' is disabled and cannot execute actions.`,
        code: ApiErrorCode.FORBIDDEN,
      }),
      403
    )
  }
  // When the operator has configured the shared AI-chat rate limit
  // (`AI_CHAT_RATE_LIMIT`), agent API calls are throttled under the SAME
  // limiter as human chat — keyed by agent name so
  // each agent gets an independent counter. Otherwise fall back to the
  // role-proportional per-agent action ceiling.
  if (resolveChatRateLimitConfig().limit !== undefined) {
    const chatLimit = checkChatRateLimit(`agent:${agent.name}`)
    if (chatLimit.limited) {
      return c.json(
        errorBody({
          error: `Agent '${agent.name}' has exceeded its action rate limit.`,
          code: ApiErrorCode.RATE_LIMITED,
        }),
        429,
        { 'Retry-After': chatLimit.retryAfter.toString() }
      )
    }
    return undefined
  }
  const rateLimit = checkAgentRateLimit(agent.name, agent.role)
  if (rateLimit.limited) {
    return c.json(
      errorBody({
        error: `Agent '${agent.name}' has exceeded its action rate limit.`,
        code: ApiErrorCode.RATE_LIMITED,
      }),
      429,
      { 'Retry-After': rateLimit.retryAfter.toString() }
    )
  }
  return undefined
}

/**
 * Operational-limit pre-flight gate.
 *
 * Checked BEFORE the AI round-trip so an over-budget action never reaches the
 * provider. Returns a 202 `queued` response when the agent has exhausted its
 * `maxActionsPerMinute` window or has no free `maxConcurrentTasks` slot;
 * returns `undefined` when the action may proceed — in which case a concurrency
 * slot IS now held and the caller owes a `releaseConcurrencySlot`.
 *
 * A `queued` decision claims neither an action-window slot nor a concurrency
 * slot — the action is deferred, not dropped.
 */
export const checkLimitGates = (c: Readonly<Context>, agent: Agent): Response | undefined => {
  const limits = resolveAgentLimits(agent.limits)

  const rate = checkActionRateLimit(agent.name, limits.maxActionsPerMinute)
  if (rate.queued) {
    return c.json(
      { status: 'queued', agent: agent.name, reason: 'maxActionsPerMinute exceeded' },
      202
    )
  }

  if (!acquireConcurrencySlot(agent.name, limits.maxConcurrentTasks)) {
    return c.json(
      { status: 'queued', agent: agent.name, reason: 'maxConcurrentTasks reached' },
      202
    )
  }

  return undefined
}

/**
 * The daily-token-budget refusal.
 *
 * Shared because `approval-routes.ts` and `schedule-routes.ts` both reach it,
 * from the execute path and the schedule path, and had grown two byte-identical
 * copies of the message. It lives beside the other execution-gate refusals
 * rather than in `agent-limits.ts`: the budget PREDICATE is a limits concern,
 * the HTTP answer to it is a gate concern — the same split `agentNotFound`
 * already makes in `agent-lookup.ts`.
 */
export const tokenBudgetExhausted = (c: Readonly<Context>, agentName: string): Response =>
  c.json(
    errorBody({
      error: `Daily token budget exhausted for agent '${agentName}'.`,
      code: ApiErrorCode.RATE_LIMITED,
    }),
    429
  )
