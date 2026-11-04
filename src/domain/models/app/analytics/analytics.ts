/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Built-in Analytics Configuration Schema
 *
 * Configures the first-party analytics engine.
 * When this property exists in the app config, analytics is enabled.
 * When omitted, no analytics endpoints are available.
 *
 * Configuration forms:
 * - `true` — Enable analytics with all defaults
 * - `false` — Explicitly disable analytics
 * - `{ ... }` — Enable analytics with custom options
 *
 * Design principles:
 * - No cookies: a server-computed visitor identifier, rotated daily, counts
 *   unique visitors
 * - No external dependencies
 * - Honors Do Not Track and Global Privacy Control by default
 *   (respectDoNotTrack: true, respectGlobalPrivacyControl: true)
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
export const BuiltInAnalyticsSchema = Schema.Union([
  Schema.Boolean,
  Schema.Struct({
    /**
     * Number of days to retain analytics data (optional).
     *
     * Must be between 1 and 730 days (2 years).
     * Defaults to 365 days. Data older than this is automatically purged.
     */
    retentionDays: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          title: 'Retention Days',
          description: 'Number of days to retain analytics data (1-730)',
          defaultNote: '365',
        }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 730 }))
      )
    ),

    /**
     * URL path patterns to exclude from tracking (optional).
     *
     * Glob patterns matching page paths that should not be tracked.
     * Useful for excluding admin pages, API docs, or internal routes.
     */
    excludedPaths: Schema.optional(
      Schema.Array(
        Schema.String.annotate({
          description:
            'One glob pattern. A path matching it records no event: `/admin/*` excludes everything beneath `/admin`. On a multilingual app, `/en/pricing` excludes the English page only, and `/pricing` excludes that page in every language.',
        })
      ).pipe(
        Schema.annotate({
          title: 'Excluded Paths',
          description: 'Glob patterns for paths excluded from tracking',
        })
      )
    ),

    /**
     * Whether to honor the Do Not Track browser setting (optional).
     *
     * When true, visitors with DNT:1 header will not be tracked.
     * Defaults to true.
     */
    respectDoNotTrack: Schema.optional(
      Schema.Boolean.annotate({
        description: 'Records nothing for a visitor whose browser asks not to be tracked.',
        defaultNote: 'true',
      })
    ),

    /**
     * Whether to honor the Global Privacy Control signal (optional).
     *
     * Sibling of `respectDoNotTrack`. Only the exact `Sec-GPC: 1` request header
     * (and `navigator.globalPrivacyControl === true` in the tracker) is the
     * signal. Defaults to true.
     */
    respectGlobalPrivacyControl: Schema.optional(
      Schema.Boolean.annotate({
        description:
          'Records nothing for a visitor whose browser sends the Global Privacy Control signal (`Sec-GPC: 1`).',
        defaultNote: 'true',
      })
    ),

    /**
     * Which fields each analytics event stores (optional).
     *
     * `audience-only` (the default) keeps what audience measurement needs and
     * drops the rest on the server, whatever the tracker sends. `full` stores
     * every field. Switching to `audience-only` also strips the now-excluded
     * fields from the events already stored, once, at the next start.
     */
    profile: Schema.optional(
      Schema.Literals(['audience-only', 'full']).annotate({
        title: 'Analytics Profile',
        description:
          'Which fields each event stores. `audience-only` keeps page paths without their query string, the referrer host, device, browser, operating system and language, and stores no UTM value, screen size or page title; outbound clicks keep their destination without its query string, and short-link clicks, QR scans and form submissions carry one shared visitor identifier instead of a per-visitor one. `full` also stores UTM values, screen size, page titles, full referrers and full destinations, with a per-visitor identifier on short-link clicks, QR scans and form submissions too.',
        defaultNote: 'audience-only',
      })
    ),

    /**
     * Session timeout in minutes (optional).
     *
     * Time of inactivity before a new session is created.
     * Must be between 1 and 120 minutes. Defaults to 30 minutes.
     */
    sessionTimeout: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          title: 'Session Timeout',
          description:
            'The session window in minutes (1-120) for page views, outbound clicks, short-link clicks and QR scans: events of one visitor in one window count as one session.',
          defaultNote: '30',
        }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 120 }))
      )
    ),
  }),
]).pipe(
  Schema.annotate({
    identifier: 'BuiltInAnalytics',
    title: 'Built-in Analytics Configuration',
    description:
      "First-party analytics engine. It sets no cookies and calls no external service; whether visitors must consent before it runs is the operator's to assess.",
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
 * @public
 */
export type BuiltInAnalyticsEncoded = Schema.Codec.Encoded<typeof BuiltInAnalyticsSchema>
