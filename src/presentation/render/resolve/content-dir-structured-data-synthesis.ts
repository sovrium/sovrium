/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Presentation-layer SEO + JSON-LD synthesis for `contentDir` pages.
 *
 * Split out of `markdown-page-resolver.ts` so the resolver stays focused on the
 * markdown-body pipeline. Composes the pure domain synthesisers
 * (`buildContentDirSeoMeta`, `buildContentDirStructuredData`) with the
 * presentation-layer `BASE_URL` origin + the `contentDir.index` convention base-path pattern + the A1
 * zone-tab breadcrumb root crumb.
 */

import { primaryPagePath } from '@/domain/kernel/matching/localized-path'
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
import type { CollectionNavData } from '@/presentation/render/resolve/content-dir-lister'

/** What a `contentDir` render knows beyond its page, route and frontmatter. */
export interface ContentDirSeoContext {
  /** The app whose languages the hreflang alternates name. */
  readonly app?: App | undefined
  /**
   * When serving a `contentDir.index` article at the collection base path, the
   * SEO meta is built against the base-path pattern (e.g. `/:lang/docs`) rather
   * than the page's slugged pattern (`/:lang/docs/:slug`), so the canonical,
   * the hreflang alternates and every address in the JSON-LD name the base path
   * — the single canonical URL.
   */
  readonly indexBasePathPattern?: string | undefined
  /**
   * The zone-tab breadcrumb root (name + path-relative href), threaded into the
   * synthesised BreadcrumbList so its position-1 root becomes the active docs
   * zone tab. `undefined` for non-zoned collections (default "Home" root).
   */
  readonly docsRootCrumb?: DocsRootCrumb | undefined
  /** The collection's sidebar, in its sort order: where each section crumb links. */
  readonly collectionNav?: CollectionNavData | undefined
}

/**
 * The address of each section's first article, in the sidebar's (sort) order,
 * keyed by the raw section value.
 */
const firstArticleOfEachSection = (
  collectionNav: CollectionNavData | undefined
): Readonly<Record<string, string>> =>
  (collectionNav?.sidebar ?? []).reduce<Readonly<Record<string, string>>>(
    (first, entry) =>
      entry.group === undefined || Object.hasOwn(first, entry.group)
        ? first
        : { ...first, [entry.group]: entry.href },
    {}
  )

/**
 * The breadcrumb's root crumb and section links, each address made absolute
 * by `toAbsolute` exactly as the page's own.
 */
const breadcrumbAddressing = (
  page: Page,
  context: ContentDirSeoContext,
  toAbsolute: (path: string) => string
): Pick<Parameters<typeof buildContentDirStructuredData>[0], 'rootCrumb' | 'sections'> => {
  const { docsRootCrumb } = context
  const urls = Object.fromEntries(
    Object.entries(firstArticleOfEachSection(context.collectionNav)).map(([section, href]) => [
      section,
      toAbsolute(href),
    ])
  )
  const labels = page.contentDir?.nav?.groupLabels
  return {
    sections: { urls, ...(labels !== undefined && { labels }) },
    ...(docsRootCrumb !== undefined && {
      rootCrumb: { name: docsRootCrumb.name, url: toAbsolute(docsRootCrumb.href) },
    }),
  }
}

/**
 * Synthesise the JSON-LD documents for a `contentDir` page
 * Author-wins: when the page declares an
 * explicit `meta.schema`, return an empty array so the author's structured data
 * is the sole source (no double-emission of the same `@type`). Otherwise the
 * synthesiser reads `meta.structuredData.enabled` and derives a TechArticle +
 * BreadcrumbList from the file's frontmatter and the nav grouping field.
 * Every address it names is built the way the canonical is: from the base path
 * on a collection index, absolute when a `BASE_URL` origin is set — so the
 * self-link collapses compare like with like.
 */
function buildContentDirSynthesisedJsonLd(input: {
  readonly page: Page
  readonly routeParams: Readonly<Record<string, string>>
  readonly frontmatter: Readonly<Record<string, string>>
  readonly baseUrl: string | undefined
  readonly context: ContentDirSeoContext
}): readonly Record<string, unknown>[] {
  const { page, routeParams, frontmatter, baseUrl, context } = input
  if (page.meta?.schema !== undefined) return []
  const config = parseStructuredDataConfig(page.meta?.structuredData)
  if (config === undefined) return []
  const pattern = context.indexBasePathPattern ?? primaryPagePath(page.path)
  const toAbsolute = (path: string): string =>
    baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path
  return buildContentDirStructuredData({
    config,
    frontmatter,
    url: toAbsolute(resolvePagePath(pattern, routeParams)),
    groupBy: page.contentDir?.nav?.groupBy,
    ...breadcrumbAddressing(page, context, toAbsolute),
  })
}

/**
 * Synthesise the SEO `<head>` meta for a `contentDir` page. Returns `undefined` for non-contentDir pages so declared
 * pages keep authoring SEO via `page.meta`. The canonical/alternates use the
 * `BASE_URL` operator origin when set (mirrors `seo-routes.resolveBaseUrl`),
 * otherwise fall back to a path-relative URL.
 */
export function buildContentDirSeo(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  frontmatter: Readonly<Record<string, string>>,
  context: ContentDirSeoContext = {}
): ContentDirSeoMeta | undefined {
  if (page.contentDir === undefined) return undefined
  const baseUrl = typeof Bun.env.BASE_URL === 'string' ? Bun.env.BASE_URL : undefined
  return buildContentDirSeoMeta({
    pattern: context.indexBasePathPattern ?? primaryPagePath(page.path),
    routeParams,
    frontmatter,
    languages: context.app?.languages,
    baseUrl,
    structuredData: buildContentDirSynthesisedJsonLd({
      page,
      routeParams,
      frontmatter,
      baseUrl,
      context,
    }),
  })
}
