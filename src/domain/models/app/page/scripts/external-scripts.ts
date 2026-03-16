/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

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
 * Loading strategies:
 * - async: Best for analytics, ads (execute ASAP, order doesn't matter)
 * - defer: Best for frameworks (preserve order, non-blocking)
 * - neither: Blocking (avoid unless script must execute before DOM)
 *
 * @example
 * ```typescript
 * const alpineJS = {
 *   src: 'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
 *   defer: true,
 *   position: 'head'
 * }
 *
 * const chartJS = {
 *   src: 'https://cdn.jsdelivr.net/npm/chart.js',
 *   async: true
 * }
 *
 * const localApp = {
 *   src: './js/app.js',
 *   module: true,
 *   position: 'body-end'
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
 * Common use cases:
 * - Frameworks: Alpine.js, htmx (defer for order preservation)
 * - Libraries: Chart.js, D3.js (async for parallel loading)
 * - Analytics: Google Analytics, Plausible (async, non-blocking)
 * - UI widgets: Intercom, Crisp chat (async, low priority)
 *
 * Performance best practices:
 * - Use async for non-dependent scripts (analytics, ads)
 * - Use defer for frameworks/libraries that depend on each other
 * - Add integrity hashes for security (CDN scripts)
 * - Prefer body-end position for non-critical scripts
 *
 * @example
 * ```typescript
 * const externalScripts = [
 *   {
 *     src: 'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
 *     defer: true,
 *     position: 'head'
 *   },
 *   {
 *     src: 'https://cdn.jsdelivr.net/npm/chart.js',
 *     async: true
 *   },
 *   {
 *     src: './js/app.js',
 *     module: true,
 *     position: 'body-end'
 *   }
 * ]
 * ```
 *
 * @see specs/app/pages/scripts/external-scripts/external-scripts.schema.json
 */
export const ExternalScriptsSchema = Schema.Array(ExternalScriptSchema).annotations({
  title: 'External Scripts',
  description: 'External JavaScript dependencies',
})

export type CrossOrigin = Schema.Schema.Type<typeof CrossOriginSchema>
export type ScriptPosition = Schema.Schema.Type<typeof ScriptPositionSchema>
export type ExternalScript = Schema.Schema.Type<typeof ExternalScriptSchema>
export type ExternalScripts = Schema.Schema.Type<typeof ExternalScriptsSchema>
