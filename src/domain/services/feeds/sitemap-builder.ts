/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Page } from '@/domain/models/app/pages'

const DEFAULT_PRIORITY = 0.5

const DEFAULT_CHANGEFREQ = 'monthly'

export function resolveSitemapPriority(page: Page): number {
  if (page.sitemap && page.sitemap.priority !== undefined) {
    return page.sitemap.priority
  }
  return page.meta?.priority ?? DEFAULT_PRIORITY
}

export function resolveSitemapChangefreq(page: Page): string {
  if (page.sitemap && page.sitemap.changefreq !== undefined) {
    return page.sitemap.changefreq
  }
  return page.meta?.changefreq ?? DEFAULT_CHANGEFREQ
}

export function isPageInSitemap(page: Page): boolean {
  const hasNoindexRobots = page.meta?.robots !== undefined && page.meta.robots.includes('noindex')
  return (
    !page.meta?.noindex &&
    !hasNoindexRobots &&
    !page.path.startsWith('/_') &&
    page.sitemap !== false
  )
}

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

export function buildSitemapXml(pages: readonly Page[], baseUrl: string): string {
  const lastmod = new Date().toISOString().split('T')[0] ?? ''
  const entries = pages.filter(isPageInSitemap).map((page) => buildUrlEntry(page, baseUrl, lastmod))

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`
}

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
