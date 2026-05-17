/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PageAccessSchema } from './access'
import { PageComponentsSchema } from './components'
import { DataFilterSchema } from './components/data-source'
import { ContentDirSchema } from './content-dir'
import { DataSourceSchema } from './data-source'
import { PageIdSchema } from './id'
import { PageLayoutSchema } from './layout'
import { MarkdownSchema } from './markdown'
import { MetaSchema } from './meta'
import { PageNameSchema } from './name'
import { PagePathSchema } from './path'
import { ScriptsSchema } from './scripts'
import { SitemapConfigSchema } from './sitemap'
import { PageSourceSchema } from './source'
import { PageToastConfigSchema } from './toasts'
import { PageVarsSchema } from './vars'
import { ViewTransitionSchema } from './view-transition'

/**
 * Page Schema
 *
 * Represents a complete page configuration with metadata, layout, components, and scripts.
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
 * - **Page Components**: Reference component templates using $ref syntax with $vars substitution
 * - **Styling**: Pages use className with theme tokens, not page-level theme
 *
 * ## Component References
 *
 * Components can reference component templates defined at app level using $ref syntax:
 *
 * ```typescript
 * {
 *   components: [
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
 *   components: [
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
 *   components: []
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
 *   components: [
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
 * @see {@link PageComponentsSchema} for components configuration
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
   * Page components containing content
   *
   * Components can be:
   * - Direct components: { type, props, children }
   * - Component references: { $ref, $vars }
   *
   * Component references resolve to app.components[] with variable substitution
   */
  components: PageComponentsSchema,

  /**
   * Optional access control for the page
   *
   * Controls who can access this page:
   * - `'all'` (default when omitted): Public access
   * - `'authenticated'`: Logged-in users only
   * - `['admin', 'editor']`: Specific roles only
   * - `{ require: 'authenticated', redirectTo: '/login' }`: With redirect
   *
   * @example
   * ```typescript
   * // Authenticated users with redirect
   * access: { require: 'authenticated', redirectTo: '/login' }
   *
   * // Admin only
   * access: ['admin']
   * ```
   */
  access: Schema.optional(PageAccessSchema),

  /**
   * Toast notification configuration for this page
   *
   * Controls default position and duration for toast notifications.
   * Individual toasts can override the duration.
   *
   * @example
   * ```typescript
   * toasts: { position: 'top-right', duration: 5000 }
   * ```
   */
  toasts: Schema.optional(PageToastConfigSchema),

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
   * Optional page-level variables for substitution in components
   *
   * Variables can be referenced in component content, props, and children using
   * $variableName syntax. These variables are substituted at runtime.
   *
   * Page-level variables provide values for components without component references.
   * They complement component-level vars (from $ref with $vars) for direct components.
   *
   * @example
   * ```typescript
   * {
   *   vars: {
   *     siteName: 'Sovrium',
   *     primaryColor: 'blue'
   *   },
   *   components: [
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
  vars: Schema.optional(PageVarsSchema),

  /**
   * Collection configuration for template pages
   *
   * When set, this page becomes a template that generates one route per record
   * in the specified table. The `slugField` determines which field maps to the
   * dynamic URL parameter, and `$record.*` variables become available in all
   * components, meta, and children.
   *
   * @example
   * ```typescript
   * {
   *   path: '/blog/:slug',
   *   collection: {
   *     table: 'posts',
   *     slugField: 'slug',
   *     filter: [{ field: 'status', operator: 'eq', value: 'published' }]
   *   }
   * }
   * ```
   */
  collection: Schema.optional(
    Schema.Struct({
      /** Table name to generate pages from (must exist in app.tables) */
      table: Schema.String.annotations({
        description: 'Table name to generate collection pages from',
      }),
      /** Field name whose value becomes the URL parameter */
      slugField: Schema.String.annotations({
        description: 'Field used as the URL slug parameter',
      }),
      /** Optional filter to limit which records generate pages */
      filter: Schema.optional(
        Schema.Array(DataFilterSchema).annotations({
          description: 'Filter conditions to limit which records generate pages',
        })
      ),
    }).annotations({
      identifier: 'PageCollection',
      title: 'Page Collection',
      description: 'Template page configuration that generates one route per table record',
    })
  ),

  /**
   * Sitemap configuration for this page
   *
   * Controls the page's entry in `/sitemap.xml`:
   * - Object with `priority` and `changefreq`: Customize sitemap entry
   * - `false`: Exclude this page from the sitemap
   * - Omitted: Include with default priority (0.5)
   *
   * @example
   * ```typescript
   * // High priority page
   * sitemap: { priority: 1.0, changefreq: 'weekly' }
   *
   * // Exclude from sitemap
   * sitemap: false
   * ```
   */
  sitemap: Schema.optional(SitemapConfigSchema),

  /**
   * RSS feed configuration for collection pages
   *
   * When set on a collection page, generates an RSS feed endpoint.
   * - `true`: Generate feed with default settings (20 items)
   * - `{ limit: N }`: Generate feed with custom item count
   *
   * @example
   * ```typescript
   * // Simple boolean
   * rss: true
   *
   * // With custom limit
   * rss: { limit: 25 }
   * ```
   */
  rss: Schema.optional(
    Schema.Union(
      Schema.Boolean.annotations({
        description: 'Enable RSS feed with default settings (20 items)',
      }),
      Schema.Struct({
        /** Maximum number of items in the RSS feed */
        limit: Schema.optional(
          Schema.Number.pipe(
            Schema.int(),
            Schema.greaterThan(0),
            Schema.annotations({
              description: 'Maximum number of items in the RSS feed',
              examples: [10, 20, 50],
            })
          )
        ),
      })
    ).annotations({
      identifier: 'PageRss',
      title: 'RSS Feed Configuration',
      description: 'RSS feed generation for collection pages',
    })
  ),

  /**
   * Layout configuration with named sections (header, footer, sidebar).
   *
   * Defines structural layout sections that contain their own components,
   * separate from the page's main content area.
   */
  layout: Schema.optional(PageLayoutSchema),

  /**
   * View transition animation configuration.
   *
   * Controls how the page animates when navigating to/from it.
   * Supports fade, slide (with direction), and none (disabled).
   */
  viewTransition: Schema.optional(ViewTransitionSchema),

  /**
   * Markdown page mode configuration.
   *
   * Enables markdown-driven content from inline strings or files.
   * Supports layout modes, frontmatter variables, and table of contents.
   */
  markdown: Schema.optional(MarkdownSchema),

  /**
   * Content directory collection configuration.
   *
   * Generates one route per markdown file in the specified directory.
   * Used for blogs, documentation sites, and other content collections.
   */
  contentDir: Schema.optional(ContentDirSchema),

  /**
   * File source for the page content.
   *
   * Alternative to inline components — loads page content from a file.
   */
  source: Schema.optional(PageSourceSchema),

  /**
   * Enable real-time presence awareness for this page.
   *
   * When true, users on this page broadcast their presence to other
   * connected users, enabling collaborative features.
   */
  presence: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Enable real-time presence awareness for this page',
      })
    )
  ),

  /**
   * Page-level data source binding (Y-5: inline-relationship-create).
   *
   * Resolves a single record (`mode: 'single'`) or list (`mode: 'list'`) at
   * request time and exposes it as the page's `$parent` context. Embedded
   * forms with `inlinePrefill` then resolve `$parent.<field>` tokens from
   * the resolved record so an inline-create form on `/projects/:id`
   * pre-fills the new record's `project_id` automatically.
   *
   * Distinct from `collection` (which generates one route per record from a
   * table) and `components[].dataSource` (which scopes a single component):
   * page-level dataSource binds the host page itself to a record so any
   * descendant form-ref can read `$parent.*`.
   *
   * @example
   * ```typescript
   * {
   *   path: '/projects/:id',
   *   dataSource: { table: 'projects', mode: 'single', param: 'id' },
   *   components: [
   *     {
   *       type: 'form',
   *       formRef: 'new-ticket',
   *       inlinePrefill: { prefill: { project_id: '$parent.id' }, lockPrefill: true }
   *     }
   *   ]
   * }
   * ```
   */
  dataSource: Schema.optional(DataSourceSchema),

  /**
   * Tables accessible from this page context.
   *
   * When set, restricts which tables the page (and features like AI chat)
   * can access. Used for scoping data access to only relevant tables
   * for the page's purpose.
   *
   * @example
   * ```typescript
   * allowedTables: ['tickets', 'customers']
   * ```
   */
  allowedTables: Schema.optional(
    Schema.Array(Schema.String.pipe(Schema.minLength(1))).pipe(
      Schema.annotations({
        description: 'Tables accessible from this page context (e.g., for AI chat scoping)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'Page',
    title: 'Page',
    description:
      'Complete page configuration with metadata, layout, components, and scripts. Pages use a component-based layout system with reusable component templates.',
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
