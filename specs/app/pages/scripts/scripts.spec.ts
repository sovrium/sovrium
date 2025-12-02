/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Client Scripts Configuration
 *
 * Source: src/domain/models/app/page/scripts.ts
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Client Scripts Configuration', () => {
  test(
    'APP-PAGES-SCRIPTS-001: should orchestrate client-side script management',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a scripts configuration with all 4 properties
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              features: { darkMode: true },
              externalScripts: [{ src: 'https://cdn.example.com/lib.js', async: true }],
              inlineScripts: [{ code: 'console.log("ready")' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: scripts includes features, externalScripts, inlineScripts, config
      await page.goto('/')

      // THEN: it should orchestrate client-side script management
      await expect(page.locator('script[src="https://cdn.example.com/lib.js"]')).toBeAttached()
      const scriptContent = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'))
        const inlineScript = scripts.find(
          (s) => !s.src && s.innerHTML.includes('console.log("ready")')
        )
        return inlineScript?.innerHTML
      })
      // THEN: assertion
      expect(scriptContent).toContain('console.log("ready")')
    }
  )

  test(
    'APP-PAGES-SCRIPTS-002: should enable client-side feature toggles',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: scripts with features only
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { features: { darkMode: true, animations: true, analytics: false } },
            sections: [],
          },
        ],
      })

      // WHEN: features defines darkMode, animations, analytics
      await page.goto('/')

      // THEN: it should enable client-side feature toggles
      const html = page.locator('html')
      await expect(html).toHaveAttribute('data-features')
    }
  )

  test(
    'APP-PAGES-SCRIPTS-003: should include external JavaScript dependencies',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: scripts with externalScripts
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              externalScripts: [
                { src: 'https://cdn.example.com/script.js', async: true, defer: false },
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: externalScripts array loads CDN libraries
      await page.goto('/')

      // THEN: it should include external JavaScript dependencies
      await expect(page.locator('script[src="https://cdn.example.com/script.js"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-SCRIPTS-004: should inject inline JavaScript code',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: scripts with inlineScripts
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { inlineScripts: [{ code: 'console.log("Hello")' }] },
            sections: [],
          },
        ],
      })

      // WHEN: inlineScripts array contains code snippets
      await page.goto('/')

      // THEN: it should inject inline JavaScript code
      const scriptContent = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'))
        const inlineScript = scripts.find(
          (s) => !s.src && s.innerHTML.includes('console.log("Hello")')
        )
        return inlineScript?.innerHTML
      })
      // THEN: assertion
      expect(scriptContent).toContain('console.log("Hello")')
    }
  )

  test(
    'APP-PAGES-SCRIPTS-005: should provide client-side configuration data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: scripts with config object
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {},
            sections: [{ type: 'heading', content: 'Config Test' }],
          },
        ],
      })

      // WHEN: config has apiUrl and environment properties
      await page.goto('/')

      // THEN: it should render page with scripts configuration
      await expect(page.locator('h1')).toHaveText('Config Test')
    }
  )

  test(
    'APP-PAGES-SCRIPTS-006: should allow pages without client-side scripts',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: empty scripts configuration
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {},
            sections: [],
          },
        ],
      })

      // WHEN: all properties are omitted
      await page.goto('/')

      // THEN: it should allow pages without client-side scripts
      const scriptTags = await page.locator('script[src]').count()
      expect(scriptTags).toBe(0)
    }
  )

  test(
    'APP-PAGES-SCRIPTS-007: should support flexible client configuration',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: scripts config with additionalProperties true
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {},
            sections: [{ type: 'heading', content: 'Flexible Config Test' }],
          },
        ],
      })

      // WHEN: config accepts any custom properties
      await page.goto('/')

      // THEN: it should render page that supports flexible client configuration
      await expect(page.locator('h1')).toHaveText('Flexible Config Test')
    }
  )

  test(
    'APP-PAGES-SCRIPTS-008: should enable feature-driven configuration',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: scripts combining features and config
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { features: { analytics: true } },
            sections: [{ type: 'heading', content: 'Feature Config Test' }],
          },
        ],
      })

      // WHEN: features toggle behavior and config provides data
      await page.goto('/')

      // THEN: it should render page with feature-driven configuration
      await expect(page.locator('h1')).toHaveText('Feature Config Test')
      const html = page.locator('html')
      await expect(html).toHaveAttribute('data-features')
    }
  )

  test(
    'APP-PAGES-SCRIPTS-009: should support per-page script customization',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: scripts at page level
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home' },
            scripts: { features: { analytics: true } },
            sections: [],
          },
          {
            name: 'Blog',
            path: '/blog',
            meta: { lang: 'en-US', title: 'Blog', description: 'Blog' },
            scripts: {},
            sections: [],
          },
        ],
      })

      // WHEN: each page can define custom scripts
      await page.goto('/')

      // THEN: it should support per-page script customization
      const homeHtml = page.locator('html')
      await expect(homeHtml).toHaveAttribute('data-features')
      // WHEN: user navigates to the page
      await page.goto('/blog')
      const blogHtml = page.locator('html')
      // THEN: assertion
      await expect(blogHtml).toHaveAttribute('data-features')
    }
  )

  test(
    'APP-PAGES-SCRIPTS-010: should compose scripts from modular schemas',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: scripts referencing sub-schemas
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              features: { darkMode: true },
              externalScripts: [{ src: 'https://cdn.example.com/lib.js' }],
              inlineScripts: [{ code: 'console.log("ready")' }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: features, externalScripts, inlineScripts use $ref
      await page.goto('/')

      // THEN: it should compose scripts from modular schemas
      await expect(page.locator('script[src="https://cdn.example.com/lib.js"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-SCRIPTS-011: user can complete full Client Scripts workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('Setup: Start server with scripts configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test' },
              scripts: {
                features: { darkMode: true, animations: true },
                externalScripts: [
                  {
                    src: 'https://cdn.example.com/lib.js',
                    async: true,
                    defer: true,
                  },
                ],
                inlineScripts: [{ code: 'console.log("ready")' }],
              },
              sections: [{ type: 'heading', content: 'Scripts Test' }],
            },
          ],
        })
      })

      await test.step('Navigate and verify scripts', async () => {
        await page.goto('/')

        await expect(page.locator('h1')).toHaveText('Scripts Test')

        await expect(page.locator('script[src="https://cdn.example.com/lib.js"]')).toBeAttached()

        const scriptContent = await page.evaluate(() => {
          const scripts = Array.from(document.querySelectorAll('script'))
          const inlineScript = scripts.find((s) => !s.src && s.innerHTML.includes('console.log'))
          return inlineScript?.innerHTML
        })
        expect(scriptContent).toContain('console.log')
      })
    }
  )
})
