/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  resolveSitemapChangefreq,
  resolveSitemapPriority,
} from '@/domain/services/feeds/sitemap-builder'
import {
  enumerateContentDir,
  readContentDirBodies,
  type ContentDirEntry,
} from '@/infrastructure/markdown/content-dir-enumerator'
import type { App, Page } from '@/domain/models/app'

/**
 * Hreflang configuration for multilingual sitemaps
 */
export interface HreflangConfig {
  /** Maps language codes to full locales (e.g., { en: 'en-US', fr: 'fr-FR' }) */
  readonly localeMap: Readonly<Record<string, string>>
  /** Default language code for x-default hreflang (e.g., 'en') */
  readonly defaultLanguage: string
}

/**
 * Repair whitespace inside <pre> tags that Prettier's HTML formatter damages.
 *
 * Prettier adds a newline + indentation after the opening `>` of `<pre>` tags.
 * Because `<pre>` renders whitespace literally (CSS `white-space: pre`), this
 * introduces a visible blank first line in code blocks.
 *
 * This function strips the newline and any spaces immediately after `<pre ...>`.
 */
const repairPreWhitespace = (html: string): string => html.replace(/(<pre[^>]*>)\n[ ]*/g, '$1')

/**
 * Format HTML with Prettier for professional formatting
 * Loads Prettier config and formats HTML using the HTML parser.
 *
 * After formatting, repairs `<pre>` whitespace that Prettier damages
 * (leading newline + indentation, trailing whitespace).
 */
export const formatHtmlWithPrettier = async (html: string): Promise<string> => {
  const prettier = await import('prettier')
  const config = await prettier.resolveConfig(process.cwd())

  const formatted = await prettier.format(html, {
    ...config,
    parser: 'html',
  })

  return repairPreWhitespace(formatted)
}

/**
 * Build the full URL for a page in a specific language.
 *
 * Two shapes are handled so a language prefix never duplicates:
 *  - The path already carries a `:lang` template segment (e.g. `/:lang/about`):
 *    the `:lang` token is SUBSTITUTED with the language code, never prefixed.
 *  - The path is language-agnostic (e.g. `/about`): the language code is
 *    prefixed once (`/en/about`).
 *
 * In both cases the result carries exactly one language prefix (never
 * `/en/en/...` or `/en/:lang/...`).
 */
const buildLanguageUrl = (baseUrl: string, lang: string, pagePath: string): string => {
  if (/(^|\/):lang(\/|$)/.test(pagePath)) {
    const substituted = pagePath.replace(
      /(^|\/):lang(\/|$)/,
      (_match, pre: string, post: string) => (post === '' ? `${pre}${lang}` : `${pre}${lang}/`)
    )
    return `${baseUrl}${substituted}`
  }
  const normalizedPath = pagePath === '/' ? '' : pagePath
  return `${baseUrl}/${lang}${normalizedPath}${normalizedPath === '' ? '/' : ''}`
}

/**
 * If `pagePath`'s FIRST segment is one of the configured language codes (e.g.
 * `/en/introduction` when `en` is supported), return that code. This identifies
 * a "hardcoded-language" path — a page whose language prefix is baked into its
 * declared `path` (because `contentDir.directory` is per-locale and takes no
 * `:lang` interpolation, so a bilingual docs site declares `/en/:slug` +
 * `/fr/:slug` rather than a single `/:lang/:slug`). Returns `undefined` for
 * language-agnostic paths (`/about`) and `:lang`-template paths.
 */
const leadingLanguageSegment = (
  pagePath: string,
  languages: readonly string[]
): string | undefined => {
  const firstSegment = pagePath.split('/').filter((segment) => segment.length > 0)[0]
  return firstSegment !== undefined && languages.includes(firstSegment) ? firstSegment : undefined
}

