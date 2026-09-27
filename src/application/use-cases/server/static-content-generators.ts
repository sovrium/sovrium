/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { validateLanguageSubdirectory } from '@/domain/models/app/languages/language-detection'
import { isPublicPage } from '@/domain/models/app/pages/is-public'
import {
  SITEMAP_MAX_URLS,
  buildSitemapIndexXml,
  chunkSitemapEntries,
  isPageInSitemap,
  resolveSitemapChangefreq,
  resolveSitemapPriority,
} from '@/domain/models/app/pages/sitemap-builder'
import {
  enumerateContentDir,
  readContentDirBodies,
  type ContentDirEntry,
} from '@/infrastructure/markdown/content-dir-enumerator'
import {
  expandCollectionRecords,
  toSitemapLastmod,
  type CollectionRecordIndex,
  type RecordPath,
} from './sitemap-record-fan-out'
import type { FetchSitemapRecords } from '@/application/ports/services/page-renderer'
import type { App, Page } from '@/domain/models/app'
import type { Options } from 'prettier'

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
 * The formatting options every generated page is laid out with.
 *
 * PINNED IN CODE, and deliberately NOT discovered from the filesystem. A
 * generated site is a pure function of the app config and its content (the
 * Build Output Determinism contract in
 * `[internal ref]`), so a `.prettierrc`,
 * an `.editorconfig` or a `package.json#prettier` that a self-hoster happens to
 * have lying around near their build directory must not change a byte of the
 * output. `prettier.format` reads nothing from disk on its own — only
 * `prettier.resolveConfig` does, and this module no longer calls it.
 *
 * It used to. `resolveConfig(process.cwd())` treats its argument as a FILE
 * path and starts its upward search at that argument's PARENT, so the knob was
 * not merely ambient, it was off by one directory: a config in the PARENT of
 * the build directory changed the output while the one in the build directory
 * itself was silently ignored. The fix is no lookup at all — not a corrected
 * lookup. Pinned by `[internal ref]`, whose cwd-config case is a
 * regression guard against "repairing" the off-by-one.
 *
 * Every value below is Prettier 3.x's own default, written out rather than
 * inherited so a future change to those defaults cannot silently re-lay-out
 * every shipped page. The JavaScript-side options are load-bearing despite the
 * `html` parser: Prettier formats the contents of embedded `<script>` blocks
 * (the command-palette bootstrap, island hydration, JSON-LD), so `printWidth`,
 * `semi`, `singleQuote` and `trailingComma` all shape the emitted bytes.
 *
 * Two things this repo's OWN `.prettierrc.json` carries are pointedly absent,
 * and both absences are decisions rather than oversights:
 *  - `singleAttributePerLine` — a source-readability preference for this
 *    repo's TypeScript. It has no business exploding shipped product markup
 *    one attribute per line.
 *  - `prettier-plugin-tailwindcss` — it REORDERS `class` attributes.
 *    Reordering classes in product HTML is a behaviour change, not
 *    formatting. `plugins: []` states that no plugin runs here.
 */
const HTML_FORMAT_OPTIONS: Readonly<Options> = {
  parser: 'html',
  plugins: [],
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  endOfLine: 'lf',
  htmlWhitespaceSensitivity: 'css',
  bracketSameLine: false,
  bracketSpacing: true,
  semi: true,
  singleQuote: false,
  quoteProps: 'as-needed',
  trailingComma: 'all',
  arrowParens: 'always',
}

/**
 * Format HTML with Prettier for professional formatting.
 *
 * Uses {@link HTML_FORMAT_OPTIONS} verbatim — no config is resolved from the
 * filesystem, so the result depends on the input HTML alone.
 *
 * After formatting, repairs `<pre>` whitespace that Prettier damages
 * (leading newline + indentation, trailing whitespace).
 */
