/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Rate-limit wiring for admin / auth-endpoints / tables / activity.
 *
 * Four separate sliding windows share the same map-of-timestamps math; that
 * math lives in the shared `createSlidingWindowLimiter()` primitive (see
 * `@/infrastructure/utils/sliding-window-limiter`). Each domain below
 * composes its own key derivation + config map on top.
 *
 * Critical contract preservation: the admin window is **1 second**
 * (`ADMIN_CONFIG.windowMs = 1000`); auth / tables / activity use
 * `getRateLimitWindowMs()` (env-overridable, default 60_000 ms). These
 * differ by 60× by design — admin endpoints intentionally allow 10 req/s
 * during dashboard polling while user-facing auth is brute-force-prevented
 * at 20 req/min. A naive consolidation that uses one window everywhere
 * would silently weaken admin to 10 req/min — a security regression.
 *
 * Out of scope: the MCP rate limiter (`mcp/rate-limit.ts`) has a different
 * contract (dual-window, JSON-RPC envelope, X-RateLimit-* headers) and stays
 * independent.
 */

import { resolveRateLimitWindowSeconds } from '@/domain/models/process-env/rate-limit-window'
import {
  resolveRateLimitReads,
  resolveRateLimitWrites,
} from '@/domain/models/process-env/records-rate-limits'
import { createSlidingWindowLimiter } from '@/infrastructure/process/sliding-window-limiter'
import type { SlidingWindowConfig } from '@/infrastructure/process/sliding-window-limiter'

// ---------------------------------------------------------------------------
// Common helpers
// ---------------------------------------------------------------------------

/**
 * Get rate limit window duration in milliseconds from environment variable.
 * Defaults to 60 seconds (production) if not set. Never `NaN` or zero: the
 * boot refuses a value that is not a whole number of seconds above zero, and
 * this falls back to the default rather than trust one.
 * Tests should set RATE_LIMIT_WINDOW_SECONDS=5 for faster execution.
 *
 * NOT used by the admin limiter — admin uses a hardcoded 1-second window
 * (see ADMIN_CONFIG below). Used by auth / tables / activity.
 */
export const getRateLimitWindowMs = (): number => resolveRateLimitWindowSeconds() * 1000

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

const getAuthRateLimitConfigs = (): Readonly<Record<string, EndpointRateLimitConfig>> => {
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
    // RFC 7591 dynamic client registration, capped at the sign-up rate because
    // it is the same kind of surface once an operator sets
    // `SOVRIUM_OAUTH_ANONYMOUS_CLIENT_REGISTRATION=true`: an unauthenticated
    // caller writing rows into `auth.oauth_client`, each carrying a
    // caller-chosen `client_name` that a consent screen will later show a user.
    // Uncapped, one caller can fill the table and stock an unbounded supply of
    // plausible-looking client identities.
    //
    // The cap applies whether or not the operator opted in. With the default
    // `false` the endpoint 401s before reaching here, so the limiter simply
    // never becomes the binding constraint — and it is already in place on the
    // day someone flips the env var, which is the point.
    '/api/auth/oauth2/register': {
      windowMs,
      maxRequests: 20,
    },
    // Every route that mails an address the caller names. Better Auth's own
    // limiter is off (`buildRateLimitConfig`), and that silences its plugins'
    // per-route rules too, so these rows restore the budgets the dependency's
    // authors chose: 5 for magic links (the plugin's default), 3 for one-time
    // codes (the plugin's default) and for verification resends and email
    // changes (Better Auth's built-in rule). The request past the budget is
    // refused here, before Better Auth runs, so it sends nothing. The unit test
    // beside this file enumerates the vendored routes that send mail and fails
    // when one has no row and no recorded reason to go without.
    '/api/auth/sign-in/magic-link': { windowMs, maxRequests: 5 },
    '/api/auth/email-otp/send-verification-otp': { windowMs, maxRequests: 3 },
    '/api/auth/email-otp/request-password-reset': { windowMs, maxRequests: 3 },
    // Deprecated upstream in favour of the route above, but still served.
    '/api/auth/forget-password/email-otp': { windowMs, maxRequests: 3 },
    '/api/auth/send-verification-email': { windowMs, maxRequests: 3 },
    // Mails the NEW address, which the signed-in caller chooses freely.
    '/api/auth/change-email': { windowMs, maxRequests: 3 },
    // Sovrium's own invitation route. A non-admin role granted `canInvite` can
    // mail any address through it, and the admin limiter (10 per SECOND) is no
    // budget for mail.
    '/api/auth/admin/invite-user': { windowMs, maxRequests: 10 },
    // Re-mails a pending invitation. Admin-equivalent only, but an admin
    // session (or a stolen one) must not turn it into an unmetered mail cannon
    // aimed at one inbox. A ROUTE PATTERN, not an exact path: the middleware
    // mounts each key with Hono's own matching and records against the key, so
    // the budget is per client address across every invitation.
    '/api/admin/invitations/:id/resend': { windowMs, maxRequests: 10 },
    // User-code lookups of the device flow (`auth.deviceAuthorization`): the
    // plugin's own budget, 5 per client address over a code's 30-minute life,
    // restored here for the same reason as the mail rows. A user code is
    // short; this cap is what keeps it from being guessed.
    '/api/auth/device': { windowMs: 30 * 60 * 1000, maxRequests: 5 },
    // The one-click decision on a loopback request. It needs the claimant's
    // session and decides each request once (a compare-and-set on `pending`),
    // so it cannot mint return codes; the budget bounds a signed-in caller
    // walking user codes through it. It answers an unknown code and someone
    // else's alike, so the walk learns nothing either way.
    '/api/auth/device/decide': { windowMs, maxRequests: 30 },
  }
}

