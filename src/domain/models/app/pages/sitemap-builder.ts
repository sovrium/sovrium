/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure sitemap.xml and robots.txt builders.
 *
 * Lives in the `pages` slug because both describe the page set itself, and
 * both are pure transformations — `(pages, baseUrl) => string` — with no side
 * effects, mirroring the RSS feed builder. The page-routes adapter
 * (infrastructure) and the
 * static-content generators (application) both delegate here so the
 * runtime route and SSG output stay byte-identical.
 *
 * Sitemap entries are configured per page via `sitemap` (`{ priority,
 * changefreq }`, or `false` to exclude). `meta.priority` / `meta.changefreq`
 * were a second, older spelling for the same two values and have been removed.
 */

import { isPublicPage } from '@/domain/models/app/pages/is-public'
import type { Page } from '@/domain/models/app/pages'

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
 * attentively by exactly the parties the disclosure matters to. `buildRobotsTxt`
 * below therefore stays untouched.
 */
export function isPageInSitemap(page: Page): boolean {
  const hasNoindexRobots = page.meta?.robots !== undefined && page.meta.robots.includes('noindex')
  return (
    isPublicPage(page) &&
    !page.meta?.noindex &&
    !hasNoindexRobots &&
    !page.path.startsWith('/_') &&
    page.sitemap !== false
  )
}

/**
 * Build a single `<url>` entry for the sitemap.
 */
function buildUrlEntry(page: Page, baseUrl: string, lastmod: string): string {
  const priority = resolveSitemapPriority(page)
  const changefreq = resolveSitemapChangefreq(page)
  return `  <url>
    <loc>${baseUrl}${page.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${priority.toFixed(1)}</priority>
    <changefreq>${changefreq}</changefreq>
  </url>`
}

/**
 * Build the full `/sitemap.xml` body from the app's pages.
 *
 * @param now - the clock, injected so this stays a pure function of its inputs.
 *   The infrastructure caller passes the request time; the default exists only
 *   so existing call sites and tests keep working.
 *
 * KNOWN LIMITATION, deliberately unchanged here: every `<url>` entry receives
 * the SAME `lastmod`, so the sitemap asserts that every page was modified today
 * whether or not its content changed. Crawlers learn to distrust a `lastmod`
 * that always says "now", which costs the signal its value. Fixing that needs a
 * per-page modification timestamp the config does not carry — a schema
 * question, not a refactor. Injecting the clock at least makes the output
 * deterministic and the function testable without mocking global time.
 */
export function buildSitemapXml(
  pages: readonly Page[],
  baseUrl: string,
  now: Date = new Date()
): string {
  const lastmod = now.toISOString().split('T')[0] ?? ''
  const entries = pages.filter(isPageInSitemap).map((page) => buildUrlEntry(page, baseUrl, lastmod))

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`
}

/**
 * Build the `/robots.txt` body, referencing `/sitemap.xml`.
 *
 * Underscore-prefixed and noindex pages are emitted as `Disallow` rules.
 */
export function buildRobotsTxt(pages: readonly Page[], baseUrl: string): string {
  const baseLines = ['User-agent: *', 'Allow: /']

  const disallowLines = pages
    .filter(
      (page) =>
        page.meta?.noindex === true ||
        (page.meta?.robots !== undefined && page.meta.robots.includes('noindex')) ||
        page.path.startsWith('/_')
    )
    .map((page) => `Disallow: ${page.path}`)

  const lines = [...baseLines, ...disallowLines, `Sitemap: ${baseUrl}/sitemap.xml`]
  return lines.join('\n')
}
