/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  generateSitemapContent,
  generateRobotsContent,
  generateClientHydrationScript,
  generateHreflangLinks,
  type HreflangConfig,
} from './static-content-generators'
import type { Page } from '@/domain/models/app'

// Helper to create minimal page data for testing
// These functions only use path and meta fields, so we cast partial data
const createPage = (path: string, meta?: Partial<Page['meta']>): Page =>
  ({ name: 'Test', path, sections: [], meta }) as Page

describe('generateSitemapContent', () => {
  const mockPages: readonly Page[] = [createPage('/'), createPage('/about'), createPage('/contact')]

  describe('When generating single-language sitemap', () => {
    test('Then includes XML declaration and urlset', () => {
      const result = generateSitemapContent(mockPages, 'https://example.com')
      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(result).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
      expect(result).toContain('</urlset>')
    })

    test('Then includes all page URLs', () => {
      const result = generateSitemapContent(mockPages, 'https://example.com')
      expect(result).toContain('<loc>https://example.com/</loc>')
      expect(result).toContain('<loc>https://example.com/about</loc>')
      expect(result).toContain('<loc>https://example.com/contact</loc>')
    })

    test('Then includes lastmod date', () => {
      const result = generateSitemapContent(mockPages, 'https://example.com')
      // Date format: YYYY-MM-DD
      expect(result).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/)
    })

    test('Then uses default priority 0.5', () => {
      const result = generateSitemapContent(mockPages, 'https://example.com')
      expect(result).toContain('<priority>0.5</priority>')
    })

    test('Then uses default changefreq monthly', () => {
      const result = generateSitemapContent(mockPages, 'https://example.com')
      expect(result).toContain('<changefreq>monthly</changefreq>')
    })
  })

  describe('When pages have meta options', () => {
    test('Then uses custom priority from meta', () => {
      const pages: readonly Page[] = [createPage('/', { priority: 1.0 })]
      const result = generateSitemapContent(pages, 'https://example.com')
      expect(result).toContain('<priority>1.0</priority>')
    })

    test('Then uses custom changefreq from meta', () => {
      const pages: readonly Page[] = [createPage('/', { changefreq: 'daily' })]
      const result = generateSitemapContent(pages, 'https://example.com')
      expect(result).toContain('<changefreq>daily</changefreq>')
    })

    test('Then excludes pages with noindex', () => {
      const pages: readonly Page[] = [createPage('/'), createPage('/private', { noindex: true })]
      const result = generateSitemapContent(pages, 'https://example.com')
      expect(result).toContain('<loc>https://example.com/</loc>')
      expect(result).not.toContain('/private')
    })

    test('Then excludes underscore-prefixed pages', () => {
      const pages: readonly Page[] = [createPage('/'), createPage('/_admin')]
      const result = generateSitemapContent(pages, 'https://example.com')
      expect(result).toContain('<loc>https://example.com/</loc>')
      expect(result).not.toContain('/_admin')
    })
  })

  describe('When generating multi-language sitemap', () => {
    test('Then creates entries for each language', () => {
      const pages: readonly Page[] = [createPage('/')]
      const result = generateSitemapContent(pages, 'https://example.com', '', {
        languages: ['en', 'fr'],
      })
      expect(result).toContain('<loc>https://example.com/en/</loc>')
      expect(result).toContain('<loc>https://example.com/fr/</loc>')
    })

    test('Then creates language-prefixed paths for non-root pages', () => {
      const pages: readonly Page[] = [createPage('/about')]
      const result = generateSitemapContent(pages, 'https://example.com', '', {
        languages: ['en', 'fr'],
      })
      expect(result).toContain('<loc>https://example.com/en/about</loc>')
      expect(result).toContain('<loc>https://example.com/fr/about</loc>')
    })

    test('Then handles multiple pages with multiple languages', () => {
      const pages: readonly Page[] = [createPage('/'), createPage('/about')]
      const result = generateSitemapContent(pages, 'https://example.com', '', {
        languages: ['en', 'fr', 'de'],
      })
      // 2 pages * 3 languages = 6 URLs
      expect((result.match(/<url>/g) || []).length).toBe(6)
    })
  })

  describe('When generating sitemap with hreflang config', () => {
    const hreflangConfig: HreflangConfig = {
      localeMap: { en: 'en-US', fr: 'fr-FR' },
      defaultLanguage: 'en',
    }

    test('Then includes xmlns:xhtml namespace', () => {
      const pages: readonly Page[] = [createPage('/')]
      const result = generateSitemapContent(pages, 'https://example.com', '', {
        languages: ['en', 'fr'],
        hreflangConfig,
      })
      expect(result).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    })

    test('Then includes hreflang links in URL entries', () => {
      const pages: readonly Page[] = [createPage('/')]
      const result = generateSitemapContent(pages, 'https://example.com', '', {
        languages: ['en', 'fr'],
        hreflangConfig,
      })
      expect(result).toContain('hreflang="en-US"')
      expect(result).toContain('hreflang="fr-FR"')
      expect(result).toContain('hreflang="x-default"')
    })

    test('Then does not include xmlns:xhtml without hreflang config', () => {
      const pages: readonly Page[] = [createPage('/')]
      const result = generateSitemapContent(pages, 'https://example.com', '', {
        languages: ['en', 'fr'],
      })
      expect(result).not.toContain('xmlns:xhtml')
    })
  })
})

