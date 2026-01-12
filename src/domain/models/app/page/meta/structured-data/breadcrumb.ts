/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SchemaOrgContext, schemaType, positiveInt } from './common-fields'

/**
 * Breadcrumb list item
 *
 * Represents a single breadcrumb in the navigation trail.
 *
 * Required properties:
 * - @type: "ListItem" (Schema.org type identifier)
 * - position: Item position in breadcrumb trail (starts at 1)
 * - name: Human-readable breadcrumb label (e.g., "Home", "Products", "Widget")
 *
 * Optional properties:
 * - item: URL to the breadcrumb page (clickable link)
 */
export const BreadcrumbListItemSchema = Schema.Struct({
  '@type': schemaType('ListItem'),
  position: positiveInt('Item position in breadcrumb trail'),
  name: Schema.String.annotations({
    description: 'Breadcrumb label',
  }),
  item: Schema.optional(
    Schema.String.annotations({
      description: 'URL to the breadcrumb page',
      format: 'uri',
    })
  ),
}).annotations({
  description: 'Breadcrumb list item',
})

/**
 * Schema.org BreadcrumbList structured data
 *
 * Represents the navigation path (breadcrumb trail) showing the page's position
 * in the site hierarchy. Displayed in Google search results as a breadcrumb trail
 * instead of the full URL, improving click-through rates.
 *
 * Required properties:
 * - @context: "https://schema.org" (Schema.org vocabulary)
 * - @type: "BreadcrumbList" (Schema.org type identifier)
 * - itemListElement: Array of breadcrumb items (ListItem objects)
 *
 * Breadcrumb structure:
 * - Each item has @type "ListItem", position (integer starting at 1), name, and optional item URL
 * - Position determines order: 1 = Home, 2 = Category, 3 = Subcategory, etc.
 * - Name is the human-readable label shown in breadcrumb trail
 * - Item URL is optional but recommended for clickable breadcrumbs
 *
 * Common patterns:
 * - **Home > Category > Page**: 3-level hierarchy for content sites
 * - **Home > Products > Category > Product**: 4-level for e-commerce
 * - **Home > Docs > Section > Article**: 4-level for documentation
 *
 * SEO impact:
 * - **Rich results**: Breadcrumb trail replaces URL in Google search results
 * - **Site structure**: Helps search engines understand site architecture
 * - **Navigation UX**: Users see page context in search results (higher CTR)
 * - **Mobile optimization**: Breadcrumbs save space vs full URL on mobile
 *
 * Google display example:
 * - Without breadcrumbs: "https://example.com/products/electronics/laptop"
 * - With breadcrumbs: "Home › Products › Electronics › Laptop"
 *
 * @example
 * ```typescript
 * const breadcrumb = {
 *   "@context": "https://schema.org",
 *   "@type": "BreadcrumbList",
 *   itemListElement: [
 *     {
 *       "@type": "ListItem",
 *       position: 1,
 *       name: "Home",
 *       item: "https://example.com"
 *     },
 *     {
 *       "@type": "ListItem",
 *       position: 2,
 *       name: "Products",
 *       item: "https://example.com/products"
 *     },
 *     {
 *       "@type": "ListItem",
 *       position: 3,
 *       name: "Widget",
 *       item: "https://example.com/products/widget"
 *     }
 *   ]
 * }
 * ```
 *
 * @see specs/app/pages/meta/structured-data/breadcrumb.schema.json
 */
export const BreadcrumbSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('BreadcrumbList'),
  itemListElement: Schema.Array(BreadcrumbListItemSchema).annotations({
    description: 'Array of breadcrumb items',
  }),
}).annotations({
  title: 'Breadcrumb Schema',
  description: 'Schema.org BreadcrumbList structured data',
})

export type BreadcrumbListItem = Schema.Schema.Type<typeof BreadcrumbListItemSchema>
export type Breadcrumb = Schema.Schema.Type<typeof BreadcrumbSchema>
