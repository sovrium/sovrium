/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from '@/domain/models/app'

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
 * Format HTML with Prettier for professional formatting
 * Loads Prettier config and formats HTML using the HTML parser
 */
export const formatHtmlWithPrettier = async (html: string): Promise<string> => {
  const prettier = await import('prettier')
  const config = await prettier.resolveConfig(process.cwd())

  return await prettier.format(html, {
    ...config,
    parser: 'html',
  })
}

/**
 * Build the full URL for a page in a specific language
 */
const buildLanguageUrl = (baseUrl: string, lang: string, pagePath: string): string => {
  const normalizedPath = pagePath === '/' ? '' : pagePath
  return `${baseUrl}/${lang}${normalizedPath}${normalizedPath === '' ? '/' : ''}`
}

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
 * Build a single <url> entry for the sitemap
 */
const buildUrlEntry = (
  loc: string,
  lastmod: string,
  page: Page,
  hreflangSection: string
): string => {
  const priority = page.meta?.priority ?? 0.5
  const changefreq = page.meta?.changefreq ?? 'monthly'
  return `  <url>
    <loc>${loc}</loc>${hreflangSection}
    <lastmod>${lastmod}</lastmod>
    <priority>${priority.toFixed(1)}</priority>
    <changefreq>${changefreq}</changefreq>
  </url>`
}

/**
 * Generate sitemap.xml content
 */
export const generateSitemapContent = (
  pages: readonly Page[],
  baseUrl: string,
  _basePath: string = '',
  options?: { readonly languages?: readonly string[]; readonly hreflangConfig?: HreflangConfig }
): string => {
  const indexablePages = pages.filter((page) => !page.meta?.noindex && !page.path.startsWith('/_'))
  const lastmod = new Date().toISOString().split('T')[0] ?? ''
  const languages = options?.languages
  const hreflangConfig = options?.hreflangConfig
  const hasHreflang = languages && languages.length > 0 && hreflangConfig !== undefined

  const entries: readonly string[] =
    languages && languages.length > 0
      ? languages.flatMap((lang) =>
          indexablePages.map((page) => {
            const hreflangLinks = hasHreflang
              ? generateHreflangLinks(baseUrl, page.path, languages, hreflangConfig).map(
                  (link) => `    ${link}`
                )
              : []
            const hreflangSection = hreflangLinks.length > 0 ? `\n${hreflangLinks.join('\n')}` : ''
            return buildUrlEntry(
              buildLanguageUrl(baseUrl, lang, page.path),
              lastmod,
              page,
              hreflangSection
            )
          })
        )
      : indexablePages.map((page) => buildUrlEntry(`${baseUrl}${page.path}`, lastmod, page, ''))

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
  _basePath: string = '',
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
