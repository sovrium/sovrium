/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ─── Content Directory Collection ────────────────────────────────────────────

/**
 * Content directory sort configuration.
 */
const ContentDirSortSchema = Schema.Struct({
  /** Frontmatter field to sort by */
  field: Schema.String.pipe(
    Schema.annotate({ description: 'Frontmatter field to sort by (e.g., date)' }),
    Schema.check(Schema.isMinLength(1))
  ),

  /** Sort order */
  order: Schema.optional(
    Schema.Literals(['asc', 'desc']).pipe(
      Schema.annotate({ description: 'Sort order (default: desc)' })
    )
  ),

  /** Sort direction (alias for order) */
  direction: Schema.optional(
    Schema.Literals(['asc', 'desc']).pipe(
      Schema.annotate({ description: 'Sort direction (alias for order)' })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'ContentDirSort',
    title: 'Content Directory Sort',
    description: 'Sort configuration for content directory collection pages',
  })
)

/**
 * A single docs navigation TAB (a "zone") — one bucket of the collection's
 * `groupBy` sections, surfaced as one entry in an app's docs tab strip.
 *
 * A tab does not render itself: the app owns its own tab-strip markup and
 * matches each tab by `id`. The platform uses this declaration to (a) filter the
 * docs sidebar down to the ACTIVE tab's sections, (b) announce that tab on the
 * sidebar wrapper (`data-docs-active-zone="<id>"`) so the app's tab strip can
 * mark itself `aria-current="page"`, and (c) root the docs-article breadcrumb at
 * the active tab instead of the generic "Home".
 */
const ContentDirNavTabSchema = Schema.Struct({
  /**
   * Stable tab identifier, surfaced verbatim as `data-docs-active-zone` on the
   * docs sidebar wrapper. The app's tab-strip markup matches on this value.
   */
  id: Schema.String.pipe(
    Schema.annotate({
      description:
        'Stable tab identifier, announced as data-docs-active-zone on the docs sidebar (e.g. "tables")',
    }),
    Schema.check(Schema.isMinLength(1))
  ),

  /**
   * Display label for the tab. Doubles as the docs-article breadcrumb ROOT-crumb
   * name for a tabbed collection. Supply an ALREADY-LOCALISED string per locale
   * (the page factory receives `lang`) — the same convention `groupLabels` uses.
   * Absent ⇒ the `id` is humanized to Title Case ("api-reference" → "Api
   * Reference"), matching the `groupLabels` / `groupIcons` fallback.
   */
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Tab display label, also the breadcrumb root-crumb name. Already-localised per locale. Absent = humanized id.',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /**
   * The tab's landing URL, used as the breadcrumb ROOT-crumb href. Absent ⇒ the
   * platform DERIVES it from the first sidebar entry (in sort order) belonging to
   * this tab — the self-healing default, which keeps working when the docs tree
   * is restructured. Set it only when the tab's landing page is not that first
   * entry (e.g. a hand-authored landing page outside the collection).
   */
  href: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "Tab landing URL used as the breadcrumb root href. Absent = derived from the tab's first sidebar entry (self-healing).",
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /**
   * The `groupBy` section slugs this tab owns, in the order their sidebar group
   * sections should render WITHIN the tab. This is orthogonal to `contentDir.sort`,
   * which continues to order the ENTRIES inside each group: `sections` orders the
   * groups, `sort` orders the links. Declaring the order explicitly removes the
   * hidden coupling whereby renumbering one article's `order:` frontmatter could
   * silently reorder whole sidebar sections.
   *
   * A section slug present in the content but absent from EVERY tab is not
   * dropped — it falls back to the first declared tab, so no article ever becomes
   * unreachable through the sidebar.
   */
  sections: Schema.Array(
    Schema.String.pipe(
      Schema.annotate({ description: 'A groupBy section slug owned by this tab' }),
      Schema.check(Schema.isMinLength(1))
    )
  ).pipe(
    Schema.annotate({
      description:
        'Section slugs owned by this tab, in sidebar group order within the tab (orthogonal to contentDir.sort, which orders entries inside each group)',
    }),
    Schema.check(Schema.isMinLength(1))
  ),
}).pipe(
  Schema.annotate({
    identifier: 'ContentDirNavTab',
    title: 'Content Directory Navigation Tab',
    description: 'One docs navigation tab (zone) owning a set of sidebar sections',
  })
)

/**
 * The collection's docs tab (zone) declarations, in tab-strip order.
 *
 * Validated at decode time so an incoherent information architecture fails fast
 * rather than silently swallowing sections: tab `id`s must be unique, and no
 * section slug may be claimed by two tabs (a section belongs to exactly one tab,
 * otherwise "which zone is active?" has no answer).
 *
 * Annotations sit BEFORE the filter (the `PagesSchema` pattern) so the
 * identifier/title/description survive JSON Schema generation — a bare
 * `Schema.filter` node carries no JSON representation of its own.
 */
const ContentDirNavTabsSchema = Schema.Array(ContentDirNavTabSchema).pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.annotate({
    identifier: 'ContentDirNavTabs',
    title: 'Content Directory Navigation Tabs',
    description:
      'Docs navigation tabs (zones) in tab-strip order. Each owns a disjoint set of sidebar sections.',
  }),
  Schema.check(
    Schema.makeFilter((tabs) => {
      const duplicateId = tabs
        .map((tab) => tab.id)
        .find((id, index, ids) => ids.indexOf(id) !== index)
      if (duplicateId !== undefined) return `duplicate nav tab id "${duplicateId}"`
      const claims = tabs.flatMap((tab) => tab.sections.map((section) => ({ section, id: tab.id })))
      const conflict = claims.find(
        (claim, index) => claims.findIndex((other) => other.section === claim.section) !== index
      )
      if (conflict !== undefined)
        return `section "${conflict.section}" is claimed by more than one nav tab (last: "${conflict.id}") — a section belongs to exactly one tab`
      return true
    })
  )
)

