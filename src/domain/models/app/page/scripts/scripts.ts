/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ExternalScriptsSchema } from './external-scripts'
import { FeaturesSchema } from './features'
import { InlineScriptsSchema } from './inline-scripts'

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
 * Use cases:
 * - SPA initialization: Load framework (Alpine.js, htmx) + inline config
 * - Analytics: External script (Google Analytics) + inline tracking code
 * - Feature flags: Toggle features based on environment or user preferences
 * - Third-party services: Auth0, Sentry, Intercom configuration
 *
 * Loading order:
 * 1. External scripts (async/defer respected)
 * 2. Inline scripts (execute after external scripts load)
 * 3. Config available as window.APP_CONFIG
 *
 * Performance:
 * - Load scripts only where needed (per-page customization)
 * - Use async for non-dependent scripts (analytics, ads)
 * - Use defer for frameworks (preserve order, non-blocking)
 * - Keep inline scripts < 1KB (larger code should be external)
 *
 * Security:
 * - Config is public (sent to client), NO SECRETS
 * - Never include API keys, passwords, private tokens in config
 * - Use HTTPS for external scripts (no http://)
 * - Add integrity hashes for CDN scripts
 * - Inline scripts require CSP nonce or hash
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

export type Scripts = Schema.Schema.Type<typeof ScriptsSchema>
