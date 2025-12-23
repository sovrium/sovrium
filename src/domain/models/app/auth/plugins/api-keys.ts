/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Auto-Rotation Configuration
 *
 * Enables automatic API key rotation for security.
 * Presence of this config enables auto-rotation.
 *
 * @example
 * ```typescript
 * // Simple enable (use defaults)
 * { autoRotate: true }
 *
 * // With custom rotation window (24 hours in milliseconds)
 * { autoRotate: { rotationWindow: 86400000 } }
 * ```
 */
export const AutoRotateSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    rotationWindow: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Time in milliseconds between automatic rotations' })
      )
    ),
    gracePeriod: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({
          description: 'Grace period in milliseconds where old key still works after rotation',
        })
      )
    ),
    notifyOnRotation: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({ description: 'Send notification when key is auto-rotated' })
      )
    ),
  })
).pipe(
  Schema.annotations({
    title: 'Auto-Rotation',
    description: 'Automatic API key rotation configuration',
    examples: [true, { rotationWindow: 86_400_000, gracePeriod: 3_600_000 }],
  })
)

export type AutoRotate = Schema.Schema.Type<typeof AutoRotateSchema>

/**
 * Sliding Window Rate Limit Configuration
 *
 * Advanced rate limiting with sliding window algorithm.
 * More accurate than fixed window rate limiting.
 */
export const SlidingWindowSchema = Schema.Struct({
  windowSize: Schema.optional(
    Schema.Number.pipe(
      Schema.positive(),
      Schema.annotations({ description: 'Window size in milliseconds' })
    )
  ),
  precision: Schema.optional(
    Schema.Number.pipe(
      Schema.positive(),
      Schema.annotations({ description: 'Number of sub-windows for precision' })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Sliding Window',
    description: 'Sliding window algorithm configuration for rate limiting',
    examples: [{ windowSize: 60_000, precision: 10 }],
  })
)

export type SlidingWindow = Schema.Schema.Type<typeof SlidingWindowSchema>

/**
 * Rate Limit Configuration
 *
 * Controls API request rate limiting per key.
 * Supports simple limit or advanced sliding window configuration.
 */
export const RateLimitConfigSchema = Schema.Union(
  // Simple form: just a number (requests per minute)
  Schema.Number.pipe(
    Schema.positive(),
    Schema.annotations({ description: 'Max requests per minute (simple form)' })
  ),
  // Detailed form: object with options
  Schema.Struct({
    requestsPerMinute: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Maximum requests per minute' })
      )
    ),
    requestsPerHour: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Maximum requests per hour' })
      )
    ),
    requestsPerDay: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Maximum requests per day' })
      )
    ),
    slidingWindow: Schema.optional(SlidingWindowSchema),
    scopes: Schema.optional(
      Schema.Record({
        key: Schema.String.pipe(
          Schema.pattern(/^[a-z][a-z0-9_-]*$/i),
          Schema.annotations({ description: 'Scope name (e.g., "read", "write")' })
        ),
        value: Schema.Number.pipe(
          Schema.positive(),
          Schema.annotations({ description: 'Max requests per minute for this scope' })
        ),
      }).pipe(Schema.annotations({ description: 'Per-scope rate limits' }))
    ),
  })
).pipe(
  Schema.annotations({
    title: 'Rate Limit',
    description: 'API rate limiting configuration',
    examples: [
      1000,
      { requestsPerMinute: 100, requestsPerHour: 1000, slidingWindow: { windowSize: 60_000 } },
    ],
  })
)

export type RateLimitConfig = Schema.Schema.Type<typeof RateLimitConfigSchema>

/**
 * Resource Permissions Schema
 *
 * Defines granular API key permissions using resource:action pattern.
 * Each resource maps to an array of allowed actions.
 *
 * @example
 * ```typescript
 * {
 *   users: ['read', 'list'],
 *   posts: ['create', 'read', 'update', 'delete'],
 *   analytics: ['*']  // Wildcard for all actions
 * }
 * ```
 */
export const ResourcePermissionsSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-z][a-z0-9_-]*$/i),
    Schema.annotations({ description: 'Resource name (e.g., "users", "posts")' })
  ),
  value: Schema.Array(
    Schema.Union(
      Schema.Literal('*'),
      Schema.String.pipe(
        Schema.pattern(/^[a-z][a-z0-9_-]*$/i),
        Schema.annotations({ description: 'Action name (e.g., "read", "write")' })
      )
    )
  ).pipe(
    Schema.minItems(1),
    Schema.annotations({ description: 'Allowed actions for this resource' })
  ),
}).pipe(
  Schema.annotations({
    title: 'Resource Permissions',
    description: 'Resource:action permission definitions for API keys',
    examples: [
      {
        users: ['read', 'list'],
        posts: ['create', 'read', 'update', 'delete'],
        analytics: ['*'],
      },
    ],
  })
)

export type ResourcePermissions = Schema.Schema.Type<typeof ResourcePermissionsSchema>

/**
 * API Keys Plugin Configuration
 *
 * Enables programmatic API access with API keys.
 * Users can generate API keys for integration and automation.
 *
 * Configuration options:
 * - expirationDays: Number of days until API keys expire (0 = never)
 * - rateLimit: Rate limiting configuration (simple number or detailed object)
 * - maxKeysPerUser: Maximum API keys a user can create
 * - autoRotate: Automatic key rotation configuration
 * - resourcePermissions: Granular resource:action permissions
 * - prefix: Custom prefix for generated API keys
 * - hashKeys: Store hashed keys instead of plaintext
 *
 * @example
 * ```typescript
 * // Simple enable
 * { plugins: { apiKeys: true } }
 *
 * // With configuration
 * { plugins: { apiKeys: { expirationDays: 90, rateLimit: 1000 } } }
 *
 * // With auto-rotation and permissions
 * { plugins: { apiKeys: {
 *   autoRotate: { rotationWindow: 86400000 },
 *   rateLimit: { requestsPerMinute: 100, slidingWindow: { windowSize: 60000 } },
 *   resourcePermissions: { users: ['read'], posts: ['*'] }
 * } } }
 * ```
 */
export const ApiKeysConfigSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    // ========== Existing Fields ==========
    expirationDays: Schema.optional(
      Schema.Number.pipe(
        Schema.nonNegative(),
        Schema.annotations({ description: 'Days until API keys expire (0 = never)' })
      )
    ),
    rateLimit: Schema.optional(RateLimitConfigSchema),
    maxKeysPerUser: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Maximum API keys per user' })
      )
    ),

    // ========== Key Generation Options ==========
    prefix: Schema.optional(
      Schema.String.pipe(
        Schema.pattern(/^[a-z][a-z0-9_-]*$/i),
        Schema.annotations({ description: 'Custom prefix for generated API keys (e.g., "sk_")' })
      )
    ),
    hashKeys: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({ description: 'Store hashed keys instead of plaintext for security' })
      )
    ),

    // ========== Advanced Features ==========
    autoRotate: Schema.optional(AutoRotateSchema),
    resourcePermissions: Schema.optional(ResourcePermissionsSchema),
  })
).pipe(
  Schema.annotations({
    title: 'API Keys Plugin Configuration',
    description: 'Programmatic API access with API keys',
    examples: [
      true,
      { expirationDays: 90, rateLimit: 1000 },
      {
        autoRotate: { rotationWindow: 86_400_000 },
        rateLimit: { requestsPerMinute: 100, slidingWindow: { windowSize: 60_000 } },
        maxKeysPerUser: 5,
      },
    ],
  })
)

export type ApiKeysConfig = Schema.Schema.Type<typeof ApiKeysConfigSchema>
