/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Presentation-layer SEO + JSON-LD synthesis for `contentDir` pages
 *.
 *
 * Split out of `markdown-page-resolver.ts` so the resolver stays focused on the
 * markdown-body pipeline. Composes the pure domain synthesisers
 * (`buildContentDirSeoMeta`, `buildContentDirStructuredData`) with the
 * presentation-layer `BASE_URL` origin + the [internal ref] base-path pattern + the A1
 * zone-tab breadcrumb root crumb.
 */

import {
  buildContentDirSeoMeta,
  resolvePagePath,
  type ContentDirSeoMeta,
} from '@/domain/models/app/pages/content-dir-seo-meta'
import {
  buildContentDirStructuredData,
  parseStructuredDataConfig,
} from '@/domain/models/app/pages/content-dir-structured-data'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { DocsRootCrumb } from '@/presentation/render/markdown/docs-root-crumb'

/**
 * Synthesise the JSON-LD documents for a `contentDir` page
 *. Author-wins: when the page declares an
 * explicit `meta.schema`, return an empty array so the author's structured data
 * is the sole source (no double-emission of the same `@type`). Otherwise the
 * synthesiser reads `meta.structuredData.enabled` and derives a TechArticle +
 * BreadcrumbList from the file's frontmatter and the nav grouping field.
 */
// eslint-disable-next-line max-params -- A1 threads the zone-tab rootCrumb through the existing JSON-LD synthesiser
function buildContentDirSynthesisedJsonLd(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  frontmatter: Readonly<Record<string, string>>,
  baseUrl: string | undefined,
  docsRootCrumb: DocsRootCrumb | undefined
): readonly Record<string, unknown>[] {
  if (page.meta?.schema !== undefined) return []
  const config = parseStructuredDataConfig(page.meta?.structuredData)
  if (config === undefined) return []
  const resolvedPath = resolvePagePath(page.path, routeParams)
  const toAbsolute = (path: string): string =>
    baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path
  // Build the JSON-LD rootCrumb URL the SAME way as the page URL (absolute when a
  // BASE_URL origin is set) so the domain builder's self-link collapse matches.
  const rootCrumb =
    docsRootCrumb !== undefined
      ? { name: docsRootCrumb.name, url: toAbsolute(docsRootCrumb.href) }
      : undefined
  return buildContentDirStructuredData({
    config,
    frontmatter,
    url: toAbsolute(resolvedPath),
    groupBy: page.contentDir?.nav?.groupBy,
    ...(rootCrumb !== undefined && { rootCrumb }),
  })
}

/**
 * Synthesise the SEO `<head>` meta for a `contentDir` page. Returns `undefined` for non-contentDir pages so declared
 * pages keep authoring SEO via `page.meta`. The canonical/alternates use the
 * `BASE_URL` operator origin when set (mirrors `seo-routes.resolveBaseUrl`),
 * otherwise fall back to a path-relative URL.
 */
// eslint-disable-next-line max-params -- [internal ref] threads the index base-path pattern + A1 threads the zone-tab rootCrumb through the existing SEO builder
export function buildContentDirSeo(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  frontmatter: Readonly<Record<string, string>>,
  app: App | undefined,
  /**
   * [internal ref] — when serving a `contentDir.index` article at the collection base
   * path, the SEO meta is built against the base-path pattern (e.g. `/:lang/docs`)
   * rather than the page's slugged pattern (`/:lang/docs/:slug`), so the canonical
   * link + hreflang alternates point at the base path — the single canonical URL.
   */
  indexBasePathPattern?: string,
  /**
   * A1 — the zone-tab breadcrumb root (name + path-relative href), threaded into
   * the synthesised BreadcrumbList so its position-1 root becomes the active docs
   * zone tab. `undefined` for non-zoned collections (default "Home" root).
   */
  docsRootCrumb?: DocsRootCrumb
): ContentDirSeoMeta | undefined {
  if (page.contentDir === undefined) return undefined
  const baseUrl = typeof Bun.env.BASE_URL === 'string' ? Bun.env.BASE_URL : undefined
  return buildContentDirSeoMeta({
    pattern: indexBasePathPattern ?? page.path,
    routeParams,
    frontmatter,
    languages: app?.languages,
    baseUrl,
    structuredData: buildContentDirSynthesisedJsonLd(
      page,
      routeParams,
      frontmatter,
      baseUrl,
      docsRootCrumb
    ),
  })
}
