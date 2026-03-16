/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ScriptPositionSchema } from './external-scripts'

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
 * Use cases:
 * - Global config: window.APP_CONFIG initialization
 * - Theme restoration: Apply saved theme before paint (avoid FOUC)
 * - Analytics: Tracking code initialization
 * - Feature detection: Check browser capabilities
 *
 * Performance considerations:
 * - Pros: No network request, executes immediately
 * - Cons: Not cached, repeated on every page load
 * - Recommendation: Keep inline scripts < 1KB, use external for larger code
 *
 * Security (CSP):
 * - Inline scripts require 'unsafe-inline' or nonce/hash in CSP header
 * - Use nonce: <script nonce="random123">...</script>
 * - Or hash: CSP header script-src 'sha256-{hash}'
 *
 * @example
 * ```typescript
 * const configScript = {
 *   code: "window.config = { apiUrl: 'https://api.example.com' };",
 *   position: 'head'
 * }
 *
 * const analyticsScript = {
 *   code: "console.log('Page loaded');",
 *   position: 'body-end'
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
 * Common use cases:
 * - Configuration: window.APP_CONFIG = {...}
 * - Theme restoration: Apply dark mode before paint
 * - Analytics initialization: gtag(), Plausible tracking
 * - Event listeners: DOMContentLoaded handlers
 *
 * Best practices:
 * - Keep scripts small (< 1KB) - larger code should be external
 * - Use for critical initialization only (theme, config)
 * - Position head scripts for pre-render logic
 * - Position body-end scripts for post-render logic
 *
 * Security:
 * - Inline scripts require CSP nonce or hash
 * - Escape user input to prevent XSS
 * - Never inject untrusted code
 *
 * @example
 * ```typescript
 * const inlineScripts = [
 *   {
 *     code: "window.config = { apiUrl: 'https://api.example.com' };",
 *     position: 'head'
 *   },
 *   {
 *     code: "console.log('Page loaded');",
 *     position: 'body-end'
 *   }
 * ]
 * ```
 *
 * @see specs/app/pages/scripts/inline-scripts/inline-scripts.schema.json
 */
export const InlineScriptsSchema = Schema.Array(InlineScriptSchema).annotations({
  title: 'Inline Scripts',
  description: 'Inline JavaScript code snippets',
})

export type InlineScript = Schema.Schema.Type<typeof InlineScriptSchema>
export type InlineScripts = Schema.Schema.Type<typeof InlineScriptsSchema>
