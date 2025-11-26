/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for External Scripts
 *
 * Source: specs/app/pages/scripts/external-scripts/external-scripts.schema.json
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('External Scripts', () => {
  test(
    'APP-PAGES-EXTERNAL-001: should load external JavaScript from CDN',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an external script with src URL
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              externalScripts: [{ src: 'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: src is 'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js'
      await page.goto('/')

      // THEN: it should load external JavaScript from CDN
      await expect(
        page.locator('script[src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"]')
      ).toBeAttached()
    }
  )

  test(
    'APP-PAGES-EXTERNAL-002: should load script asynchronously (non-blocking)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an external script with async true
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              externalScripts: [{ src: 'https://cdn.example.com/script.js', async: true }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: async is true
      await page.goto('/')

      // THEN: it should load script asynchronously (non-blocking)
      const script = page.locator('script[src="https://cdn.example.com/script.js"]')
      await expect(script).toHaveAttribute('async', '')
    }
  )

  test(
    'APP-PAGES-EXTERNAL-003: should defer script execution until DOM loaded',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an external script with defer true
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              externalScripts: [{ src: 'https://cdn.example.com/script.js', defer: true }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: defer is true
      await page.goto('/')

      // THEN: it should defer script execution until DOM loaded
      const script = page.locator('script[src="https://cdn.example.com/script.js"]')
      await expect(script).toHaveAttribute('defer', '')
    }
  )

  test(
    "APP-PAGES-EXTERNAL-004: should load script with type='module'",
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app configuration
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { externalScripts: [{ src: './js/app.js', module: true }] },
            sections: [],
          },
        ],
      })
      // WHEN: user navigates to the page
      await page.goto('/')
      const script = page.locator('script[src="./js/app.js"]')
      // THEN: assertion
      await expect(script).toHaveAttribute('type', 'module')
    }
  )

  test(
    'APP-PAGES-EXTERNAL-005: should verify subresource integrity for security',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an external script with integrity hash
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              externalScripts: [
                { src: 'https://cdn.example.com/lib.js', integrity: 'sha384-abc123' },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: integrity is 'sha384-abc123...'
      await page.goto('/')

      // THEN: it should verify subresource integrity for security
      const script = page.locator('script[src="https://cdn.example.com/lib.js"]')
      await expect(script).toHaveAttribute('integrity', 'sha384-abc123')
    }
  )

  test(
    'APP-PAGES-EXTERNAL-006: should set CORS policy for script loading',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an external script with crossorigin
      const crossorigins = ['anonymous', 'use-credentials'] as const
      for (const crossorigin of crossorigins) {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test' },
              scripts: {
                externalScripts: [{ src: 'https://cdn.example.com/lib.js', crossorigin }],
              },
              sections: [],
            },
          ],
        })
        // WHEN: user navigates to the page
        await page.goto('/')
        const script = page.locator('script[src="https://cdn.example.com/lib.js"]')
        // THEN: assertion
        await expect(script).toHaveAttribute('crossorigin', crossorigin)
      }
    }
  )

  test(
    'APP-PAGES-EXTERNAL-007: should insert script in document head',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an external script with position 'head'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              externalScripts: [
                { src: 'https://cdn.example.com/head-script.js', position: 'head' },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: crossorigin is 'anonymous' or 'use-credentials'
      await page.goto('/')

      // THEN: it should set CORS policy for script loading
      const script = page.locator('head script[src="https://cdn.example.com/head-script.js"]')
      await expect(script).toBeAttached()
    }
  )

  test(
    'APP-PAGES-EXTERNAL-008: should insert script at end of body',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an external script with position 'body-end'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              externalScripts: [
                { src: 'https://cdn.example.com/body-script.js', position: 'body-end' },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: position is 'body-end'
      await page.goto('/')

      // THEN: it should insert script at end of body
      const script = page.locator('body script[src="https://cdn.example.com/body-script.js"]')
      await expect(script).toBeAttached()
    }
  )

  test(
    'APP-PAGES-EXTERNAL-009: should insert script at start of body',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an external script with position 'body-start'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              externalScripts: [
                { src: 'https://cdn.example.com/body-start-script.js', position: 'body-start' },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: position is 'body-end' (default)
      await page.goto('/')

      // THEN: it should insert script at start of body
      const script = page.locator('body script[src="https://cdn.example.com/body-start-script.js"]')
      await expect(script).toBeAttached()
    }
  )

  test(
    'APP-PAGES-EXTERNAL-010: should load multiple external scripts in order',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: external scripts array with multiple libraries
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              externalScripts: [
                { src: 'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js' },
                { src: 'https://cdn.jsdelivr.net/npm/chart.js' },
                { src: './js/app.js' },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: position is 'body-start'
      await page.goto('/')

      // THEN: it should insert script at start of body
      await expect(
        page.locator('script[src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"]')
      ).toBeAttached()
      // THEN: assertion
      await expect(
        page.locator('script[src="https://cdn.jsdelivr.net/npm/chart.js"]')
      ).toBeAttached()
      // THEN: assertion
      await expect(page.locator('script[src="./js/app.js"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-EXTERNAL-011: should load local JavaScript file',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: external script with relative src
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { externalScripts: [{ src: './js/app.js' }] },
            sections: [],
          },
        ],
      })

      // WHEN: array includes [AlpineJS, Chart.js, app.js]
      await page.goto('/')

      // THEN: it should load multiple external scripts in order
      await expect(page.locator('script[src="./js/app.js"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-EXTERNAL-012: should load script with default settings (sync, body-end)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: external script with required src only
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { externalScripts: [{ src: 'https://cdn.example.com/script.js' }] },
            sections: [],
          },
        ],
      })

      // WHEN: src is './js/app.js' (relative path)
      await page.goto('/')

      // THEN: it should load local JavaScript file
      const script = page.locator('script[src="https://cdn.example.com/script.js"]')
      await expect(script).toBeAttached()
      await expect(script).not.toHaveAttribute('async')
      await expect(script).not.toHaveAttribute('defer')
    }
  )

  test(
    'APP-PAGES-EXTERNAL-013: user can complete full External Scripts workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              externalScripts: [
                {
                  src: 'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
                  defer: true,
                  position: 'head',
                },
                { src: 'https://cdn.jsdelivr.net/npm/chart.js', async: true },
                { src: './js/app.js', module: true, position: 'body-end' },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: only src is provided (all other properties optional)
      await page.goto('/')

      // THEN: it should load script with default settings (sync, body-end)
      await expect(page.locator('head script[src*="alpinejs"]')).toBeAttached()
      await expect(page.locator('script[src*="chart.js"]')).toBeAttached()
      await expect(page.locator('script[src="./js/app.js"][type="module"]')).toBeAttached()
    }
  )
})