/**
 * Swap the leading language segment of a hardcoded-language path with `lang`,
 * yielding the sibling locale's URL: `/en/introduction` + `fr` → `/fr/introduction`,
 * `/en/` + `fr` → `/fr/`. The caller guarantees the first segment is a language
 * code (see {@link leadingLanguageSegment}).
 */
const swapLeadingLanguage = (pagePath: string, lang: string): string =>
  pagePath.replace(/^\/[^/]+/, `/${lang}`)

/**
 * Generate hreflang <xhtml:link> elements for a single URL entry
 */
export const generateHreflangLinks = (
  baseUrl: string,
  pagePath: string,
  languages: readonly string[],
  hreflangConfig: HreflangConfig
): readonly string[] => {
  const languageLinks = languages.map((lang) => {
    const locale = hreflangConfig.localeMap[lang] ?? lang
    const url = buildLanguageUrl(baseUrl, lang, pagePath)
    return `<xhtml:link rel="alternate" hreflang="${locale}" href="${url}" />`
  })

  const defaultUrl = buildLanguageUrl(baseUrl, hreflangConfig.defaultLanguage, pagePath)
  const xDefaultLink = `<xhtml:link rel="alternate" hreflang="x-default" href="${defaultUrl}" />`

  return [...languageLinks, xDefaultLink]
}

/**
 * Generate hreflang <xhtml:link> elements for a hardcoded-language URL entry by
 * swapping the leading language segment across the configured locales. Pairs
 * `/en/introduction` with its `/fr/introduction` sibling (plus `x-default` →
 * the default language) — distinct from {@link generateHreflangLinks}, which
 * PREFIXES a language-agnostic path.
 */
const generateHardcodedLangHreflangLinks = (
  baseUrl: string,
  pagePath: string,
  languages: readonly string[],
  hreflangConfig: HreflangConfig
): readonly string[] => {
  const languageLinks = languages.map((lang) => {
    const locale = hreflangConfig.localeMap[lang] ?? lang
    const url = `${baseUrl}${swapLeadingLanguage(pagePath, lang)}`
    return `<xhtml:link rel="alternate" hreflang="${locale}" href="${url}" />`
  })

  const defaultUrl = `${baseUrl}${swapLeadingLanguage(pagePath, hreflangConfig.defaultLanguage)}`
  const xDefaultLink = `<xhtml:link rel="alternate" hreflang="x-default" href="${defaultUrl}" />`

  return [...languageLinks, xDefaultLink]
}

/**
 * Build a single <url> entry for the sitemap
 */
const buildUrlEntry = (
  loc: string,
  lastmod: string,
  page: Page,
  hreflangSection: string
): string => {
  const priority = resolveSitemapPriority(page)
  const changefreq = resolveSitemapChangefreq(page)
  return `  <url>
    <loc>${loc}</loc>${hreflangSection}
    <lastmod>${lastmod}</lastmod>
    <priority>${priority.toFixed(1)}</priority>
    <changefreq>${changefreq}</changefreq>
  </url>`
}

/**
 * Expand a single indexable page into the concrete paths that appear in the
 * sitemap.
 *
 *  - A `contentDir` page fans out into one resolved path per markdown file
 *    (the declared `:slug`/`:param` template is replaced by each real slug),
 *    so the sitemap lists `/docs/getting-started` rather than `/docs/:slug`.
 *  - Any remaining page whose path still carries a non-`:lang` dynamic segment
 *    is a record-detail template with no enumerable instances here and is
 *    dropped (it would otherwise leak a `:param` into a `<loc>`).
 *  - A static (or `:lang`-only) page passes through unchanged.
 */
const expandPagePaths = async (page: Page): Promise<readonly string[]> => {
  if (page.contentDir) {
    const entries = await enumerateContentDir(page.contentDir, page.path)
    return entries.map((entry) => entry.path)
  }
  const withoutLang = page.path.replace(/(^|\/):lang(\/|$)/, '$1$2')
  if (/:[a-zA-Z0-9_]+/.test(withoutLang)) return []
  return [page.path]
}