export const formatHtmlWithPrettier = async (html: string): Promise<string> => {
  const prettier = await import('prettier')
  const formatted = await prettier.format(html, HTML_FORMAT_OPTIONS)

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
  lastmod: string | undefined,
  page: Page,
  hreflangSection: string
): string => {
  const priority = resolveSitemapPriority(page)
  const changefreq = resolveSitemapChangefreq(page)
  const lastmodLine = lastmod === undefined ? '' : `\n    <lastmod>${lastmod}</lastmod>`
  return `  <url>
    <loc>${loc}</loc>${hreflangSection}${lastmodLine}
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
const expandPagePaths = async (
  page: Page,
  resolveRecords: ResolveRecordPaths
): Promise<readonly ExpandedPath[]> => {
  const recordPaths = await resolveRecords(page)
  if (recordPaths !== undefined) return recordPaths
  if (page.contentDir) {
    const entries = await enumerateContentDir(page.contentDir, page.path)
    return entries.map((entry) => ({
      path: entry.path,
      lastmod: toSitemapLastmod(entry.modifiedAt),
    }))
  }
  const withoutLang = page.path.replace(/(^|\/):lang(\/|$)/, '$1$2')
  if (/:[a-zA-Z0-9_]+/.test(withoutLang)) return []
  return [{ path: page.path, lastmod: undefined }]
}

/**
 * A concrete URL path plus its `<lastmod>`, when one is actually known.
 *
 * A page declared in config has no modification date the engine could know, so
 * it carries none: Google trusts `lastmod` only from a site whose dates prove
 * accurate, and stamping every entry with the generation date is the fastest
 * way to lose that trust. A content-directory article carries its file's
 * modification time.
 */
interface ExpandedPath {
  readonly path: string
  readonly lastmod: string | undefined
}

/**
 * The record entries of one page, or `undefined` when it is not a listed
 * collection page — read live (the served route) or from an enumeration the
 * caller already made (the static build).
 */
type ResolveRecordPaths = (page: Page) => Promise<readonly RecordPath[] | undefined>

/** A concrete sitemap entry: the source page plus its resolved URL path. */
interface ExpandedPage extends ExpandedPath {
  readonly page: Page
}

/**
 * Filter to indexable pages and expand each into its concrete URL paths
 * (contentDir pages fan out to one path per markdown file).
 *
 * The eligibility predicate is the DOMAIN's `isPageInSitemap`, not a local
 * copy of it. This function previously inlined a byte-equivalent
 * duplicate, and the two drifted the moment `access` had to be honoured: the
 * live route and the static build are the two halves of the same contract, and
 * a build that withholds a gated page's HTML while advertising its URL in the
 * sitemap it writes beside it hands every crawler a guaranteed 404. One
 * predicate means they cannot disagree again.
 */
const collectExpandedPages = async (
  pages: readonly Page[],
  resolveRecords: ResolveRecordPaths
): Promise<readonly ExpandedPage[]> => {
  const indexablePages = pages.filter(isPageInSitemap)
  const expanded = await Promise.all(
    indexablePages.map(async (page) => ({
      page,
      paths: await expandPagePaths(page, resolveRecords),
    }))
  )
  return expanded.flatMap(({ page, paths }) => paths.map((entry) => ({ page, ...entry })))
}

/** Inputs for {@link buildSitemapEntries}. */
interface SitemapEntriesInput {
  readonly expandedPages: readonly ExpandedPage[]
  readonly baseUrl: string
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
  const { baseUrl, languages, hreflangConfig } = ctx
  const links = hreflangConfig
    ? generateHardcodedLangHreflangLinks(baseUrl, expanded.path, languages, hreflangConfig)
    : []
  return buildUrlEntry(
    `${baseUrl}${expanded.path}`,
    expanded.lastmod,
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
  const { baseUrl, languages, hreflangConfig } = ctx
  return languages.map((lang) => {
    const links = hreflangConfig
      ? generateHreflangLinks(baseUrl, expanded.path, languages, hreflangConfig)
      : []
    return buildUrlEntry(
      buildLanguageUrl(baseUrl, lang, expanded.path),
      expanded.lastmod,
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
  languages,
  hreflangConfig,
}: SitemapEntriesInput): readonly string[] => {
  if (languages === undefined || languages.length === 0) {
    return expandedPages.map(({ page, path, lastmod }) =>
      buildUrlEntry(`${baseUrl}${path}`, lastmod, page, '')
    )
  }
  const ctx: LanguageEntryContext = { baseUrl, languages, hreflangConfig }
  return expandedPages.flatMap((expanded) =>
    leadingLanguageSegment(expanded.path, languages) !== undefined
      ? [buildHardcodedLangEntry(expanded, ctx)]
      : buildLanguageAgnosticEntries(expanded, ctx)
  )
}

/** Options shared by the sitemap generators. */
export interface SitemapOptions {
  readonly languages?: readonly string[]
  readonly hreflangConfig?: HreflangConfig
  /**
   * The app and a row reader. When both are given, a collection page
   * over an anonymously readable table fans out to one entry per record; when
   * absent, and no `collectionRecords` is given either, such a page is left out.
   */
  readonly app?: App
  readonly fetchRecords?: FetchSitemapRecords
  /**
   * The records a static build already enumerated. When given it wins over
   * `fetchRecords`: the build lists exactly the records it writes pages for,
   * read once, so the sitemap and the pages cannot disagree.
   */
  readonly collectionRecords?: CollectionRecordIndex
}

/** How the entries read a page's records, given the options. */
const recordResolver = (options: SitemapOptions | undefined): ResolveRecordPaths => {
  const index = options?.collectionRecords
  if (index !== undefined) return (page) => Promise.resolve(index.get(page.path))
  const records =
    options?.fetchRecords !== undefined && options.app !== undefined
      ? { app: options.app, fetchRecords: options.fetchRecords }
      : undefined
  return (page) => expandCollectionRecords(page, records)
}

/** Every `<url>` entry, plus whether the `xhtml` namespace is needed. */
const collectSitemapEntries = async (
  pages: readonly Page[],
  baseUrl: string,
  options: SitemapOptions | undefined
): Promise<{ readonly entries: readonly string[]; readonly hasHreflang: boolean }> => {
  const expandedPages = await collectExpandedPages(pages, recordResolver(options))
  const languages = options?.languages
  const hreflangConfig = options?.hreflangConfig
  const hasHreflang =
    languages !== undefined && languages.length > 0 && hreflangConfig !== undefined
  const entries = buildSitemapEntries({ expandedPages, baseUrl, languages, hreflangConfig })
  return { entries, hasHreflang }
}

/** Wrap entries in a `<urlset>` document. */
const renderUrlset = (entries: readonly string[], hasHreflang: boolean): string => {
  const xmlnsAttr = hasHreflang
    ? ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml"'
    : ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset${xmlnsAttr}>
${entries.join('\n')}
</urlset>`
}

