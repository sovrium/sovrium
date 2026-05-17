/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Rate-limit primitives for admin / auth-endpoints / tables / activity.
 *
 * Four separate sliding windows share the same map-of-timestamps math —
 * extract that math into `createSlidingWindowLimiter()` and let each domain
 * compose its own key derivation + config map on top.
 *
 * Critical contract preservation: the admin window is **1 second**
 * (`ADMIN_CONFIG.windowMs = 1000`); auth / tables / activity use
 * `getRateLimitWindowMs()` (env-overridable, default 60_000 ms). These
 * differ by 60× by design — admin endpoints intentionally allow 10 req/s
 * during dashboard polling while user-facing auth is brute-force-prevented
 * at 20 req/min. A naive consolidation that uses one window everywhere
 * would silently weaken admin to 10 req/min — a security regression.
 *
 * Out of scope: this consolidation is intentionally narrow. The MCP rate
 * limiter (`mcp/rate-limit.ts`) has a different contract (dual-window,
 * JSON-RPC envelope, X-RateLimit-* headers) and the webhook rate limiter
 * (`presentation/api/routes/automations/webhook-rate-limit.ts`) has its
 * own decision shape — both stay independent.
 */

interface SlidingWindowConfig {
  readonly windowMs: number
  readonly maxRequests: number
}

interface SlidingWindowLimiter {
  readonly getRecent: (key: string, windowMs: number) => readonly number[]
  readonly isExceeded: (key: string, config: SlidingWindowConfig) => boolean
  readonly record: (key: string, config: SlidingWindowConfig) => readonly number[]
  readonly getRetryAfter: (key: string, windowMs: number) => number
}

/**
 * Construct an in-memory sliding-window limiter. Each call returns an
 * isolated `Map<string, number[]>` so the four domains in this file don't
 * share state. The returned API:
 *
 *   - `getRecent(key, windowMs)` — timestamps within the window for `key`
 *   - `isExceeded(key, config)` — true when the count meets `maxRequests`
 *   - `record(key, config)` — append `now`, return the new history
 *   - `getRetryAfter(key, windowMs)` — seconds until the oldest in-window
 *     request expires (0 when empty)
 */
