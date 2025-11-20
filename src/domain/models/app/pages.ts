/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PageSchema } from './page'
import type { Page, PageEncoded } from './page'

/**
 * Pages Schema
 *
 * Array of page configurations for the application. At least one page is required.
 *
 * Typical pages include:
 * - Homepage (/)
 * - About (/about)
 * - Pricing (/pricing)
 * - Contact (/contact)
 * - Blog (/blog)
 *
 * @example
 * ```typescript
 * const pages: Pages = [
 *   {
 *     name: 'Home',
 *     path: '/',
 *     meta: { lang: 'en-US', title: 'Home', description: 'Welcome' },
 *     sections: []
 *   },
 *   {
 *     name: 'About',
 *     path: '/about',
 *     meta: { lang: 'en-US', title: 'About', description: 'About us' },
 *     sections: []
 *   }
 * ]
 * ```
 */
export const PagesSchema = Schema.Array(PageSchema).pipe(
  Schema.minItems(1),
  Schema.annotations({
    identifier: 'Pages',
    title: 'Pages',
    description:
      'Marketing and content pages with server-side rendering support. Pages use a block-based layout system with reusable components for building landing pages, about pages, pricing pages, and other public-facing content. Supports comprehensive metadata, theming, and structured data for SEO optimization.',
  })
)

/**
 * TypeScript type for Pages array
 */
export type Pages = typeof PagesSchema.Type

/**
 * Re-export Page schema and types from page module
 */
export { PageSchema }
export type { Page, PageEncoded }
