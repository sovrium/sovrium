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
 * limiter (`automations/webhook-rate-limit.ts`), the command-search limiter, the MCP dual-window limiter
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
 * ships under `effect/persistence` (the unstable tier, whose
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

/**
 * The outcome of {@link SlidingWindowLimiter.consume}: whether the attempt was
 * refused, the `Retry-After` it carries, and how many in-window attempts the
 * key holds once the call returns.
 */
export interface SlidingWindowDecision {
  readonly limited: boolean
  /** Whole seconds until a slot frees up — at least 1 when limited, 0 otherwise. */
  readonly retryAfter: number
  /** In-window attempts recorded for the key, this one included when accepted. */
  readonly count: number
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
  /**
   * Check-and-record in one step, the decision every HTTP limiter makes: over
   * the ceiling, refuse WITHOUT recording (so sustained traffic cannot keep
   * pushing its own window forward) and carry a `Retry-After` of at least 1 s,
   * the floor RFC 7231 requires of the header; otherwise record the attempt.
   */
  readonly consume: (
    key: string,
    config: SlidingWindowConfig,
    now?: number
  ) => SlidingWindowDecision
  /**
   * Forget every key with no request inside `windowMs` of `now`, and return how
   * many were forgotten. {@link record} already sweeps on its own at most once
   * per window (see {@link createSlidingWindowLimiter}); this is the explicit
   * form, for a caller that wants to sweep on its own schedule.
   */
  readonly prune: (windowMs: number, now?: number) => number
  /** How many keys currently hold history. */
  readonly size: () => number
  /** Drop all recorded history. For test harnesses and audit hooks. */
  readonly clear: () => void
}

/**
 * Forget every key of `state` with no timestamp inside `windowMs` of `at`, and
 * return how many were forgotten. See {@link SlidingWindowLimiter.prune}.
 */
const pruneStaleKeys = (state: Map<string, number[]>, windowMs: number, at: number): number => {
  const stale = [...state.entries()]
    .filter(([, history]) => history.every((timestamp) => at - timestamp >= windowMs))
    .map(([key]) => key)
  stale.forEach((key) => state.delete(key))
  return stale.length
}

/**
 * The self-sweep of one limiter: the longest window any call has asked about,
 * and when the map was last swept against it. See
 * {@link createSlidingWindowLimiter} for why it exists.
 */
const createSweep = (state: Map<string, number[]>) => {
  const clock: { at: number | undefined; longestWindowMs: number } = {
    at: undefined,
    longestWindowMs: 0,
  }
  return {
    observe: (windowMs: number): void => {
      if (windowMs <= clock.longestWindowMs) return
      clock.longestWindowMs = windowMs
    },
    runIfDue: (at: number): void => {
      if (clock.at !== undefined && at - clock.at < clock.longestWindowMs) return
      if (clock.at !== undefined) {
        pruneStaleKeys(state, clock.longestWindowMs, at)
      }
      clock.at = at
    },
  } as const
}

/**
 * Every limiter this module has built, held weakly so a limiter its owner drops
 * (one built inside a per-boot route factory) is still collected. Read only by
 * {@link resetRateLimitersForTests}.
 */
const liveLimiters = new Set<WeakRef<SlidingWindowLimiter>>()

/**
 * TEST HARNESS ONLY — drop the recorded history of every sliding-window
 * limiter in the process.
 *
 * Most limiters are module-level, so their history outlives a server: a test
 * harness that boots several servers inside one process (the in-process E2E
 * mode) would otherwise carry one boot's sign-ins into the next and answer 429
 * on a fresh server. The harness calls this once per boot, beside its page and
 * CSS cache resets. No route, middleware or use-case calls it, and nothing in
 * a deployed server should: a production process boots one server and keeps
 * its limits for its whole life.
 */
export const resetRateLimitersForTests = (): void => {
  const entries = [...liveLimiters]
  entries.forEach((ref) => {
    const limiter = ref.deref()
    if (limiter === undefined) {
      liveLimiters.delete(ref)
      return
    }
    limiter.clear()
  })
}

/** Enrol a freshly built limiter for {@link resetRateLimitersForTests}, and hand it back. */
const enrol = (limiter: SlidingWindowLimiter): SlidingWindowLimiter => {
  liveLimiters.add(new WeakRef(limiter))
  return limiter
}

/**
 * Construct an in-memory sliding-window limiter. Each call returns an
 * isolated `Map<string, number[]>` so distinct domains do not share state.
 *
 * Every method takes an optional clock override so the window arithmetic is
 * unit-testable without real timers; omitting it reads `Date.now()`.
 *
 * Memory: a key is often attacker-chosen (a client address, a caller id), and
 * the map would otherwise keep one entry per key it has EVER seen. So
 * {@link SlidingWindowLimiter.record} sweeps out every key with no request left
 * in the window, at most once per window — the sweep's cost is amortised over
 * every request in that window, and the map never holds more than the keys
 * seen in the last two windows. The window swept against is the LONGEST any
 * call has asked about, so a limiter consulted with several window lengths
 * never forgets a key that one of them still counts. Forgetting a key whose
 * every timestamp is outside that window changes no answer: every read already
 * filters those timestamps out.
 */
export const createSlidingWindowLimiter = (): SlidingWindowLimiter => {
  const state = new Map<string, number[]>()
  const sweep = createSweep(state)

  const getRecent = (key: string, windowMs: number, now?: number): readonly number[] => {
    const at = now ?? Date.now()
    sweep.observe(windowMs)
    const history = state.get(key) ?? []
    return history.filter((timestamp) => at - timestamp < windowMs)
  }

  const record = (key: string, config: SlidingWindowConfig, now?: number): readonly number[] => {
    const at = now ?? Date.now()
    const recent = getRecent(key, config.windowMs, at)
    sweep.runIfDue(at)
    const updated = [...recent, at]
    state.set(key, updated)
    return updated
  }

  const getRetryAfter = (
    key: string,
    windowMs: number,
    options?: Readonly<RetryAfterOptions>
  ): number => {
    const at = options?.now ?? Date.now()
    const minSeconds = options?.minSeconds ?? 0
    const recent = getRecent(key, windowMs, at)
    if (recent.length === 0) return minSeconds
    const resetTime = Math.min(...recent) + windowMs
    return Math.max(minSeconds, Math.ceil(Math.max(0, resetTime - at) / 1000))
  }

  return enrol({
    getRecent,
    isExceeded: (key, config, now) =>
      getRecent(key, config.windowMs, now).length >= config.maxRequests,
    record,
    getRetryAfter,
    consume: (key, config, now) => {
      const at = now ?? Date.now()
      const recent = getRecent(key, config.windowMs, at)
      if (recent.length >= config.maxRequests) {
        const retryAfter = getRetryAfter(key, config.windowMs, { now: at, minSeconds: 1 })
        return { limited: true, retryAfter, count: recent.length }
      }
      return { limited: false, retryAfter: 0, count: record(key, config, at).length }
    },
    prune: (windowMs, now) => pruneStaleKeys(state, windowMs, now ?? Date.now()),
    size: () => state.size,
    clear: () => state.clear(),
  })
}