/**
 * The paths the auth rate-limit middleware is mounted on: exactly the keys of
 * the budget table, so a route cannot carry a budget without being guarded,
 * or be guarded without a budget.
 */
export const getAuthRateLimitedPaths = (): readonly string[] =>
  Object.keys(getAuthRateLimitConfigs())

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
// Tables rate limiter — one budget per caller and kind, env-derived window
// ---------------------------------------------------------------------------

const tablesLimiter = createSlidingWindowLimiter()

/** The methods that write: all four draw on ONE budget per caller. */
const TABLES_WRITE_METHODS: ReadonlySet<string> = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

/** Requests one API key may make per window, reads and writes together (about 5 a second). */
export const API_KEY_TABLES_BUDGET = 300

/** Reads one visitor address that is not signed in may make per window. */
export const ANONYMOUS_TABLES_READS = 100

/**
 * Which budget a `/api/tables*` request draws on, and its size, for the caller
 * named by `callerKey` (`user:<id>`, `key:<digest>` or `ip:<address>`):
 *
 * - an API key: its own budget, every method together;
 * - a write (POST, PATCH, PUT, DELETE): the caller's one write budget,
 *   `RATE_LIMIT_WRITES` — a batch request is one write;
 * - a read by a signed-in person: `RATE_LIMIT_READS`, a ceiling no page reaches;
 * - a read by a visitor who is not signed in: {@link ANONYMOUS_TABLES_READS}.
 *
 * The list endpoint and the record endpoints keep separate read budgets.
 * A `HEAD` is counted as the read it runs; any other method (`OPTIONS`) is
 * not counted.
 */
export const tablesBudgetOf = (
  method: string,
  path: string,
  callerKey: string
): { readonly bucket: string; readonly config: EndpointRateLimitConfig } | undefined => {
  const windowMs = getRateLimitWindowMs()
  // A HEAD runs the GET handler (Hono answers it with the GET route, body
  // dropped), so it is a read like any other; a method's case never changes
  // which budget it draws on.
  const verb = method.toUpperCase() === 'HEAD' ? 'GET' : method.toUpperCase()
  if (callerKey.startsWith('key:')) {
    return { bucket: 'key', config: { windowMs, maxRequests: API_KEY_TABLES_BUDGET } }
  }
  if (TABLES_WRITE_METHODS.has(verb)) {
    return { bucket: 'write', config: { windowMs, maxRequests: resolveRateLimitWrites() } }
  }
  if (verb !== 'GET') return undefined
  const maxRequests = callerKey.startsWith('user:')
    ? resolveRateLimitReads()
    : ANONYMOUS_TABLES_READS
  return {
    bucket: `read:${path === '/api/tables' ? 'list' : 'records'}`,
    config: { windowMs, maxRequests },
  }
}

const tablesKey = (bucket: string, callerKey: string): string => `${bucket}:${callerKey}`

export const isTablesRateLimitExceeded = (
  method: string,
  path: string,
  callerKey: string
): boolean => {
  const budget = tablesBudgetOf(method, path, callerKey)
  if (!budget) return false
  return tablesLimiter.isExceeded(tablesKey(budget.bucket, callerKey), budget.config)
}

export const recordTablesRateLimitRequest = (
  method: string,
  path: string,
  callerKey: string
): readonly number[] => {
  const budget = tablesBudgetOf(method, path, callerKey)
  if (!budget) return []
  return tablesLimiter.record(tablesKey(budget.bucket, callerKey), budget.config)
}

/** Seconds until the budget the request drew on has room again. */
export const getTablesRateLimitRetryAfter = (
  method: string,
  path: string,
  callerKey: string
): number => {
  const budget = tablesBudgetOf(method, path, callerKey)
  if (!budget) return 0
  return tablesLimiter.getRetryAfter(tablesKey(budget.bucket, callerKey), budget.config.windowMs)
}

// ---------------------------------------------------------------------------
// Activity rate limiter — per-method:path config, env-derived window default 60s
// ---------------------------------------------------------------------------

const activityLimiter = createSlidingWindowLimiter()

const getActivityRateLimitConfigs = (): Readonly<Record<string, EndpointRateLimitConfig>> => {
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
 * Uses `getRateLimitWindowMs()` directly rather than the per-config windowMs
 * (the values are identical today).
 */
export const getActivityRateLimitRetryAfter = (method: string, path: string, ip: string): number =>
  activityLimiter.getRetryAfter(getActivityRateLimitKey(method, path, ip), getRateLimitWindowMs())
