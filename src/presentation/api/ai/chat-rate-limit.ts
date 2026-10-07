/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-user AI chat rate limiter (in-memory sliding window).
 *
 * Drives `[internal ref]`
 * (the AI chat rate limiting requirement — Chat Rate Limiting).
 *
 * A burst of rapid `POST /api/ai/chat` calls from a single user must
 * eventually produce HTTP 429. Built on the shared
 * `createSlidingWindowLimiter()` primitive (see
 * `@/infrastructure/utils/sliding-window-limiter`) — a process-local Map of
 * recent timestamps keyed by the acting principal. The same caveat applies —
 * suitable only for single-process deployments, which is exactly the E2E
 * test topology (one server process per test).
 *
 * Operator-tunable env-var contract (both optional):
 *  - `AI_CHAT_RATE_LIMIT`  max messages allowed within the window. Unset →
 *                          rate limiting disabled (no 429 ever).
 *  - `AI_CHAT_RATE_WINDOW` sliding-window length in seconds. Unset → defaults
 *                          to 60 seconds.
 *
 * Frugal-by-default: when `AI_CHAT_RATE_LIMIT` is unset the limiter is a
 * no-op so existing chat specs (which never set the var) are unaffected.
 */

import { parsePositiveIntEnv } from '@/domain/models/process-env/positive-int-env'
import { createSlidingWindowLimiter } from '@/infrastructure/process/sliding-window-limiter'

const limiter = createSlidingWindowLimiter()

/** Default sliding-window length when `AI_CHAT_RATE_WINDOW` is unset. */
const DEFAULT_WINDOW_SECONDS = 60

/** Resolved, operator-tunable rate-limit configuration for the chat route. */
interface ChatRateLimitConfig {
  /** Max messages allowed within the window. `undefined` → limiting disabled. */
  readonly limit: number | undefined
  /** Sliding-window length in seconds. */
  readonly windowSeconds: number
}

/**
 * Resolve the chat rate-limit config from the environment. Read fresh on every
 * call so a test that sets the env vars per server boot is honoured.
 */
export const resolveChatRateLimitConfig = (): ChatRateLimitConfig => ({
  limit: parsePositiveIntEnv(process.env.AI_CHAT_RATE_LIMIT),
  windowSeconds: parsePositiveIntEnv(process.env.AI_CHAT_RATE_WINDOW) ?? DEFAULT_WINDOW_SECONDS,
})

export interface ChatRateLimitDecision {
  /** True when the attempt is rate-limited and must be rejected with 429. */
  readonly limited: boolean
  /** Whole seconds until the oldest in-window timestamp falls out (429 only). */
  readonly retryAfter: number
  /** Remaining quota within the current window after this attempt. */
  readonly remaining: number
  /** Resolved per-window limit, or `undefined` when limiting is disabled. */
  readonly limit: number | undefined
}

/**
 * Record a chat-message attempt for `principalKey` and decide whether it is
 * rate-limited.
 *
 * When `AI_CHAT_RATE_LIMIT` is unset the limiter is a pure no-op:
 * `limited: false`, `remaining` and `limit` are `undefined`/`Infinity`-ish and
 * no state is recorded.
 *
 * When `limited` is true the attempt is NOT recorded (so the window does not
 * keep extending under sustained load) and `retryAfter` carries the number of
 * whole seconds until the oldest in-window timestamp falls out.
 */
export const checkChatRateLimit = (principalKey: string): ChatRateLimitDecision => {
  const { limit, windowSeconds } = resolveChatRateLimitConfig()

  // Limiting disabled — never rate-limit, never record state.
  if (limit === undefined) {
    return { limited: false, retryAfter: 0, remaining: Number.MAX_SAFE_INTEGER, limit: undefined }
  }

  const decision = limiter.consume(principalKey, {
    windowMs: windowSeconds * 1000,
    maxRequests: limit,
  })
  return {
    limited: decision.limited,
    retryAfter: decision.retryAfter,
    remaining: decision.limited ? 0 : Math.max(0, limit - decision.count),
    limit,
  }
}
