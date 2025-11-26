/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Open Graph Metadata
 *
 * Source: specs/app/pages/meta/social/open-graph.schema.json
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Open Graph Metadata', () => {
  test(
    'APP-PAGES-OG-001: should validate minimal Open Graph metadata',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Open Graph with required properties
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
                description: 'Revolutionary new product changing the industry',
                type: 'website',
                url: 'https://example.com/product',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: title, description, type, and url are provided
      await page.goto('/')

      // THEN: it should validate minimal Open Graph metadata
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        'content',
        'Amazing Product Launch'
      )
      // THEN: assertion
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
        'content',
        'Revolutionary new product changing the industry'
      )
      // THEN: assertion
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website')
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        'content',
        'https://example.com/product'
      )
    }
  )

  test(
    'APP-PAGES-OG-002: should enforce title length for social display',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Open Graph title with maxLength
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
                title: 'Transform Your Business with AI-Powered Analytics - Start Free Trial Today',
                description: 'Test',
                type: 'website',
                url: 'https://example.com',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: title has 90 characters max
      await page.goto('/')

      // THEN: it should enforce title length for social display
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
      expect(ogTitle?.length).toBeLessThanOrEqual(90)
    }
  )

  test(
    'APP-PAGES-OG-003: should enforce description length for social cards',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Open Graph description with maxLength
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
                title: 'Test',
                description:
                  'Discover how our AI-powered platform helps businesses make data-driven decisions. Get real-time insights, automated reporting, and predictive analytics. Start your free 14-day trial today.',
                type: 'website',
                url: 'https://example.com',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: description has 200 characters max
      await page.goto('/')

      // THEN: it should enforce description length for social cards
      const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content')
      expect(ogDesc?.length).toBeLessThanOrEqual(200)
    }
  )

  test(
    'APP-PAGES-OG-004: should categorize content type for social platforms',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Open Graph type enum
      const types = ['website', 'article', 'book', 'profile', 'video', 'music'] as const
      for (const type of types) {
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
                openGraph: { title: 'Test', description: 'Test', type, url: 'https://example.com' },
              },
              sections: [],
            },
          ],
        })
        // WHEN: user navigates to the page
        await page.goto('/')
        // THEN: assertion
        await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', type)
      }
    }
  )

  test(
    'APP-PAGES-OG-005: should provide social sharing image',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Open Graph image URL
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
                title: 'Product Launch',
                description: 'Revolutionary product',
                type: 'website',
                url: 'https://example.com',
                image: 'https://example.com/og-image-1200x630.jpg',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: type is one of: website, article, book, profile, video, music
      await page.goto('/')

      // THEN: it should categorize content type for social platforms
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        'https://example.com/og-image-1200x630.jpg'
      )
    }
  )

  test(
    'APP-PAGES-OG-006: should provide alternative text for social image',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Open Graph imageAlt
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
                title: 'Product Launch',
                description: 'Revolutionary product',
                type: 'website',
                url: 'https://example.com',
                image: 'https://example.com/og-image.jpg',
                imageAlt: 'Product screenshot showing dashboard with analytics graphs and metrics',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: image is URL with recommended 1200x630px dimensions
      await page.goto('/')

      // THEN: it should provide social sharing image
      await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
        'content',
        'Product screenshot showing dashboard with analytics graphs and metrics'
      )
    }
  )

  test(
    'APP-PAGES-OG-007: should distinguish site from page title',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Open Graph siteName
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
                title: '10 Ways to Boost Productivity',
                description: 'Proven strategies for better productivity',
                type: 'article',
                url: 'https://example.com/blog/productivity',
                siteName: 'Acme Blog',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: imageAlt describes image for accessibility
      await page.goto('/')

      // THEN: it should provide alternative text for social image
      await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
        'content',
        'Acme Blog'
      )
    }
  )

  test(
    'APP-PAGES-OG-008: should specify content language for social platforms',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Open Graph locale
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
                title: 'Atelier de Consentement',
                description: 'Atelier pour apprendre à poser ses limites',
                type: 'website',
                url: 'https://example.fr',
                locale: 'fr_FR',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: siteName identifies the overall website brand
      await page.goto('/')

      // THEN: it should distinguish site from page title
      const locale = await page.locator('meta[property="og:locale"]').getAttribute('content')
      expect(locale).toMatch(/^[a-z]{2}_[A-Z]{2}$/)
    }
  )

  test(
    'APP-PAGES-OG-009: should provide grammatical article before title',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Open Graph determiner
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
                title: 'Ultimate Guide to SEO',
                determiner: 'the',
                description: 'Comprehensive SEO guide',
                type: 'article',
                url: 'https://example.com/guide',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: locale is format 'en_US', 'fr_FR' (language_TERRITORY)
      await page.goto('/')

      // THEN: it should specify content language for social platforms
      await expect(page.locator('meta[property="og:determiner"]')).toHaveAttribute('content', 'the')
    }
  )

  test(
    'APP-PAGES-OG-010: should enable video content sharing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Open Graph video URL
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
                title: 'Product Demo Video',
                description: 'See our product in action',
                type: 'video',
                url: 'https://example.com/demo',
                image: 'https://example.com/video-thumbnail.jpg',
                video: 'https://example.com/demo.mp4',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: determiner is 'a', 'an', 'the', 'auto', or empty
      await page.goto('/')

      // THEN: it should provide grammatical article before title
      await expect(page.locator('meta[property="og:video"]')).toHaveAttribute(
        'content',
        'https://example.com/demo.mp4'
      )
    }
  )

  test(
    'APP-PAGES-OG-011: should enable audio content sharing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Open Graph audio URL
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
                title: 'Podcast Episode #42: Marketing Strategies',
                description: 'Learn advanced marketing from industry experts',
                type: 'music',
                url: 'https://example.com/podcast/42',
                image: 'https://example.com/podcast-cover.jpg',
                audio: 'https://example.com/podcast-42.mp3',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: video property contains media URL
      await page.goto('/')

      // THEN: it should enable video content sharing
      await expect(page.locator('meta[property="og:audio"]')).toHaveAttribute(
        'content',
        'https://example.com/podcast-42.mp3'
      )
    }
  )

  test(
    'APP-PAGES-OG-012: should display enhanced social sharing card',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Open Graph rich social preview
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
                title: 'Transform Your Business with AI-Powered Analytics',
                description:
                  'Get real-time insights, automated reporting, and predictive analytics. Start your free 14-day trial today with no credit card required.',
                type: 'website',
                url: 'https://example.com/product',
                image: 'https://example.com/og-image-1200x630.jpg',
                imageAlt: 'Dashboard screenshot showing analytics graphs',
                siteName: 'Acme Analytics',
                locale: 'en_US',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: audio property contains media URL
      await page.goto('/')

      // THEN: it should enable audio content sharing
      await expect(page.locator('meta[property="og:title"]')).toBeAttached()
      await expect(page.locator('meta[property="og:description"]')).toBeAttached()
      await expect(page.locator('meta[property="og:image"]')).toBeAttached()
      await expect(page.locator('meta[property="og:site_name"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-OG-013: user can complete full Open Graph workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app configuration
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
                title: 'Complete Open Graph Test',
                description: 'Testing all Open Graph features',
                type: 'website',
                url: 'https://example.com',
                image: 'https://example.com/og-image.jpg',
                imageAlt: 'Test image',
                siteName: 'Test Site',
                locale: 'en_US',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: user navigates to the page
      await page.goto('/')

      // Verify required properties
      // THEN: assertion
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        'content',
        'Complete Open Graph Test'
      )
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
        'content',
        'Testing all Open Graph features'
      )
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website')
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        'content',
        'https://example.com'
      )

      // Verify optional properties
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        'https://example.com/og-image.jpg'
      )
      await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
        'content',
        'Test image'
      )
      await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
        'content',
        'Test Site'
      )
      await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'en_US')
    }
  )
})
