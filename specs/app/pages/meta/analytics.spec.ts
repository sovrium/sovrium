/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

declare global {
  interface Window {
    dataLayer: unknown[]
  }
}

/**
 * E2E Tests for Analytics Configuration
 *
 * Source: src/domain/models/app/page/meta.ts
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Analytics Configuration', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-ANALYTICS-001: should support multiple analytics providers',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: analytics with providers array
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              analytics: {
                providers: [
                  { name: 'plausible', enabled: true },
                  { name: 'google', enabled: true },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: providers contains analytics configurations
      await page.goto('/')

      // THEN: it should support multiple analytics providers
      await expect(page.locator('[data-testid="analytics-plausible"]')).toBeAttached()
      await expect(page.locator('[data-testid="analytics-google"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-ANALYTICS-002: should support 6 analytics providers',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: analytics provider with name enum
      const providers = ['google', 'plausible', 'matomo', 'fathom', 'posthog', 'mixpanel']
      for (const provider of providers) {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Home',
              path: '/',
              meta: {
                lang: 'en-US',
                title: 'Test',
                description: 'Test',
                analytics: { providers: [{ name: provider, enabled: true }] },
              },
              sections: [],
            },
          ],
        })
        // WHEN: user navigates to the page
        await page.goto('/')
        // THEN: assertion
        await expect(page.locator(`[data-testid="analytics-${provider}"]`)).toBeAttached()
      }
    }
  )

  test(
    'APP-PAGES-ANALYTICS-003: should allow enabling/disabling provider',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: analytics provider with enabled toggle
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              analytics: {
                providers: [
                  { name: 'google', enabled: true },
                  { name: 'plausible', enabled: false },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: name is one of: google, plausible, matomo, fathom, posthog, mixpanel
      await page.goto('/')

      // THEN: it should support 6 analytics providers
      await expect(page.locator('[data-testid="analytics-google"]')).toBeAttached()
      await expect(page.locator('[data-testid="analytics-plausible"]')).toBeHidden()
    }
  )

  test(
    'APP-PAGES-ANALYTICS-004: should load provider scripts',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: analytics provider with scripts array
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              analytics: {
                providers: [
                  {
                    name: 'plausible',
                    scripts: [{ src: 'https://plausible.io/js/script.js', async: true }],
                  },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: enabled is true or false
      await page.goto('/')

      // THEN: it should allow enabling/disabling provider
      await expect(page.locator('script[src="https://plausible.io/js/script.js"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-ANALYTICS-005: should load script asynchronously',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: analytics provider script with async
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              analytics: {
                providers: [
                  {
                    name: 'plausible',
                    scripts: [{ src: 'https://plausible.io/js/script.js', async: true }],
                  },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: scripts contains external script configurations
      await page.goto('/')

      // THEN: it should load provider scripts
      const script = page.locator('script[src="https://plausible.io/js/script.js"]')
      await expect(script).toHaveAttribute('async', '')
    }
  )

  test(
    'APP-PAGES-ANALYTICS-006: should execute provider initialization code',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: analytics provider with initScript
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              analytics: {
                providers: [
                  {
                    name: 'google',
                    initScript:
                      "window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-XXXXX');",
                  },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: async is true for non-blocking load
      await page.goto('/')

      // THEN: it should load script asynchronously
      const dataLayer = await page.evaluate(() => window.dataLayer)
      expect(dataLayer).toBeDefined()
    }
  )

  test(
    'APP-PAGES-ANALYTICS-007: should optimize DNS resolution for provider',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: analytics provider with dnsPrefetch
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              analytics: {
                providers: [{ name: 'plausible', dnsPrefetch: 'https://plausible.io' }],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: initScript contains inline JavaScript for initialization
      await page.goto('/')

      // THEN: it should execute provider initialization code
      await expect(
        page.locator('link[rel="dns-prefetch"][href="https://plausible.io"]')
      ).toBeAttached()
    }
  )

  test(
    'APP-PAGES-ANALYTICS-008: should pass configuration to provider',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: analytics provider with config object
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
              analytics: {
                providers: [
                  {
                    name: 'google',
                    enabled: true,
                    scripts: [
                      { src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXX', async: true },
                    ],
                  },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: provider config includes tracking ID in script URL
      await page.goto('/')

      // THEN: it should pass configuration to provider via script URL
      const script = page.locator('script[src*="googletagmanager.com"][src*="G-XXXXX"]')
      await expect(script).toBeAttached()
    }
  )

  test(
    'APP-PAGES-ANALYTICS-009: should configure Google Analytics',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: analytics with Google Analytics provider
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
              analytics: {
                providers: [
                  {
                    name: 'google',
                    enabled: true,
                    scripts: [
                      {
                        src: 'https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ',
                        async: true,
                      },
                    ],
                  },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: config contains provider-specific settings
      await page.goto('/')

      // THEN: it should pass configuration to provider
      await expect(page.locator('script[src*="googletagmanager.com"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-ANALYTICS-010: should configure privacy-friendly Plausible analytics',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: analytics with Plausible provider
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              analytics: {
                providers: [
                  {
                    name: 'plausible',
                    enabled: true,
                    scripts: [{ src: 'https://plausible.io/js/script.js', async: true }],
                  },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: name is 'google' with tracking ID in config
      await page.goto('/')

      // THEN: it should configure Google Analytics
      await expect(page.locator('script[src="https://plausible.io/js/script.js"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-ANALYTICS-011: should support multi-provider analytics',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: analytics with multiple providers
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              analytics: {
                providers: [
                  {
                    name: 'plausible',
                    enabled: true,
                    scripts: [{ src: 'https://plausible.io/js/script.js', async: true }],
                  },
                  {
                    name: 'google',
                    enabled: true,
                    scripts: [
                      { src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXX', async: true },
                    ],
                  },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: name is 'plausible' with domain config
      await page.goto('/')

      // THEN: it should configure privacy-friendly Plausible analytics
      await expect(page.locator('script[src="https://plausible.io/js/script.js"]')).toBeAttached()
      await expect(page.locator('script[src*="googletagmanager.com"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-ANALYTICS-012: should configure event tracking and feature flags',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: analytics provider with PostHog
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
              analytics: {
                providers: [
                  {
                    name: 'posthog',
                    enabled: true,
                    scripts: [{ src: 'https://app.posthog.com/static/array.js', async: true }],
                  },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: providers array contains [plausible, google]
      await page.goto('/')

      // THEN: it should support multi-provider analytics
      await expect(page.locator('script[src*="posthog.com"]')).toBeAttached()
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-ANALYTICS-013: user can complete full analytics workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app configuration
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
              analytics: {
                providers: [
                  {
                    name: 'plausible',
                    enabled: true,
                    scripts: [{ src: 'https://plausible.io/js/script.js', async: true }],
                    dnsPrefetch: 'https://plausible.io',
                  },
                  {
                    name: 'google',
                    enabled: true,
                    scripts: [
                      { src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXX', async: true },
                    ],
                    dnsPrefetch: 'https://www.googletagmanager.com',
                  },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: user navigates to the page
      await page.goto('/')

      // Verify DNS prefetch
      // THEN: assertion
      await expect(
        page.locator('link[rel="dns-prefetch"][href="https://plausible.io"]')
      ).toBeAttached()
      await expect(
        page.locator('link[rel="dns-prefetch"][href="https://www.googletagmanager.com"]')
      ).toBeAttached()

      // Verify scripts loaded
      await expect(page.locator('script[src="https://plausible.io/js/script.js"]')).toBeAttached()
      await expect(page.locator('script[src*="googletagmanager.com"]')).toBeAttached()

      // Verify async loading
      await expect(page.locator('script[src="https://plausible.io/js/script.js"]')).toHaveAttribute(
        'async',
        ''
      )
    }
  )
})
