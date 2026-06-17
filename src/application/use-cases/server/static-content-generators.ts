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

export interface HreflangConfig {
  readonly localeMap: Readonly<Record<string, string>>
  readonly defaultLanguage: string
}

const repairPreWhitespace = (html: string): string => html.replace(/(<pre[^>]*>)\n[ ]*/g, '$1')

export const formatHtmlWithPrettier = async (html: string): Promise<string> => {
  const prettier = await import('prettier')
  const config = await prettier.resolveConfig(process.cwd())

  const formatted = await prettier.format(html, {
    ...config,
    parser: 'html',
  })

  return repairPreWhitespace(formatted)
}

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

const leadingLanguageSegment = (
  pagePath: string,
  languages: readonly string[]
): string | undefined => {
  const firstSegment = pagePath.split('/').filter((segment) => segment.length > 0)[0]
  return firstSegment !== undefined && languages.includes(firstSegment) ? firstSegment : undefined
}

const swapLeadingLanguage = (pagePath: string, lang: string): string =>
  pagePath.replace(/^\/[^/]+/, `/${lang}`)

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

const expandPagePaths = async (page: Page): Promise<readonly string[]> => {
  if (page.contentDir) {
    const entries = await enumerateContentDir(page.contentDir, page.path)
    return entries.map((entry) => entry.path)
  }
  const withoutLang = page.path.replace(/(^|\/):lang(\/|$)/, '$1$2')
  if (/:[a-zA-Z0-9_]+/.test(withoutLang)) return []
  return [page.path]
}

interface ExpandedPage {
  readonly page: Page
  readonly path: string
}

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

interface SitemapEntriesInput {
  readonly expandedPages: readonly ExpandedPage[]
  readonly baseUrl: string
  readonly lastmod: string
  readonly languages: readonly string[] | undefined
  readonly hreflangConfig: HreflangConfig | undefined
}

const renderHreflangSection = (links: readonly string[]): string => {
  const indented = links.map((link) => `    ${link}`)
  return indented.length > 0 ? `\n${indented.join('\n')}` : ''
}

interface LanguageEntryContext {
  readonly baseUrl: string
  readonly lastmod: string
  readonly languages: readonly string[]
  readonly hreflangConfig: HreflangConfig | undefined
}

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

export const generateRobotsContent = (
  pages: readonly Page[],
  baseUrl: string,
  includeSitemap: boolean = false
): string => {
  const baseLines = ['User-agent: *', 'Allow: /']

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


interface LlmsHeader {
  readonly title: string
  readonly description: string
}

const resolveLlmsHeader = (app: App): LlmsHeader => {
  const title = app.llms?.title ?? app.name
  const description =
    app.llms?.description ?? app.description ?? `Documentation and content for ${app.name}.`
  return { title, description }
}

const humanizeGroup = (key: string): string =>
  key
    .split(/[-_\s]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')

const UNGROUPED_KEY = 'Other'

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

const groupEntries = (
  entries: readonly ContentDirEntry[]
): ReadonlyArray<readonly [string, readonly ContentDirEntry[]]> => {
  const keys = entries.map((entry) => entry.group ?? UNGROUPED_KEY)
  const orderedKeys = keys.filter((key, index) => keys.indexOf(key) === index)
  return orderedKeys.map(
    (key) => [key, entries.filter((entry) => (entry.group ?? UNGROUPED_KEY) === key)] as const
  )
}

const renderEntryBullet = (entry: ContentDirEntry, baseUrl: string): string => {
  const url = `${baseUrl}${entry.path}`
  const suffix = entry.description ? `: ${entry.description}` : ''
  return `- [${entry.title}](${url})${suffix}`
}

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
