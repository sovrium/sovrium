/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ============================================================================
// Custom Elements
// ============================================================================

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
 */
export const CustomElementsSchema = Schema.Array(CustomElementSchema).annotations({
  title: 'Custom Head Elements',
  description: 'Additional custom elements to add to the page head',
})

/** @public */
export type CustomElementType = Schema.Schema.Type<typeof CustomElementTypeSchema>
export type CustomElement = Schema.Schema.Type<typeof CustomElementSchema>
export type CustomElements = Schema.Schema.Type<typeof CustomElementsSchema>
