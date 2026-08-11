/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { deriveContentDirIndexBasePath } from '@/domain/utils/content-dir/content-dir-index-base-path'
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
 *     components: []
 *   },
 *   {
 *     name: 'About',
 *     path: '/about',
 *     meta: { lang: 'en-US', title: 'About', description: 'About us' },
 *     components: []
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
      'Marketing and content pages with server-side rendering support. Pages use a component-based layout system with reusable component templates for building landing pages, about pages, pricing pages, and other public-facing content. Supports comprehensive metadata, theming, and structured data for SEO optimization.',
  }),
  // contentDir.index cross-page conflict validation
  //: a page whose `contentDir.index` is
  // set serves the index article at the collection BASE PATH (page path minus
  // its trailing dynamic segment) — no OTHER page may claim exactly that path,
  // otherwise the two routes would silently shadow each other.
  // Annotations sit BEFORE this filter (AppSchema pattern) so the identifier/
  // title/description survive JSON Schema generation — a bare Schema.filter
  // node carries no JSON representation of its own.
  Schema.filter((pages) => {
    const conflicts = pages.flatMap((page) => {
      if (page.contentDir?.index === undefined) return []
      const basePath = deriveContentDirIndexBasePath(page.path)
      // Path with no trailing dynamic segment degenerates naturally (no base
      // path to serve) — nothing to validate.
      if (basePath === undefined) return []
      return pages
        .filter((candidate) => candidate !== page && candidate.path === basePath)
        .map(
          (candidate) =>
            `page "${candidate.name}" (${candidate.path}) conflicts with the contentDir index base path of page "${page.name}" (${page.path})`
        )
    })
    return conflicts[0] ?? true
  })
)

/**
 * TypeScript type for Pages array
 * @public
 */
export type Pages = typeof PagesSchema.Type

/**
 * Re-export Page schema and types from page module
 */
export { PageSchema }
export type { Page, PageEncoded }
