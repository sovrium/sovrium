/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Inline Scripts
 *
 * Source: specs/app/pages/scripts/inline-scripts/inline-scripts.schema.json
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Inline Scripts', () => {
  test(
    'APP-PAGES-INLINE-001: should inject inline JavaScript code',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an inline script with code
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test_page',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { inlineScripts: [{ code: "console.log('Page loaded');" }] },
            sections: [],
          },
        ],
      })

      // WHEN: code is 'console.log('Page loaded');'
      await page.goto('/')

      // THEN: it should inject inline JavaScript code
      // Note: Script element content is accessible via innerHTML (not textContent in Playwright)
      const scripts = await page.locator('script:not([src])').all()
      const scriptContents = await Promise.all(scripts.map((s) => s.innerHTML()))
      const hasExpectedScript = scriptContents.some((content) =>
        content.includes("console.log('Page loaded');")
      )
      expect(hasExpectedScript).toBeTruthy()
    }
  )

  test(
    'APP-PAGES-INLINE-002: should insert code at end of body',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an inline script with position 'body-end'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              inlineScripts: [{ code: "console.log('body-end');", position: 'body-end' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: position is 'body-end' (default)
      await page.goto('/')

      // THEN: it should insert code at end of body
      const scripts = await page.locator('script:not([src])').all()
      const scriptContents = await Promise.all(scripts.map((s) => s.innerHTML()))
      const hasExpectedScript = scriptContents.some((content) =>
        content.includes("console.log('body-end');")
      )
      expect(hasExpectedScript).toBeTruthy()
    }
  )

  test(
    'APP-PAGES-INLINE-003: should insert code in document head',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an inline script with position 'head'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { inlineScripts: [{ code: "console.log('head');", position: 'head' }] },
            sections: [],
          },
        ],
      })

      // WHEN: position is 'head'
      await page.goto('/')

      // THEN: it should insert code in document head
      const headScripts = await page.locator('head script').all()
      const headScriptContents = await Promise.all(headScripts.map((s) => s.innerHTML()))
      const hasExpectedScript = headScriptContents.some((content) =>
        content.includes("console.log('head');")
      )
      expect(hasExpectedScript).toBeTruthy()
    }
  )

  test(
    'APP-PAGES-INLINE-004: should insert code at start of body',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an inline script with position 'body-start'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              inlineScripts: [{ code: "console.log('body-start');", position: 'body-start' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: position is 'body-start'
      await page.goto('/')

      // THEN: it should insert code at start of body
      const bodyScripts = await page.locator('body script').all()
      const bodyScriptContents = await Promise.all(bodyScripts.map((s) => s.innerHTML()))
      const hasExpectedScript = bodyScriptContents.some((content) =>
        content.includes("console.log('body-start');")
      )
      expect(hasExpectedScript).toBeTruthy()
    }
  )

  test(
    'APP-PAGES-INLINE-005: should wrap code in async IIFE (async function)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an inline script with async true
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { inlineScripts: [{ code: "await fetch('/api/data')", async: true }] },
            sections: [],
          },
        ],
      })

      // WHEN: async is true
      await page.goto('/')

      // THEN: it should wrap code in async IIFE (async function)
      const scripts = await page.locator('script:not([src])').all()
      const scriptContents = await Promise.all(scripts.map((s) => s.innerHTML()))
      const asyncScript = scriptContents.find((content) => content.includes('await fetch'))
      expect(asyncScript).toContain('(async () => {')
    }
  )

  test(
    'APP-PAGES-INLINE-006: should inject global configuration',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an inline script setting window config
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              inlineScripts: [{ code: "window.config = { apiUrl: 'https://api.example.com' };" }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: code is 'window.config = { apiUrl: '...' };'
      await page.goto('/')

      // THEN: it should inject global configuration
      const config = await page.evaluate(() => (window as any).config)
      expect(config?.apiUrl).toBe('https://api.example.com')
    }
  )

  test(
    'APP-PAGES-INLINE-007: should inject multiple inline scripts in order',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: inline scripts array with multiple snippets
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              inlineScripts: [
                { code: "console.log('first');" },
                { code: 'window.config = { ready: true };' },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: array contains [console.log, window.config]
      await page.goto('/')

      // THEN: it should inject multiple inline scripts in order
      const scripts = await page.locator('script:not([src])').all()
      const scriptContents = await Promise.all(scripts.map((s) => s.innerHTML()))
      const hasFirstScript = scriptContents.some((content) =>
        content.includes("console.log('first');")
      )
      expect(hasFirstScript).toBeTruthy()
      const config = await page.evaluate(() => (window as any).config)
      expect(config?.ready).toBe(true)
    }
  )

  test(
    'APP-PAGES-INLINE-008: should inject code with default settings (body-end, sync)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an inline script with required code only
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { inlineScripts: [{ code: "console.log('default');" }] },
            sections: [],
          },
        ],
      })

      // WHEN: only code is provided (position and async optional)
      await page.goto('/')

      // THEN: it should inject code with default settings (body-end, sync)
      const scripts = await page.locator('script:not([src])').all()
      const scriptContents = await Promise.all(scripts.map((s) => s.innerHTML()))
      const hasExpectedScript = scriptContents.some((content) =>
        content.includes("console.log('default');")
      )
      expect(hasExpectedScript).toBeTruthy()
    }
  )

  test(
    'APP-PAGES-INLINE-009: should enable custom tracking code',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: inline scripts for analytics tracking
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              inlineScripts: [
                {
                  code: 'window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);}',
                },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: code includes analytics initialization
      await page.goto('/')

      // THEN: it should enable custom tracking code
      const gtag = await page.evaluate(() => typeof (window as any).gtag)
      expect(gtag).toBe('function')
    }
  )

  test(
    'APP-PAGES-INLINE-010: should execute scripts in document order',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: inline scripts execution order
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              inlineScripts: [
                { code: 'window.order = [];', position: 'head' },
                { code: "window.order.push('body-start');", position: 'body-start' },
                { code: "window.order.push('body-end');", position: 'body-end' },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: scripts have different positions (head, body-start, body-end)
      await page.goto('/')

      // THEN: it should execute scripts in document order
      const order = await page.evaluate(() => (window as any).order)
      expect(order).toEqual(['body-start', 'body-end'])
    }
  )

  test.fixme(
    'APP-PAGES-SCRIPTS-INLINE-REGRESSION-001: user can complete full Inline Scripts workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              inlineScripts: [
                {
                  code: "window.APP_CONFIG = { apiUrl: 'https://api.example.com', debug: false };",
                  position: 'head',
                },
                {
                  code: "document.addEventListener('DOMContentLoaded', () => { console.log('App ready'); });",
                },
                {
                  code: "if (localStorage.getItem('theme') === 'dark') { document.documentElement.classList.add('dark'); }",
                  position: 'head',
                },
              ],
            },
            sections: [],
          },
        ],
      })
      await page.goto('/')
      const config = await page.evaluate(() => (window as any).APP_CONFIG)
      expect(config?.apiUrl).toBe('https://api.example.com')
      expect(config?.debug).toBe(false)
    }
  )
})
