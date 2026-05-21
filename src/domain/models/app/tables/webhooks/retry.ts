/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const WebhookRetrySchema = Schema.Struct({
  maxAttempts: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(0),
    Schema.annotations({
      title: 'Max Attempts',
      description: 'Number of retry attempts (0 = no retries, default: 3)',
    })
  ),

  backoff: Schema.optional(
    Schema.Literal('exponential', 'fixed').pipe(
      Schema.annotations({ description: 'Retry backoff strategy' })
    )
  ),

  initialDelay: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Initial delay in milliseconds before first retry' })
    )
  ),

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

export type WebhookRetry = Schema.Schema.Type<typeof WebhookRetrySchema>


const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BACKOFF = 'exponential' as const
const DEFAULT_INITIAL_DELAY = 1000
const DEFAULT_MAX_DELAY = 60_000

export interface ResolvedRetryPolicy {
  readonly maxAttempts: number
  readonly backoff: 'exponential' | 'fixed'
  readonly initialDelay: number
  readonly maxDelay: number
}

export const resolveRetryPolicy = (retry: WebhookRetry | undefined): ResolvedRetryPolicy => ({
  maxAttempts: retry?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
  backoff: retry?.backoff ?? DEFAULT_BACKOFF,
  initialDelay: retry?.initialDelay ?? DEFAULT_INITIAL_DELAY,
  maxDelay: retry?.maxDelay ?? DEFAULT_MAX_DELAY,
})

export const computeRetryDelay = (policy: ResolvedRetryPolicy, attemptIndex: number): number => {
  const raw =
    policy.backoff === 'exponential'
      ? policy.initialDelay * 2 ** Math.max(0, attemptIndex - 1)
      : policy.initialDelay
  return Math.min(raw, policy.maxDelay)
}
