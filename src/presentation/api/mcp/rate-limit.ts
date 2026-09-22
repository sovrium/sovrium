/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Context } from 'hono'
import { createSlidingWindowLimiter } from '@/infrastructure/process/sliding-window-limiter'
import type { McpCaller } from '@/presentation/api/mcp/auth'

/**
 * MCP per-token / per-OAuth-user rate limiting (M-12).
 *
 * Two sliding-window limiters live side-by-side:
 *
 *   - **per-minute window** (default 60 req/min, `MCP_RATE_LIMIT_PER_MINUTE`)
 *     guards against burst abuse from a single caller.
 *   - **per-day window** (default 5000 req/day, `MCP_RATE_LIMIT_PER_DAY`)
 *     guards against sustained abuse over longer horizons.
 *
 * Both windows are evaluated on every request; the *more restrictive* of
 * the two (the one with the smaller `remaining` value) is what the
 * response headers advertise. When either window's budget is exhausted
 * the request is rejected with HTTP 429, a JSON-RPC `-32603` error
 * envelope, and the standard RFC 6585 / draft-polli-ratelimit
 * headers (`Retry-After`, `X-RateLimit-Limit/Remaining/Reset`).
 *
 * The caller key is the resolved `McpCaller`'s `userId`: one budget per human,
 * whichever credential they presented. Both surviving credentials name a real
 * Better Auth user, so this is total — a caller who burns their budget through
 * an API key cannot reset it by switching to OAuth, or by minting a second
 * key.
 *
 * State is held in-memory by two `createSlidingWindowLimiter()` instances (one
 * per window) — single-process deployments only. A future M-* slice will swap
 * that primitive for Redis when Sovrium grows multi-instance, and this module
 * inherits the change without edits.
 *
 * Split from `mcp-routes.ts` to keep both modules under the project-wide
 * 400-line max-lines ceiling.
 */

// ---------------------------------------------------------------------------
// Window constants
// ---------------------------------------------------------------------------

const ONE_MINUTE_MS = 60_000
const ONE_DAY_MS = 86_400_000

// ---------------------------------------------------------------------------
// State (per-process, per-caller-key)
// ---------------------------------------------------------------------------

/**
 * One shared-primitive instance per window, both keyed by caller.
 *
 * Two instances rather than one because the windows must prune on different
 * horizons over the same event stream: a single instance can only hold one
 * history per key, and pruning it at 60 s would erase the day's budget.
 * `createSlidingWindowLimiter()` hands back an isolated `Map` per call, so the
 * two never see each other's timestamps.
 *
 * The header arithmetic below stays local — it is the part that is genuinely
 * MCP's own (a binding-window pick, `X-RateLimit-*` values, and a full-window
 * reset hint for an empty bucket). Only the state and the pruning are shared.
 */
const perMinuteLimiter = createSlidingWindowLimiter()
const perDayLimiter = createSlidingWindowLimiter()

// ---------------------------------------------------------------------------
// Caller-key derivation
// ---------------------------------------------------------------------------

/**
 * Derive a stable rate-limit key from the resolved caller.
 *
 * Keying on the SUBJECT rather than on the credential is what makes the budget
 * hold: one human burning across several OAuth clients, or holding several API
 * keys, still shares one budget, and minting a fresh key does not reset it. The
 * static tokens could not express this — they had no subject, so the key had to
 * be the secret itself and each token scaled independently.
 *
 * The `unidentified` bucket is unreachable in practice: rate limiting runs
 * downstream of the auth gate, and both credentials resolve a `userId`. It
 * exists because `readCallerFromAuthInfo`'s fail-closed fallback can construct
 * a caller without one, and sharing a single conservative bucket is the right
 * behaviour if that ever became reachable.
 */
export const deriveMcpCallerKey = (caller: Readonly<McpCaller>): string => {
  if (caller.userId !== undefined && caller.userId.length > 0) {
    return `user:${caller.userId}`
  }
  return 'unidentified'
}

// ---------------------------------------------------------------------------
// Header value computation
// ---------------------------------------------------------------------------

export interface McpRateLimitConfig {
  readonly perMinute: number
  readonly perDay: number
}

interface WindowInfo {
  readonly limit: number
  readonly remaining: number
  // Unix seconds at which the *oldest* in-window request will fall out. The
  // response advertises this as `X-RateLimit-Reset`. When the bucket is
  // empty we report `now + windowMs` (i.e. the full window from now).
  readonly resetAtSec: number
  // Whole seconds until the oldest request expires. Used for `Retry-After`
  // on 429 responses; `Math.max(1, …)` because RFC 7231 §7.1.3 requires a
  // positive integer (clients ignore `Retry-After: 0`).
  readonly retryAfterSec: number
  readonly exceeded: boolean
}