/**
 * Content directory navigation configuration.
 *
 * Controls how a documentation sidebar is derived from the collection's
 * markdown files. When enabled, the resolver builds a grouped link list
 * (optionally bucketed by a frontmatter field) backing the docs-layout
 * sidebar and the `$contentDir.previous` / `$contentDir.next` links.
 */
const ContentDirNavSchema = Schema.Struct({
  /** Whether to build a navigation sidebar from the collection */
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({ description: 'Enable a docs sidebar derived from the collection files' })
    )
  ),

  /** Frontmatter field used to group sidebar entries into sections */
  groupBy: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Frontmatter field used to group sidebar entries (e.g., category)',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /** Frontmatter field used as the sidebar link label */
  labelFrom: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Frontmatter field used as the sidebar link label (e.g., title)',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /**
   * Display-label overrides for sidebar group keys. Maps a raw `groupBy`
   * frontmatter value to the heading text shown for that group section
   * (e.g. `{ Guides: 'Developer Guides' }`). Any group key without an entry
   * here falls back to a kebab/snake → Title-Case humanization of the raw key
   * ("get-started" → "Get Started").
   */
  groupLabels: Schema.optional(
    Schema.Record(Schema.String, Schema.String).pipe(
      Schema.annotate({
        description:
          'Map of raw groupBy keys to display labels (e.g., { Guides: "Developer Guides" })',
      })
    )
  ),

  /**
   * Decorative leading icons for sidebar group sections. Maps a raw `groupBy`
   * frontmatter value to a Lucide icon name (kebab-case, e.g.
   * `{ tables: 'compass' }`). The icon renders as an `aria-hidden` glyph beside
   * the group label (the label always carries the accessible meaning). Any
   * group key without an entry — or an icon name that does not resolve to a real
   * Lucide component — renders label-only (graceful fallback).
   */
  groupIcons: Schema.optional(
    Schema.Record(Schema.String, Schema.String).pipe(
      Schema.annotate({
        description:
          'Map of raw groupBy keys to Lucide icon names (kebab-case, e.g. { tables: "compass" })',
      })
    )
  ),

  /**
   * Whether sidebar group sections start collapsed. When `true`, each group is
   * rendered as a native `<details>/<summary>` and only the group containing the
   * current page is `open` (so a long docs tree is scannable). When `false`
   * (default), every group renders expanded. Has no effect on the ungrouped
   * flat-list case (`groupBy` unset).
   */
  collapsed: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        description:
          'Collapse sidebar group sections by default, expanding only the active group (default: false)',
      })
    )
  ),

  /**
   * Docs navigation TABS (zones): the app's own documentation information
   * architecture, declared in config instead of baked into the platform.
   *
   * Each tab owns a disjoint set of `groupBy` section slugs. When set, the docs
   * sidebar renders ONLY the active tab's sections and announces that tab via
   * `data-docs-active-zone="<id>"` on its wrapper, so the app's tab-strip markup
   * can mark the matching link `aria-current="page"`. The docs-article breadcrumb
   * roots at the active tab (its `label`, linking to its `href` or the derived
   * first entry) instead of the generic "Home".
   *
   * The active tab is the one owning the current article's section; a section
   * with no declaring tab falls back to the FIRST tab (never dropped).
   *
   * Absent ⇒ unchanged behaviour: the sidebar renders the flat expanded stack of
   * every group with no zone announcement, and the breadcrumb keeps its "Home"
   * root. Tabs are opt-in per collection.
   *
   * @example
   * ```typescript
   * tabs: [
   *   { id: 'runtime', label: 'Runtime', sections: ['get-started', 'configuration'] },
   *   { id: 'tables', label: 'Tables', href: '/en/docs/tables-overview', sections: ['tables', 'records'] },
   * ]
   * ```
   */
  tabs: Schema.optional(ContentDirNavTabsSchema),
}).pipe(
  Schema.annotate({
    identifier: 'ContentDirNav',
    title: 'Content Directory Navigation',
    description: 'Sidebar navigation configuration derived from a content directory collection',
  })
)

