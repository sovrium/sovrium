/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure synthesis of SEO `<head>` meta for content-directory pages
 *.
 *
 * A `contentDir` page generates one route per markdown file, so its SEO meta
 * cannot be authored statically in `page.meta` — it must be derived per request
 * from the resolved slug + each file's frontmatter:
 *
 * - canonical: the absolute resolved URL of THIS page,
 *    so search engines collapse duplicate query-string / trailing-slash forms.
 * - hreflang alternates: when the page path carries a
 *    `:lang` segment and the app declares multiple languages, one
 *    `rel="alternate"` per configured locale (plus `x-default`) pointing at the
 *    same slug under each language prefix.
 * - Open Graph: og:title / og:description / og:image
 *    derived from the markdown file's frontmatter.
 *
 * This lives in the domain layer because it is a pure transform (no I/O): the
 * resolver in the presentation layer supplies the already-extracted frontmatter,
 * the resolved route params, the page path pattern, and the app languages.
 */

import type { Languages } from '@/domain/models/app/languages'
import type { OpenGraph } from '@/domain/models/app/pages/meta'

/** Open Graph subset synthesised from frontmatter. */
export interface ContentDirOpenGraph {
  readonly title?: string
  readonly description?: string
  readonly image?: string
}

/** A single hreflang alternate link. */
export interface ContentDirAlternate {
  /** The hreflang attribute value (configured language code, e.g. `en`, `fr`). */
  readonly hreflang: string
  /** The resolved URL for this locale (absolute when a base URL is available). */
  readonly href: string
}

/** Synthesised SEO meta for a content-directory page. */
export interface ContentDirSeoMeta {
  /** Absolute (or path-relative) canonical URL for this page. */
  readonly canonical: string
  /** Per-locale hreflang alternates (empty when the path has no `:lang` segment). */
  readonly alternates: readonly ContentDirAlternate[]
  /** Open Graph values derived from frontmatter (omitted keys when absent). */
  readonly openGraph: ContentDirOpenGraph | undefined
  /**
   * Auto-synthesised JSON-LD documents (TechArticle + BreadcrumbList) derived
   * from frontmatter + nav when `meta.structuredData.enabled` is true and the
   * author did NOT provide a `meta.schema`.
   * Empty when synthesis is off or overridden by the author.
   */
  readonly structuredData: readonly Record<string, unknown>[]
}

const LANG_SEGMENT = /(^|\/):lang(\/|$)/

/**
 * If a pattern's FIRST segment is one of the configured language codes (e.g.
 * `/en/:slug` when `en` is supported), return that code. This identifies a
 * "hardcoded-language" page — one whose language prefix is baked into its
 * declared `path` rather than expressed as a `:lang` template segment (a
 * bilingual docs site with per-locale content directories declares `/en/:slug`
 * + `/fr/:slug` because `contentDir.directory` takes no `:lang` interpolation).
 * Returns `undefined` for language-agnostic and `:lang`-template patterns.
 */
const leadingLanguageCode = (
  pattern: string,
  languages: Languages | undefined
): string | undefined => {
  if (!languages) return undefined
  const firstSegment = pattern.split('/').filter((segment) => segment.length > 0)[0]
  if (firstSegment === undefined) return undefined
  return languages.supported.some((lang) => lang.code === firstSegment) ? firstSegment : undefined
}

/**
 * Resolve a hardcoded-language pattern under a specific language by swapping the
 * leading language segment and resolving the remaining dynamic params:
 * `/en/:slug` + `{ slug: 'x' }` + `fr` → `/fr/x`.
 */
const resolveHardcodedLangPath = (
  pattern: string,
  routeParams: Readonly<Record<string, string>>,
  lang: string
): string => resolvePagePath(pattern.replace(/^\/[^/]+/, `/${lang}`), routeParams)

/**
 * Substitute the dynamic `:param` segments of a page-path pattern with their
 * resolved route-param values, yielding the concrete URL path.
 *
 * `/docs/:slug` + `{ slug: 'getting-started' }` → `/docs/getting-started`.
 * `/:lang/:slug` + `{ lang: 'en', slug: 'x' }` → `/en/x`.
 *
 * Segments without a matching param value are left as-is (defensive — the
 * route-matcher always supplies every captured segment).
 */
export const resolvePagePath = (
  pattern: string,
  routeParams: Readonly<Record<string, string>>
): string =>
  pattern
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment
      const name = segment.slice(1)
      const value = routeParams[name]
      return typeof value === 'string' && value.length > 0 ? value : segment
    })
    .join('/')

/**
 * Substitute a specific language code into the `:lang` segment of a pattern,
 * resolving every other dynamic segment from `routeParams`. Used to build the
 * per-locale hreflang alternate URLs.
 */
const resolvePathForLang = (
  pattern: string,
  routeParams: Readonly<Record<string, string>>,
  lang: string
): string => resolvePagePath(pattern, { ...routeParams, lang })

/** Prefix a path with the base URL (when one is configured), else return it raw. */
const toAbsolute = (path: string, baseUrl: string | undefined): string =>
  baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path

