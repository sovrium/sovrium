/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ─── Webhook Retry Policy ───────────────────────────────────────────────────

/**
 * Webhook retry configuration for failed deliveries.
 *
 * @example
 * ```typescript
 * { maxAttempts: 5, backoff: 'exponential', initialDelay: 1000, maxDelay: 300000 }
 * ```
 */
export const WebhookRetrySchema = Schema.Struct({
  /** Number of retry attempts after initial failure. 0 disables retries. Default: 3. */
  maxAttempts: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(0),
    Schema.annotations({
      title: 'Max Attempts',
      description: 'Number of retry attempts (0 = no retries, default: 3)',
    })
  ),

  /** Backoff strategy between retries (default: exponential). */
  backoff: Schema.optional(
    Schema.Literal('exponential', 'fixed').pipe(
      Schema.annotations({ description: 'Retry backoff strategy' })
    )
  ),

  /** Milliseconds before first retry (default: 1000). */
  initialDelay: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Initial delay in milliseconds before first retry' })
    )
  ),

  /** Maximum delay between retries in milliseconds (default: 60000). */
  maxDelay: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Maximum delay in milliseconds between retries' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'WebhookRetry',
    title: 'Webhook Retry Policy',
    description: 'Retry configuration for failed webhook deliveries.',
  })
)
