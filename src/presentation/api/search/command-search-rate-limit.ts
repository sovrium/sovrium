/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-client rate limiter for `GET /api/command-search` (in-memory sliding
 * window) — [internal ref].
 *
 * `/api/command-search` is the only UNAUTHENTICATED surface in the app that
 * performs an unbounded multi-table scan: the route works without a session and
 * simply reports `favorited: false` for everything. Every sibling scanning
 * surface is already limited (`/api/tables/*` records + activity, `/api/ai/chat`,
 * `/api/shared-views/*`); this one was missed, and it is the endpoint behind the
 * production Gateway Timeout recorded as GlitchTip `SOVRIUM-WEBSITE-3`.
 *
 * Modelled on `user-views/shared-views-rate-limit.ts` and sharing its
 * `createSlidingWindowLimiter()` primitive and its 429 envelope verbatim — a
 * second spelling of "you are rate limited" is a client-side branch nobody
 * asked for.
 *
 * The ONE departure is the key: **client IP**, not `session.userId`. The
 * shared-views limiter runs after `requireAuth()` and can rely on a session
 * being present; an anonymous caller here has no id to key on. Anything coarser
 * (a global counter) would let one abusive client lock out every reader, which
 * converts an abuse problem into an outage. The address comes from the canonical
 * `getRequestClientIp` so a forged forwarding header cannot buy a fresh bucket
 * here that it cannot buy at any other abuse-controlled endpoint.
 *
 * Operator-tunable env-var contract (both optional):
 *  - `COMMAND_SEARCH_RATE_LIMIT_MAX`       max requests per window (default 30)
 *  - `COMMAND_SEARCH_RATE_LIMIT_WINDOW_MS` window length in ms (default 60_000)
 *
 * 30 rather than the shared-views 60 because each request here is far more
 * expensive, and it still clears a fast typist: debounced palette input produces
 * a handful of requests per search, not dozens.
 *
 * Caveat inherited from the shared primitive: the `Map` is process-local, so
 * this is correct only for single-process deployments — which is exactly the
 * E2E test topology (one server process per test).
 */

import { rateLimitedResponse } from '@/infrastructure/process/rate-limit-response'
import { createSlidingWindowLimiter } from '@/infrastructure/process/sliding-window-limiter'
import { getRequestClientIp } from '@/presentation/api/middleware/client-ip'
import type { MiddlewareHandler } from 'hono'

const limiter = createSlidingWindowLimiter()

/** Default sliding-window length when `COMMAND_SEARCH_RATE_LIMIT_WINDOW_MS` is unset. */
const DEFAULT_WINDOW_MS = 60_000

/** Default request ceiling when `COMMAND_SEARCH_RATE_LIMIT_MAX` is unset. */
const DEFAULT_MAX_REQUESTS = 30

/** Resolved configuration for the command-search rate limiter. */
interface CommandSearchRateLimitConfig {
  readonly windowMs: number
  readonly maxRequests: number
}

/**
 * Parse a positive integer from an env value. Returns `undefined` for an
 * absent, empty, or non-positive-integer value so the caller can fall through
 * to the default.
 */
const parsePositiveInt = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) return undefined
  return value
}

/**
 * Resolve the command-search rate-limit config from the environment. Read fresh
 * on every call so a test that sets the env vars per server boot is honoured.
 */
export const resolveCommandSearchRateLimitConfig = (): CommandSearchRateLimitConfig => ({
  windowMs: parsePositiveInt(process.env.COMMAND_SEARCH_RATE_LIMIT_WINDOW_MS) ?? DEFAULT_WINDOW_MS,
  maxRequests: parsePositiveInt(process.env.COMMAND_SEARCH_RATE_LIMIT_MAX) ?? DEFAULT_MAX_REQUESTS,
})

export interface CommandSearchRateLimitDecision {
  /** True when the attempt is rate-limited and must be rejected with 429. */
  readonly limited: boolean
  /** Whole seconds until the oldest in-window timestamp falls out (429 only). */
  readonly retryAfter: number
}

/**
 * Record a palette search attempt for `clientIp` and decide whether it is
 * rate-limited.
 *
 * When `limited` is true the attempt is NOT recorded (so the window does not
 * keep extending under sustained load) and `retryAfter` carries the number of
 * whole seconds until the oldest in-window timestamp falls out.
 */
export const checkCommandSearchRateLimit = (clientIp: string): CommandSearchRateLimitDecision => {
  const { windowMs, maxRequests } = resolveCommandSearchRateLimitConfig()
  const now = Date.now()
  const recent = limiter.getRecent(clientIp, windowMs)

  if (recent.length >= maxRequests) {
    // Limited attempts are NOT recorded; `Math.max(1, …)` floors retry-after at
    // 1s (the shared primitive's getRetryAfter floors at 0s), which is what the
    // spec's `Number(retryAfter) > 0` assertion pins.
    const oldest = Math.min(...recent)
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    return { limited: true, retryAfter }
  }

  // eslint-disable-next-line functional/no-expression-statements -- record the attempt in the shared limiter's mutable store
  limiter.record(clientIp, { windowMs, maxRequests })
  return { limited: false, retryAfter: 0 }
}

/**
 * Hono middleware enforcing the per-client-IP command-search rate limit.
 *
 * Mounted on `/api/command-search` UNCONDITIONALLY — on both the auth-configured
 * and the no-auth branch of `api-routes.ts` — because the route itself is
 * reachable either way. It runs BEFORE the handler so a rejected request never
 * reaches the per-table fan-out it is there to bound.
 */
export const commandSearchRateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const decision = checkCommandSearchRateLimit(getRequestClientIp(c))
  if (decision.limited) {
    return rateLimitedResponse(c, decision.retryAfter)
  }

  await next()
}
