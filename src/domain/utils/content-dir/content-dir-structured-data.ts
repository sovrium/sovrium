/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure synthesis of JSON-LD structured data for content-directory pages
 * ([internal ref]..015).
 *
 * A `contentDir` page generates one route per markdown file, so it has no
 * statically-authored `page.meta.schema`. When the author opts in via
 * `meta.structuredData: { enabled: true }`, this synthesiser derives:
 *
 *  - a `TechArticle` (or `Article`) document from the file's frontmatter
 *    (`headline` = title, `description` = description, optional `datePublished`
 *    from a parseable `date` frontmatter), and
 *  - a `BreadcrumbList` reflecting the nav section → page position, derived
 *    from the `groupBy` frontmatter value (the docs "category") and the page
 *    title. Its position-1 root defaults to a nameless "Home", but the caller may
 *    pass an optional `rootCrumb` (the active docs-zone tab: name + link) to
 *    anchor the trail at the zone instead — with self-link and section-redundancy
 *    collapses that keep it well-formed (see {@link buildBreadcrumbList}).
 *
 * The synthesiser is OFF by default (absent config → empty output) and never
 * runs when the author supplied `page.meta.schema` — that path is the
 * author-wins override and is enforced by the caller. The output is an array
 * of direct Schema.org objects (each carrying `@context` + `@type`) consumable
 * by `StructuredDataScript`'s direct-object code path.
 *
 * Lives in the domain layer because it is a pure transform (no I/O): the
 * presentation-layer resolver supplies the already-extracted frontmatter, the
 * resolved page URL, and the configured grouping field.
 */

/** Synthesis configuration distilled from `meta.structuredData`. */
export interface ContentDirStructuredDataConfig {
  /** Whether synthesis is enabled (frugal default: absent ⇒ off). */
  readonly enabled?: boolean
  /** Article subtype to emit (default `TechArticle`). */
  readonly type?: 'TechArticle' | 'Article'
  /** Whether to also emit a BreadcrumbList (default `true`). */
  readonly breadcrumbs?: boolean
  /** Organization name used as the article publisher (optional). */
  readonly organization?: string
}

const SCHEMA_CONTEXT = 'https://schema.org' as const
const DEFAULT_ARTICLE_TYPE = 'TechArticle' as const

/**
 * Narrow an unknown `meta.structuredData` slot into a typed config. Returns
 * `undefined` when the slot is absent or not an enabling object so callers can
 * cheaply short-circuit the "off by default" case.
 */
export const parseStructuredDataConfig = (
  raw: unknown
): ContentDirStructuredDataConfig | undefined => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const candidate = raw as Record<string, unknown>
  if (candidate.enabled !== true) return undefined
  return {
    enabled: true,
    type: candidate.type === 'Article' ? 'Article' : DEFAULT_ARTICLE_TYPE,
    breadcrumbs: candidate.breadcrumbs !== false,
    ...(typeof candidate.organization === 'string' ? { organization: candidate.organization } : {}),
  }
}

/**
 * Parse a frontmatter `date` value into an ISO-8601 `datePublished`. Returns
 * `undefined` when absent or unparseable so the article carries the field only
 * when the frontmatter genuinely declares a date.
 */
