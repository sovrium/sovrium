/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ============================================================================
// Analytics
// ============================================================================

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
export const AnalyticsProviderNameSchema = Schema.Literals([
  'google',
  'plausible',
  'matomo',
  'fathom',
  'posthog',
  'mixpanel',
]).annotate({
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
  src: Schema.String.annotate({
    description: 'Script source URL',
    format: 'uri',
  }),
  async: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Load script asynchronously',
      default: true,
    })
  ),
  defer: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Defer script execution',
    })
  ),
}).annotate({
  description: 'Analytics script',
})

/**
 * Analytics provider configuration
 *
 * Defines a single analytics provider with scripts, initialization, and settings.
 */
export const AnalyticsProviderSchema = Schema.Struct({
  name: AnalyticsProviderNameSchema,
  enabled: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Whether this provider is enabled',
      default: true,
    })
  ),
  scripts: Schema.optional(
    Schema.Array(AnalyticsScriptSchema).annotate({
      description: 'Scripts this provider injects into the page.',
    })
  ),
  initScript: Schema.optional(
    Schema.String.annotate({
      description: 'Inline JavaScript to initialize the analytics',
    })
  ),
  dnsPrefetch: Schema.optional(
    Schema.String.annotate({
      description: 'Domain to DNS prefetch for this provider',
      format: 'uri',
    })
  ),
  config: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description: 'Provider-specific configuration',
    })
  ),
}).annotate({
  description: 'Analytics provider',
})

/**
 * Analytics configuration for multiple providers
 *
 * Manages analytics tracking across one or more analytics platforms.
 */
export const AnalyticsSchema = Schema.Struct({
  providers: Schema.Array(AnalyticsProviderSchema).annotate({
    description: 'Third-party analytics providers loaded on the page.',
  }),
}).annotate({
  title: 'Analytics Configuration',
  description: 'Configuration for analytics providers',
})

/** @public */
export type AnalyticsProviderName = Schema.Schema.Type<typeof AnalyticsProviderNameSchema>
/** @public */
export type AnalyticsScript = Schema.Schema.Type<typeof AnalyticsScriptSchema>
/** @public */
export type AnalyticsProvider = Schema.Schema.Type<typeof AnalyticsProviderSchema>
export type Analytics = Schema.Schema.Type<typeof AnalyticsSchema>
