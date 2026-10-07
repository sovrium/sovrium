/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import {
  ContentDirReader,
  type ContentDirEntry,
  type ContentDirReadError,
} from '@/application/ports/services/content-dir-reader'
import { isPublicArticle } from '@/domain/models/app/pages/content-dir-access'
import {
  SITEMAP_MAX_URLS,
  buildSitemapIndexXml,
  chunkSitemapEntries,
  isPageInSitemap,
  resolveSitemapChangefreq,
  resolveSitemapPriority,
} from '@/domain/models/app/pages/sitemap-builder'
import { SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'
import {
  expandCollectionRecords,
  toSitemapLastmod,
  type CollectionRecordIndex,
  type RecordPath,
} from './sitemap-record-fan-out'
import { renderUrlset } from './sitemap-urlset'
import {
  buildLanguageUrl,
  generateHardcodedLangHreflangLinks,
  generateHreflangLinks,
  leadingLanguageSegment,
  type HreflangConfig,
} from './static-content-generators'
import type { FetchSitemapRecords } from '@/application/ports/services/page-renderer'
import type { App, Page } from '@/domain/models/app'

/**
 * The sitemap documents a site publishes: one `<url>` entry per page path,
 * expanded across languages and records, with its hreflang alternates.
 */

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
  resolveRecords: ResolveRecordPaths,
  contentEntries: ContentEntriesByPage
): Promise<readonly ExpandedPath[]> => {
  const recordPaths = await resolveRecords(page)
  if (recordPaths !== undefined) return recordPaths
  if (page.contentDir) {
    const entries = contentEntries.get(page) ?? []
    return entries
      .filter((entry) => isPublicArticle(entry.access))
      .map((entry) => ({
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

/**
 * The articles of every indexable `contentDir` page, read through the port
 * before the expansion runs, so the expansion itself touches no filesystem.
 */
type ContentEntriesByPage = ReadonlyMap<Page, readonly ContentDirEntry[]>

/** A collection page's records could not be read for the sitemap. */
export class SitemapRecordsReadError extends Data.TaggedError('SitemapRecordsReadError')<{
  readonly cause: unknown
}> {}

/** How many `contentDir` directories are read at once (filesystem, not the pool). */
const CONTENT_DIR_READ_CONCURRENCY = 4

/** Read every indexable `contentDir` page's articles through {@link ContentDirReader}. */
const readContentEntries = (
  pages: readonly Page[]
): Effect.Effect<ContentEntriesByPage, ContentDirReadError, ContentDirReader> =>
  Effect.gen(function* () {
    const reader = yield* ContentDirReader
    const pairs = yield* Effect.forEach(
      pages.filter(isPageInSitemap),
      (page) =>
        page.contentDir
          ? Effect.map(reader.enumerate(page.contentDir, page.path), (entries) => [
              [page, entries] as const,
            ])
          : Effect.succeed([]),
      { concurrency: CONTENT_DIR_READ_CONCURRENCY }
    )
    return new Map(pairs.flat())
  })

/** A concrete sitemap entry: the source page plus its resolved URL path. */
interface ExpandedPage extends ExpandedPath {
  readonly page: Page
}

/**
 * Filter to indexable pages and expand each into its concrete URL paths
 * (contentDir pages fan out to one path per markdown file).
 *
 * The eligibility predicate is the DOMAIN's `isPageInSitemap`, not a local
 * copy of it. A local duplicate drifts the moment the predicate changes — as
 * it must when `access` is honoured — and the live route and the static build
 * are the two halves of the same contract, and
 * a build that withholds a gated page's HTML while advertising its URL in the
 * sitemap it writes beside it hands every crawler a guaranteed 404. One
 * predicate means they cannot disagree.
 */
const collectExpandedPages = (
  pages: readonly Page[],
  resolveRecords: ResolveRecordPaths,
  contentEntries: ContentEntriesByPage
): Effect.Effect<readonly ExpandedPage[], SitemapRecordsReadError> =>
  Effect.map(
    // A collection page's records come off the shared database pool, so the
    // pages are expanded under the shared fan-out ceiling, not all at once.
    Effect.forEach(
      pages.filter(isPageInSitemap),
      (page) =>
        Effect.tryPromise({
          try: () => expandPagePaths(page, resolveRecords, contentEntries),
          catch: (cause) => new SitemapRecordsReadError({ cause }),
        }).pipe(Effect.map((paths) => paths.map((entry) => ({ page, ...entry })))),
      { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
    ),
    (perPage) => perPage.flat()
  )

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
const collectSitemapEntries = (
  pages: readonly Page[],
  baseUrl: string,
  options: SitemapOptions | undefined
): Effect.Effect<
  { readonly entries: readonly string[]; readonly hasHreflang: boolean },
  SitemapReadError,
  ContentDirReader
> =>
  Effect.gen(function* () {
    const contentEntries = yield* readContentEntries(pages)
    const expandedPages = yield* collectExpandedPages(
      pages,
      recordResolver(options),
      contentEntries
    )
    const languages = options?.languages
    const hreflangConfig = options?.hreflangConfig
    const hasHreflang =
      languages !== undefined && languages.length > 0 && hreflangConfig !== undefined
    const entries = buildSitemapEntries({ expandedPages, baseUrl, languages, hreflangConfig })
    return { entries, hasHreflang }
  })

/** Why a sitemap document could not be built: an unreadable article or record. */
export type SitemapReadError = ContentDirReadError | SitemapRecordsReadError

/**
 * Generate the `/sitemap.xml` document.
 *
 * An Effect because `contentDir` pages are expanded into one URL per markdown
 * file (read through {@link ContentDirReader}) and collection pages into one URL
 * per record. Up to 5 000 entries it is a `<urlset>`; past that it is a
 * `<sitemapindex>` naming `/sitemap-1.xml`, `/sitemap-2.xml`, … — see
 * {@link generateSitemapChildContent}.
 */
export const generateSitemapContent = (
  pages: readonly Page[],
  baseUrl: string,
  options?: SitemapOptions
): Effect.Effect<string, SitemapReadError, ContentDirReader> =>
  Effect.map(collectSitemapEntries(pages, baseUrl, options), ({ entries, hasHreflang }) =>
    entries.length <= SITEMAP_MAX_URLS
      ? renderUrlset(entries, hasHreflang)
      : buildSitemapIndexXml(baseUrl, chunkSitemapEntries(entries).length)
  ).pipe(Effect.withSpan('server.generate-sitemap'))

/**
 * Every document a static build writes for its sitemap, from ONE read of the
 * entries: `sitemap` is `/sitemap.xml` (a `<urlset>`, or a `<sitemapindex>`
 * past 5 000 entries) and `children[i]` is `/sitemap-{i + 1}.xml` — empty when
 * the sitemap is not split. Each document is byte-identical to what
 * {@link generateSitemapContent} and {@link generateSitemapChildContent} return
 * for the same entries.
 */
export const generateSitemapDocuments = (
  pages: readonly Page[],
  baseUrl: string,
  options?: SitemapOptions
): Effect.Effect<
  { readonly sitemap: string; readonly children: readonly string[] },
  SitemapReadError,
  ContentDirReader
> =>
  Effect.map(collectSitemapEntries(pages, baseUrl, options), ({ entries, hasHreflang }) => {
    if (entries.length <= SITEMAP_MAX_URLS) {
      return { sitemap: renderUrlset(entries, hasHreflang), children: [] }
    }
    const chunks = chunkSitemapEntries(entries)
    return {
      sitemap: buildSitemapIndexXml(baseUrl, chunks.length),
      children: chunks.map((chunk) => renderUrlset(chunk, hasHreflang)),
    }
  }).pipe(Effect.withSpan('server.generate-sitemap-documents'))

/**
 * Generate child sitemap `index` (1-based) of an app whose sitemap is split,
 * or `undefined` when there is no such child — including every child of an
 * app small enough to fit in one `/sitemap.xml`.
 */
export const generateSitemapChildContent = (
  pages: readonly Page[],
  baseUrl: string,
  index: number,
  options?: SitemapOptions
): Effect.Effect<string | undefined, SitemapReadError, ContentDirReader> =>
  Effect.map(collectSitemapEntries(pages, baseUrl, options), ({ entries, hasHreflang }) => {
    if (entries.length <= SITEMAP_MAX_URLS) return undefined
    const chunk = chunkSitemapEntries(entries)[index - 1]
    return chunk === undefined ? undefined : renderUrlset(chunk, hasHreflang)
  }).pipe(Effect.withSpan('server.generate-sitemap-child'))
