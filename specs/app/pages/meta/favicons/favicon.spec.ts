/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Favicon
 *
 * Source: specs/app/pages/meta/favicons/favicon.schema.json
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Favicon', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-FAVICON-001: should reference default favicon file',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a favicon path string
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test_page',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              favicon: './public/favicon.ico',
            },
            sections: [],
          },
        ],
      })

      // WHEN: value is './public/favicon.ico'
      await page.goto('/')

      // THEN: it should reference default favicon file
      await expect(page.locator('link[rel="icon"][href="./public/favicon.ico"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-FAVICON-002: should support legacy ICO format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a favicon with .ico extension
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test', favicon: './favicon.ico' },
            sections: [],
          },
        ],
      })

      // WHEN: path ends with .ico
      await page.goto('/')

      // THEN: it should support legacy ICO format
      const href = await page.locator('link[rel="icon"]').getAttribute('href')
      expect(href).toMatch(/\.ico$/)
    }
  )

  test(
    'APP-PAGES-FAVICON-003: should support PNG format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a favicon with .png extension
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test', favicon: './favicon.png' },
            sections: [],
          },
        ],
      })

      // WHEN: path ends with .png
      await page.goto('/')

      // THEN: it should support PNG format
      const href = await page.locator('link[rel="icon"]').getAttribute('href')
      expect(href).toMatch(/\.png$/)
    }
  )

  test(
    'APP-PAGES-FAVICON-004: should support modern SVG format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a favicon with .svg extension
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
              favicon: './assets/favicon.svg',
            },
            sections: [],
          },
        ],
      })

      // WHEN: path ends with .svg
      await page.goto('/')

      // THEN: it should support modern SVG format
      const href = await page.locator('link[rel="icon"]').getAttribute('href')
      expect(href).toMatch(/\.svg$/)
    }
  )

  test(
    'APP-PAGES-FAVICON-005: should use relative file paths',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a favicon path starting with ./
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
              favicon: './public/favicon.ico',
            },
            sections: [],
          },
        ],
      })

      // WHEN: pattern enforces relative path prefix
      await page.goto('/')

      // THEN: it should use relative file paths
      const href = await page.locator('link[rel="icon"]').getAttribute('href')
      expect(href).toMatch(/^\.\//)
    }
  )

  test(
    'APP-PAGES-FAVICON-006: should enable quick favicon setup',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a simple favicon configuration
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test', favicon: './favicon.ico' },
            sections: [],
          },
        ],
      })

      // WHEN: single string path is provided
      await page.goto('/')

      // THEN: it should enable quick favicon setup
      await expect(page.locator('link[rel="icon"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-FAVICON-007: should provide site branding in tabs',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a favicon for browser tab
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test Page',
              description: 'Test',
              favicon: './favicon.ico',
            },
            sections: [],
          },
        ],
      })

      // WHEN: favicon is displayed in browser UI
      await page.goto('/')

      // THEN: it should provide site branding in tabs
      await expect(page.locator('link[rel="icon"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-FAVICON-008: should support both simple and complete configurations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a favicon versus favicons property
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test', favicon: './favicon.ico' },
            sections: [],
          },
        ],
      })

      // WHEN: favicon is simple string, favicons is array of objects
      await page.goto('/')

      // THEN: it should support both simple and complete configurations
      const iconCount = await page.locator('link[rel="icon"]').count()
      expect(iconCount).toBeGreaterThan(0)
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-META-FAVICONS-FAVICON-REGRESSION-001: user can complete full favicon workflow',
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
              title: 'Test',
              description: 'Test',
              favicon: './public/favicon.ico',
            },
            sections: [],
          },
        ],
      })

      await page.goto('/')

      // Verify favicon link
      const favicon = page.locator('link[rel="icon"]')
      await expect(favicon).toBeAttached()
      await expect(favicon).toHaveAttribute('href', './public/favicon.ico')
    }
  )
})
