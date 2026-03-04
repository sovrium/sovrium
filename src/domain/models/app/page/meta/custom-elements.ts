/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Custom head element type
 *
 * 5 HTML elements allowed in <head>:
 * - meta: Metadata (charset, viewport, theme-color, etc.)
 * - link: External resources (stylesheets, preconnect, dns-prefetch)
 * - script: JavaScript files or inline code
 * - style: Inline CSS styles
 * - base: Base URL for relative URLs
 */
export const CustomElementTypeSchema = Schema.Literal(
  'meta',
  'link',
  'script',
  'style',
  'base'
).annotations({
  title: 'Custom Element Type',
  description: 'HTML element type',
})

/**
 * Custom head element
 *
 * Allows adding arbitrary HTML elements to the page <head> section.
 * Useful for custom meta tags, third-party integrations, or special configurations.
 *
 * Required properties:
 * - type: HTML element type (meta, link, script, style, base)
 *
 * Optional properties:
 * - attrs: Object of HTML attributes (kebab-case keys, string values)
 * - content: Inner content for script or style elements
 *
 * Common use cases:
 * - Custom meta tags: theme-color, apple-mobile-web-app-capable
 * - Preconnect/DNS prefetch: Speed up external resource loading
 * - Third-party scripts: Analytics, chat widgets not covered by analytics config
 * - Inline styles: Critical CSS for above-the-fold content
 *
 * Attribute naming:
 * - Keys must be kebab-case (data-theme, http-equiv, charset)
 * - Values are always strings
 * - Pattern: ^[a-zA-Z][a-zA-Z0-9-]*$
 *
 * @example
 * ```typescript
 * const themeColorMeta = {
 *   type: 'meta',
 *   attrs: {
 *     name: 'theme-color',
 *     content: '#FFAF00'
 *   }
 * }
 *
 * const viewportMeta = {
 *   type: 'meta',
 *   attrs: {
 *     name: 'viewport',
 *     content: 'width=device-width, initial-scale=1'
 *   }
 * }
 *
 * const preconnectLink = {
 *   type: 'link',
 *   attrs: {
 *     rel: 'preconnect',
 *     href: 'https://fonts.gstatic.com'
 *   }
 * }
 *
 * const inlineScript = {
 *   type: 'script',
 *   content: "console.log('Custom script');"
 * }
 *
 * const criticalCSS = {
 *   type: 'style',
 *   content: 'body { margin: 0; padding: 0; }'
 * }
 * ```
 *
 * @see specs/app/pages/meta/custom-elements/custom-elements.schema.json
 */
export const CustomElementSchema = Schema.Struct({
  type: CustomElementTypeSchema,
  attrs: Schema.optional(
    Schema.Record({
      key: Schema.String.pipe(
        Schema.pattern(/^[a-zA-Z][a-zA-Z0-9-]*$/, {
          message: () =>
            'Attribute name must start with a letter and contain only letters, numbers, and hyphens (kebab-case)',
        })
      ),
      value: Schema.String,
    }).annotations({
      description: 'Element attributes',
    })
  ),
  content: Schema.optional(
    Schema.String.annotations({
      description: 'Inner content for script or style elements',
    })
  ),
}).annotations({
  title: 'Custom Element',
  description: 'Custom head element',
})

/**
 * Additional custom elements to add to the page head
 *
 * Array of custom HTML elements injected into the <head> section.
 * Provides escape hatch for custom meta tags, scripts, styles not
 * covered by dedicated schemas (analytics, favicons, social, etc.).
 *
 * Common use cases:
 * - Mobile web app meta tags (apple-mobile-web-app-capable, mobile-web-app-capable)
 * - Theme customization (theme-color, color-scheme)
 * - Performance optimization (preconnect, dns-prefetch for custom CDNs)
 * - Third-party integrations (chat widgets, analytics not in analytics schema)
 * - Critical CSS (inline styles for above-the-fold content)
 *
 * Order matters:
 * - Meta tags: First (charset, viewport)
 * - Preconnect/DNS prefetch: Early (before scripts that use those domains)
 * - Styles: Before visual content
 * - Scripts: Last (unless critical)
 *
 * @example
 * ```typescript
 * const customElements = [
 *   // Mobile web app configuration
 *   {
 *     type: 'meta',
 *     attrs: {
 *       name: 'apple-mobile-web-app-capable',
 *       content: 'yes'
 *     }
 *   },
 *   {
 *     type: 'meta',
 *     attrs: {
 *       name: 'theme-color',
 *       content: '#FFAF00'
 *     }
 *   },
 *   // Performance optimization
 *   {
 *     type: 'link',
 *     attrs: {
 *       rel: 'preconnect',
 *       href: 'https://fonts.gstatic.com'
 *     }
 *   },
 *   // Critical CSS
 *   {
 *     type: 'style',
 *     content: 'body{margin:0}*{box-sizing:border-box}'
 *   }
 * ]
 * ```
 *
 * @see specs/app/pages/meta/custom-elements/custom-elements.schema.json
 */
export const CustomElementsSchema = Schema.Array(CustomElementSchema).annotations({
  title: 'Custom Head Elements',
  description: 'Additional custom elements to add to the page head',
})

export type CustomElementType = Schema.Schema.Type<typeof CustomElementTypeSchema>
export type CustomElement = Schema.Schema.Type<typeof CustomElementSchema>
export type CustomElements = Schema.Schema.Type<typeof CustomElementsSchema>