/**
 * Build the hreflang alternates for a content-directory page.
 *
 * Returns an empty list unless the app declares more than one supported language
 * AND the page path expresses a language either as:
 *  - a `:lang` template segment (`/:lang/:slug`) — substituted per locale, OR
 *  - a hardcoded leading language segment (`/en/:slug`) — swapped per locale.
 *
 * The hardcoded form supports bilingual docs sites whose per-locale content
 * directories (`content/docs/en` vs `content/docs/fr`) force two declared pages
 * (`/en/:slug` + `/fr/:slug`) instead of one `/:lang/:slug` page.
 *
 * Each alternate uses the configured language `code` (e.g. `en`, `fr`) as the
 * hreflang value — that is the URL-prefix segment and the value the spec locks
 * (`hreflang="en"`), distinct from the longer `locale` (`en-US`) used by the
 * generic page-level hreflang block. A trailing `x-default` points at the
 * default language.
 */
const buildAlternates = (
  pattern: string,
  routeParams: Readonly<Record<string, string>>,
  baseUrl: string | undefined,
  languages: Languages | undefined
): readonly ContentDirAlternate[] => {
  if (!languages || languages.supported.length <= 1) return []

  // `/:lang/:slug`: substitute the :lang template segment with each code.
  if (LANG_SEGMENT.test(pattern)) {
    const perLocale = languages.supported.map((lang) => ({
      hreflang: lang.code,
      href: toAbsolute(resolvePathForLang(pattern, routeParams, lang.code), baseUrl),
    }))
    const xDefault: ContentDirAlternate = {
      hreflang: 'x-default',
      href: toAbsolute(resolvePathForLang(pattern, routeParams, languages.default), baseUrl),
    }
    return [...perLocale, xDefault]
  }

  // `/en/:slug` (hardcoded language): swap the leading language segment so a
  // bilingual docs site with per-locale content directories still pairs each
  // article to its sibling-locale URL.
  if (leadingLanguageCode(pattern, languages) !== undefined) {
    const perLocale = languages.supported.map((lang) => ({
      hreflang: lang.code,
      href: toAbsolute(resolveHardcodedLangPath(pattern, routeParams, lang.code), baseUrl),
    }))
    const xDefault: ContentDirAlternate = {
      hreflang: 'x-default',
      href: toAbsolute(resolveHardcodedLangPath(pattern, routeParams, languages.default), baseUrl),
    }
    return [...perLocale, xDefault]
  }

  return []
}

/**
 * Derive the Open Graph subset from frontmatter. Returns `undefined` when no
 * frontmatter key maps to an OG field so the caller emits no og:* tags for a
 * bare markdown file. `image` accepts the common `image` / `ogImage` /
 * `og:image` frontmatter conventions.
 */
const buildOpenGraph = (
  frontmatter: Readonly<Record<string, string>>
): ContentDirOpenGraph | undefined => {
  const { title, description } = frontmatter
  const image = frontmatter['image'] ?? frontmatter['ogImage'] ?? frontmatter['og:image']
  const og: ContentDirOpenGraph = {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
  }
  return Object.keys(og).length > 0 ? og : undefined
}

/**
 * Synthesise the full SEO meta payload for a content-directory page.
 *
 * @param pattern - The page path pattern (e.g. `/docs/:slug`, `/:lang/:slug`).
 * @param routeParams - The resolved dynamic-segment values for this request.
 * @param frontmatter - The rendered markdown file's frontmatter scalars.
 * @param languages - The app language configuration (for hreflang alternates).
 * @param baseUrl - The public origin (`BASE_URL`/proxy-derived), when known.
 */
export const buildContentDirSeoMeta = (input: {
  readonly pattern: string
  readonly routeParams: Readonly<Record<string, string>>
  readonly frontmatter: Readonly<Record<string, string>>
  readonly languages: Languages | undefined
  readonly baseUrl: string | undefined
  /**
   * Pre-synthesised JSON-LD documents (see `content-dir-structured-data.ts`).
   * Optional so callers that only need canonical/OG meta can omit it; defaults
   * to an empty array (synthesis off).
   */
  readonly structuredData?: readonly Record<string, unknown>[]
}): ContentDirSeoMeta => {
  const { pattern, routeParams, frontmatter, languages, baseUrl, structuredData } = input
  const resolvedPath = resolvePagePath(pattern, routeParams)
  return {
    canonical: toAbsolute(resolvedPath, baseUrl),
    alternates: buildAlternates(pattern, routeParams, baseUrl, languages),
    openGraph: buildOpenGraph(frontmatter),
    structuredData: structuredData ?? [],
  }
}

/**
 * Merge the frontmatter-derived Open Graph values for a content-directory page
 * over the page-meta-derived ones. Explicit `page.meta.openGraph` values win
 * (an author may override the synthesised defaults), so this only fills the
 * gaps left by the absent static meta. Returns the page-meta value unchanged
 * when there is nothing synthesised to merge.
 */
export const mergeContentDirOpenGraph = (
  openGraphData: OpenGraph | undefined,
  contentDirSeo: ContentDirSeoMeta | undefined
): OpenGraph | undefined => {
  const synthesised = contentDirSeo?.openGraph
  if (!synthesised) return openGraphData
  return { ...synthesised, ...(openGraphData ?? {}) }
}
