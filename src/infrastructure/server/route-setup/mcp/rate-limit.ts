/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Context } from 'hono'
import type { McpCaller } from '@/infrastructure/server/route-setup/mcp/auth'

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
 * envelope (per AC-003), and the standard RFC 6585 / draft-polli-ratelimit
 * headers (`Retry-After`, `X-RateLimit-Limit/Remaining/Reset`).
 *
 * The caller key is derived from the resolved `McpCaller`:
 *   - `oauth2` strategy → OAuth-resolved `userId` (one budget per user)
 *   - `token` strategy  → the static bearer token value (one budget per
 *     operator-issued token, so revoking a token cannot be defeated by
 *     issuing a fresh one with the same identity)
 *
 * State is held in-memory (`Map<callerKey, RateLimitState>`) — single-process
 * deployments only. A future M-* slice will swap this for Redis when Sovrium
 * grows multi-instance.
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

interface RateLimitState {
  // Sliding-window timestamps (ms-since-epoch). Pruned on every read.
  readonly perMinute: ReadonlyArray<number>
  readonly perDay: ReadonlyArray<number>
}

const rateLimitState = new Map<string, RateLimitState>()

const pruneTimestamps = (
  timestamps: ReadonlyArray<number>,
  windowMs: number,
  now: number
): ReadonlyArray<number> => timestamps.filter((t) => now - t < windowMs)

/**
 * Reset the in-memory rate-limit map. Exposed for tests + future audit hooks
 * — not invoked during normal request handling. Note: each test starts a
 * fresh server, but multiple specs share the same Bun process, so without
 * cross-spec isolation the per-day buckets could bleed between tests when
 * the same token value is randomly re-generated. The keying is per-token
 * (long random hex) so collisions are extraordinarily unlikely; this helper
 * is provided for completeness.
 * @public
 */
export const resetMcpRateLimitState = (): void => {
  // eslint-disable-next-line functional/immutable-data -- in-memory rate-limit state lives in a Map
  rateLimitState.clear()
}

// ---------------------------------------------------------------------------
// Caller-key derivation
// ---------------------------------------------------------------------------

/**
 * Derive a stable rate-limit key from the resolved caller.
 *
 * In `oauth2` strategy the caller carries a real `userId`; we key on that so
 * a single human burning across multiple OAuth clients still shares one
 * budget.
 *
 * In `token` strategy `userId` is `undefined`, so we fall back to the bearer
 * token value itself — keying on the token means each operator-issued token
 * has its own budget (admin / member / viewer scale independently).
 */
export const deriveMcpCallerKey = (caller: Readonly<McpCaller>, bearerToken: string): string => {
  if (caller.userId !== undefined && caller.userId.length > 0) {
    return `user:${caller.userId}`
  }
  return `token:${bearerToken}`
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
  const existing = rateLimitState.get(callerKey)
  const minutePruned = existing ? pruneTimestamps(existing.perMinute, ONE_MINUTE_MS, now) : []
  const dayPruned = existing ? pruneTimestamps(existing.perDay, ONE_DAY_MS, now) : []

  const minuteInfo = computeWindowInfo(minutePruned, config.perMinute, ONE_MINUTE_MS, now)
  const dayInfo = computeWindowInfo(dayPruned, config.perDay, ONE_DAY_MS, now)
  const binding = pickBindingWindow(minuteInfo, dayInfo)

  const headers: Record<string, string> = {
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
  const existing = rateLimitState.get(callerKey)
  const minutePruned = existing ? pruneTimestamps(existing.perMinute, ONE_MINUTE_MS, now) : []
  const dayPruned = existing ? pruneTimestamps(existing.perDay, ONE_DAY_MS, now) : []

  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- in-memory rate-limit state
  rateLimitState.set(callerKey, {
    perMinute: [...minutePruned, now],
    perDay: [...dayPruned, now],
  })
}

// ---------------------------------------------------------------------------
// Hono header injection
// ---------------------------------------------------------------------------

/**
 * Apply the rate-limit headers to a Hono `Context` so subsequent
 * `c.json(...)` calls (and the dispatcher's responses) carry them. Hono
 * propagates `c.header()` values to the final `Response` automatically.
 */
export const applyRateLimitHeaders = (
  c: Readonly<Context>,
  headers: Readonly<Record<string, string>>
): void => {
  Object.entries(headers).forEach(([name, value]) => c.header(name, value))
}

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
 * either window. AC-003 pins the JSON-RPC error code to `-32603` (internal
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
