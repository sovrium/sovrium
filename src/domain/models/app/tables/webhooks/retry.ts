/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ─── Webhook Retry Policy ───────────────────────────────────────────────────

/** The most retries one delivery may make after its first attempt. */
const MAX_RETRY_ATTEMPTS = 10
/** The shortest wait, in milliseconds, before a delivery's first retry. */
const MIN_INITIAL_DELAY_MS = 100
/** The longest wait, in milliseconds, between two retries of one delivery: one hour. */
const MAX_RETRY_DELAY_MS = 3_600_000

/**
 * Webhook retry configuration for failed deliveries.
 *
 * Every field is bounded so that one webhook cannot keep a dead receiver busy
 * for ever: at most ten retries, a first retry at least 100 ms after the
 * failed attempt, and at most an hour between two retries.
 *
 * @example
 * ```typescript
 * { maxAttempts: 5, backoff: 'exponential', initialDelay: 1000, maxDelay: 300000 }
 * ```
 */
export const WebhookRetrySchema = Schema.Struct({
  /** Number of retry attempts after initial failure, 0 to 10. 0 disables retries. Default: 3. */
  maxAttempts: Schema.Finite.pipe(
    Schema.annotate({
      title: 'Max Attempts',
      description:
        'Number of retry attempts after the initial delivery failure, from 0 (no retries) to 10. Required once a `retry` block is present; 3 is what applies when the whole block is omitted. A value above 10 is refused when the config is validated.',
      defaultNote: '3, when `retry` is omitted entirely',
    }),
    Schema.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(0),
      Schema.isLessThanOrEqualTo(MAX_RETRY_ATTEMPTS)
    )
  ),

  /** Backoff strategy between retries (default: exponential). */
  backoff: Schema.optional(
    Schema.Literals(['exponential', 'fixed']).pipe(
      Schema.annotate({
        description: "Retry backoff strategy. Defaults to 'exponential'.",
        defaultNote: 'exponential',
      })
    )
  ),

  /** Milliseconds before first retry, at least 100 (default: 1000). */
  initialDelay: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Initial delay in milliseconds before the first retry, at least 100. Defaults to 1000. A value below 100 is refused when the config is validated.',
        defaultNote: '1000',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(MIN_INITIAL_DELAY_MS))
    )
  ),

  /** Maximum delay between retries in milliseconds, at most one hour (default: 60000). */
  maxDelay: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Upper bound on the delay between retries, in milliseconds, at most 3600000 (one hour). Defaults to 60000. A value above one hour is refused when the config is validated.',
        defaultNote: '60000',
      }),
      Schema.check(
        Schema.isInt(),
        Schema.isGreaterThan(0),
        Schema.isLessThanOrEqualTo(MAX_RETRY_DELAY_MS)
      )
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'WebhookRetry',
    title: 'Webhook Retry Policy',
    description: 'Retry configuration for failed webhook deliveries.',
  })
)

/** @public */
export type WebhookRetry = Schema.Schema.Type<typeof WebhookRetrySchema>

// ─── Retry Policy Resolution ────────────────────────────────────────────────

/** Default number of retry attempts when `retry` is omitted. */
const DEFAULT_MAX_ATTEMPTS = 3
/** Default backoff strategy when `retry.backoff` is omitted. */
const DEFAULT_BACKOFF = 'exponential' as const
/** Default initial delay in milliseconds when `retry.initialDelay` is omitted. */
const DEFAULT_INITIAL_DELAY = 1000
/** Default maximum delay in milliseconds when `retry.maxDelay` is omitted. */
const DEFAULT_MAX_DELAY = 60_000

/**
 * A fully-resolved retry policy — every field concrete, no optionals. Produced
 * by {@link resolveRetryPolicy} from an optional {@link WebhookRetry} config.
 *
 * @public
 */
export interface ResolvedRetryPolicy {
  /** Retry attempts after the initial delivery (0 = no retries). */
  readonly maxAttempts: number
  /** Backoff strategy between retries. */
  readonly backoff: 'exponential' | 'fixed'
  /** Milliseconds before the first retry. */
  readonly initialDelay: number
  /** Upper bound on the delay between retries. */
  readonly maxDelay: number
}

/**
 * Resolve an optional webhook retry config into a concrete policy, applying
 * the documented defaults (3 attempts, exponential backoff, 1s initial delay,
 * 60s cap) for any omitted field.
 *
 * Pure function — no side effects, deterministic.
 *
 * @public
 */
export const resolveRetryPolicy = (retry: WebhookRetry | undefined): ResolvedRetryPolicy => ({
  maxAttempts: retry?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
  backoff: retry?.backoff ?? DEFAULT_BACKOFF,
  initialDelay: retry?.initialDelay ?? DEFAULT_INITIAL_DELAY,
  maxDelay: retry?.maxDelay ?? DEFAULT_MAX_DELAY,
})

/**
 * Compute the delay in milliseconds before retry attempt `attemptIndex`
 * (1-based: 1 = first retry, 2 = second retry, ...).
 *
 * - `exponential`: `initialDelay * 2^(attemptIndex - 1)`, capped at `maxDelay`.
 * - `fixed`: a constant `initialDelay`, capped at `maxDelay`.
 *
 * Pure function — deterministic given the policy and attempt index.
 *
 * @public
 */
export const computeRetryDelay = (policy: ResolvedRetryPolicy, attemptIndex: number): number => {
  const raw =
    policy.backoff === 'exponential'
      ? policy.initialDelay * 2 ** Math.max(0, attemptIndex - 1)
      : policy.initialDelay
  return Math.min(raw, policy.maxDelay)
}
