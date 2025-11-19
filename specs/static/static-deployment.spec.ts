/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { constants } from 'node:fs'
import { readFile, readdir, access } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect } from '@/specs/fixtures'

test.describe('Static Site Generation - Deployment Features', () => {
  test.fixme(
    'STATIC-DEPLOY-001: should generate .nojekyll for GitHub Pages',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app configured for GitHub Pages deployment
      const outputDir = await generateStaticSite(
        {
          name: 'test-app',
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en', title: 'Home', description: 'Home page' },
              sections: [],
            },
            {
              name: 'docs',
              path: '/_docs/api', // Path starting with underscore
              meta: { lang: 'en', title: 'API Docs', description: 'API Documentation' },
              sections: [{ type: 'h1', children: ['API Documentation'] }],
            },
          ],
        },
        {
          deployment: 'github-pages',
        }
      )

      // WHEN: examining deployment files
      const files = await readdir(outputDir)

      // THEN: should generate .nojekyll file
      expect(files).toContain('.nojekyll')

      // Verify .nojekyll exists and is readable
      await expect(access(join(outputDir, '.nojekyll'), constants.R_OK)).resolves.toBeUndefined()

      // .nojekyll should be empty (standard practice)
      const nojekyllContent = await readFile(join(outputDir, '.nojekyll'), 'utf-8')
      expect(nojekyllContent).toBe('')

      // Should handle underscore paths correctly
      const allFiles = await readdir(outputDir, { recursive: true })
      expect(allFiles).toContain('_docs/api.html')

      // Verify underscore directory was created
      await expect(access(join(outputDir, '_docs'), constants.R_OK)).resolves.toBeUndefined()
    }
  )

  test.fixme(
    'STATIC-DEPLOY-002: should generate sitemap.xml',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with sitemap generation enabled
      const outputDir = await generateStaticSite(
        {
          name: 'test-app',
          pages: [
            {
              name: 'home',
              path: '/',
              meta: {
                lang: 'en',
                title: 'Home',
                description: 'Home page',
                priority: 1.0,
                changefreq: 'daily',
              },
              sections: [],
            },
            {
              name: 'about',
              path: '/about',
              meta: {
                lang: 'en',
                title: 'About',
                description: 'About page',
                priority: 0.8,
                changefreq: 'weekly',
              },
              sections: [],
            },
            {
              name: 'products',
              path: '/products',
              meta: {
                lang: 'en',
                title: 'Products',
                description: 'Products page',
                priority: 0.9,
                changefreq: 'daily',
              },
              sections: [],
            },
            {
              name: 'contact',
              path: '/contact',
              meta: {
                lang: 'en',
                title: 'Contact',
                description: 'Contact page',
                priority: 0.7,
                changefreq: 'monthly',
              },
              sections: [],
            },
            {
              name: 'privacy',
              path: '/privacy',
              meta: {
                lang: 'en',
                title: 'Privacy Policy',
                description: 'Privacy policy',
                priority: 0.3,
                changefreq: 'yearly',
                noindex: true, // Should not be in sitemap
              },
              sections: [],
            },
          ],
        },
        {
          baseUrl: 'https://example.com',
          generateSitemap: true,
        }
      )

      // WHEN: reading sitemap.xml
      const sitemapPath = join(outputDir, 'sitemap.xml')
      await expect(access(sitemapPath, constants.R_OK)).resolves.toBeUndefined()

      const sitemap = await readFile(sitemapPath, 'utf-8')

      // THEN: should generate valid sitemap.xml
      // XML declaration and schema
      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
      expect(sitemap).toContain('</urlset>')

      // URLs should be included
      expect(sitemap).toContain('<loc>https://example.com/</loc>')
      expect(sitemap).toContain('<loc>https://example.com/about</loc>')
      expect(sitemap).toContain('<loc>https://example.com/products</loc>')
      expect(sitemap).toContain('<loc>https://example.com/contact</loc>')

      // Privacy page should NOT be in sitemap (noindex)
      expect(sitemap).not.toContain('<loc>https://example.com/privacy</loc>')

      // Priority values
      expect(sitemap).toContain('<priority>1.0</priority>') // Home
      expect(sitemap).toContain('<priority>0.8</priority>') // About
      expect(sitemap).toContain('<priority>0.9</priority>') // Products
      expect(sitemap).toContain('<priority>0.7</priority>') // Contact

      // Change frequency values
      expect(sitemap).toContain('<changefreq>daily</changefreq>')
      expect(sitemap).toContain('<changefreq>weekly</changefreq>')
      expect(sitemap).toContain('<changefreq>monthly</changefreq>')

      // Should have lastmod dates (current date)
      expect(sitemap).toContain('<lastmod>')

      // Verify XML structure is valid
      const urlMatches = sitemap.match(/<url>/g)
      const urlCloseMatches = sitemap.match(/<\/url>/g)
      expect(urlMatches?.length).toBe(4) // 4 pages (excluding privacy)
      expect(urlCloseMatches?.length).toBe(4)
    }
  )

  test.fixme(
    'STATIC-DEPLOY-003: should generate robots.txt',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with robots.txt generation
      const outputDir = await generateStaticSite(
        {
          name: 'test-app',
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en', title: 'Home', description: 'Home' },
              sections: [],
            },
            {
              name: 'admin',
              path: '/admin',
              meta: {
                lang: 'en',
                title: 'Admin',
                description: 'Admin panel',
                robots: 'noindex, nofollow', // Should be disallowed
              },
              sections: [],
            },
            {
              name: 'api-docs',
              path: '/api/docs',
              meta: {
                lang: 'en',
                title: 'API Documentation',
                description: 'API docs',
                robots: 'noindex', // Should be disallowed
              },
              sections: [],
            },
            {
              name: 'private',
              path: '/private',
              meta: {
                lang: 'en',
                title: 'Private Area',
                description: 'Private',
                robots: 'noindex, nofollow', // Should be disallowed
              },
              sections: [],
            },
          ],
        },
        {
          baseUrl: 'https://example.com',
          generateRobotsTxt: true,
          generateSitemap: true,
        }
      )

      // WHEN: reading robots.txt
      const robotsPath = join(outputDir, 'robots.txt')
      await expect(access(robotsPath, constants.R_OK)).resolves.toBeUndefined()

      const robots = await readFile(robotsPath, 'utf-8')

      // THEN: should generate valid robots.txt
      // User agent rules
      expect(robots).toContain('User-agent: *')

      // Allow root by default
      expect(robots).toContain('Allow: /')

      // Disallow pages with noindex
      expect(robots).toContain('Disallow: /admin')
      expect(robots).toContain('Disallow: /api/docs')
      expect(robots).toContain('Disallow: /private')

      // Sitemap reference
      expect(robots).toContain('Sitemap: https://example.com/sitemap.xml')

      // Optional: crawl delay
      // expect(robots).toContain('Crawl-delay:')

      // Verify structure
      const lines = robots.split('\n').filter((line) => line.trim())
      expect(lines[0]).toContain('User-agent')

      // Should not have duplicate rules
      const disallowLines = lines.filter((l) => l.startsWith('Disallow:'))
      const uniqueDisallows = new Set(disallowLines)
      expect(disallowLines.length).toBe(uniqueDisallows.size)
    }
  )

  test.fixme(
    'STATIC-DEPLOY-004: should handle base path configuration',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with base path for subdirectory deployment
      const outputDir = await generateStaticSite(
        {
          name: 'test-app',
          theme: {
            colors: { primary: '#3B82F6' },
          },
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en', title: 'Home', description: 'Home' },
              sections: [
                {
                  type: 'div',
                  children: [
                    {
                      type: 'a',
                      props: { href: '/', className: 'home-link' },
                      children: ['Home'],
                    },
                    {
                      type: 'a',
                      props: { href: '/about', className: 'about-link' },
                      children: ['About'],
                    },
                    {
                      type: 'img',
                      props: { src: '/images/logo.png', alt: 'Logo' },
                    },
                    {
                      type: 'link',
                      props: { rel: 'stylesheet', href: '/assets/output.css' },
                    },
                  ],
                },
              ],
            },
            {
              name: 'about',
              path: '/about',
              meta: { lang: 'en', title: 'About', description: 'About' },
              sections: [
                {
                  type: 'a',
                  props: { href: '/' },
                  children: ['Back to Home'],
                },
              ],
            },
          ],
        },
        {
          baseUrl: 'https://example.com/myapp',
          basePath: '/myapp',
          deployment: 'generic', // Can be deployed to any subdirectory
        }
      )

      // WHEN: reading generated HTML
      const homeHtml = await readFile(join(outputDir, 'index.html'), 'utf-8')
      const aboutHtml = await readFile(join(outputDir, 'about.html'), 'utf-8')

      // THEN: should update all paths with base path
      // Links should be prefixed with base path
      expect(homeHtml).toContain('href="/myapp/"')
      expect(homeHtml).toContain('href="/myapp/about"')
      expect(aboutHtml).toContain('href="/myapp/"')

      // Asset paths should be prefixed
      expect(homeHtml).toContain('src="/myapp/images/logo.png"')
      expect(homeHtml).toContain('href="/myapp/assets/output.css"')

      // Both pages should reference CSS with base path
      expect(aboutHtml).toContain('href="/myapp/assets/output.css"')

      // Meta tags should use full URLs with base path
      expect(homeHtml).toContain('<link rel="canonical" href="https://example.com/myapp/">')
      expect(aboutHtml).toContain('<link rel="canonical" href="https://example.com/myapp/about">')

      // If sitemap exists, check URLs
      const sitemapPath = join(outputDir, 'sitemap.xml')
      try {
        await access(sitemapPath, constants.R_OK)
        const sitemap = await readFile(sitemapPath, 'utf-8')
        expect(sitemap).toContain('<loc>https://example.com/myapp/</loc>')
        expect(sitemap).toContain('<loc>https://example.com/myapp/about</loc>')
      } catch {
        // Sitemap might not be generated in this config
      }
    }
  )

  test.fixme(
    'STATIC-DEPLOY-REGRESSION-001: complete deployment workflow',
    { tag: '@regression' },
    async ({ generateStaticSite, page }) => {
      // GIVEN: complete app with all deployment features
      const outputDir = await generateStaticSite(
        {
          name: 'test-app',
          description: 'Deployment test application',
          theme: {
            colors: { primary: '#3B82F6' },
          },
          languages: {
            en: {
              name: 'English',
              locale: 'en-US',
              translations: { title: 'Home' },
            },
            fr: {
              name: 'Français',
              locale: 'fr-FR',
              translations: { title: 'Accueil' },
            },
          },
          pages: [
            {
              name: 'home',
              path: '/',
              meta: {
                title: '$t:title',
                description: 'Multi-language home page',
                priority: 1.0,
                changefreq: 'daily',
              },
              sections: [
                {
                  type: 'header',
                  props: { className: 'bg-primary text-white p-4' },
                  children: [
                    { type: 'h1', children: ['$t:title'] },
                    {
                      type: 'nav',
                      children: [
                        { type: 'a', props: { href: '/' }, children: ['Home'] },
                        { type: 'a', props: { href: '/about' }, children: ['About'] },
                        { type: 'a', props: { href: '/products' }, children: ['Products'] },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              name: 'about',
              path: '/about',
              meta: {
                title: 'About',
                priority: 0.8,
                changefreq: 'weekly',
              },
              sections: [],
            },
            {
              name: 'products',
              path: '/products',
              meta: {
                title: 'Products',
                priority: 0.9,
                changefreq: 'daily',
              },
              sections: [],
            },
            {
              name: 'admin',
              path: '/_admin',
              meta: {
                lang: 'en',
                title: 'Admin',
                robots: 'noindex, nofollow',
              },
              sections: [],
            },
          ],
        },
        {
          baseUrl: 'https://example.github.io/my-project',
          basePath: '/my-project',
          deployment: 'github-pages',
          languages: ['en', 'fr'],
          generateSitemap: true,
          generateRobotsTxt: true,
          hydration: true,
        }
      )

      // WHEN: examining all deployment files
      const files = await readdir(outputDir, { recursive: true })

      // THEN: should have complete deployment setup
      // GitHub Pages specific
      expect(files).toContain('.nojekyll')

      // Sitemap
      expect(files).toContain('sitemap.xml')
      const sitemap = await readFile(join(outputDir, 'sitemap.xml'), 'utf-8')
      expect(sitemap).toContain('https://example.github.io/my-project/')
      expect(sitemap).toContain('https://example.github.io/my-project/en/')
      expect(sitemap).toContain('https://example.github.io/my-project/fr/')

      // Robots.txt
      expect(files).toContain('robots.txt')
      const robots = await readFile(join(outputDir, 'robots.txt'), 'utf-8')
      expect(robots).toContain('Disallow: /_admin')
      expect(robots).toContain('Sitemap: https://example.github.io/my-project/sitemap.xml')

      // Multi-language structure
      expect(files).toContain('en/index.html')
      expect(files).toContain('fr/index.html')

      // Assets
      expect(files).toContain('assets/output.css')
      expect(files).toContain('assets/client.js') // For hydration

      // Check HTML has correct paths
      const enHome = await readFile(join(outputDir, 'en/index.html'), 'utf-8')
      expect(enHome).toContain('href="/my-project/assets/output.css"')
      expect(enHome).toContain('src="/my-project/assets/client.js"')
      expect(enHome).toContain('href="/my-project/en/about"')

      // Hreflang tags with base path
      expect(enHome).toContain('hreflang="en" href="https://example.github.io/my-project/en/"')
      expect(enHome).toContain('hreflang="fr" href="https://example.github.io/my-project/fr/"')

      // Load in browser to verify
      await page.goto(`file://${join(outputDir, 'en/index.html')}`)
      await expect(page.locator('h1')).toBeVisible()

      // Verify underscore paths work (GitHub Pages compatibility)
      expect(files).toContain('_admin.html')
    }
  )
})
