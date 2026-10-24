/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { languageAlternates } from '@/domain/kernel/matching/localized-alternates'
import { leadingLanguageOf } from '@/domain/kernel/matching/localized-path'
import {
  resolveSitemapChangefreq,
  resolveSitemapPriority,
} from '@/domain/models/app/pages/sitemap-builder'
import {
  buildLanguageUrl,
  renderSitemapHreflangLinks,
  type HreflangConfig,
} from './static-content-generators'
import type { Page } from '@/domain/models/app'

/**
 * The `<url>` entries of a sitemap, built from the pages already expanded to
 * their concrete paths: one entry per path, fanned out across the languages a
 * page is served in, each carrying the page's language alternates.
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
 * A concrete URL path plus its `<lastmod>`, when one is actually known.
 *
 * A page declared in config has no modification date the engine could know, so
 * it carries none: Google trusts `lastmod` only from a site whose dates prove
 * accurate, and stamping every entry with the generation date is the fastest
 * way to lose that trust. A content-directory article carries its file's
 * modification time.
 */
export interface ExpandedPath {
  readonly path: string
  readonly lastmod: string | undefined
}

/** A concrete sitemap entry: the source page plus its resolved URL path. */
export interface ExpandedPage extends ExpandedPath {
  readonly page: Page
}

/** Inputs for {@link buildSitemapEntries}. */
export interface SitemapEntriesInput {
  readonly expandedPages: readonly ExpandedPage[]
  /** Every route pattern the app declares: an alternate is advertised only where one answers. */
  readonly routes: readonly string[]
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
  readonly routes: readonly string[]
}

/**
 * The hreflang links of one entry: the page's domain alternates — the same
 * pairs its HTML `<link rel="alternate">` names — rendered for the sitemap.
 */
const entryHreflangLinks = (expanded: ExpandedPage, ctx: LanguageEntryContext): string => {
  if (ctx.hreflangConfig === undefined) return ''
  const alternates = languageAlternates({
    path: expanded.page.path,
    address: expanded.path,
    routes: ctx.routes,
    languages: ctx.languages,
  })
  return renderHreflangSection(
    renderSitemapHreflangLinks(ctx.baseUrl, alternates, ctx.hreflangConfig)
  )
}

/**
 * Build the `<url>` entry for a HARDCODED-language page (its `path` already
 * carries a leading language segment, e.g. `/en/introduction`). Emitted ONCE at
 * its literal path — NOT fanned out across the language loop — with hreflang
 * alternates pairing it to the sibling-locale URLs a page actually answers.
 */
const buildHardcodedLangEntry = (expanded: ExpandedPage, ctx: LanguageEntryContext): string =>
  buildUrlEntry(
    `${ctx.baseUrl}${expanded.path}`,
    expanded.lastmod,
    expanded.page,
    entryHreflangLinks(expanded, ctx)
  )

/**
 * Build the `<url>` entries for a LANGUAGE-AGNOSTIC page (`/about`, `/:lang/...`)
 * by fanning it out across every configured language: one entry per language,
 * each prefixed (or `:lang`-substituted) via {@link buildLanguageUrl}.
 */
const buildLanguageAgnosticEntries = (
  expanded: ExpandedPage,
  ctx: LanguageEntryContext
): readonly string[] => {
  const links = entryHreflangLinks(expanded, ctx)
  return ctx.languages.map((lang) =>
    buildUrlEntry(
      buildLanguageUrl(ctx.baseUrl, lang, expanded.path),
      expanded.lastmod,
      expanded.page,
      links
    )
  )
}

/**
 * Build every `<url>` entry for the resolved pages, optionally per-language.
 *
 * Two language shapes are handled distinctly so a prefix never duplicates:
 *  - hardcoded-language paths (`/en/introduction`) emit ONCE at their literal
 *    path with sibling-locale hreflang alternates;
 *  - language-agnostic / `:lang`-template paths fan out across the language loop.
 */
export const buildSitemapEntries = ({
  expandedPages,
  routes,
  baseUrl,
  languages,
  hreflangConfig,
}: SitemapEntriesInput): readonly string[] => {
  if (languages === undefined || languages.length === 0) {
    return expandedPages.map(({ page, path, lastmod }) =>
      buildUrlEntry(`${baseUrl}${path}`, lastmod, page, '')
    )
  }
  const ctx: LanguageEntryContext = { baseUrl, languages, hreflangConfig, routes }
  return expandedPages.flatMap((expanded) =>
    leadingLanguageOf(expanded.path, languages) !== undefined
      ? [buildHardcodedLangEntry(expanded, ctx)]
      : buildLanguageAgnosticEntries(expanded, ctx)
  )
}
