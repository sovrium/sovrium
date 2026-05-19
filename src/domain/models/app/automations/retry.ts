/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const RetryConfigSchema = Schema.Struct({
  maxAttempts: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 10),
    Schema.annotations({ description: 'Maximum retry attempts (1-10)' })
  ),

  delayMs: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(100, 60_000),
      Schema.annotations({
        description: 'Base delay between retries in milliseconds (100-60000, default: 1000)',
      })
    )
  ),

  strategy: Schema.optional(
    Schema.Literal('fixed', 'exponential').pipe(
      Schema.annotations({
        description: 'Retry strategy: fixed delay or exponential backoff (default: fixed)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'RetryConfig',
    title: 'Retry Configuration',
    description: 'Automatic retry behavior for failed executions with fixed or exponential backoff',
    examples: [
      { maxAttempts: 3 },
      { maxAttempts: 5, delayMs: 2000, strategy: 'exponential' as const },
    ],
  })
)

export type RetryConfig = Schema.Schema.Type<typeof RetryConfigSchema>
export type RetryConfigEncoded = Schema.Schema.Encoded<typeof RetryConfigSchema>
