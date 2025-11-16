/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Page Metadata
 *
 * Source: specs/app/pages/meta/meta.schema.json
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Page Metadata', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-META-001: should validate minimal metadata configuration',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: page metadata with required properties
      await startServerWithSchema({
        name: 'test_app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'My Page', description: 'Page description' },
            sections: [],
          },
        ],
      })

      // WHEN: lang is 'en-US', title is 'My Page', description is 'Page description'
      await page.goto('/')

      // THEN: it should validate minimal metadata configuration
      await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
      await expect(page).toHaveTitle('My Page')
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        'Page description'
      )
    }
  )

  test(
    'APP-PAGES-META-002: should enforce title length constraint',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: page metadata with title maxLength
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Short Page Title for SEO - Fits in Search Results',
              description: 'Description',
            },
            sections: [],
          },
        ],
      })

      // WHEN: title has 60 characters max for optimal SEO display
      await page.goto('/')

      // THEN: it should enforce title length constraint
      const title = await page.title()
      expect(title.length).toBeLessThanOrEqual(60)
    }
  )

  test(
    'APP-PAGES-META-003: should enforce description length constraint',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: page metadata with description maxLength
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description:
                'This is a compelling page description that fits within the 160 character limit recommended for optimal display in search engine result snippets.',
            },
            sections: [],
          },
        ],
      })

      // WHEN: description has 160 characters max for SEO snippets
      await page.goto('/')

      // THEN: it should enforce description length constraint
      const description = await page.locator('meta[name="description"]').getAttribute('content')
      expect(description?.length).toBeLessThanOrEqual(160)
    }
  )

  test(
    'APP-PAGES-META-004: should accept keyword string',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: page metadata with keywords
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              keywords: 'web development, react, typescript, seo optimization, page builder',
            },
            sections: [],
          },
        ],
      })

      // WHEN: keywords is comma-separated list for SEO
      await page.goto('/')

      // THEN: it should accept keyword string
      await expect(page.locator('meta[name="keywords"]')).toHaveAttribute(
        'content',
        'web development, react, typescript, seo optimization, page builder'
      )
    }
  )

  test(
    'APP-PAGES-META-005: should define canonical URL',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: page metadata with canonical URL
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              canonical: 'https://example.com/products/widget',
            },
            sections: [],
          },
        ],
      })

      // WHEN: canonical prevents duplicate content issues
      await page.goto('/')

      // THEN: it should define canonical URL
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://example.com/products/widget'
      )
    }
  )

  test(
    'APP-PAGES-META-006: should support both single and multi-favicon configurations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: page metadata with favicon and favicons
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              favicons: {
                icon: '/icon.svg',
                appleTouchIcon: '/apple-touch-icon.png',
                sizes: [{ size: '32x32', href: '/favicon-32x32.png' }],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: favicon is simple icon, favicons is complete set
      await page.goto('/')

      // THEN: it should support both single and multi-favicon configurations
      await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
        'href',
        '/icon.svg'
      )
      await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
        'href',
        '/apple-touch-icon.png'
      )
    }
  )

  test(
    'APP-PAGES-META-007: should include CSS and font resources',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: page metadata with stylesheet and googleFonts
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              stylesheet: '/styles/main.css',
              googleFonts:
                'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
            },
            sections: [],
          },
        ],
      })

      // WHEN: stylesheet and font URLs are provided
      await page.goto('/')

      // THEN: it should include CSS and font resources
      await expect(page.locator('link[rel="stylesheet"][href="/styles/main.css"]')).toBeAttached()
      await expect(
        page.locator('link[rel="preconnect"][href="https://fonts.googleapis.com"]')
      ).toBeAttached()
    }
  )

  test(
    'APP-PAGES-META-008: should enable rich social sharing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: page metadata with social media integration
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              openGraph: {
                title: 'Amazing Product Launch',
                description: 'Revolutionary new product',
                image: 'https://example.com/og-image.jpg',
                url: 'https://example.com/products/new',
              },
              twitter: {
                card: 'summary_large_image',
                title: 'Amazing Product Launch',
                description: 'Revolutionary new product',
                image: 'https://example.com/twitter-image.jpg',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: openGraph and twitter properties are configured
      await page.goto('/')

      // THEN: it should enable rich social sharing
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        'content',
        'Amazing Product Launch'
      )
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        'content',
        'summary_large_image'
      )
    }
  )

  test.fixme(
    'APP-PAGES-META-009: should provide search engine understanding',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: page metadata with structured data
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'Acme Inc',
                url: 'https://example.com',
                logo: 'https://example.com/logo.png',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: schema property contains Schema.org markup
      await page.goto('/')

      // THEN: it should provide search engine understanding
      const jsonLd = await page.locator('script[type="application/ld+json"]').textContent()
      expect(jsonLd).toContain('"@type":"Organization"')
      expect(jsonLd).toContain('"name":"Acme Inc"')
    }
  )

  test.fixme(
    'APP-PAGES-META-010: should optimize page load performance',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: page metadata with performance optimizations
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              preload: [
                {
                  href: '/fonts/Inter-Regular.woff2',
                  as: 'font',
                  type: 'font/woff2',
                  crossorigin: true,
                },
              ],
              dnsPrefetch: ['https://fonts.googleapis.com', 'https://analytics.google.com'],
            },
            sections: [],
          },
        ],
      })

      // WHEN: preload and dnsPrefetch are configured
      await page.goto('/')

      // THEN: it should optimize page load performance
      await expect(page.locator('link[rel="preload"][as="font"]')).toBeAttached()
      await expect(
        page.locator('link[rel="dns-prefetch"][href="https://fonts.googleapis.com"]')
      ).toBeVisible()
    }
  )

  test.fixme(
    'APP-PAGES-META-011: should enable visitor analytics',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: page metadata with analytics
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              analytics: { googleAnalytics: 'G-XXXXXXXXXX', googleTagManager: 'GTM-XXXXXXX' },
            },
            sections: [],
          },
        ],
      })

      // WHEN: analytics property configures tracking providers
      await page.goto('/')

      // THEN: it should enable visitor analytics
      await expect(page.locator('script[src*="googletagmanager.com"]')).toBeAttached()
    }
  )

  test.fixme(
    'APP-PAGES-META-012: should provide comprehensive page metadata management',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: page metadata orchestrating all sub-schemas
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Complete Page Metadata Example',
              description:
                'Comprehensive metadata with SEO, social, structured data, performance, and analytics.',
              keywords: 'metadata, seo, social media, structured data',
              canonical: 'https://example.com/complete',
              favicons: { icon: '/icon.svg' },
              openGraph: { title: 'Complete Page Metadata Example' },
              twitter: { card: 'summary' },
              schema: { '@type': 'WebPage' },
              dnsPrefetch: ['https://fonts.googleapis.com'],
              analytics: { googleAnalytics: 'G-XXXXXXXXXX' },
            },
            sections: [],
          },
        ],
      })

      // WHEN: metadata includes SEO, social, structured data, performance, analytics
      await page.goto('/')

      // THEN: it should provide comprehensive page metadata management
      await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
      await expect(page).toHaveTitle('Complete Page Metadata Example')
      await expect(page.locator('link[rel="canonical"]')).toBeAttached()
      await expect(page.locator('meta[property="og:title"]')).toBeAttached()
      await expect(page.locator('meta[name="twitter:card"]')).toBeAttached()
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test.fixme(
    'APP-PAGES-META-REGRESSION-001: user can complete full metadata workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Complete Test Page',
              description: 'Complete metadata test with all features',
              keywords: 'test, metadata, seo',
              canonical: 'https://example.com/test',
              favicons: { icon: '/icon.svg' },
              openGraph: { title: 'Complete Test Page', image: 'https://example.com/og.jpg' },
              dnsPrefetch: ['https://fonts.googleapis.com'],
            },
            sections: [],
          },
        ],
      })

      await page.goto('/')

      // Verify basic metadata
      await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
      await expect(page).toHaveTitle('Complete Test Page')
      await expect(page.locator('meta[name="description"]')).toBeAttached()

      // Verify SEO
      await expect(page.locator('link[rel="canonical"]')).toBeAttached()
      await expect(page.locator('meta[name="keywords"]')).toBeAttached()

      // Verify social
      await expect(page.locator('meta[property="og:title"]')).toBeAttached()

      // Verify performance
      await expect(page.locator('link[rel="dns-prefetch"]')).toBeAttached()
    }
  )
})