const createSlidingWindowLimiter = (): SlidingWindowLimiter => {
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

// ---------------------------------------------------------------------------
// Common helpers
// ---------------------------------------------------------------------------

/**
 * Get rate limit window duration in milliseconds from environment variable.
 * Defaults to 60 seconds (production) if not set.
 * Tests should set RATE_LIMIT_WINDOW_SECONDS=5 for faster execution.
 *
 * NOT used by the admin limiter — admin uses a hardcoded 1-second window
 * (see ADMIN_CONFIG below). Used by auth / tables / activity.
 */
const getRateLimitWindowMs = (): number => {
  const windowSeconds = process.env.RATE_LIMIT_WINDOW_SECONDS
  return windowSeconds ? parseInt(windowSeconds, 10) * 1000 : 60 * 1000
}

/**
 * Extract IP address from request headers
 * Returns the client IP from x-forwarded-for or defaults to localhost
 */
export const extractClientIp = (forwardedFor: string | undefined): string => {
  return forwardedFor ? (forwardedFor.split(',')[0]?.trim() ?? '127.0.0.1') : '127.0.0.1'
}

interface EndpointRateLimitConfig {
  readonly windowMs: number
  readonly maxRequests: number
}

// ---------------------------------------------------------------------------
// Admin rate limiter — 10 req per 1-SECOND window (NOT env-overridable)
// ---------------------------------------------------------------------------

/**
 * Admin window is intentionally 1 second (NOT 60 seconds like the other
 * three limiters in this file). 10 requests per second matches dashboard
 * polling cadence. If you change this, read `getRateLimitWindowMs()` above
 * and confirm the discrepancy is still intentional.
 */
const ADMIN_CONFIG: SlidingWindowConfig = { windowMs: 1000, maxRequests: 10 }
const adminLimiter = createSlidingWindowLimiter()

export const isRateLimitExceeded = (ip: string): boolean =>
  adminLimiter.isExceeded(ip, ADMIN_CONFIG)

export const recordRateLimitRequest = (ip: string): readonly number[] =>
  adminLimiter.record(ip, ADMIN_CONFIG)

// ---------------------------------------------------------------------------
// Auth rate limiter — per-endpoint config, env-derived window default 60s
// ---------------------------------------------------------------------------

const authLimiter = createSlidingWindowLimiter()

const getAuthRateLimitConfigs = (): Record<string, EndpointRateLimitConfig> => {
  const windowMs = getRateLimitWindowMs()
  return {
    '/api/auth/sign-in/email': {
      windowMs,
      maxRequests: 20, // 20 attempts per window (prevents brute force while allowing legitimate retries)
    },
    '/api/auth/sign-up/email': {
      windowMs,
      maxRequests: 20, // 20 signups per window (prevents abuse while allowing test scenarios)
    },
    '/api/auth/request-password-reset': {
      windowMs,
      maxRequests: 10, // 10 attempts per window (prevents enumeration while allowing legitimate use)
    },
  }
}

const getAuthRateLimitKey = (endpoint: string, ip: string): string => `${endpoint}:${ip}`

export const isAuthRateLimitExceeded = (endpoint: string, ip: string): boolean => {
  const config = getAuthRateLimitConfigs()[endpoint]
  if (!config) return false
  return authLimiter.isExceeded(getAuthRateLimitKey(endpoint, ip), config)
}

export const recordAuthRateLimitRequest = (endpoint: string, ip: string): readonly number[] => {
  const config = getAuthRateLimitConfigs()[endpoint]
  if (!config) return []
  return authLimiter.record(getAuthRateLimitKey(endpoint, ip), config)
}

export const getAuthRateLimitRetryAfter = (endpoint: string, ip: string): number => {
  const config = getAuthRateLimitConfigs()[endpoint]
  if (!config) return 0
  return authLimiter.getRetryAfter(getAuthRateLimitKey(endpoint, ip), config.windowMs)
}

// ---------------------------------------------------------------------------
// Tables rate limiter — per-method:path config, env-derived window default 60s
// ---------------------------------------------------------------------------

const tablesLimiter = createSlidingWindowLimiter()

const getTablesRateLimitConfigs = (): Record<string, EndpointRateLimitConfig> => {
  const windowMs = getRateLimitWindowMs()
  return {
    'GET:/api/tables': { windowMs, maxRequests: 100 },
    'GET:/api/tables/*': { windowMs, maxRequests: 100 },
    'POST:/api/tables/*': { windowMs, maxRequests: 50 },
  }
}

/**
 * Resolve the effective config-key for a given method+path. Matches an
 * exact key first, then falls back to the wildcard `<method>:/api/tables/*`.
 */
const resolveTablesConfigKey = (method: string, path: string): string => {
  const exactKey = `${method}:${path}`
  return getTablesRateLimitConfigs()[exactKey] ? exactKey : `${method}:/api/tables/*`
}

const getTablesRateLimitKey = (method: string, path: string, ip: string): string =>
  `${resolveTablesConfigKey(method, path)}:${ip}`

export const isTablesRateLimitExceeded = (method: string, path: string, ip: string): boolean => {
  const config = getTablesRateLimitConfigs()[resolveTablesConfigKey(method, path)]
  if (!config) return false
  return tablesLimiter.isExceeded(getTablesRateLimitKey(method, path, ip), config)
}

export const recordTablesRateLimitRequest = (
  method: string,
  path: string,
  ip: string
): readonly number[] => {
  const config = getTablesRateLimitConfigs()[resolveTablesConfigKey(method, path)]
  if (!config) return []
  return tablesLimiter.record(getTablesRateLimitKey(method, path, ip), config)
}

/**
 * The original tables retry-after used `getRateLimitWindowMs()` directly
 * (not the per-config windowMs). Both produce the same value today —
 * every tables config uses the env-derived window — but preserving the
 * original behaviour keeps this commit a true no-op.
 */
export const getTablesRateLimitRetryAfter = (method: string, path: string, ip: string): number =>
  tablesLimiter.getRetryAfter(getTablesRateLimitKey(method, path, ip), getRateLimitWindowMs())

// ---------------------------------------------------------------------------
// Activity rate limiter — per-method:path config, env-derived window default 60s
// ---------------------------------------------------------------------------

const activityLimiter = createSlidingWindowLimiter()

const getActivityRateLimitConfigs = (): Record<string, EndpointRateLimitConfig> => {
  const windowMs = getRateLimitWindowMs()
  return {
    'GET:/api/activity': { windowMs, maxRequests: 60 },
    'GET:/api/activity/*': { windowMs, maxRequests: 60 },
  }
}

const resolveActivityConfigKey = (method: string, path: string): string => {
  const exactKey = `${method}:${path}`
  return getActivityRateLimitConfigs()[exactKey] ? exactKey : `${method}:/api/activity/*`
}

const getActivityRateLimitKey = (method: string, path: string, ip: string): string =>
  `${resolveActivityConfigKey(method, path)}:${ip}`

export const isActivityRateLimitExceeded = (method: string, path: string, ip: string): boolean => {
  const config = getActivityRateLimitConfigs()[resolveActivityConfigKey(method, path)]
  if (!config) return false
  return activityLimiter.isExceeded(getActivityRateLimitKey(method, path, ip), config)
}

export const recordActivityRateLimitRequest = (
  method: string,
  path: string,
  ip: string
): readonly number[] => {
  const config = getActivityRateLimitConfigs()[resolveActivityConfigKey(method, path)]
  if (!config) return []
  return activityLimiter.record(getActivityRateLimitKey(method, path, ip), config)
}

/**
 * Same caveat as `getTablesRateLimitRetryAfter` — preserve original
 * behaviour of using `getRateLimitWindowMs()` directly rather than the
 * per-config windowMs (the values are identical today).
 */
export const getActivityRateLimitRetryAfter = (method: string, path: string, ip: string): number =>
  activityLimiter.getRetryAfter(getActivityRateLimitKey(method, path, ip), getRateLimitWindowMs())