describe('generateHreflangLinks', () => {
  const hreflangConfig: HreflangConfig = {
    localeMap: { en: 'en-US', fr: 'fr-FR' },
    defaultLanguage: 'en',
  }

  test('Then generates one link per language plus x-default', () => {
    const links = generateHreflangLinks('https://example.com', '/', ['en', 'fr'], hreflangConfig)
    expect(links).toHaveLength(3) // en + fr + x-default
  })

  test('Then uses locale from localeMap', () => {
    const links = generateHreflangLinks('https://example.com', '/', ['en', 'fr'], hreflangConfig)
    expect(links[0]).toContain('hreflang="en-US"')
    expect(links[1]).toContain('hreflang="fr-FR"')
  })

  test('Then includes x-default pointing to default language', () => {
    const links = generateHreflangLinks('https://example.com', '/', ['en', 'fr'], hreflangConfig)
    const xDefault = links.find((l) => l.includes('x-default'))
    expect(xDefault).toBeDefined()
    expect(xDefault).toContain('href="https://example.com/en/"')
  })

  test('Then builds correct URLs for non-root pages', () => {
    const links = generateHreflangLinks(
      'https://example.com',
      '/company',
      ['en', 'fr'],
      hreflangConfig
    )
    expect(links[0]).toContain('href="https://example.com/en/company"')
    expect(links[1]).toContain('href="https://example.com/fr/company"')
  })

  test('Then falls back to language code when locale not in map', () => {
    const config: HreflangConfig = { localeMap: { en: 'en-US' }, defaultLanguage: 'en' }
    const links = generateHreflangLinks('https://example.com', '/', ['en', 'de'], config)
    expect(links[0]).toContain('hreflang="en-US"')
    expect(links[1]).toContain('hreflang="de"')
  })
})

describe('generateRobotsContent', () => {
  describe('When generating basic robots.txt', () => {
    test('Then includes User-agent and Allow directives', () => {
      const result = generateRobotsContent([], 'https://example.com')
      expect(result).toContain('User-agent: *')
      expect(result).toContain('Allow: /')
    })

    test('Then does not include sitemap by default', () => {
      const result = generateRobotsContent([], 'https://example.com')
      expect(result).not.toContain('Sitemap:')
    })
  })

  describe('When includeSitemap is true', () => {
    test('Then includes sitemap URL', () => {
      const result = generateRobotsContent([], 'https://example.com', '', true)
      expect(result).toContain('Sitemap: https://example.com/sitemap.xml')
    })
  })

  describe('When pages have noindex', () => {
    test('Then adds Disallow for noindex pages', () => {
      const pages: readonly Page[] = [createPage('/'), createPage('/private', { noindex: true })]
      const result = generateRobotsContent(pages, 'https://example.com')
      expect(result).toContain('Disallow: /private')
    })

    test('Then adds Disallow for pages with robots noindex directive', () => {
      const pages: readonly Page[] = [createPage('/secret', { robots: 'noindex, nofollow' })]
      const result = generateRobotsContent(pages, 'https://example.com')
      expect(result).toContain('Disallow: /secret')
    })

    test('Then adds Disallow for underscore-prefixed pages', () => {
      const pages: readonly Page[] = [createPage('/_admin'), createPage('/_internal')]
      const result = generateRobotsContent(pages, 'https://example.com')
      expect(result).toContain('Disallow: /_admin')
      expect(result).toContain('Disallow: /_internal')
    })
  })

  describe('When combining options', () => {
    test('Then includes both Disallow rules and Sitemap', () => {
      const pages: readonly Page[] = [createPage('/private', { noindex: true })]
      const result = generateRobotsContent(pages, 'https://example.com', '', true)
      expect(result).toContain('User-agent: *')
      expect(result).toContain('Allow: /')
      expect(result).toContain('Disallow: /private')
      expect(result).toContain('Sitemap: https://example.com/sitemap.xml')
    })
  })
})

describe('generateClientHydrationScript', () => {
  test('Then returns script with header comment', () => {
    const result = generateClientHydrationScript()
    expect(result).toContain('Sovrium Client-Side Hydration Script')
  })

  test('Then includes console.log for hydration enabled', () => {
    const result = generateClientHydrationScript()
    expect(result).toContain("console.log('Sovrium: Client-side hydration enabled')")
  })

  test('Then is idempotent (returns same content)', () => {
    const result1 = generateClientHydrationScript()
    const result2 = generateClientHydrationScript()
    expect(result1).toBe(result2)
  })
})
