/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Analytics provider name
 *
 * 6 supported analytics platforms:
 * - google: Google Analytics 4 (most popular, 60% market share)
 * - plausible: Privacy-focused, GDPR-compliant, no cookies
 * - matomo: Open-source, self-hosted, privacy-focused
 * - fathom: Privacy-first, simple, GDPR-compliant
 * - posthog: Product analytics, session replay, feature flags
 * - mixpanel: Product analytics, funnel analysis, cohort analysis
 */
export const AnalyticsProviderNameSchema = Schema.Literal(
  'google',
  'plausible',
  'matomo',
  'fathom',
  'posthog',
  'mixpanel'
).annotations({
  description: 'Analytics provider name',
})

/**
 * Analytics script configuration
 *
 * External JavaScript file to load for analytics provider.
 *
 * Required properties:
 * - src: Script source URL (CDN or provider-hosted)
 *
 * Optional properties:
 * - async: Load asynchronously (default: true, recommended for analytics)
 * - defer: Defer execution until DOM loaded
 */
export const AnalyticsScriptSchema = Schema.Struct({
  src: Schema.String.annotations({
    description: 'Script source URL',
    format: 'uri',
  }),
  async: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Load script asynchronously',
      default: true,
    })
  ),
  defer: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Defer script execution',
    })
  ),
}).annotations({
  description: 'Analytics script',
})

/**
 * Analytics provider configuration
 *
 * Defines a single analytics provider with scripts, initialization, and settings.
 *
 * Required properties:
 * - name: Provider name (google, plausible, matomo, fathom, posthog, mixpanel)
 *
 * Optional properties:
 * - enabled: Whether provider is active (default: true)
 * - scripts: Array of external scripts to load
 * - initScript: Inline JavaScript for provider initialization
 * - dnsPrefetch: Domain to DNS prefetch (performance optimization)
 * - config: Provider-specific configuration (tracking IDs, privacy settings, features)
 *
 * Common pattern:
 * 1. Load external script(s) from CDN (scripts array)
 * 2. Run initialization code (initScript)
 * 3. Configure with provider settings (config object)
 *
 * Performance optimization:
 * - async: true (default) - non-blocking script load
 * - dnsPrefetch: Early DNS resolution for faster script load
 *
 * @example
 * ```typescript
 * const googleAnalytics = {
 *   name: 'google',
 *   enabled: true,
 *   scripts: [
 *     {
 *       src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXX',
 *       async: true
 *     }
 *   ],
 *   initScript: `
 *     window.dataLayer = window.dataLayer || [];
 *     function gtag(){dataLayer.push(arguments);}
 *     gtag('js', new Date());
 *     gtag('config', 'G-XXXXX');
 *   `,
 *   dnsPrefetch: 'https://www.googletagmanager.com',
 *   config: {
 *     trackingId: 'G-XXXXX',
 *     anonymizeIp: true
 *   }
 * }
 *
 * const plausible = {
 *   name: 'plausible',
 *   enabled: true,
 *   scripts: [
 *     {
 *       src: 'https://plausible.io/js/script.js',
 *       async: true,
 *       defer: true
 *     }
 *   ],
 *   dnsPrefetch: 'https://plausible.io',
 *   config: {
 *     domain: 'example.com'
 *   }
 * }
 * ```
 *
 * @see specs/app/pages/meta/analytics/analytics.schema.json
 */
export const AnalyticsProviderSchema = Schema.Struct({
  name: AnalyticsProviderNameSchema,
  enabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Whether this provider is enabled',
      default: true,
    })
  ),
  scripts: Schema.optional(Schema.Array(AnalyticsScriptSchema)),
  initScript: Schema.optional(
    Schema.String.annotations({
      description: 'Inline JavaScript to initialize the analytics',
    })
  ),
  dnsPrefetch: Schema.optional(
    Schema.String.annotations({
      description: 'Domain to DNS prefetch for this provider',
      format: 'uri',
    })
  ),
  config: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    }).annotations({
      description: 'Provider-specific configuration',
    })
  ),
}).annotations({
  description: 'Analytics provider',
})

/**
 * Analytics configuration for multiple providers
 *
 * Manages analytics tracking across one or more analytics platforms.
 * Supports simultaneous tracking with multiple providers for:
 * - Transition periods (migrating between providers)
 * - Compliance (privacy-friendly for EU, full-featured for others)
 * - Comparison (data quality validation)
 * - Redundancy (backup if one fails)
 *
 * Required properties:
 * - providers: Array of analytics provider configurations
 *
 * Provider categories:
 * 1. **Privacy-focused** (GDPR-compliant, no cookies):
 *    - plausible: < 1KB, simple dashboards
 *    - matomo: Open-source, self-hosted
 *    - fathom: Minimal, privacy-first
 *
 * 2. **Full-featured** (detailed analytics):
 *    - google: Free, most popular, integrates with Ads
 *    - posthog: Product analytics, session replay, feature flags
 *    - mixpanel: Funnel analysis, cohorts, retention
 *
 * Integration notes:
 * - All scripts load asynchronously (non-blocking)
 * - DNS prefetch optimizes external script loading
 * - Config object flexible (additionalProperties: true)
 * - Each provider independent (isolated initialization)
 *
 * @example
 * ```typescript
 * const analytics = {
 *   providers: [
 *     // Privacy-friendly for all users
 *     {
 *       name: 'plausible',
 *       enabled: true,
 *       scripts: [
 *         {
 *           src: 'https://plausible.io/js/script.js',
 *           async: true
 *         }
 *       ],
 *       config: {
 *         domain: 'example.com'
 *       }
 *     },
 *     // Full-featured for detailed insights
 *     {
 *       name: 'google',
 *       enabled: true,
 *       scripts: [
 *         {
 *           src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXX',
 *           async: true
 *         }
 *       ],
 *       initScript: `
 *         window.dataLayer = window.dataLayer || [];
 *         function gtag(){dataLayer.push(arguments);}
 *         gtag('js', new Date());
 *         gtag('config', 'G-XXXXX');
 *       `,
 *       config: {
 *         trackingId: 'G-XXXXX',
 *         anonymizeIp: true
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * @see specs/app/pages/meta/analytics/analytics.schema.json
 */
export const AnalyticsSchema = Schema.Struct({
  providers: Schema.Array(AnalyticsProviderSchema),
}).annotations({
  title: 'Analytics Configuration',
  description: 'Configuration for analytics providers',
})

export type AnalyticsProviderName = Schema.Schema.Type<typeof AnalyticsProviderNameSchema>
export type AnalyticsScript = Schema.Schema.Type<typeof AnalyticsScriptSchema>
export type AnalyticsProvider = Schema.Schema.Type<typeof AnalyticsProviderSchema>
export type Analytics = Schema.Schema.Type<typeof AnalyticsSchema>