/** A concrete sitemap entry: the source page plus its resolved URL path. */
interface ExpandedPage {
  readonly page: Page
  readonly path: string
}

/**
 * Filter to indexable pages and expand each into its concrete URL paths
 * (contentDir pages fan out to one path per markdown file).
 */
const collectExpandedPages = async (pages: readonly Page[]): Promise<readonly ExpandedPage[]> => {
  const indexablePages = pages.filter(
    (page) =>
      !page.meta?.noindex &&
      !(page.meta?.robots && page.meta.robots.includes('noindex')) &&
      !page.path.startsWith('/_') &&
      page.sitemap !== false
  )
  const expanded = await Promise.all(
    indexablePages.map(async (page) => ({ page, paths: await expandPagePaths(page) }))
  )
  return expanded.flatMap(({ page, paths }) => paths.map((path) => ({ page, path })))
}

/** Inputs for {@link buildSitemapEntries}. */
interface SitemapEntriesInput {
  readonly expandedPages: readonly ExpandedPage[]
  readonly baseUrl: string
  readonly lastmod: string
  readonly languages: readonly string[] | undefined
  readonly hreflangConfig: HreflangConfig | undefined
}

/** Render the `\n`-joined, indented hreflang `<xhtml:link>` block for an entry. */
const renderHreflangSection = (links: readonly string[]): string => {
  const indented = links.map((link) => `    ${link}`)
  return indented.length > 0 ? `\n${indented.join('\n')}` : ''
}

/** Shared per-language context threaded through the entry builders. */
interface LanguageEntryContext {
  readonly baseUrl: string
  readonly lastmod: string
  readonly languages: readonly string[]
  readonly hreflangConfig: HreflangConfig | undefined
}

/**
 * Build the `<url>` entry for a HARDCODED-language page (its `path` already
 * carries a leading language segment, e.g. `/en/introduction`). Emitted ONCE at
 * its literal path — NOT fanned out across the language loop — with hreflang
 * alternates pairing it to its sibling-locale URLs.
 */
const buildHardcodedLangEntry = (expanded: ExpandedPage, ctx: LanguageEntryContext): string => {
  const { baseUrl, lastmod, languages, hreflangConfig } = ctx
  const links = hreflangConfig
    ? generateHardcodedLangHreflangLinks(baseUrl, expanded.path, languages, hreflangConfig)
    : []
  return buildUrlEntry(
    `${baseUrl}${expanded.path}`,
    lastmod,
    expanded.page,
    renderHreflangSection(links)
  )
}

/**
 * Build the `<url>` entries for a LANGUAGE-AGNOSTIC page (`/about`, `/:lang/...`)
 * by fanning it out across every configured language: one entry per language,
 * each prefixed (or `:lang`-substituted) via {@link buildLanguageUrl}.
 */
const buildLanguageAgnosticEntries = (
  expanded: ExpandedPage,
  ctx: LanguageEntryContext
): readonly string[] => {
  const { baseUrl, lastmod, languages, hreflangConfig } = ctx
  return languages.map((lang) => {
    const links = hreflangConfig
      ? generateHreflangLinks(baseUrl, expanded.path, languages, hreflangConfig)
      : []
    return buildUrlEntry(
      buildLanguageUrl(baseUrl, lang, expanded.path),
      lastmod,
      expanded.page,
      renderHreflangSection(links)
    )
  })
}

/**
 * Build every `<url>` entry for the resolved pages, optionally per-language.
 *
 * Two language shapes are handled distinctly so a prefix never duplicates:
 *  - hardcoded-language paths (`/en/introduction`) emit ONCE at their literal
 *    path with sibling-locale hreflang alternates;
 *  - language-agnostic / `:lang`-template paths fan out across the language loop.
 */
