/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Feature configuration with enabled flag and custom config
 *
 * Complex feature definition with:
 * - enabled: Boolean toggle for the feature
 * - config: Flexible configuration object (additionalProperties: true)
 *
 * Use this when a feature requires additional configuration beyond a simple boolean.
 *
 * @example
 * ```typescript
 * const animations = {
 *   enabled: true,
 *   config: {
 *     duration: 300,
 *     easing: 'ease-in-out'
 *   }
 * }
 * ```
 */
export const FeatureConfigSchema = Schema.Struct({
  enabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Whether the feature is enabled',
    })
  ),
  config: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    }).annotations({
      description: 'Feature-specific configuration data',
    })
  ),
}).annotations({
  description: 'Feature configuration with enabled flag and custom config',
})

/**
 * Feature value - either a boolean flag or a configuration object
 *
 * Supports two patterns:
 * 1. Simple boolean: true/false for basic feature toggles
 * 2. Configuration object: { enabled, config } for features requiring settings
 *
 * @example
 * ```typescript
 * const features = {
 *   darkMode: true,  // Simple boolean
 *   liveChat: {      // Complex configuration
 *     enabled: true,
 *     config: {
 *       provider: 'intercom',
 *       appId: 'abc123'
 *     }
 *   }
 * }
 * ```
 */
export const FeatureValueSchema = Schema.Union(
  Schema.Boolean.annotations({
    description: 'Simple feature flag',
  }),
  FeatureConfigSchema
).annotations({
  description: 'Feature value - either a boolean flag or a configuration object',
})

/**
 * Client-side feature toggles
 *
 * Record of feature flags controlling client-side behavior.
 * Each feature can be either a simple boolean or a complex configuration object.
 *
 * Common use cases:
 * - darkMode: Enable dark theme
 * - animations: Control UI animations
 * - analytics: Toggle tracking
 * - cookieConsent: GDPR compliance
 * - liveChat: Customer support widget
 *
 * Features are:
 * - Accessible in client JavaScript as window.FEATURES
 * - Stored in data-* attributes for CSS/JS access
 * - Persisted in localStorage for user preferences
 *
 * @example
 * ```typescript
 * const features = {
 *   darkMode: true,
 *   animations: {
 *     enabled: true,
 *     config: {
 *       duration: 300,
 *       easing: 'ease-in-out'
 *     }
 *   },
 *   cookieConsent: false,
 *   liveChat: {
 *     enabled: true,
 *     config: {
 *       provider: 'intercom',
 *       appId: 'abc123'
 *     }
 *   }
 * }
 * ```
 *
 * @see specs/app/pages/scripts/features/features.schema.json
 */
export const FeaturesSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/, {
      message: () =>
        'Feature name must be camelCase starting with a letter (e.g., darkMode, liveChat, cookieConsent)',
    })
  ),
  value: FeatureValueSchema,
}).annotations({
  title: 'Feature Flags',
  description: 'Client-side feature toggles',
})

export type FeatureConfig = Schema.Schema.Type<typeof FeatureConfigSchema>
export type FeatureValue = Schema.Schema.Type<typeof FeatureValueSchema>
export type Features = Schema.Schema.Type<typeof FeaturesSchema>