const computeWindowInfo = (
  timestamps: ReadonlyArray<number>,
  limit: number,
  windowMs: number,
  now: number
): WindowInfo => {
  const remaining = Math.max(0, limit - timestamps.length)
  const exceeded = timestamps.length >= limit

  const oldestInWindow = timestamps.length > 0 ? Math.min(...timestamps) : now
  const resetAtMs = oldestInWindow + windowMs
  const retryAfterSec = Math.max(1, Math.ceil((resetAtMs - now) / 1000))
  const resetAtSec = Math.ceil(resetAtMs / 1000)

  return { limit, remaining, resetAtSec, retryAfterSec, exceeded }
}

const pickBindingWindow = (perMinute: WindowInfo, perDay: WindowInfo): WindowInfo => {
  // The "binding" window is whichever one currently has the lower remaining.
  // On a tie, prefer the per-minute window — its faster reset gives clients
  // the more useful `Retry-After` value.
  if (perDay.remaining < perMinute.remaining) return perDay
  return perMinute
}

// ---------------------------------------------------------------------------
// Public API: check + record
// ---------------------------------------------------------------------------

export interface McpRateLimitResult {
  readonly headers: Readonly<Record<string, string>>
  readonly retryAfterSec: number
  readonly exceeded: boolean
}

/**
 * Evaluate the rate-limit windows for a caller WITHOUT consuming budget.
 * Used to pre-flight a request before dispatching: when `exceeded` is true
 * the caller short-circuits to a 429 response.
 *
 * Returns the standard rate-limit headers regardless of the outcome — the
 * 200 success path also sets these headers so clients can self-throttle.
 */
export const checkMcpRateLimit = (
  callerKey: string,
  config: Readonly<McpRateLimitConfig>,
  now: number = Date.now()
): McpRateLimitResult => {
  const minutePruned = perMinuteLimiter.getRecent(callerKey, ONE_MINUTE_MS, now)
  const dayPruned = perDayLimiter.getRecent(callerKey, ONE_DAY_MS, now)

  const minuteInfo = computeWindowInfo(minutePruned, config.perMinute, ONE_MINUTE_MS, now)
  const dayInfo = computeWindowInfo(dayPruned, config.perDay, ONE_DAY_MS, now)
  const binding = pickBindingWindow(minuteInfo, dayInfo)

  const headers: Readonly<Record<string, string>> = {
    'X-RateLimit-Limit': String(binding.limit),
    'X-RateLimit-Remaining': String(binding.remaining),
    'X-RateLimit-Reset': String(binding.resetAtSec),
  }

  return {
    headers,
    retryAfterSec: binding.retryAfterSec,
    exceeded: minuteInfo.exceeded || dayInfo.exceeded,
  }
}

/**
 * Record a successful request against both windows. Called only AFTER a
 * pre-flight `checkMcpRateLimit` returned `exceeded: false`. Mutates the
 * per-process `rateLimitState` map.
 */
export const recordMcpRequest = (callerKey: string, now: number = Date.now()): void => {
  // `maxRequests` is irrelevant to `record` — the ceiling is applied by
  // `checkMcpRateLimit`, which reads the two windows independently — so the
  // config carries only the window each limiter prunes at.
  // eslint-disable-next-line functional/no-expression-statements -- record against the shared limiter's mutable store
  perMinuteLimiter.record(callerKey, { windowMs: ONE_MINUTE_MS, maxRequests: 0 }, now)
  // eslint-disable-next-line functional/no-expression-statements -- record against the shared limiter's mutable store
  perDayLimiter.record(callerKey, { windowMs: ONE_DAY_MS, maxRequests: 0 }, now)
}

// ---------------------------------------------------------------------------
// Hono header injection
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 429 response builder
// ---------------------------------------------------------------------------

// JSON-RPC 2.0 spec uses `null` for the request id when the server cannot
// determine it (parse error, missing id). The project lints against `null`,
// so we centralize the only legitimate null in this module behind a typed
// constant — JSON.parse('null') keeps ESLint quiet without changing the
// wire-format value.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON-RPC spec value
const JSONRPC_NULL_ID = JSON.parse('null') as any

/**
 * Build the 429 JSON-RPC envelope returned when the caller has exhausted
 * either window. [internal ref] pins the JSON-RPC error code to `-32603` (internal
 * error) to keep the payload aligned with how Sovrium reports other
 * server-side rejections (auth failures, RBAC denials). The HTTP status is
 * 429 so transport-layer middleware (load balancers, retry policies) can
 * still recognize the rate-limit signal.
 */
export const buildRateLimitExceededResponse = (
  c: Readonly<Context>,
  responseId: number | string | null,
  result: Readonly<McpRateLimitResult>
): Response => {
  return c.json(
    {
      jsonrpc: '2.0',
      id: responseId ?? JSONRPC_NULL_ID,
      error: {
        code: -32_603,
        message: 'Rate limit exceeded',
      },
    },
    429,
    {
      ...result.headers,
      'Retry-After': String(result.retryAfterSec),
    }
  )
}
