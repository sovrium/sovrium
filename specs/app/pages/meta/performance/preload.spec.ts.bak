/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Resource Preloading
 *
 * Source: src/domain/models/app/page/meta.ts
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Resource Preloading', () => {
  test(
    'APP-PAGES-PRELOAD-001: should preload critical resource',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: preload resource with href and as
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
              preload: [{ href: './output.css', as: 'style' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: href is resource URL and as specifies type
      await page.goto('/')

      // THEN: it should preload critical resource
      await expect(
        page.locator('link[rel="preload"][href="./output.css"][as="style"]')
      ).toBeAttached()
    }
  )

  test(
    'APP-PAGES-PRELOAD-002: should preload critical stylesheet',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: preload with as='style'
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
              preload: [{ href: './styles/main.css', as: 'style' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: as is 'style' for CSS files
      await page.goto('/')

      // THEN: it should preload critical stylesheet
      await expect(page.locator('link[rel="preload"][as="style"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-PRELOAD-003: should preload critical scripts',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: preload with as='script'
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
              preload: [{ href: './scripts/app.js', as: 'script' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: as is 'script' for JavaScript files
      await page.goto('/')

      // THEN: it should preload critical scripts
      await expect(page.locator('link[rel="preload"][as="script"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-PRELOAD-004: should preload web fonts',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: preload with as='font'
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
                { href: './fonts/MyFont.woff2', as: 'font', type: 'font/woff2', crossorigin: true },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: as is 'font' with type and crossorigin
      await page.goto('/')

      // THEN: it should preload web fonts
      const preload = page.locator('link[rel="preload"][as="font"]')
      await expect(preload).toHaveAttribute('type', 'font/woff2')
      await expect(preload).toHaveAttribute('crossorigin', '')
    }
  )

  test(
    'APP-PAGES-PRELOAD-005: should preload hero images',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: preload with as='image'
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
              preload: [{ href: './images/hero.jpg', as: 'image' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: as is 'image' for above-the-fold images
      await page.goto('/')

      // THEN: it should preload hero images
      await expect(page.locator('link[rel="preload"][as="image"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-PRELOAD-006: should prefetch critical API responses',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: preload with as='fetch'
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
              preload: [{ href: '/api/data.json', as: 'fetch' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: as is 'fetch' for API data
      await page.goto('/')

      // THEN: it should prefetch critical API responses
      await expect(page.locator('link[rel="preload"][as="fetch"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-PRELOAD-007: should set CORS for cross-origin fonts',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: preload with crossorigin for fonts
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
                  href: './fonts/font.woff2',
                  as: 'font',
                  type: 'font/woff2',
                  crossorigin: 'anonymous',
                },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: crossorigin is true or 'anonymous'
      await page.goto('/')

      // THEN: it should set CORS for cross-origin fonts
      await expect(page.locator('link[rel="preload"][as="font"]')).toHaveAttribute(
        'crossorigin',
        'anonymous'
      )
    }
  )

  test(
    'APP-PAGES-PRELOAD-008: should help browser prioritize resource',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: preload with type attribute
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
              preload: [{ href: './fonts/font.woff2', as: 'font', type: 'font/woff2' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: type specifies MIME type like 'font/woff2'
      await page.goto('/')

      // THEN: it should help browser prioritize resource
      await expect(page.locator('link[rel="preload"][type="font/woff2"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-PRELOAD-009: should preload only when media query matches',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: preload with media query
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
                { href: './images/hero-mobile.jpg', as: 'image', media: '(max-width: 768px)' },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: media specifies conditional loading
      await page.goto('/')

      // THEN: it should preload only when media query matches
      await expect(page.locator('link[rel="preload"][media="(max-width: 768px)"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-PRELOAD-010: should optimize First Contentful Paint (FCP)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: preload for critical rendering path
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
                { href: './output.css', as: 'style' },
                { href: './fonts/font.woff2', as: 'font', type: 'font/woff2', crossorigin: true },
                { href: './images/hero.jpg', as: 'image' },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: preloading CSS, fonts, and hero images
      await page.goto('/')

      // THEN: it should optimize First Contentful Paint (FCP)
      await expect(page.locator('link[rel="preload"]')).toHaveCount(3)
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test covering all 10 @spec scenarios via single server setup
  // ============================================================================

  test(
    'APP-PAGES-PRELOAD-REGRESSION: user can complete full preload workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // OPTIMIZATION: Consolidated from 10 startServerWithSchema calls to 1
      // All preload resources are ADDITIVE - can be combined in single preload array
      await test.step('Setup: Start server with comprehensive preload configuration', async () => {
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
                  // Style resources (001, 002)
                  { href: './output.css', as: 'style' },
                  { href: './styles/main.css', as: 'style' },
                  // Script resources (003)
                  { href: './scripts/app.js', as: 'script' },
                  // Font resources with crossorigin=true (004)
                  {
                    href: './fonts/MyFont.woff2',
                    as: 'font',
                    type: 'font/woff2',
                    crossorigin: true,
                  },
                  // Font resources with crossorigin='anonymous' (007, 008)
                  {
                    href: './fonts/font.woff2',
                    as: 'font',
                    type: 'font/woff2',
                    crossorigin: 'anonymous',
                  },
                  // Image resources (005)
                  { href: './images/hero.jpg', as: 'image' },
                  // Fetch resources (006)
                  { href: '/api/data.json', as: 'fetch' },
                  // Image with media query (009)
                  { href: './images/hero-mobile.jpg', as: 'image', media: '(max-width: 768px)' },
                ],
              },
              sections: [],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-PAGES-PRELOAD-001: Preload critical resource', async () => {
        await expect(
          page.locator('link[rel="preload"][href="./output.css"][as="style"]')
        ).toBeAttached()
      })

      await test.step('APP-PAGES-PRELOAD-002: Preload critical stylesheet', async () => {
        await expect(page.locator('link[rel="preload"][as="style"]').first()).toBeAttached()
      })

      await test.step('APP-PAGES-PRELOAD-003: Preload critical scripts', async () => {
        await expect(page.locator('link[rel="preload"][as="script"]')).toBeAttached()
      })

      await test.step('APP-PAGES-PRELOAD-004: Preload web fonts', async () => {
        const preload = page.locator('link[rel="preload"][href="./fonts/MyFont.woff2"]')
        await expect(preload).toHaveAttribute('type', 'font/woff2')
        await expect(preload).toHaveAttribute('crossorigin', '')
      })

      await test.step('APP-PAGES-PRELOAD-005: Preload hero images', async () => {
        await expect(
          page.locator('link[rel="preload"][href="./images/hero.jpg"][as="image"]')
        ).toBeAttached()
      })

      await test.step('APP-PAGES-PRELOAD-006: Prefetch critical API responses', async () => {
        await expect(page.locator('link[rel="preload"][as="fetch"]')).toBeAttached()
      })

      await test.step('APP-PAGES-PRELOAD-007: Set CORS for cross-origin fonts', async () => {
        await expect(
          page.locator('link[rel="preload"][href="./fonts/font.woff2"]')
        ).toHaveAttribute('crossorigin', 'anonymous')
      })

      await test.step('APP-PAGES-PRELOAD-008: Help browser prioritize resource', async () => {
        await expect(page.locator('link[rel="preload"][type="font/woff2"]').first()).toBeAttached()
      })

      await test.step('APP-PAGES-PRELOAD-009: Preload only when media query matches', async () => {
        await expect(page.locator('link[rel="preload"][media="(max-width: 768px)"]')).toBeAttached()
      })

      await test.step('APP-PAGES-PRELOAD-010: Optimize First Contentful Paint (FCP)', async () => {
        // Total 8 unique preload resources in comprehensive config
        await expect(page.locator('link[rel="preload"]')).toHaveCount(8)
      })
    }
  )
})