/**
 * Content directory collection configuration.
 *
 * Turns a page into a collection that generates one route per markdown file
 * in the specified directory. Similar to blog engines or documentation sites.
 *
 * @example
 * ```typescript
 * // Basic blog
 * contentDir: { directory: 'content/blog', slugFrom: 'filename' }
 *
 * // Documentation with filepath slugs
 * contentDir: { directory: 'content/docs', slugFrom: 'filepath' }
 *
 * // With glob filter and sort
 * contentDir: {
 *   directory: 'content/blog',
 *   slugFrom: 'filename',
 *   include: '*.md',
 *   sort: { field: 'date', order: 'desc' }
 * }
 * ```
 */
export const ContentDirSchema = Schema.Struct({
  /** Directory path containing markdown files */
  directory: Schema.String.pipe(
    Schema.annotate({ description: 'Directory containing markdown content files' }),
    Schema.check(Schema.isMinLength(1))
  ),

  /** How to derive the URL slug from each file */
  slugFrom: Schema.Literals(['filename', 'filepath']).pipe(
    Schema.annotate({
      description: 'Derive URL slug from filename (blog-post.md → blog-post) or filepath',
    })
  ),

  /**
   * Slug of the collection's index article.
   * When set, the page ALSO serves the collection base path (the page `path`
   * minus its trailing dynamic segment) rendering this article with the full
   * docs shell, and the article's slugged URL 301-redirects to the base path
   * (single canonical URL, old links preserved). The sidebar entry for this
   * slug links to the base path (active there), it keeps its position in
   * `contentDir.sort` for prev/next, the sitemap / llms.txt / search index
   * list it at the base path, and the `.md` / `Accept: text/markdown` twins
   * follow the canonical URL. Mirrors bun.com/docs (landing directly on the
   * introduction), VitePress `index.md`, Docusaurus `slug: /` — but explicit.
   *
   * @example 'introduction'
   */
  index: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Slug of the index article served at the collection base path (page path minus its trailing dynamic segment). The slugged URL 301-redirects to the base path. E.g. "introduction".',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /** Glob pattern to filter which files to include */
  include: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({ description: 'Glob pattern to filter files (e.g., *.md)' }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /** Sort configuration for the collection */
  sort: Schema.optional(ContentDirSortSchema),

  /** Filter configuration for the collection */
  filter: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).pipe(
      Schema.annotate({
        description: 'Filter conditions for content files (e.g., by frontmatter)',
      })
    )
  ),

  /** Navigation sidebar configuration derived from the collection */
  nav: Schema.optional(ContentDirNavSchema),

  /**
   * "Edit this page" URL template for docs-layout articles
   *. When set, every generated article
   * renders an "Edit this page" link in the docs header whose `href` is this
   * template with the following placeholders interpolated:
   *   - `{slug}` — the resolved article slug (e.g. `installation`, or
   *     `guides/setup` for `slugFrom: 'filepath'` collections).
   *   - `{path}` — the source file path relative to `directory` (i.e. `{slug}.md`).
   *   - `{lang}` — the active request language (e.g. `en` / `fr`); empty when the
   *     request carries no `/:lang/` prefix.
   * Absent ⇒ no "Edit this page" link is rendered (opt-in per collection,
   * default off). Mirrors Docusaurus `editUrl` / VitePress `editLink.pattern` /
   * Starlight `editLink.baseUrl`.
   *
   * @example 'https://github.com/acme/repo/edit/main/docs/{lang}/{slug}.md'
   */
  editUrl: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Edit-this-page URL template for docs articles. Placeholders: {slug} (resolved article slug), {path} (source file path relative to directory, = {slug}.md), {lang} (active request language, empty when no /:lang/ prefix). Absent = no edit link (opt-in, default off). E.g. https://github.com/acme/repo/edit/main/docs/{lang}/{slug}.md',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /**
   * "Report an issue" URL template for docs-layout articles. When set, the
   * platform-rendered contribution footer at the foot of every generated article
   * renders a "Report an issue" link whose `href` is this template with the SAME
   * placeholders as {@link editUrl} interpolated:
   *   - `{slug}` — the resolved article slug (e.g. `installation`, or
   *     `guides/setup` for `slugFrom: 'filepath'` collections).
   *   - `{path}` — the source file path relative to `directory` (i.e. `{slug}.md`).
   *   - `{lang}` — the active request language (empty when no `/:lang/` prefix).
   *
   * Unlike `editUrl`, the placeholders are OPTIONAL here: a bare issue-tracker URL
   * with no placeholder (e.g. `https://github.com/acme/repo/issues/new`) is valid
   * and passes through verbatim (a fresh "new issue" form is a perfectly good
   * target). It is interpolated by the SAME pure helper as `editUrl`
   * (`buildContentDirEditUrl`, whose no-placeholder passthrough already covers the
   * bare-URL case). Absent ⇒ no "Report an issue" link is rendered (opt-in per
   * collection, default off).
   *
   * @example 'https://github.com/acme/repo/issues/new'
   * @example 'https://github.com/acme/repo/issues/new?title=Docs:%20{slug}'
   */
  issueUrl: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Report-an-issue URL template for docs articles. Same placeholders as editUrl ({slug}, {path}, {lang}) but OPTIONAL — a bare issue-tracker URL with no placeholder is valid (passes through verbatim). Absent = no issue link (opt-in, default off). E.g. https://github.com/acme/repo/issues/new',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /**
   * A short per-locale contribution note rendered (raw string) in the docs-layout
   * article's contribution footer, beside the "Edit this page" / "Report an issue"
   * links. Supplied per locale by the app config the same way the docs zone's other
   * per-locale copy is (e.g. an EN "Found a problem? Help us improve these docs."
   * paired with its FR translation). It is NOT interpolated — the string renders
   * as-is. Absent ⇒ no note is rendered (opt-in per collection, default off).
   *
   * @example 'Found a problem with this page? Edit it or open an issue.'
   */
  contributionNote: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Per-locale contribution note rendered (raw string) in the docs article contribution footer, beside the edit/issue links. Not interpolated. Absent = no note (opt-in, default off).',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'ContentDir',
    title: 'Content Directory',
    description:
      'Collection configuration that generates one route per markdown file in a directory',
  })
)

/** @public */
export type ContentDir = Schema.Schema.Type<typeof ContentDirSchema>
