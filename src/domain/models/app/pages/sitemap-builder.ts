/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure sitemap.xml and robots.txt builders.
 *
 * Lives in the `pages` slug because it describes the page set itself, and
 * every function here is pure. The static-content generators (application)
 * delegate here, and both the live SEO routes and `sovrium build` go through
 * those generators, so the runtime route and SSG output stay byte-identical.
 *
 * Sitemap entries are configured per page via `sitemap` (`{ priority,
 * changefreq }`, or `false` to exclude). `meta.priority` / `meta.changefreq`
 * were a second, older spelling for the same two values and have been removed.
 */

import { type PermissionCaller } from '@/domain/models/app/auth/permission-evaluation'
import { readOpensToEveryone } from '@/domain/models/app/auth/permission-evaluator-service'
import { isPublicPage } from '@/domain/models/app/pages/is-public'
import { filterWithFieldLiterals } from '@/domain/models/app/tables/checkbox-literal-service'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'

/** Default sitemap priority when none is configured. */
const DEFAULT_PRIORITY = 0.5

/** Default sitemap change frequency when none is configured. */
const DEFAULT_CHANGEFREQ = 'monthly'

/**
 * Resolve a page's sitemap priority from its `sitemap` config, or the default.
 */
export function resolveSitemapPriority(page: Page): number {
  if (page.sitemap && page.sitemap.priority !== undefined) {
    return page.sitemap.priority
  }
  return DEFAULT_PRIORITY
}

/**
 * Resolve a page's sitemap change frequency from its `sitemap` config, or the
 * default.
 */
export function resolveSitemapChangefreq(page: Page): string {
  if (page.sitemap && page.sitemap.changefreq !== undefined) {
    return page.sitemap.changefreq
  }
  return DEFAULT_CHANGEFREQ
}

/**
 * Whether the author withheld a page from search, by `meta.noindex` or by a
 * `meta.robots` directive containing `noindex`. Every representation of such a
 * page carries the signal: the HTML as a meta tag, a Markdown twin as an
 * `X-Robots-Tag` header.
 */
export function isNoindexPage(page: Page): boolean {
  return page.meta?.noindex === true || (page.meta?.robots?.includes('noindex') ?? false)
}

/**
 * Whether a page is eligible for the sitemap.
 *
 * Excluded when: the page is not anonymously readable (`isPublicPage`),
 * `meta.noindex` is set, `meta.robots` contains `noindex`, the path is an
 * underscore-prefixed internal page (`/_*`), or the page opts out via
 * `sitemap: false`.
 *
 * ## Why `isPublicPage`
 *
 * A sitemap is a crawler-facing document with no caller, so the per-visitor
 * `checkPageAccess` — which needs a session — is the wrong granularity. Gating
 * on `isPublicPage`, a pure function of the config, is the same predicate that
 * already decides static HTML emission and search indexing, so all three agree
 * by construction. Before this, `access` was never read here and the sitemap
 * published the private route STRUCTURE of an app whose content was correctly
 * 404ing to anonymous callers.
 *
 * The exclusion is ABSENCE, never a `robots.txt` `Disallow` line: a `Disallow`
 * restates the same private paths in a second public file, which is read more
 * attentively by exactly the parties the disclosure matters to.
 */
export function isPageInSitemap(page: Page): boolean {
  return (
    isPublicPage(page) &&
    !isNoindexPage(page) &&
    !page.path.startsWith('/_') &&
    page.sitemap !== false
  )
}

// ─── Record fan-out and the sitemap index ────────────────────────────────────

/**
 * Maximum `<url>` entries in one sitemap document. The protocol allows 50 000;
 * Sovrium splits at 5 000 so each response stays small, and serves the rest as
 * `/sitemap-1.xml`, `/sitemap-2.xml`, … behind a `<sitemapindex>`.
 */
export const SITEMAP_MAX_URLS = 5000

/** Where a collection page's records come from, when they may be listed. */
export interface SitemapCollectionSource {
  readonly table: string
  readonly slugField: string
  /** The table's `updated-at` field, whose value becomes each entry's `lastmod`. */
  readonly updatedAtField: string | undefined
  readonly filter: readonly DataFilter[] | undefined
}

