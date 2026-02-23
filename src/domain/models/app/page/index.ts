/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PageIdSchema } from './id'
import { MetaSchema } from './meta'
import { PageNameSchema } from './name'
import { PagePathSchema } from './path'
import { ScriptsSchema } from './scripts/scripts'
import { SectionsSchema } from './sections'

/**
 * Page Schema
 *
 * Represents a complete page configuration with metadata, layout, sections, and scripts.
 *
 * Marketing and content pages with server-side rendering support. Pages use a component-based
 * layout system with reusable component templates for building landing pages, about pages, pricing
 * pages, and other public-facing content.
 *
 * ## Key Features
 *
 * - **Component-Based Layout**: Compose pages from reusable component templates defined at app level
 * - **Theme Integration**: Pages use app.theme{} tokens via className utilities
 * - **i18n Support**: Multi-language pages with $t: translation references
 * - **Responsive Design**: Single page adapts to all viewports (mobile, tablet, desktop)
 * - **SEO Optimization**: Comprehensive metadata, structured data, social sharing
 *
 * ## Architecture Notes
 *
 * - **Theme**: Defined at app level (app.theme{}), NOT in individual pages
 * - **Components**: Defined at app level (app.components[]), NOT in individual pages
 * - **Sections**: Reference component templates using $ref syntax with $vars substitution
 * - **Styling**: Pages use className with theme tokens, not page-level theme
 *
 * ## Component References
 *
 * Sections can reference component templates defined at app level using $ref syntax:
 *
 * ```typescript
 * {
 *   sections: [
 *     {
 *       : '#/components/hero',
 *       $vars: {
 *         title: 'Welcome to Our Platform',
 *         ctaLabel: 'Get Started'
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * The component template is resolved and variables ($title, $ctaLabel) are substituted
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
 *   name: 'Home',
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
 *   sections: [
 *     {
 *       : '#/components/hero',
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
   * Used for identification in admin interfaces and as internal identifier.
   * Required field that serves as a unique identifier separate from the URL path.
   *
   * @example "home"
   * @example "about"
   */
  name: PageNameSchema,

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
   * Page sections containing content
   *
   * Sections can be:
   * - Direct components: { type, props, children }
   * - Component references: { $ref, $vars }
   *
   * Component references resolve to app.components[] with variable substitution
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

  /**
   * Optional page-level variables for substitution in sections
   *
   * Variables can be referenced in section content, props, and children using
   * $variableName syntax. These variables are substituted at runtime.
   *
   * Page-level variables provide values for sections without component references.
   * They complement component-level vars (from $ref with $vars) for direct sections.
   *
   * @example
   * ```typescript
   * {
   *   vars: {
   *     siteName: 'Sovrium',
   *     primaryColor: 'blue'
   *   },
   *   sections: [
   *     {
   *       type: 'heading',
   *       content: 'Welcome to $siteName'  // → 'Welcome to Sovrium'
   *     },
   *     {
   *       type: 'button',
   *       props: {
   *         className: 'bg-$primaryColor'  // → 'bg-blue'
   *       }
   *     }
   *   ]
   * }
   * ```
   */
  vars: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'Page',
    title: 'Page',
    description:
      'Complete page configuration with metadata, layout, sections, and scripts. Pages use a component-based layout system with reusable component templates.',
  })
)

/**
 * TypeScript type for a Page
 */
export type Page = typeof PageSchema.Type

/**
 * TypeScript type for an encoded Page (before validation)
 */
export type PageEncoded = typeof PageSchema.Encoded
