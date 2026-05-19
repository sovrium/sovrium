/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { createSlidingWindowLimiter } from '@/infrastructure/utils/sliding-window-limiter'

const limiter = createSlidingWindowLimiter()

const WINDOW_SECONDS = 60

const ROLE_CEILINGS: Readonly<Record<string, number>> = {
  admin: 60,
  member: 30,
  viewer: 10,
}

const DEFAULT_CEILING = 10

const ceilingForRole = (role: string): number => ROLE_CEILINGS[role] ?? DEFAULT_CEILING

export interface AgentRateLimitDecision {
  readonly limited: boolean
  readonly retryAfter: number
}

export const checkAgentRateLimit = (agentName: string, role: string): AgentRateLimitDecision => {
  const now = Date.now()
  const windowMs = WINDOW_SECONDS * 1000
  const ceiling = ceilingForRole(role)
  const recent = limiter.getRecent(agentName, windowMs)

  if (recent.length >= ceiling) {
    const oldest = Math.min(...recent)
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    return { limited: true, retryAfter }
  }

  limiter.record(agentName, { windowMs, maxRequests: ceiling })
  return { limited: false, retryAfter: 0 }
}
