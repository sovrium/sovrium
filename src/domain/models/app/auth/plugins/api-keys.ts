/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * API Keys Plugin Configuration
 *
 * Enables programmatic API access with API keys.
 * Users can generate API keys for integration and automation.
 *
 * Configuration options:
 * - expirationDays: Number of days until API keys expire (0 = never)
 * - rateLimit: Maximum requests per minute per API key
 * - maxKeysPerUser: Maximum API keys a user can create
 *
 * @example
 * ```typescript
 * // Simple enable
 * { plugins: { apiKeys: true } }
 *
 * // With configuration
 * { plugins: { apiKeys: { expirationDays: 90, rateLimit: 1000 } } }
 * ```
 */
export const ApiKeysConfigSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    expirationDays: Schema.optional(
      Schema.Number.pipe(
        Schema.nonNegative(),
        Schema.annotations({ description: 'Days until API keys expire (0 = never)' })
      )
    ),
    rateLimit: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Max requests per minute per key' })
      )
    ),
    maxKeysPerUser: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Maximum API keys per user' })
      )
    ),
  })
).pipe(
  Schema.annotations({
    title: 'API Keys Plugin Configuration',
    description: 'Programmatic API access with API keys',
    examples: [true, { expirationDays: 90, rateLimit: 1000 }],
  })
)

export type ApiKeysConfig = Schema.Schema.Type<typeof ApiKeysConfigSchema>
