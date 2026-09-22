/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared in-memory sliding-window rate-limit primitive.
 *
 * Every in-process rate limiter in the codebase needs the identical
 * timestamp-array + retry-after math: the auth/admin/tables/activity limiters
 * (`route-setup/auth-route-utils.ts`), the AI chat limiter
 * (`presentation/api/routes/ai/chat-rate-limit.ts`), the per-agent limiters
 * (`agents/agent-rate-limit.ts`, `agents/agent-limits.ts`), the webhook
 * limiter (`automations/webhook-rate-limit.ts`), the shared-views and
 * command-search limiters, the MCP dual-window limiter
 * (`route-setup/mcp/rate-limit.ts`), the form anti-spam limiter
 * (`infrastructure/forms/form-rate-limiter.ts`), and the telemetry report
 * budget (`infrastructure/telemetry/error-reporter.ts`).
 *
 * This module factors out that core so each domain composes its own key
 * derivation + config map + decision shape on top of a single primitive. It
 * lives under `infrastructure/utils/` (a pure, no-I/O, no-DI helper) so it is
 * consumable from both infrastructure and presentation routes — the
 * `infrastructure-utils` element type is on the `presentation-api-route`
 * allowlist precisely because helpers here hold no live handle.
 *
 * What is deliberately NOT built on this primitive, and why:
 *
 *  - **TTL dedup caches** — `automations/webhook-dedup.ts` and the two guards
 *    in `error-reporter.ts` (`isDuplicateObject`, `isDuplicateFingerprint`).
 *    They store ONE timestamp per key and answer "seen recently?", with no
 *    count, no ceiling, no `Retry-After` and no 429; the rejection outcome is
 *    a silent drop. Expressing them as `maxRequests: 1` would type-check and
 *    misdescribe them.
 *  - **Counters and budgets** — `agent-limits.ts`'s concurrency slots (a
 *    semaphore over an integer) and its per-UTC-day token budget (an
 *    accumulator that resets on a calendar boundary, not a rolling window).
 *  - **The `auth-route-utils.ts` admin window's SCALE** — a hardcoded
 *    1-second window against the others' 60-second default. It composes this
 *    primitive, but merging the two window lengths would silently weaken
 *    admin from 10 req/s to 10 req/min (a security regression). See that
 *    file's header.
 *
 * Caveat: the `Map` is process-local, so this is correct only for
 * single-process deployments. Horizontal scale-out requires a shared store
 * (Redis, etc.). This matches the E2E test topology (one server per test).
 *
 * Effect's own `RateLimiter` was evaluated and rejected for this role: it
 * ships under `effect/unstable/persistence` (the unstable tier, whose
 * acceptance is scoped to two telemetry/devtools files), it offers
 * `fixed-window` and `token-bucket` algorithms but not a sliding window, and
 * it requires a `RateLimiterStore` layer in Effect context — while every call
 * site here is a synchronous Hono middleware or a fire-and-forget telemetry
 * hook.
 */

/** Per-window configuration: window length and the request ceiling. */
export interface SlidingWindowConfig {
  readonly windowMs: number
  readonly maxRequests: number
}

/** Options for {@link SlidingWindowLimiter.getRetryAfter}. */
export interface RetryAfterOptions {
  /** Clock override for deterministic tests. Defaults to `Date.now()`. */
  readonly now?: number
  /**
   * Floor for the returned value. RFC 7231 §7.1.3 requires a positive
   * integer in a `Retry-After` header — clients ignore `Retry-After: 0` — so
   * a caller emitting the value as a header passes `1`. Defaults to `0`,
   * which reports "no wait" honestly for callers that only read the number.
   */
  readonly minSeconds?: number
}

/** The primitive API returned by {@link createSlidingWindowLimiter}. */
export interface SlidingWindowLimiter {
  /** Timestamps within `windowMs` for `key` (newest-inclusive). */
  readonly getRecent: (key: string, windowMs: number, now?: number) => readonly number[]
  /** True when the in-window count meets/exceeds `config.maxRequests`. */
  readonly isExceeded: (key: string, config: SlidingWindowConfig, now?: number) => boolean
  /** Append `now` to `key`'s history and return the new in-window history. */
  readonly record: (key: string, config: SlidingWindowConfig, now?: number) => readonly number[]
  /**
   * Whole seconds until the oldest in-window request for `key` expires
   * (`options.minSeconds`, default 0, when there is no in-window history).
   */
  readonly getRetryAfter: (
    key: string,
    windowMs: number,
    options?: Readonly<RetryAfterOptions>
  ) => number
  /** Drop all recorded history. For test harnesses and audit hooks. */
  readonly clear: () => void
}

/**
 * Construct an in-memory sliding-window limiter. Each call returns an
 * isolated `Map<string, number[]>` so distinct domains do not share state.
 *
 * Every method takes an optional clock override so the window arithmetic is
 * unit-testable without real timers; omitting it reads `Date.now()`.
 */
export const createSlidingWindowLimiter = (): SlidingWindowLimiter => {
  const state = new Map<string, number[]>()

  const getRecent = (key: string, windowMs: number, now?: number): readonly number[] => {
    const at = now ?? Date.now()
    const history = state.get(key) ?? []
    return history.filter((timestamp) => at - timestamp < windowMs)
  }

  return {
    getRecent,
    isExceeded: (key, config, now) =>
      getRecent(key, config.windowMs, now).length >= config.maxRequests,
    record: (key, config, now) => {
      const at = now ?? Date.now()
      const recent = getRecent(key, config.windowMs, at)
      const updated = [...recent, at]
      // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- Rate limiting requires mutable state
      state.set(key, updated)
      return updated
    },
    getRetryAfter: (key, windowMs, options) => {
      const at = options?.now ?? Date.now()
      const minSeconds = options?.minSeconds ?? 0
      const recent = getRecent(key, windowMs, at)
      if (recent.length === 0) return minSeconds
      const oldestRequest = Math.min(...recent)
      const resetTime = oldestRequest + windowMs
      const retryAfterMs = Math.max(0, resetTime - at)
      return Math.max(minSeconds, Math.ceil(retryAfterMs / 1000))
    },
    clear: () => {
      // eslint-disable-next-line functional/immutable-data -- Rate limiting requires mutable state
      state.clear()
    },
  }
}
