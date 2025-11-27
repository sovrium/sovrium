/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Feature Flags
 *
 * Source: src/domain/models/app/page/scripts.ts
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Feature Flags', () => {
  test(
    'APP-PAGES-FEATURES-001: should enable simple feature flag',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a feature with boolean value true
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { features: { darkMode: true } },
            sections: [],
          },
        ],
      })

      // WHEN: darkMode is true
      await page.goto('/')

      // THEN: it should enable simple feature flag
      const features = await page.evaluate(() => (window as any).FEATURES)
      expect(features?.darkMode).toBe(true)
    }
  )

  test(
    'APP-PAGES-FEATURES-002: should disable feature',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a feature with boolean value false
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { features: { cookieConsent: false } },
            sections: [],
          },
        ],
      })

      // WHEN: cookieConsent is false
      await page.goto('/')

      // THEN: it should disable feature
      const features = await page.evaluate(() => (window as any).FEATURES)
      expect(features?.cookieConsent).toBe(false)
    }
  )

  test(
    'APP-PAGES-FEATURES-003: should provide feature with configuration data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a feature with object config
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              features: {
                animations: { enabled: true },
              },
            },
            sections: [{ type: 'heading', content: 'Test Page' }],
          },
        ],
      })

      // WHEN: animations has enabled: true
      await page.goto('/')

      // THEN: it should render page with feature configuration
      await expect(page.locator('h1')).toHaveText('Test Page')
      const html = page.locator('html')
      await expect(html).toHaveAttribute('data-features')
    }
  )

  test(
    'APP-PAGES-FEATURES-004: should toggle feature via enabled boolean',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a feature config with enabled property
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { features: { liveChat: { enabled: true } } },
            sections: [],
          },
        ],
      })

      // WHEN: liveChat has enabled: true
      await page.goto('/')

      // THEN: it should toggle feature via enabled boolean
      const features = await page.evaluate(() => (window as any).FEATURES)
      expect(features?.liveChat?.enabled).toBe(true)
    }
  )

  test(
    'APP-PAGES-FEATURES-005: should pass configuration to feature implementation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a feature config with nested config object
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              features: {
                liveChat: { enabled: true },
              },
            },
            sections: [{ type: 'heading', content: 'Live Chat Page' }],
          },
        ],
      })

      // WHEN: liveChat feature is enabled
      await page.goto('/')

      // THEN: it should render page with live chat feature enabled
      await expect(page.locator('h1')).toHaveText('Live Chat Page')
      const html = page.locator('html')
      await expect(html).toHaveAttribute('data-features')
    }
  )

  test(
    'APP-PAGES-FEATURES-006: should validate camelCase naming convention',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: features with camelCase naming
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { features: { darkMode: true, liveChat: true, cookieConsent: false } },
            sections: [],
          },
        ],
      })

      // WHEN: feature names are darkMode, liveChat, cookieConsent
      await page.goto('/')

      // THEN: it should validate camelCase naming convention
      const features = await page.evaluate(() => (window as any).FEATURES)
      expect(features).toHaveProperty('darkMode')
      expect(features).toHaveProperty('liveChat')
      expect(features).toHaveProperty('cookieConsent')
    }
  )

  test(
    'APP-PAGES-FEATURES-007: should support both simple and complex feature definitions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: features with oneOf type (boolean or object)
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              features: {
                darkMode: true,
                animations: { enabled: true },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: feature can be true or { enabled: true }
      await page.goto('/')

      // THEN: it should support both simple and complex feature definitions
      const features = await page.evaluate(() => (window as any).FEATURES)
      expect(typeof features?.darkMode).toBe('boolean')
      expect(typeof features?.animations).toBe('object')
    }
  )

  test(
    'APP-PAGES-FEATURES-008: should support flexible feature configuration',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: feature config with additionalProperties true
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              features: {
                analytics: { enabled: true },
              },
            },
            sections: [{ type: 'heading', content: 'Analytics Page' }],
          },
        ],
      })

      // WHEN: config accepts any custom properties
      await page.goto('/')

      // THEN: it should render page with analytics feature enabled
      await expect(page.locator('h1')).toHaveText('Analytics Page')
      const html = page.locator('html')
      await expect(html).toHaveAttribute('data-features')
    }
  )

  test(
    'APP-PAGES-FEATURES-009: should enable/disable UI features dynamically',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: common feature flags (darkMode, animations, cookieConsent, liveChat)
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              features: {
                darkMode: true,
                animations: { enabled: true },
                cookieConsent: false,
                liveChat: { enabled: true },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: features control client-side behavior
      await page.goto('/')

      // THEN: it should enable/disable UI features dynamically
      const features = await page.evaluate(() => (window as any).FEATURES)
      expect(features?.darkMode).toBe(true)
      expect(features?.animations?.enabled).toBe(true)
      expect(features?.cookieConsent).toBe(false)
      expect(features?.liveChat?.enabled).toBe(true)
    }
  )

  test(
    'APP-PAGES-FEATURES-010: should provide runtime feature detection',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: features accessible in client JavaScript
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: { features: { darkMode: true, analytics: true } },
            sections: [],
          },
        ],
      })

      // WHEN: features are injected into page
      await page.goto('/')

      // THEN: it should provide runtime feature detection
      const hasFeatures = await page.evaluate(() => typeof (window as any).FEATURES === 'object')
      expect(hasFeatures).toBe(true)
    }
  )

  test(
    'APP-PAGES-FEATURES-011: user can complete full Feature Flags workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app configuration
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            scripts: {
              features: {
                darkMode: true,
                animations: { enabled: true },
                cookieConsent: false,
                liveChat: { enabled: true },
                analytics: { enabled: true },
              },
            },
            sections: [{ type: 'heading', content: 'Feature Flags Test' }],
          },
        ],
      })
      // WHEN: user navigates to the page
      await page.goto('/')

      // Verify page renders with feature flags configuration
      // THEN: assertion
      await expect(page.locator('h1')).toHaveText('Feature Flags Test')

      // Verify data-features attribute is set on html element
      const html = page.locator('html')
      await expect(html).toHaveAttribute('data-features')
    }
  )
})