/**
 * True when an anonymous caller could read the table's rows AND their address
 * field. The table's read is the one it resolves to through `inherit` and
 * `override`, as the records API judges a visitor: a table inheriting `all` is
 * open, one overriding its own `all` to signed-in callers is not.
 */
const isAnonymouslyAddressable = (
  app: App,
  table: NonNullable<App['tables']>[number],
  slugField: string
): boolean =>
  readOpensToEveryone(table, app.tables) &&
  table.rowLevelPermissions?.read === undefined &&
  isFieldReadableByCaller(app, table.name, ANONYMOUS_CRAWLER, slugField)

/**
 * The caller a crawler reads as: no session and no role, the empty role the
 * records API resolves for an anonymous public read.
 */
const ANONYMOUS_CRAWLER: PermissionCaller = { role: '' }

/**
 * The record source of a collection page whose records an anonymous crawler
 * could read, or `undefined` when its records must not be listed.
 *
 * A record is listed only where an anonymous visitor could open it — the same
 * rule {@link isPageInSitemap} applies to a page — so the table must be open to
 * everyone (its read, resolved through `inherit` and `override`, is `'all'`,
 * the one rung that admits anonymous reads) and carry no row-level read predicate, which is evaluated per visitor
 * and cannot be answered for a crawler. The field the address is built from
 * must be readable by an anonymous caller too, decided by the same
 * field-level predicate the records API applies — listing an address the API
 * would strip publishes what it hides. A page that is not itself in the
 * sitemap lists no record either.
 */
export function resolveSitemapCollectionSource(
  page: Page,
  app: App
): SitemapCollectionSource | undefined {
  const { collection } = page
  if (collection === undefined || !isPageInSitemap(page)) return undefined
  const table = app.tables?.find((candidate) => candidate.name === collection.table)
  if (table === undefined) return undefined
  if (!isAnonymouslyAddressable(app, table, collection.slugField)) return undefined
  const updatedAt = table.fields.find((field) => field.type === 'updated-at')
  return {
    table: collection.table,
    slugField: collection.slugField,
    updatedAtField: updatedAt?.name,
    // A literal compared with a checkbox binds a boolean, as on the page itself.
    filter:
      collection.filter === undefined
        ? undefined
        : filterWithFieldLiterals(collection.filter, table.fields),
  }
}

/**
 * Substitute a record's slug into a collection page's route template:
 * `/blog/:slug` + `pricing-change` → `/blog/pricing-change`. The `:lang`
 * segment is left for the language fan-out. Returns `undefined` when the
 * template has no parameter to fill, or more than one.
 */
export function buildCollectionRecordPath(pagePath: string, slug: string): string | undefined {
  const params = [...pagePath.matchAll(/:([a-zA-Z0-9_]+)/g)].filter((match) => match[1] !== 'lang')
  const [param] = params
  if (param === undefined || params.length !== 1 || slug === '') return undefined
  return pagePath.replace(`:${param[1] ?? ''}`, encodeURIComponent(slug))
}

/** Split sitemap entries into documents of at most {@link SITEMAP_MAX_URLS}. */
export function chunkSitemapEntries<T>(
  entries: readonly T[],
  size: number = SITEMAP_MAX_URLS
): readonly (readonly T[])[] {
  const count = Math.ceil(entries.length / size)
  return Array.from({ length: count }, (_, index) =>
    entries.slice(index * size, (index + 1) * size)
  )
}

/**
 * The `<sitemapindex>` naming `childCount` child sitemaps by absolute address,
 * `/sitemap-1.xml` first.
 */
export function buildSitemapIndexXml(baseUrl: string, childCount: number): string {
  const children = Array.from(
    { length: childCount },
    (_, index) => `  <sitemap>
    <loc>${baseUrl}/sitemap-${index + 1}.xml</loc>
  </sitemap>`
  )
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${children.join('\n')}
</sitemapindex>`
}
