/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The per-address and per-form sliding windows a public submission is counted
 * against, as the form-submission use-case sees them.
 *
 * Process-local by design: the windows protect one server from a flood, they
 * are not a quota. The check and the record are one atomic step.
 */

import { Context, type Effect } from 'effect'

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

export class SubmissionRateLimiter extends Context.Service<
  SubmissionRateLimiter,
  {
    /** Check both windows and, when both have budget, record the submission in each. */
    readonly checkAndRecord: (input: {
      readonly ipHash: string
      readonly formName: string
      readonly policy: Readonly<RateLimitPolicy>
    }) => Effect.Effect<RateLimitResult>
  }
>()('SubmissionRateLimiter') {}