/**
 * Generate the `/sitemap.xml` document.
 *
 * Async because `contentDir` pages are expanded into one URL per markdown file
 * and collection pages into one URL per record. Up to 5 000 entries it is a
 * `<urlset>`; past that it is a `<sitemapindex>` naming `/sitemap-1.xml`,
 * `/sitemap-2.xml`, … — see {@link generateSitemapChildContent}.
 */
export const generateSitemapContent = async (
  pages: readonly Page[],
  baseUrl: string,
  options?: SitemapOptions
): Promise<string> => {
  const { entries, hasHreflang } = await collectSitemapEntries(pages, baseUrl, options)
  if (entries.length <= SITEMAP_MAX_URLS) return renderUrlset(entries, hasHreflang)
  return buildSitemapIndexXml(baseUrl, chunkSitemapEntries(entries).length)
}

/**
 * Every document a static build writes for its sitemap, from ONE read of the
 * entries: `sitemap` is `/sitemap.xml` (a `<urlset>`, or a `<sitemapindex>`
 * past 5 000 entries) and `children[i]` is `/sitemap-{i + 1}.xml` — empty when
 * the sitemap is not split. Each document is byte-identical to what
 * {@link generateSitemapContent} and {@link generateSitemapChildContent} return
 * for the same entries.
 */
