/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AgentGuard } from '@/application/ports/services/agent-guard'
import { checkActionRateLimit, recordTokenUsage } from './agent-limits'
import { checkAgentRateLimit } from './agent-rate-limit'
import { checkChatRateLimit, resolveChatRateLimitConfig } from './chat-rate-limit'

/**
 * The agent counters, process-local like every limiter here.
 *
 * The rate limit mirrors the run-level gate the agent routes apply: when the
 * operator configured the shared chat limiter (`AI_CHAT_RATE_LIMIT`) an agent
 * is throttled under it, keyed by its name; otherwise under the ceiling of the
 * role it acts with. The action window then applies `maxActionsPerMinute`.
 */
export const AgentGuardLive = Layer.succeed(AgentGuard, {
  admitAction: (agent) =>
    Effect.sync(() => {
      const limited =
        resolveChatRateLimitConfig().limit !== undefined
          ? checkChatRateLimit(`agent:${agent.name}`).limited
          : checkAgentRateLimit(agent.name, agent.role).limited
      if (limited) return 'rate-limited' as const
      return checkActionRateLimit(agent.name, agent.maxActionsPerMinute).queued
        ? ('queued' as const)
        : undefined
    }),
  recordTokens: (agentName, tokens) => Effect.sync(() => recordTokenUsage(agentName, tokens)),
})
