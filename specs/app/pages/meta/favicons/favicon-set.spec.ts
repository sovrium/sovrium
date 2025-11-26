/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Favicon Set
 *
 * Source: specs/app/pages/meta/favicons/favicon-set.schema.json
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Favicon Set', () => {
  test(
    'APP-PAGES-FAVICONSET-001: should define browser icon',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a favicon with rel 'icon'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              favicons: [{ rel: 'icon', href: './favicon.png' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: rel is 'icon' for standard favicon
      await page.goto('/')

      // THEN: it should define browser icon
      await expect(page.locator('link[rel="icon"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-FAVICONSET-002: should define Apple touch icon',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a favicon with rel 'apple-touch-icon'
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
              favicons: [
                { rel: 'apple-touch-icon', sizes: '180x180', href: './apple-touch-icon.png' },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: rel is 'apple-touch-icon' for iOS devices
      await page.goto('/')

      // THEN: it should define Apple touch icon
      await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('sizes', '180x180')
    }
  )

  test(
    'APP-PAGES-FAVICONSET-003: should define Safari mask icon with color',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a favicon with rel 'mask-icon'
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
              favicons: [{ rel: 'mask-icon', href: './safari-pinned-tab.svg', color: '#FF5733' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: rel is 'mask-icon' for Safari pinned tabs
      await page.goto('/')

      // THEN: it should define Safari mask icon with color
      await expect(page.locator('link[rel="mask-icon"]')).toHaveAttribute('color', '#FF5733')
    }
  )

  test(
    'APP-PAGES-FAVICONSET-004: should specify icon dimensions for different contexts',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a favicon with sizes attribute
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
              favicons: [
                { rel: 'icon', type: 'image/png', sizes: '16x16', href: './favicon-16x16.png' },
                { rel: 'icon', type: 'image/png', sizes: '32x32', href: './favicon-32x32.png' },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: sizes is '16x16', '32x32', '180x180', or '192x192'
      await page.goto('/')

      // THEN: it should specify icon dimensions for different contexts
      await expect(page.locator('link[rel="icon"][sizes="16x16"]')).toBeAttached()
      await expect(page.locator('link[rel="icon"][sizes="32x32"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-FAVICONSET-005: should specify MIME type',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a favicon with type attribute
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
              favicons: [{ rel: 'icon', type: 'image/svg+xml', href: './icon.svg' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: type is 'image/png', 'image/x-icon', or 'image/svg+xml'
      await page.goto('/')

      // THEN: it should specify MIME type
      await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-FAVICONSET-006: should define Safari pinned tab color',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a favicon with color for mask-icon
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
              favicons: [{ rel: 'mask-icon', href: './safari-tab.svg', color: '#4285F4' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: color is hex value like '#FF5733'
      await page.goto('/')

      // THEN: it should define Safari pinned tab color
      const color = await page.locator('link[rel="mask-icon"]').getAttribute('color')
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  )

  test(
    'APP-PAGES-FAVICONSET-007: should provide comprehensive multi-device icon support',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a complete favicon set
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
              favicons: [
                { rel: 'icon', type: 'image/png', sizes: '16x16', href: './favicon-16x16.png' },
                { rel: 'icon', type: 'image/png', sizes: '32x32', href: './favicon-32x32.png' },
                { rel: 'apple-touch-icon', sizes: '180x180', href: './apple-touch-icon.png' },
                { rel: 'manifest', href: './site.webmanifest' },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: array contains icons for all devices (16x16, 32x32, 180x180, 192x192, 512x512, manifest)
      await page.goto('/')

      // THEN: it should provide comprehensive multi-device icon support
      await expect(page.locator('link[rel="icon"]')).toHaveCount(2)
      await expect(page.locator('link[rel="apple-touch-icon"]')).toBeAttached()
      await expect(page.locator('link[rel="manifest"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-FAVICONSET-008: user can complete full favicon set workflow',
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
              favicons: [
                { rel: 'icon', type: 'image/png', sizes: '16x16', href: './favicon-16x16.png' },
                { rel: 'icon', type: 'image/png', sizes: '32x32', href: './favicon-32x32.png' },
                { rel: 'apple-touch-icon', sizes: '180x180', href: './apple-touch-icon.png' },
                { rel: 'mask-icon', href: './safari-tab.svg', color: '#4285F4' },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: user navigates to the page
      await page.goto('/')

      // Verify all icon types
      // THEN: assertion
      await expect(page.locator('link[rel="icon"]')).toHaveCount(2)
      await expect(page.locator('link[rel="apple-touch-icon"]')).toBeAttached()
      await expect(page.locator('link[rel="mask-icon"]')).toBeAttached()
    }
  )
})
