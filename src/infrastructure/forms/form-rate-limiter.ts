/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * In-process token-bucket rate-limiter for top-level form submissions
 *.
 *
 * The limiter maintains two sliding-window buckets per call:
 *
 *   - **per-IP-hash bucket**: keyed on `(ipHash, formName)` — bounds how
 *     many submissions a single submitter can fire at the same form in the
 *     rolling window.
 *   - **per-form bucket**: keyed on `formName` alone — bounds the form's
 *     total submission rate across ALL submitters in the rolling window.
 *
 * Both buckets are evaluated on every request; whichever trips first wins.
 * The `reason` returned in the rejection result is what the route layer
 * writes to the ledger row's `status_reason` column so admins can see why
 * an attempt was blocked.
 *
 * State is held by two `createSlidingWindowLimiter()` instances — the same
 * shared primitive the MCP, auth, agent and webhook limiters compose, and
 * single-process deployments only. A future multi-instance Sovrium swaps that
 * primitive for Redis once, not once per limiter.
 *
 * Privacy: the limiter NEVER stores raw IPs. The `ipHash` argument is the
 * SHA-256 of `salt + ip` computed at the route boundary, over a salt derived
 * from the install's root secret and stable across restarts (see
 * `infrastructure/forms/ip-hash.ts`). Per-key entries auto-prune when the
 * caller observes them with a timestamp past the window — so a stalled
 * map entry costs ~120 bytes (key + timestamps array) and clears itself
 * the next time a submission from that IP lands. The map is small enough
 * to stay in memory under typical traffic without an explicit LRU; pruning
 * runs on every read so a dead entry can never be COUNTED beyond the active
 * window, and the entry itself is rewritten to its pruned form on the next
 * submission that key records.
 */

import { createSlidingWindowLimiter } from '@/infrastructure/process/sliding-window-limiter'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resolved rate-limit policy (after applying schema + defaults). */
export interface RateLimitPolicy {
  /** Submissions allowed per IP-hash in the window. */
  readonly perIp: number
  /** Submissions allowed per form (all IPs combined) in the window. */
  readonly perForm: number
  /** Rolling window in seconds. */
  readonly windowSeconds: number
}

/** Outcome reasons surfaced on rate-limit rejection. */
export type RateLimitReason = 'rate_limit_per_ip' | 'rate_limit_per_form'

export type RateLimitResult =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly reason: RateLimitReason
      /**
       * Whole seconds until the oldest request in the binding window
       * expires. RFC 7231 §7.1.3 requires a positive integer.
       */
      readonly retryAfterSec: number
    }

// ---------------------------------------------------------------------------
// State (per-process)
// ---------------------------------------------------------------------------

/**
 * One shared-primitive instance per bucket. Two instances rather than one
 * keyspace because the buckets are keyed differently — `formName:ipHash`
 * against a bare `formName` — and a single map would let a form literally
 * named `contact:abc123` collide with one submitter's bucket on `contact`.
 */
const perIpLimiter = createSlidingWindowLimiter()
const perFormLimiter = createSlidingWindowLimiter()

const composePerIpKey = (ipHash: string, formName: string): string => `${formName}:${ipHash}`

/**
 * Reset the in-memory rate-limit state. Exposed for tests + future audit
 * hooks — not invoked during normal request handling. The E2E test
 * harness starts a fresh server per spec, but multiple specs share the
 * Bun process, so resetting state per server boot keeps per-spec
 * assertions independent.
 *
 * @public
 */
export const resetFormRateLimitState = (): void => {
  perIpLimiter.clear()
  perFormLimiter.clear()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface CheckAndRecordInput {
  readonly ipHash: string
  readonly formName: string
  readonly policy: RateLimitPolicy
  /** Override clock source for deterministic tests. Defaults to `Date.now()`. */
  readonly now?: number
}

/**
 * Atomic check-and-record against both buckets.
 *
 * Evaluates the per-IP window first, then the per-form window. The
 * binding window (whichever trips first) determines the rejection reason
 * and the `Retry-After` hint. When both windows have budget remaining,
 * the request is recorded against both and the call returns `{ ok: true }`.
 *
 * Reads + writes happen in the same synchronous Effect step, so concurrent
 * Node-style request handlers can't interleave a "count" and an "insert"
 * — the JavaScript event loop guarantees the Map mutations are atomic with
 * respect to any other synchronous code path.
 */
export const checkAndRecord = (input: Readonly<CheckAndRecordInput>): RateLimitResult => {
  const { ipHash, formName, policy } = input
  const now = input.now ?? Date.now()
  const windowMs = policy.windowSeconds * 1000

  const ipKey = composePerIpKey(ipHash, formName)
  const config = { windowMs, maxRequests: policy.perIp }

  if (perIpLimiter.isExceeded(ipKey, config, now)) {
    return {
      ok: false,
      reason: 'rate_limit_per_ip',
      retryAfterSec: perIpLimiter.getRetryAfter(ipKey, windowMs, { now, minSeconds: 1 }),
    }
  }

  if (perFormLimiter.isExceeded(formName, { windowMs, maxRequests: policy.perForm }, now)) {
    return {
      ok: false,
      reason: 'rate_limit_per_form',
      retryAfterSec: perFormLimiter.getRetryAfter(formName, windowMs, { now, minSeconds: 1 }),
    }
  }

  // Both windows have budget — record the timestamp against both.
  // eslint-disable-next-line functional/no-expression-statements -- record against the shared limiters' mutable stores
  perIpLimiter.record(ipKey, config, now)
  // eslint-disable-next-line functional/no-expression-statements -- record against the shared limiters' mutable stores
  perFormLimiter.record(formName, { windowMs, maxRequests: policy.perForm }, now)

  return { ok: true }
}