const buildSitemapEntries = ({
  expandedPages,
  baseUrl,
  lastmod,
  languages,
  hreflangConfig,
}: SitemapEntriesInput): readonly string[] => {
  if (languages === undefined || languages.length === 0) {
    return expandedPages.map(({ page, path }) =>
      buildUrlEntry(`${baseUrl}${path}`, lastmod, page, '')
    )
  }
  const ctx: LanguageEntryContext = { baseUrl, lastmod, languages, hreflangConfig }
  return expandedPages.flatMap((expanded) =>
    leadingLanguageSegment(expanded.path, languages) !== undefined
      ? [buildHardcodedLangEntry(expanded, ctx)]
      : buildLanguageAgnosticEntries(expanded, ctx)
  )
}

/**
 * Generate sitemap.xml content.
 *
 * Async because `contentDir` pages are expanded into one URL per markdown file
 * (file I/O via the content-dir enumerator). Static pages incur no I/O.
 */
export const generateSitemapContent = async (
  pages: readonly Page[],
  baseUrl: string,
  options?: { readonly languages?: readonly string[]; readonly hreflangConfig?: HreflangConfig }
): Promise<string> => {
  const expandedPages = await collectExpandedPages(pages)
  const lastmod = new Date().toISOString().split('T')[0] ?? ''
  const languages = options?.languages
  const hreflangConfig = options?.hreflangConfig
  const hasHreflang =
    languages !== undefined && languages.length > 0 && hreflangConfig !== undefined

  const entries = buildSitemapEntries({
    expandedPages,
    baseUrl,
    lastmod,
    languages,
    hreflangConfig,
  })

  const xmlnsAttr = hasHreflang
    ? ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml"'
    : ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset${xmlnsAttr}>
${entries.join('\n')}
</urlset>`
}

/**
 * Generate robots.txt content
 */
export const generateRobotsContent = (
  pages: readonly Page[],
  baseUrl: string,
  includeSitemap: boolean = false
): string => {
  const baseLines = ['User-agent: *', 'Allow: /']

  // Add Disallow rules for:
  // 1. Pages with noindex or robots directives containing "noindex"
  // 2. Underscore-prefixed pages (admin/internal pages)
  const disallowedPages = pages.filter(
    (page) =>
      page.meta?.noindex === true ||
      (page.meta?.robots && page.meta.robots.includes('noindex')) ||
      page.path.startsWith('/_')
  )

  const disallowLines = disallowedPages.map((page) => `Disallow: ${page.path}`)

  const sitemapLine = includeSitemap ? [`Sitemap: ${baseUrl}/sitemap.xml`] : []
  const lines = [...baseLines, ...disallowLines, ...sitemapLine]

  return lines.join('\n')
}

// ─── llms.txt (llmstxt.org) ──────────────────────────────────────────────────

/** Resolved title + description for the `/llms.txt` header block. */
interface LlmsHeader {
  readonly title: string
  readonly description: string
}

/**
 * Resolve the H1 title + blockquote description for `/llms.txt`.
 *
 * `app.llms.title` / `app.llms.description` win; otherwise the app `name` and
 * `description` are used. A description always exists (falls back to a generic
 * sentence) so the llmstxt.org blockquote is never empty.
 */
const resolveLlmsHeader = (app: App): LlmsHeader => {
  const title = app.llms?.title ?? app.name
  const description =
    app.llms?.description ?? app.description ?? `Documentation and content for ${app.name}.`
  return { title, description }
}

/**
 * Humanize a raw group key into a section heading
 * ("get-started" → "Get Started"). Mirrors the content-dir lister fallback.
 */
const humanizeGroup = (key: string): string =>
  key
    .split(/[-_\s]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')

/** Group key used for entries with no resolvable `group`/`section`. */
const UNGROUPED_KEY = 'Other'

/**
 * Collect every content-directory entry across the app's pages, in page +
 * file order. Pages without a `contentDir` contribute nothing.
 */
const collectContentEntries = async (
  pages: readonly Page[]
): Promise<readonly ContentDirEntry[]> => {
  const perPage = await Promise.all(
    pages.map((page) =>
      page.contentDir ? enumerateContentDir(page.contentDir, page.path) : Promise.resolve([])
    )
  )
  return perPage.flat()
}

/**
 * Group entries by their resolved `group` key, preserving first-seen order for
 * both the groups and the entries within each group.
 */
const groupEntries = (
  entries: readonly ContentDirEntry[]
): ReadonlyArray<readonly [string, readonly ContentDirEntry[]]> => {
  const keys = entries.map((entry) => entry.group ?? UNGROUPED_KEY)
  const orderedKeys = keys.filter((key, index) => keys.indexOf(key) === index)
  return orderedKeys.map(
    (key) => [key, entries.filter((entry) => (entry.group ?? UNGROUPED_KEY) === key)] as const
  )
}

/** Render a single page bullet: `- [title](url): description`. */
const renderEntryBullet = (entry: ContentDirEntry, baseUrl: string): string => {
  const url = `${baseUrl}${entry.path}`
  const suffix = entry.description ? `: ${entry.description}` : ''
  return `- [${entry.title}](${url})${suffix}`
}

/**
 * Generate the llmstxt.org-structured `/llms.txt` document.
 *
 * Structure (per https://llmstxt.org):
 *  - `# <title>` (H1)
 *  - `> <description>` (blockquote)
 *  - one `## <Group>` (H2) section per `contentDir.nav.groupBy` value, each
 *    followed by `- [title](url): description` bullets.
 *
 * `baseUrl` is prefixed to each page path; pass an empty string to emit
 * relative URLs (`/docs/getting-started`).
 *
 * Async because `contentDir` pages are enumerated from disk.
 */
export const generateLlmsTxtContent = async (app: App, baseUrl: string): Promise<string> => {
  const { title, description } = resolveLlmsHeader(app)
  const entries = await collectContentEntries(app.pages ?? [])
  const grouped = groupEntries(entries)

  const sections = grouped.map(([key, groupEntriesList]) => {
    const heading = `## ${humanizeGroup(key)}`
    const bullets = groupEntriesList.map((entry) => renderEntryBullet(entry, baseUrl))
    return [heading, '', ...bullets].join('\n')
  })

  const header = [`# ${title}`, '', `> ${description}`].join('\n')
  const sectionsBlock = sections.length > 0 ? `\n\n${sections.join('\n\n')}` : ''
  return `${header}${sectionsBlock}\n`
}

/**
 * Generate the `/llms-full.txt` document — the full markdown body of every
 * content-directory page concatenated in order, separated by blank lines.
 *
 * Async because each page body is read from disk.
 */
export const generateLlmsFullTxtContent = async (app: App): Promise<string> => {
  const pages = app.pages ?? []
  const perPage = await Promise.all(
    pages.map((page) =>
      page.contentDir ? readContentDirBodies(page.contentDir, page.path) : Promise.resolve([])
    )
  )
  const bodies = perPage.flat().map(({ body }) => body.trim())
  return bodies.join('\n\n').concat('\n')
}

/**
 * Generate client-side hydration script
 *
 * This minimal script enables React hydration on the client side.
 * For production, this would:
 * - Load React runtime
 * - Re-render components with client-side state
 * - Attach event listeners
 * - Enable interactive features
 *
 * Current implementation: Minimal placeholder for testing
 */
export const generateClientHydrationScript = (): string => {
  return `/**
 * Sovrium Client-Side Hydration Script
 * Generated by Sovrium Static Site Generator
 */

// Minimal hydration script for static sites
// This enables client-side interactivity after initial SSR
console.log('Sovrium: Client-side hydration enabled')

// Future: Load React runtime and hydrate components
// Future: Initialize client-side routing
// Future: Restore interactive state
`
}