export const generateSitemapDocuments = async (
  pages: readonly Page[],
  baseUrl: string,
  options?: SitemapOptions
): Promise<{ readonly sitemap: string; readonly children: readonly string[] }> => {
  const { entries, hasHreflang } = await collectSitemapEntries(pages, baseUrl, options)
  if (entries.length <= SITEMAP_MAX_URLS) {
    return { sitemap: renderUrlset(entries, hasHreflang), children: [] }
  }
  const chunks = chunkSitemapEntries(entries)
  return {
    sitemap: buildSitemapIndexXml(baseUrl, chunks.length),
    children: chunks.map((chunk) => renderUrlset(chunk, hasHreflang)),
  }
}

/**
 * Generate child sitemap `index` (1-based) of an app whose sitemap is split,
 * or `undefined` when there is no such child — including every child of an
 * app small enough to fit in one `/sitemap.xml`.
 */
export const generateSitemapChildContent = async (
  pages: readonly Page[],
  baseUrl: string,
  index: number,
  options?: SitemapOptions
): Promise<string | undefined> => {
  const { entries, hasHreflang } = await collectSitemapEntries(pages, baseUrl, options)
  if (entries.length <= SITEMAP_MAX_URLS) return undefined
  const chunk = chunkSitemapEntries(entries)[index - 1]
  return chunk === undefined ? undefined : renderUrlset(chunk, hasHreflang)
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

  // Disallow only the reserved underscore-prefixed pages (admin/internal).
  // A `noindex` page is deliberately NOT disallowed: a crawler refused the
  // fetch never reads the page's `noindex` tag, so a URL linked from elsewhere
  // can still be indexed (bare, without a snippet). Keeping it crawlable is
  // what lets the tag take effect.
  const disallowedPages = pages.filter((page) => page.path.startsWith('/_'))

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
 * The pages ONE locale's llms document is built from.
 *
 * A page belongs to a locale by the `/{lang}/` prefix it declares in its own
 * `path`, resolved with the router's own primitive so an llms route and a page
 * route can never disagree about which segment is a language. A page carrying
 * no DECLARED prefix is locale-NEUTRAL and belongs to every locale — that rule,
 * rather than a special case, is what keeps an app with no `languages` block
 * serving exactly what it served before: no code is declared, so every page is
 * neutral and nothing is filtered out.
 *
 * It is also the whole of the changelog de-duplication. `apps/website` declares
 * its changelog collection once per locale over ONE source directory, so the
 * single English body used to be concatenated twice into one document; the two
 * declarations differ precisely by their path prefix, so scoping by prefix
 * contributes that body once per locale route and never twice to one.
 *
 * `language === undefined` means "every page", which is what the root routes of
 * an app declaring no `languages` ask for.
 *
 * Only PUBLIC pages are ever returned (`isPublicPage`, the rule the sitemap
 * follows). Both llms documents are served to anyone who asks, so a content
 * collection whose `access` requires a session or a role must contribute
 * neither a listing nor a body — filtering here, at the one entry both
 * generators share, covers every `/{lang}/` route at once.
 */
const pagesForLanguage = (app: App, language: string | undefined): readonly Page[] => {
  const pages = (app.pages ?? []).filter(isPublicPage)
  if (language === undefined) return pages
  return pages.filter((page) => {
    const declared = validateLanguageSubdirectory(app, page.path)
    return declared === undefined || declared === language
  })
}

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
 * `language` scopes the index to ONE locale (see {@link pagesForLanguage}), so
 * each article is listed once at the URL that locale reaches it by. Omitting it
 * lists every page, which is what an app declaring no `languages` wants.
 *
 * Async because `contentDir` pages are enumerated from disk.
 */
export const generateLlmsTxtContent = async (
  app: App,
  baseUrl: string,
  language?: string
): Promise<string> => {
  const { title, description } = resolveLlmsHeader(app)
  const entries = await collectContentEntries(pagesForLanguage(app, language))
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
 * `language` scopes the concatenation to ONE locale (see
 * {@link pagesForLanguage}); omitting it concatenates every page, which is what
 * an app declaring no `languages` wants. An agent asking a multilingual site
 * for its documentation reads one corpus rather than paying for every
 * translation at once.
 *
 * Async because each page body is read from disk.
 */
export const generateLlmsFullTxtContent = async (app: App, language?: string): Promise<string> => {
  const pages = pagesForLanguage(app, language)
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
