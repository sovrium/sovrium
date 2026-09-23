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
import { SystemDetailSourceSchema } from './components/system-detail-source'
import { ContentDirSchema } from './content-dir'
import { deriveContentDirIndexBasePath } from './content-dir-index-base-path'
import { DataSourceSchema } from './data-source'
import { PageIdSchema } from './id'
import { PageLayoutSchema } from './layout'
import { MarkdownSchema } from './markdown'
import { MetaSchema } from './meta'
import { PageNameSchema } from './name'
import { collectPageBindingViolations } from './page-binding-validation'
import { PageParamsSchema } from './params'
import { PagePathSchema } from './path'
import { PageQuerySchema } from './query'
import { PageRequiresSchema } from './requires'
import { ScriptsSchema } from './scripts'
import { SitemapConfigSchema } from './sitemap'
import { PageSourceSchema } from './source'
import { PageToastConfigSchema } from './toasts'
import { PageVarsSchema } from './vars'
import { ViewTransitionSchema } from './view-transition'
import { PageWindowSchema } from './window'

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
 * - **Design Integration**: Pages use app.design{} tokens via className utilities
 * - **i18n Support**: Multi-language pages with $t: translation references
 * - **Responsive Design**: Single page adapts to all viewports (mobile, tablet, desktop)
 * - **SEO Optimization**: Comprehensive metadata, structured data, social sharing
 *
 * ## Architecture Notes
 *
 * - **Design**: Defined at app level (app.design{}), NOT in individual pages
 * - **Components**: Defined at app level (app.components[]), NOT in individual pages
 * - **Page Components**: Reference component templates using $ref syntax with $vars substitution
 * - **Styling**: Pages use className with design tokens, not page-level tokens
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
      table: Schema.String.annotate({
        description: 'Table name to generate collection pages from',
      }),
      /** Field name whose value becomes the URL parameter */
      slugField: Schema.String.annotate({
        description: 'Field used as the URL slug parameter',
      }),
      /** Optional filter to limit which records generate pages */
      filter: Schema.optional(
        Schema.Array(DataFilterSchema).annotate({
          description: 'Filter conditions to limit which records generate pages',
        })
      ),
    }).annotate({
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
    Schema.Union([
      Schema.Boolean.annotate({
        description: 'Enable RSS feed with default settings (20 items)',
      }),
      Schema.Struct({
        /** Maximum number of items in the RSS feed */
        limit: Schema.optional(
          Schema.Finite.pipe(
            Schema.annotate({
              description: 'Maximum number of items in the RSS feed',
              examples: [10, 20, 50],
            }),
            Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
          )
        ),
      }),
    ]).annotate({
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
      Schema.annotate({
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
   * Discriminated:
   *  - `DataSourceSchema` (`{ table, mode: single, param }`) — bind the page to a
   *    single DB record (UNCHANGED — every existing config keeps working).
   *  - `{ system }` — a system DETAIL-endpoint binding (`SystemDetailSourceSchema`):
   *    resolve the page's single record from a read endpoint (e.g. an automation
   *    run detail) instead of `/api/tables/:t/records/:id`, then expose it as the
   *    page's `$parent`/`$record` context for descendant components. This is the
   *    list → detail drill-down for the read-only operational data console.
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
   *
   * // System detail binding (single record from a read endpoint):
   * {
   *   path: '/_admin/data/automations/runs/:id',
   *   dataSource: {
   *     system: { endpoint: '/api/admin/automations/runs/:id', param: 'id' }
   *   }
   * }
   * ```
   */
  dataSource: Schema.optional(
    Schema.Union([
      DataSourceSchema,
      Schema.Struct({
        /** System detail-endpoint binding (mutually exclusive with the DB-table form) */
        system: SystemDetailSourceSchema,
      }).annotate({
        title: 'Page System Detail Source',
        description: 'System detail-endpoint binding for a page-level single-record context',
      }),
    ]).annotate({
      identifier: 'PageDataSourceBinding',
      title: 'Page Data Source',
      description:
        'DB-table single-record binding (DataSource) OR a system detail-endpoint binding',
    })
  ),

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
    Schema.Array(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))).pipe(
      Schema.annotate({
        description: 'Tables accessible from this page context (e.g., for AI chat scoping)',
      })
    )
  ),

  /**
   * Redirect a bare collection path to its FIRST object.
   *
   * A page that lists objects and has one obvious "open this" destination per
   * object leaves the bare path with nothing useful to show. `redirectToFirst`
   * answers it with a **302 to the first resolved row** instead, so
   * `/tables` lands on `/tables/customers` rather than on a picker the
   * navigation already provides.
   *
   * `hrefTemplate` is a path with `{field}` placeholders filled from that first
   * row: `/tables/{name}` against a first row `{ name: 'customers' }` redirects
   * to `/tables/customers`.
   *
   * **An empty list renders the page.** No row means no redirect target, so the
   * page renders normally and shows its own empty state — a redirect loop or a
   * dead end would both be worse than the page the author already wrote.
   *
   * Requires a list source on the page (a component `dataSource.system` /
   * `dataSource.systemSource`, or a page-level `dataSource` in `mode: list`);
   * declaring it without one is a decode error.
   *
   * @example
   * ```yaml
   * path: /tables
   * redirectToFirst:
   *   hrefTemplate: /tables/{name}
   * ```
   */
  redirectToFirst: Schema.optional(
    Schema.Struct({
      /** Redirect target with `{field}` placeholders resolved from the first row */
      hrefTemplate: Schema.String.pipe(
        Schema.annotate({
          description:
            'Redirect target path with {field} placeholders filled from the first resolved row',
          examples: ['/tables/{name}', '/_admin/data/forms/{slug}'],
        }),
        Schema.check(
          Schema.isMinLength(1),
          Schema.isPattern(/^\//, { message: 'hrefTemplate must be a path starting with /' }),
          Schema.isPattern(/\{[^{}]+\}/, {
            message:
              'hrefTemplate must carry at least one {field} placeholder resolved from the first row — a constant target needs no redirectToFirst',
          })
        )
      ),
    }).annotate({
      identifier: 'PageRedirectToFirst',
      title: 'Redirect To First Object',
      description:
        '302 a bare collection path to its first resolved row; an empty list renders the page instead',
    })
  ),

  /**
   * Declared URL query properties for this page.
   *
   * Each entry opens ONE query parameter as a page input with a **closed
   * allow-list** of values, referenceable anywhere `$var` substitution runs as
   * `$query.<name>`. `/dashboard?period=30d` renders the same page definition
   * with `$query.period` resolved to `30d`.
   *
   * The allow-list is what makes this safe to put in a URL. An unknown or
   * missing value falls back to `default` — a page **never answers 400 for a
   * query parameter**, because a query string is attacker-controlled and a
   * stale bookmark is not an error condition. That also bounds the response
   * space to `enum.length` variants per property, so a rendered page stays
   * cacheable per-value rather than per-arbitrary-string.
   *
   * `default` must be a member of `enum`, and each property name must be
   * lowercase kebab-case — both checked at decode time.
   *
   * @example
   * ```yaml
   * path: /dashboard
   * query:
   *   period:
   *     default: 7d
   *     enum: [24h, 7d, 30d]
   * components:
   *   - type: text
   *     content: 'Showing the last $query.period'
   * ```
   */
  query: Schema.optional(PageQuerySchema),

  /**
   * The closed set of values each named route parameter may take, supplied by a
   * read endpoint — the page's own statement of which URLs it serves.
   *
   * A `:segment` is unconstrained today: `/kit/buton` matches `/kit/:type` and
   * renders a page-shaped emptiness, so a mistyped or dead link looks live. The
   * one route family that already does better hardcodes its set — a
   * `$param`-bound `table` is checked against `app.tables` and 404s otherwise,
   * because "this table does not exist" and "this table is empty" must not look
   * the same. `params` gives that same answer to a route whose permitted values
   * come from anywhere else.
   *
   * A segment outside the set answers **404**, never a default. A path segment
   * is part of a resource's identity where a query parameter is one view of it,
   * which is why `query` clamps to a default and this refuses outright.
   *
   * @example
   * ```yaml
   * path: /design-system/ui-kit/:type
   * params:
   *   type:
   *     system:
   *       endpoint: /api/admin/schema/component-types
   *     valueKey: type
   * ```
   */
  params: Schema.optional(PageParamsSchema),

  /**
   * A RELATIVE look-back window for this page, selected from the URL and
   * resolved to ABSOLUTE instants at render.
   *
   * `page.query` opens a period SELECTOR and nothing more: `$query.period`
   * substitutes the preset id `7d`, which is not a timestamp, while every
   * analytics reader requires absolute ISO `from` / `to`. `window` closes that
   * — it resolves the active preset once per render into five references
   * (`$window.start`, `$window.end`, `$window.granularity`, `$window.label`,
   * `$window.id`) usable anywhere a string is, `dataSource.system.query`
   * included.
   *
   * The preset list is closed for the same reason `query.enum` is: it bounds
   * the reachable renderings, which is what keeps the page cacheable. An
   * unrecognised value falls back to `default` and the page answers 200.
   *
   * @example
   * ```yaml
   * path: /analytics
   * window:
   *   param: period
   *   default: 7d
   *   presets:
   *     - { id: 24h, granularity: hour, label: last 24 hours }
   *     - { id: 7d }
   *     - { id: 30d }
   * ```
   */
  window: Schema.optional(PageWindowSchema),

  /**
   * Capabilities the HOST app must declare for this page to exist.
   *
   * A page whose requirements are not all met is **not registered**: the path
   * 404s, and the page appears in no sitemap, no command-palette page list and
   * no derived navigation. It never renders half-working — an "API keys" page
   * on an instance with no `auth.apiKeys` has nothing to show, and a broken
   * page a visitor can reach is worse than one that is simply not there.
   *
   * ─── IT IS FOR EMBEDDED APPS, AND THAT IS AN HONEST LIMIT ──────────────────
   *
   * "Host app" means the app the page is SERVED FOR. Standalone, that is the
   * page's own app — where the author already knows what they declared, so the
   * key is close to a comment and its value is marginal.
   *
   * It earns its place when an app is EMBEDDED in another (Sovrium's own
   * console is mounted into the operator's app). There the preset ships pages
   * whose usefulness depends on config it does not own, and `requires` is the
   * only way one config can say "serve this page only where the host supports
   * it".
   *
   * The vocabulary is a closed set (`PAGE_CAPABILITIES`), so a typo is a decode
   * error naming every accepted value rather than a page that silently never
   * appears. All listed capabilities must hold.
   *
   * @example
   * ```yaml
   * path: /api-keys
   * requires: [auth.apiKeys]
   * ```
   */
  requires: Schema.optional(PageRequiresSchema),
}).pipe(
  Schema.annotate({
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
  Schema.check(Schema.isMinLength(1)),
  Schema.annotate({
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
  Schema.check(
    Schema.makeFilter((pages) => {
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
  ),
  // Per-page cross-field rules: route-parameter bindings against `path`,
  // `redirectToFirst` against the page's list source, breadcrumb items/derive,
  // query properties, sidebar groups.
  //
  // They sit on the ARRAY rather than on `PageSchema` for a JSON-Schema reason
  // rather than an architectural one: a `Schema.check` WRAPS the node it guards,
  // and the property walker in `[internal ref]` names a
  // node by the identifier on its OUTERMOST node — so checking `PageSchema`
  // directly re-keys the whole published property universe from `Page.*` to
  // `App.pages[].*`, and leaves `#/$defs/Page` published but unreferenced.
  // Validating one level up costs nothing: every violation message names the
  // page it came from.
  Schema.check(
    Schema.makeFilter(
      (pages) => pages.flatMap((page) => collectPageBindingViolations(page))[0] ?? true
    )
  )
)

/**
 * TypeScript type for Pages array
 * @public
 */
export type Pages = typeof PagesSchema.Type
