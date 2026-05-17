/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

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

/** @public */
export type FeatureConfig = Schema.Schema.Type<typeof FeatureConfigSchema>
/** @public */
export type FeatureValue = Schema.Schema.Type<typeof FeatureValueSchema>
/** @public */
export type Features = Schema.Schema.Type<typeof FeaturesSchema>

// ---------------------------------------------------------------------------
// External Scripts
// ---------------------------------------------------------------------------

/**
 * CORS settings for external scripts
 *
 * Controls cross-origin resource sharing:
 * - anonymous: No credentials sent (default for public CDN scripts)
 * - use-credentials: Send credentials (cookies, auth headers)
 */
export const CrossOriginSchema = Schema.Literal('anonymous', 'use-credentials').annotations({
  description: 'CORS setting for cross-origin scripts',
})

/**
 * Script insertion position in HTML document
 *
 * Controls where the script tag is inserted:
 * - head: In document <head> (loads before DOM)
 * - body-start: At start of <body> (loads before content)
 * - body-end: At end of <body> (default, loads after content)
 *
 * Performance impact:
 * - head: Blocks rendering, use with defer/async
 * - body-start: Blocks content, use sparingly
 * - body-end: Non-blocking, best for most scripts
 */
export const ScriptPositionSchema = Schema.Literal('head', 'body-start', 'body-end').annotations({
  description: 'Where to insert the script in the document',
})

/**
 * External JavaScript dependency
 *
 * Defines an external script loaded from a URL (CDN or local path).
 *
 * Required properties:
 * - src: Script source URL (https:// for CDN, relative for local)
 *
 * Optional properties:
 * - async: Load asynchronously (non-blocking, execute when ready)
 * - defer: Defer execution until DOM loaded (preserves order)
 * - module: Load as ES module (type="module")
 * - integrity: Subresource integrity hash for security
 * - crossorigin: CORS setting (anonymous or use-credentials)
 * - position: Where to insert script (head, body-start, body-end)
 *
 * @example
 * ```typescript
 * const alpineJS = {
 *   src: 'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
 *   defer: true,
 *   position: 'head'
 * }
 * ```
 *
 * @see specs/app/pages/scripts/external-scripts/external-scripts.schema.json
 */
export const ExternalScriptSchema = Schema.Struct({
  src: Schema.String.annotations({
    description: 'Script source URL',
    format: 'uri',
  }),
  async: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Load script asynchronously',
      default: false,
    })
  ),
  defer: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Defer script execution',
      default: false,
    })
  ),
  module: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Load as ES module',
      default: false,
    })
  ),
  integrity: Schema.optional(
    Schema.String.annotations({
      description: 'Subresource integrity hash',
    })
  ),
  crossorigin: Schema.optional(CrossOriginSchema),
  position: Schema.optional(ScriptPositionSchema),
}).annotations({
  description: 'External JavaScript dependency',
})

/**
 * External JavaScript dependencies
 *
 * Array of external scripts loaded from CDN or local paths.
 * Scripts are loaded in order when using defer or blocking mode.
 *
 * @see specs/app/pages/scripts/external-scripts/external-scripts.schema.json
 */
export const ExternalScriptsSchema = Schema.Array(ExternalScriptSchema).annotations({
  title: 'External Scripts',
  description: 'External JavaScript dependencies',
})

/** @public */
export type CrossOrigin = Schema.Schema.Type<typeof CrossOriginSchema>
/** @public */
export type ScriptPosition = Schema.Schema.Type<typeof ScriptPositionSchema>
/** @public */
export type ExternalScript = Schema.Schema.Type<typeof ExternalScriptSchema>
/** @public */
export type ExternalScripts = Schema.Schema.Type<typeof ExternalScriptsSchema>

// ---------------------------------------------------------------------------
// Inline Scripts
// ---------------------------------------------------------------------------

/**
 * Inline JavaScript code snippet
 *
 * Defines an inline script tag with JavaScript code.
 *
 * Required properties:
 * - code: JavaScript code to execute (raw JS, no <script> tags)
 *
 * Optional properties:
 * - position: Where to insert script (head, body-start, body-end)
 * - async: Wrap code in async IIFE (async function)
 *
 * @example
 * ```typescript
 * const configScript = {
 *   code: "window.config = { apiUrl: 'https://api.example.com' };",
 *   position: 'head'
 * }
 * ```
 *
 * @see specs/app/pages/scripts/inline-scripts/inline-scripts.schema.json
 */
export const InlineScriptSchema = Schema.Struct({
  code: Schema.String.annotations({
    description: 'JavaScript code to execute',
  }),
  position: Schema.optional(ScriptPositionSchema),
  async: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Wrap in async IIFE',
      default: false,
    })
  ),
}).annotations({
  description: 'Inline JavaScript code snippet',
})

/**
 * Inline JavaScript code snippets
 *
 * Array of inline scripts injected into the HTML document.
 * Scripts execute in order (synchronous by default).
 *
 * @see specs/app/pages/scripts/inline-scripts/inline-scripts.schema.json
 */
export const InlineScriptsSchema = Schema.Array(InlineScriptSchema).annotations({
  title: 'Inline Scripts',
  description: 'Inline JavaScript code snippets',
})

/** @public */
export type InlineScript = Schema.Schema.Type<typeof InlineScriptSchema>
/** @public */
export type InlineScripts = Schema.Schema.Type<typeof InlineScriptsSchema>

// ---------------------------------------------------------------------------
// Scripts (main)
// ---------------------------------------------------------------------------

/**
 * Client scripts configuration
 *
 * Orchestrates all client-side scripts, features, and configuration.
 *
 * Properties (all optional):
 * - features: Client-side feature toggles (boolean flags or config objects)
 * - externalScripts: External JavaScript dependencies from CDN
 * - inlineScripts: Inline JavaScript code snippets
 * - config: Client-side configuration data (flexible schema)
 *
 * @example
 * ```typescript
 * const scripts = {
 *   features: {
 *     darkMode: true,
 *     animations: {
 *       enabled: true,
 *       config: {
 *         duration: 300,
 *         easing: 'ease-in-out'
 *       }
 *     },
 *     analytics: false
 *   },
 *   externalScripts: [
 *     {
 *       src: 'https://cdn.example.com/script.js',
 *       async: true
 *     }
 *   ],
 *   inlineScripts: [
 *     {
 *       code: "console.log('Page loaded');",
 *       position: 'body-end'
 *     }
 *   ],
 *   config: {
 *     apiUrl: 'https://api.example.com',
 *     environment: 'production'
 *   }
 * }
 * ```
 *
 * @see specs/app/pages/scripts/scripts.schema.json
 */
export const ScriptsSchema = Schema.Struct({
  features: Schema.optional(FeaturesSchema),
  externalScripts: Schema.optional(ExternalScriptsSchema),
  // Support 'external' as an alias for 'externalScripts' (test shorthand)
  external: Schema.optional(ExternalScriptsSchema),
  inlineScripts: Schema.optional(InlineScriptsSchema),
  config: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    }).annotations({
      description: 'Client-side configuration data',
    })
  ),
}).annotations({
  title: 'Client Scripts Configuration',
  description: 'Client-side scripts, features, and external dependencies',
})

/** @public */
export type Scripts = Schema.Schema.Type<typeof ScriptsSchema>
