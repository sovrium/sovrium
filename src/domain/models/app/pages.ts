/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PageIdSchema } from './page/id'
import { LayoutSchema } from './page/layout'
import { MetaSchema } from './page/meta'
import { PageNameSchema } from './page/name'
import { PagePathSchema } from './page/path'
import { ScriptsSchema } from './page/scripts/scripts'
import { SectionsSchema } from './page/sections'

/**
 * Page Schema
 *
 * Represents a complete page configuration with metadata, layout, sections, and scripts.
 *
 * Marketing and content pages with server-side rendering support. Pages use a block-based
 * layout system with reusable components for building landing pages, about pages, pricing
 * pages, and other public-facing content.
 *
 * ## Key Features
 *
 * - **Block-Based Layout**: Compose pages from reusable blocks defined at app level
 * - **Theme Integration**: Pages use app.theme{} tokens via className utilities
 * - **i18n Support**: Multi-language pages with $t: translation references
 * - **Responsive Design**: Single page adapts to all viewports (mobile, tablet, desktop)
 * - **SEO Optimization**: Comprehensive metadata, structured data, social sharing
 *
 * ## Architecture Notes
 *
 * - **Theme**: Defined at app level (app.theme{}), NOT in individual pages
 * - **Blocks**: Defined at app level (app.blocks[]), NOT in individual pages
 * - **Sections**: Reference blocks using $ref syntax with $vars substitution
 * - **Styling**: Pages use className with theme tokens, not page-level theme
 *
 * ## Block References
 *
 * Sections can reference blocks defined at app level using $ref syntax:
 *
 * ```typescript
 * {
 *   sections: [
 *     {
 *       $ref: '#/blocks/hero',
 *       $vars: {
 *         title: 'Welcome to Our Platform',
 *         ctaLabel: 'Get Started'
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * The block structure is resolved and variables ($title, $ctaLabel) are substituted
 * at runtime.
 *
 * ## Translation References
 *
 * Pages support internationalization via $t: translation references:
 *
 * ```typescript
 * {
 *   meta: {
 *     lang: 'en',
 *     title: '$t:hero.title'
 *   },
 *   sections: [
 *     {
 *       type: 'h1',
 *       children: ['$t:hero.title']
 *     }
 *   ]
 * }
 * ```
 *
 * Translation keys resolve based on meta.lang from app.languages{} configuration.
 *
 * ## Responsive Design
 *
 * Pages adapt to different viewports using responsive className utilities:
 *
 * ```typescript
 * {
 *   type: 'section',
 *   props: {
 *     className: 'py-12 md:py-20 lg:py-32'
 *   }
 * }
 * ```
 *
 * Mobile-first approach: base styles for mobile, breakpoints for larger screens.
 *
 * @example
 * ```typescript
 * // Minimal page with required properties
 * const minimalPage: Page = {
 *   path: '/',
 *   meta: {
 *     lang: 'en-US',
 *     title: 'Welcome',
 *     description: 'Welcome to our platform'
 *   },
 *   sections: []
 * }
 *
 * // Complete page with all properties
 * const completePage: Page = {
 *   id: 'homepage',
 *   name: 'Home',
 *   path: '/',
 *   meta: {
 *     lang: 'en-US',
 *     title: 'Welcome',
 *     description: 'Welcome to our platform',
 *     openGraph: {
 *       title: 'Welcome to Our Platform',
 *       type: 'website',
 *       url: 'https://example.com',
 *       image: 'https://example.com/og-image.jpg'
 *     }
 *   },
 *   layout: {
 *     navigation: {
 *       logo: '/logo.svg',
 *       links: {
 *         desktop: [
 *           { label: 'Home', href: '/' },
 *           { label: 'About', href: '/about' }
 *         ]
 *       }
 *     }
 *   },
 *   sections: [
 *     {
 *       $ref: '#/blocks/hero',
 *       $vars: {
 *         title: 'Welcome',
 *         ctaLabel: 'Get Started'
 *       }
 *     }
 *   ],
 *   scripts: {
 *     features: {
 *       analytics: true
 *     }
 *   }
 * }
 * ```
 *
 * @see {@link https://schema.org Schema.org} for structured data
 * @see {@link MetaSchema} for metadata configuration
 * @see {@link LayoutSchema} for layout configuration
 * @see {@link SectionsSchema} for sections configuration
 * @see {@link ScriptsSchema} for scripts configuration
 */
export const PageSchema = Schema.Struct({
  /**
   * Optional unique identifier for the page
   *
   * Used for internal references and tracking
   */
  id: Schema.optional(PageIdSchema),

  /**
   * Human-readable name for the page
   *
   * Used for identification in admin interfaces, not displayed to users
   * Optional - if not provided, derived from the path
   *
   * @example "Home Page"
   * @example "About Us"
   */
  name: Schema.optional(PageNameSchema),

  /**
   * URL path where the page is accessible
   *
   * - Root path: `/` (homepage)
   * - Nested paths: `/about`, `/products/pricing`
   *
   * @example "/"
   * @example "/about"
   * @example "/products/pricing"
   */
  path: PagePathSchema,

  /**
   * Page metadata for SEO, social sharing, and analytics
   *
   * Optional - if not provided, uses default metadata based on page name/path
   *
   * Includes:
   * - Basic SEO (title, description, keywords)
   * - Social media (Open Graph, Twitter Card)
   * - Structured data (Schema.org)
   * - Performance hints (preload, DNS prefetch)
   * - Analytics configuration
   */
  meta: Schema.optional(MetaSchema),

  /**
   * Optional layout configuration
   *
   * Orchestrates global layout components:
   * - Banner (announcements, alerts)
   * - Navigation (header, logo, links)
   * - Footer (copyright, links, social)
   * - Sidebar (collapsible, responsive)
   *
   * Layout components wrap the main content area.
   *
   * Special values:
   * - undefined: Use defaultLayout from app configuration (if available)
   * - null: Disable all layout components (blank page)
   * - object: Override or extend defaultLayout with custom configuration
   */
  layout: Schema.optional(Schema.NullOr(LayoutSchema)),

  /**
   * Page sections containing content blocks
   *
   * Sections can be:
   * - Direct components: { type, props, children }
   * - Block references: { $ref, $vars }
   *
   * Block references resolve to app.blocks[] with variable substitution
   */
  sections: SectionsSchema,

  /**
   * Optional client-side scripts and features
   *
   * Manages:
   * - Feature flags (analytics, chat widget)
   * - External scripts (CDN resources)
   * - Inline scripts (custom JavaScript)
   * - Client configuration
   */
  scripts: Schema.optional(ScriptsSchema),
})

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
 *     path: '/',
 *     meta: { lang: 'en-US', title: 'Home', description: 'Welcome' },
 *     sections: []
 *   },
 *   {
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
 * TypeScript type for a Page
 */
export type Page = typeof PageSchema.Type

/**
 * TypeScript type for Pages array
 */
export type Pages = typeof PagesSchema.Type