const parseDatePublished = (frontmatter: Readonly<Record<string, string>>): string | undefined => {
  const raw = frontmatter['date'] ?? frontmatter['datePublished'] ?? frontmatter['published']
  if (typeof raw !== 'string' || raw.length === 0) return undefined
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

/**
 * Build the TechArticle/Article document from frontmatter. `headline` always
 * carries the title (falling back to the slug-derived URL tail is the caller's
 * concern; here we use the frontmatter title verbatim).
 */
const buildArticle = (
  config: ContentDirStructuredDataConfig,
  frontmatter: Readonly<Record<string, string>>,
  url: string
): Readonly<Record<string, unknown>> => {
  const { title: headline, description } = frontmatter
  const datePublished = parseDatePublished(frontmatter)
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': config.type ?? DEFAULT_ARTICLE_TYPE,
    ...(headline ? { headline } : {}),
    ...(description ? { description } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(config.organization
      ? { publisher: { '@type': 'Organization', name: config.organization } }
      : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }
}

/**
 * Optional root-crumb override for the synthesised BreadcrumbList. Supplied by the
 * presentation resolver for a ZONED Sovrium-docs page: the active docs-zone tab
 * (its label + the URL of the zone's first article). Absent for non-zoned / generic
 * documentation apps, where the breadcrumb keeps its historical nameless "Home"
 * root (backward-compatible default).
 */
export interface BreadcrumbRootCrumb {
  /** Root crumb label — the active docs-zone tab name (e.g. `Tables`). */
  readonly name: string
  /** Absolute (or path-relative) URL of the zone's first article (the tab landing). */
  readonly url: string
}

/**
 * Build the BreadcrumbList reflecting root → section → page. The section is the
 * `groupBy` frontmatter value (`section` / `category`); when no section is present
 * the breadcrumb degrades to root → page so the list is always well-formed.
 *
 * Root crumb (position 1):
 *   - `rootCrumb` ABSENT → the historical nameless `Home` root (no `item`), so
 *     non-zoned / generic content-directory breadcrumbs are UNCHANGED (default).
 *   - `rootCrumb` PRESENT → the active docs-zone tab (name + linked `item`).
 *
 * Two collapses keep the trail honest for the Sovrium docs:
 *   - SELF-LINK (edge case a): when `rootCrumb.url` equals this page's own `url`
 *     (the zone's first article IS the current page — e.g. a single-file changelog
 *     collection), the root crumb is DROPPED entirely so no position-1 item equals
 *     the page item. The trail becomes section → page (or just page).
 *   - REDUNDANCY (edge case b): when the section value equals `rootCrumb.name`
 *     (e.g. a `section: Tables` page in the Tables zone), the redundant middle
 *     section crumb is DROPPED so the trail never reads "Tables / Tables / <page>".
 *
 * Positions are numbered 1..n over the crumbs that survive the collapses.
 */
/**
 * Resolve the position-1 root crumb(s):
 *   - no `rootCrumb` → the historical nameless `Home` (backward-compatible default);
 *   - `rootCrumb` self-linking THIS page → `[]` (SELF-LINK collapse, edge case a);
 *   - otherwise → the active docs-zone tab (name + linked `item`).
 */
const buildRootCrumbItems = (
  rootCrumb: BreadcrumbRootCrumb | undefined,
  url: string
): readonly { readonly name: string; readonly item?: string }[] => {
  if (rootCrumb === undefined) return [{ name: 'Home' }]
  if (rootCrumb.url === url) return []
  return [{ name: rootCrumb.name, item: rootCrumb.url }]
}

const buildBreadcrumbList = (
  frontmatter: Readonly<Record<string, string>>,
  url: string,
  groupBy: string | undefined,
  rootCrumb: BreadcrumbRootCrumb | undefined
): Readonly<Record<string, unknown>> => {
  const sectionField = groupBy ?? 'category'
  const rawSection = frontmatter[sectionField] ?? frontmatter['section'] ?? frontmatter['category']
  const pageName = frontmatter['title'] ?? url

  // REDUNDANCY collapse (edge case b): drop the section when it equals the zone
  // tab name so the trail never reads "Tables / Tables / <page>".
  const sectionRedundant =
    rootCrumb !== undefined && rawSection !== undefined && rawSection === rootCrumb.name
  const section = sectionRedundant ? undefined : rawSection

  // Crumbs without their position (added after collapses, so numbering has no gaps).
  const rootItems = buildRootCrumbItems(rootCrumb, url)
  const sectionItems: readonly { readonly name: string }[] =
    section !== undefined ? [{ name: section }] : []
  const pageItem = { name: pageName, item: url }

  const itemListElement = [...rootItems, ...sectionItems, pageItem].map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    ...item,
  }))

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement,
  }
}

/**
 * Synthesise the JSON-LD documents for a content-directory page.
 *
 * Returns an empty array when synthesis is disabled (the off-by-default case).
 * Otherwise returns `[Article]` or `[Article, BreadcrumbList]` — the article
 * is always first so callers that read the first `<script>` (e.g. parse-checks)
 * observe the primary document.
 *
 * @param config - Parsed synthesis config (see {@link parseStructuredDataConfig}).
 * @param frontmatter - The rendered markdown file's frontmatter scalars.
 * @param url - The resolved (canonical) URL of this page.
 * @param groupBy - The `contentDir.nav.groupBy` frontmatter field, when set.
 * @param rootCrumb - Optional docs-zone root-crumb override (see {@link BreadcrumbRootCrumb}).
 *   When provided, the BreadcrumbList's position-1 item becomes the active docs-zone
 *   tab (name + link) instead of the default nameless `Home`. Absent ⇒ unchanged.
 */
export const buildContentDirStructuredData = (input: {
  readonly config: ContentDirStructuredDataConfig | undefined
  readonly frontmatter: Readonly<Record<string, string>>
  readonly url: string
  readonly groupBy: string | undefined
  readonly rootCrumb?: BreadcrumbRootCrumb
}): readonly Record<string, unknown>[] => {
  const { config, frontmatter, url, groupBy, rootCrumb } = input
  if (!config?.enabled) return []
  const article = buildArticle(config, frontmatter, url)
  if (config.breadcrumbs === false) return [article]
  return [article, buildBreadcrumbList(frontmatter, url, groupBy, rootCrumb)]
}
