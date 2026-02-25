/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Built-in Analytics Configuration Schema
 *
 * Configures the first-party, privacy-friendly analytics engine.
 * When this property exists in the app config, analytics is enabled.
 * When omitted, no analytics endpoints are available.
 *
 * Configuration forms:
 * - `true` — Enable analytics with all defaults
 * - `false` — Explicitly disable analytics
 * - `{ ... }` — Enable analytics with custom options
 *
 * Design principles:
 * - No cookies (visitor hashing via SHA-256)
 * - No external dependencies
 * - GDPR-friendly by default (respectDoNotTrack: true)
 * - Configurable data retention
 *
 * @example
 * ```typescript
 * // Enable with all defaults
 * true
 *
 * // Explicitly disabled
 * false
 *
 * // Custom retention and excluded paths
 * {
 *   retentionDays: 90,
 *   excludedPaths: ['/admin/*', '/api/*'],
 *   sessionTimeout: 15
 * }
 * ```
 */
export const BuiltInAnalyticsSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    /**
     * Number of days to retain analytics data (optional).
     *
     * Must be between 1 and 730 days (2 years).
     * Defaults to 365 days. Data older than this is automatically purged.
     */
    retentionDays: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 730),
        Schema.annotations({
          title: 'Retention Days',
          description: 'Number of days to retain analytics data (1-730)',
        })
      )
    ),

    /**
     * URL path patterns to exclude from tracking (optional).
     *
     * Glob patterns matching page paths that should not be tracked.
     * Useful for excluding admin pages, API docs, or internal routes.
     */
    excludedPaths: Schema.optional(
      Schema.Array(Schema.String).pipe(
        Schema.annotations({
          title: 'Excluded Paths',
          description: 'Glob patterns for paths excluded from tracking',
        })
      )
    ),

    /**
     * Whether to honor the Do Not Track browser setting (optional).
     *
     * When true, visitors with DNT:1 header will not be tracked.
     * Defaults to true for privacy compliance.
     */
    respectDoNotTrack: Schema.optional(Schema.Boolean),

    /**
     * Session timeout in minutes (optional).
     *
     * Time of inactivity before a new session is created.
     * Must be between 1 and 120 minutes. Defaults to 30 minutes.
     */
    sessionTimeout: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 120),
        Schema.annotations({
          title: 'Session Timeout',
          description: 'Session timeout in minutes (1-120)',
        })
      )
    ),
  })
).pipe(
  Schema.annotations({
    title: 'Built-in Analytics Configuration',
    description:
      'First-party, privacy-friendly analytics engine. No cookies, no external dependencies, GDPR-compliant.',
    examples: [
      true,
      {
        retentionDays: 90,
        excludedPaths: ['/admin/*', '/api/*'],
        sessionTimeout: 15,
      },
      false,
    ],
  })
)

/**
 * TypeScript type inferred from BuiltInAnalyticsSchema
 */
export type BuiltInAnalytics = Schema.Schema.Type<typeof BuiltInAnalyticsSchema>

/**
 * Encoded type of BuiltInAnalyticsSchema (what goes in before validation)
 */
export type BuiltInAnalyticsEncoded = Schema.Schema.Encoded<typeof BuiltInAnalyticsSchema>
