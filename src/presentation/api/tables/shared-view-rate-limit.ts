/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-user rate limiter for the `/api/shared-views/*` route surface
 * (in-memory sliding window).
 *
 * Phase 6 Cycle 6 audit flagged the absence of any rate-limiting on the
 * `/api/shared-views/*` chain. The view IDs are nanoid (brute-force-resistant
 * by entropy), but a per-user ceiling is still abuse-hardening best practice
 * and matches the policy applied to the sibling `/api/tables/*` (records,
 * activity) and `/api/ai/chat` surfaces.
 *
 * Built on the shared `createSlidingWindowLimiter()` primitive (see
 * `@/infrastructure/utils/sliding-window-limiter`) — a process-local Map of
 * recent timestamps. The same caveat applies — suitable only for
 * single-process deployments, which is exactly the E2E test topology (one
 * server process per test).
 *
 * The limit is keyed by `session.userId`. This middleware runs AFTER
 * `requireAuth()` in `api-routes.ts`, so the session is guaranteed to exist.
 *
 * Operator-tunable env-var contract (both optional):
 *  - `SHARED_VIEWS_RATE_LIMIT_MAX`        max requests per window (default 60)
 *  - `SHARED_VIEWS_RATE_LIMIT_WINDOW_MS`  window length in milliseconds
 *                                         (default 60_000)
 *
 * Defaults: 60 requests / 60 seconds (1 req/sec sustained, with burst
 * tolerance). Aligned with the activity limiter's order-of-magnitude.
 *
 * On exceed: returns HTTP 429 with the canonical error envelope used across
 * the API (`{ success, message, code: 'RATE_LIMITED' }`) and a `Retry-After`
 * header in whole seconds.
 */

import { rateLimitedResponse } from '@/infrastructure/process/rate-limit-response'
import { createSlidingWindowLimiter } from '@/infrastructure/process/sliding-window-limiter'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { MiddlewareHandler } from 'hono'

const limiter = createSlidingWindowLimiter()

/** Default sliding-window length when `SHARED_VIEWS_RATE_LIMIT_WINDOW_MS` is unset. */
const DEFAULT_WINDOW_MS = 60_000

/** Default request ceiling when `SHARED_VIEWS_RATE_LIMIT_MAX` is unset. */
const DEFAULT_MAX_REQUESTS = 60

/** Resolved configuration for the shared-views rate limiter. */
interface SharedViewsRateLimitConfig {
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
 * Resolve the shared-views rate-limit config from the environment. Read fresh
 * on every call so a test that sets the env vars per server boot is honoured.
 */
export const resolveSharedViewsRateLimitConfig = (): SharedViewsRateLimitConfig => ({
  windowMs: parsePositiveInt(process.env.SHARED_VIEWS_RATE_LIMIT_WINDOW_MS) ?? DEFAULT_WINDOW_MS,
  maxRequests: parsePositiveInt(process.env.SHARED_VIEWS_RATE_LIMIT_MAX) ?? DEFAULT_MAX_REQUESTS,
})

export interface SharedViewsRateLimitDecision {
  /** True when the attempt is rate-limited and must be rejected with 429. */
  readonly limited: boolean
  /** Whole seconds until the oldest in-window timestamp falls out (429 only). */
  readonly retryAfter: number
}

/**
 * Record a shared-view request attempt for `userId` and decide whether it is
 * rate-limited.
 *
 * When `limited` is true the attempt is NOT recorded (so the window does not
 * keep extending under sustained load) and `retryAfter` carries the number of
 * whole seconds until the oldest in-window timestamp falls out.
 */
export const checkSharedViewsRateLimit = (userId: string): SharedViewsRateLimitDecision => {
  const { windowMs, maxRequests } = resolveSharedViewsRateLimitConfig()
  const now = Date.now()
  const recent = limiter.getRecent(userId, windowMs)

  if (recent.length >= maxRequests) {
    // Limited attempts are NOT recorded; `Math.max(1, …)` floors retry-after
    // at 1s (the shared primitive's getRetryAfter floors at 0s).
    const oldest = Math.min(...recent)
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    return { limited: true, retryAfter }
  }

  // eslint-disable-next-line functional/no-expression-statements -- record the attempt in the shared limiter's mutable store
  limiter.record(userId, { windowMs, maxRequests })
  return { limited: false, retryAfter: 0 }
}

/**
 * Hono middleware enforcing the per-user shared-views rate limit.
 *
 * MUST be composed AFTER `authMiddleware(auth)` + `requireAuth()` so the
 * session is guaranteed present. Unauthenticated requests never reach this
 * middleware — they would have been short-circuited by `requireAuth` with a
 * 401 — which keeps the limiter's window slots from being consumed by
 * non-authenticated traffic.
 *
 * On exceed: returns 429 with the canonical error envelope and `Retry-After`.
 */
export const sharedViewsRateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const { session } = (c as ContextWithSession).var
  if (!session) {
    // Defensive: should never happen — `requireAuth()` runs before this
    // middleware. If we ever lose that ordering, fall through silently rather
    // than crash; the auth chain is the source of truth for 401s.
    await next()
    return
  }

  const decision = checkSharedViewsRateLimit(session.userId)
  if (decision.limited) {
    return rateLimitedResponse(c, decision.retryAfter)
  }

  await next()
}
