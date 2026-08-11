/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared in-memory sliding-window rate-limit primitive.
 *
 * Several rate limiters across the codebase need the identical
 * timestamp-array + retry-after math: the auth/admin/tables/activity limiters
 * (`route-setup/auth-route-utils.ts`), the AI chat limiter
 * (`presentation/api/routes/ai/chat-rate-limit.ts`), the per-agent limiter
 * (`presentation/api/routes/agents/agent-rate-limit.ts`), and the webhook
 * limiter (`presentation/api/routes/automations/webhook-rate-limit.ts`).
 *
 * This module factors out that core so each domain composes its own key
 * derivation + config map + decision shape on top of a single primitive. It
 * lives under `infrastructure/utils/` (a pure, no-I/O, no-DI helper) so it is
 * consumable from both infrastructure and presentation routes.
 *
 * Out of scope — left bespoke on purpose:
 *  - `mcp/rate-limit.ts` — a dual-window limiter with a JSON-RPC envelope and
 *    `X-RateLimit-*` headers; a naive merge would lose its distinct contract.
 *  - the `auth-route-utils.ts` admin window — a hardcoded 1-second window
 *    (vs the others' 60-second default); merging windows there would silently
 *    weaken admin rate limiting (a security regression).
 *
 * Caveat: the `Map` is process-local, so this is correct only for
 * single-process deployments. Horizontal scale-out requires a shared store
 * (Redis, etc.). This matches the E2E test topology (one server per test).
 */

/** Per-window configuration: window length and the request ceiling. */
export interface SlidingWindowConfig {
  readonly windowMs: number
  readonly maxRequests: number
}

/** The primitive API returned by {@link createSlidingWindowLimiter}. */
export interface SlidingWindowLimiter {
  /** Timestamps within `windowMs` for `key` (newest-inclusive). */
  readonly getRecent: (key: string, windowMs: number) => readonly number[]
  /** True when the in-window count meets/exceeds `config.maxRequests`. */
  readonly isExceeded: (key: string, config: SlidingWindowConfig) => boolean
  /** Append `now` to `key`'s history and return the new in-window history. */
  readonly record: (key: string, config: SlidingWindowConfig) => readonly number[]
  /**
   * Whole seconds until the oldest in-window request for `key` expires
   * (0 when there is no in-window history).
   */
  readonly getRetryAfter: (key: string, windowMs: number) => number
}

/**
 * Construct an in-memory sliding-window limiter. Each call returns an
 * isolated `Map<string, number[]>` so distinct domains do not share state.
 */
export const createSlidingWindowLimiter = (): SlidingWindowLimiter => {
  const state = new Map<string, number[]>()

  const getRecent = (key: string, windowMs: number): readonly number[] => {
    const now = Date.now()
    const history = state.get(key) ?? []
    return history.filter((timestamp) => now - timestamp < windowMs)
  }

  return {
    getRecent,
    isExceeded: (key, config) => getRecent(key, config.windowMs).length >= config.maxRequests,
    record: (key, config) => {
      const recent = getRecent(key, config.windowMs)
      const updated = [...recent, Date.now()]
      // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- Rate limiting requires mutable state
      state.set(key, updated)
      return updated
    },
    getRetryAfter: (key, windowMs) => {
      const recent = getRecent(key, windowMs)
      if (recent.length === 0) return 0
      const oldestRequest = Math.min(...recent)
      const resetTime = oldestRequest + windowMs
      const now = Date.now()
      const retryAfterMs = Math.max(0, resetTime - now)
      return Math.ceil(retryAfterMs / 1000)
    },
  }
}
