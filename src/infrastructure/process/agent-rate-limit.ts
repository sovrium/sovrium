/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-agent action rate limiter (in-memory sliding window).
 *
 * An agent's actions are subject to the same kind of
 * rate limiting human users face — a burst of rapid `POST
 * /api/agents/:name/execute` calls must eventually produce HTTP 429.
 *
 * Built on the shared `createSlidingWindowLimiter()` primitive (see
 * `@/infrastructure/utils/sliding-window-limiter`) — a process-local Map of
 * recent timestamps. The same caveat applies — suitable only for
 * single-process deployments, which is exactly the E2E test topology (one
 * server process per test).
 *
 * The limit is keyed by agent name. The agent's auth role determines the
 * ceiling so an agent is throttled in proportion to the privileges of the
 * role it impersonates (higher-level roles get a larger burst budget),
 * exactly as a human user with that role would be.
 */

import { roleActionCeiling } from '@/domain/models/app/agents/agent-gate-validation'
import { createSlidingWindowLimiter } from './sliding-window-limiter'

const limiter = createSlidingWindowLimiter()

/** Sliding-window length for the per-agent action limiter (seconds). */
const WINDOW_SECONDS = 60

export interface AgentRateLimitDecision {
  readonly limited: boolean
  readonly retryAfter: number
}

/** Whether a check counts the attempt (the default) or only asks. */
export interface LimitCheckOptions {
  /** `false`: decide without recording, for a gate whose run is charged later. */
  readonly record?: boolean
}

/**
 * Record an agent action attempt and decide whether it is rate-limited.
 *
 * When `limited` is true the attempt is NOT recorded (so the window does not
 * keep extending under sustained load) and `retryAfter` carries the number of
 * whole seconds until the oldest in-window timestamp falls out.
 */
export const checkAgentRateLimit = (
  agentName: string,
  role: string,
  options: LimitCheckOptions = {}
): AgentRateLimitDecision => {
  const now = Date.now()
  const windowMs = WINDOW_SECONDS * 1000
  const ceiling = roleActionCeiling(role)
  const recent = limiter.getRecent(agentName, windowMs)

  if (recent.length >= ceiling) {
    // Limited attempts are NOT recorded; `Math.max(1, …)` floors retry-after
    // at 1s (the shared primitive's getRetryAfter floors at 0s).
    const oldest = Math.min(...recent)
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    return { limited: true, retryAfter }
  }

  if (options.record !== false) limiter.record(agentName, { windowMs, maxRequests: ceiling })
  return { limited: false, retryAfter: 0 }
}
