/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Built-in analytics configuration schema
 *
 * Enables first-party, privacy-friendly analytics tracking without cookies
 * or external dependencies. Supports both shorthand (boolean) and detailed
 * configuration (object).
 *
 * Features:
 * - Cookie-free tracking using visitor hashing
 * - Configurable data retention (1-730 days, default: 365)
 * - Session timeout control (1-120 minutes, default: 30)
 * - Path exclusion with glob patterns (e.g., '/admin/*')
 * - Do Not Track respect (default: true)
 *
 * @example Shorthand (boolean)
 * ```typescript
 * const app = {
 *   name: 'my-app',
 *   analytics: true, // Enables with defaults
 * }
 * ```
 *
 * @example Detailed configuration
 * ```typescript
 * const app = {
 *   name: 'my-app',
 *   analytics: {
 *     retentionDays: 90,
 *     sessionTimeout: 60,
 *     excludedPaths: ['/admin/*', '/api/*'],
 *     respectDoNotTrack: false,
 *   },
 * }
 * ```
 */

/**
 * Detailed analytics configuration object
 */
export const BuiltInAnalyticsConfigSchema = Schema.Struct({
  /**
   * Number of days to retain analytics data (1-730 days)
   * Default: 365 days (1 year)
   *
   * Data older than retentionDays is automatically purged during server operations.
   */
  retentionDays: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(1),
      Schema.lessThanOrEqualTo(730)
    ).pipe(
      Schema.annotations({
        title: 'Retention Days',
        description: 'Number of days to retain analytics data (1-730 days). Default: 365.',
      })
    )
  ),

  /**
   * Session timeout in minutes (1-120 minutes)
   * Default: 30 minutes
   *
   * Determines when a new session starts after user inactivity.
   */
  sessionTimeout: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(1),
      Schema.lessThanOrEqualTo(120)
    ).pipe(
      Schema.annotations({
        title: 'Session Timeout',
        description: 'Session timeout in minutes (1-120 minutes). Default: 30.',
      })
    )
  ),

  /**
   * Paths to exclude from tracking (supports glob patterns)
   * Default: [] (track all paths)
   *
   * Glob patterns:
   * - '*' matches any segment (e.g., '/admin/*' excludes /admin/users, /admin/settings)
   * - '**' matches anything (e.g., '/private/**' excludes all nested paths)
   */
  excludedPaths: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({
        title: 'Excluded Paths',
        description:
          'Paths to exclude from tracking. Supports glob patterns (* for segment, ** for any depth).',
      })
    )
  ),

  /**
   * Whether to respect Do Not Track browser setting
   * Default: true
   *
   * When true, tracking is disabled if navigator.doNotTrack === "1"
   */
  respectDoNotTrack: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        title: 'Respect Do Not Track',
        description: 'Whether to respect Do Not Track browser setting. Default: true.',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Built-In Analytics Configuration',
    description:
      'Detailed configuration for built-in analytics including retention, session timeout, excluded paths, and Do Not Track behavior.',
  })
)

/**
 * Built-in analytics schema - supports both boolean shorthand and detailed config
 *
 * - true: Enable analytics with default settings
 * - false: Disable analytics
 * - object: Enable analytics with custom settings
 */
export const BuiltInAnalyticsSchema = Schema.Union(
  Schema.Literal(true),
  Schema.Literal(false),
  BuiltInAnalyticsConfigSchema
).pipe(
  Schema.annotations({
    title: 'Built-In Analytics',
    description:
      'Enable first-party analytics tracking. Use boolean for defaults or object for custom configuration.',
    examples: [
      true,
      false,
      {
        retentionDays: 90,
        sessionTimeout: 60,
        excludedPaths: ['/admin/*', '/api/*'],
        respectDoNotTrack: false,
      },
    ],
  })
)

/**
 * TypeScript type inferred from BuiltInAnalyticsSchema
 */
export type BuiltInAnalytics = Schema.Schema.Type<typeof BuiltInAnalyticsSchema>

/**
 * Encoded type of BuiltInAnalyticsSchema (what goes in)
 */
export type BuiltInAnalyticsEncoded = Schema.Schema.Encoded<typeof BuiltInAnalyticsSchema>
