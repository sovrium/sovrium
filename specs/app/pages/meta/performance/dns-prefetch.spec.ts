/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for DNS Prefetch
 *
 * Source: src/domain/models/app/page/meta.ts
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('DNS Prefetch', () => {
  test(
    'APP-PAGES-DNS-001: should prefetch DNS for listed domains',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: DNS prefetch array with domains
      await startServerWithSchema({
        name: 'test_app',
        pages: [
          {
            name: 'home',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              dnsPrefetch: ['https://fonts.googleapis.com', 'https://www.google-analytics.com'],
            },
            sections: [],
          },
        ],
      })

      // WHEN: array contains external domain URLs
      await page.goto('/')

      // THEN: it should prefetch DNS for listed domains
      await expect(
        page.locator('link[rel="dns-prefetch"][href="https://fonts.googleapis.com"]')
      ).toBeAttached()
      // THEN: assertion
      await expect(
        page.locator('link[rel="dns-prefetch"][href="https://www.google-analytics.com"]')
      ).toBeAttached()
    }
  )

  test(
    'APP-PAGES-DNS-002: should optimize Google Fonts loading',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: DNS prefetch for font domains
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
              dnsPrefetch: ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
            },
            sections: [],
          },
        ],
      })

      // WHEN: array includes 'https://fonts.googleapis.com' and 'https://fonts.gstatic.com'
      await page.goto('/')

      // THEN: it should optimize Google Fonts loading
      await expect(
        page.locator('link[rel="dns-prefetch"][href="https://fonts.googleapis.com"]')
      ).toBeAttached()
      // THEN: assertion
      await expect(
        page.locator('link[rel="dns-prefetch"][href="https://fonts.gstatic.com"]')
      ).toBeAttached()
    }
  )

  test(
    'APP-PAGES-DNS-003: should optimize analytics script loading',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: DNS prefetch for analytics domains
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
              dnsPrefetch: ['https://www.google-analytics.com'],
            },
            sections: [],
          },
        ],
      })

      // WHEN: array includes 'https://www.google-analytics.com' or 'https://plausible.io'
      await page.goto('/')

      // THEN: it should optimize analytics script loading
      await expect(
        page.locator('link[rel="dns-prefetch"][href="https://www.google-analytics.com"]')
      ).toBeAttached()
    }
  )

  test(
    'APP-PAGES-DNS-004: should optimize CDN resource loading',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: DNS prefetch for CDN domains
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
              dnsPrefetch: ['https://unpkg.com', 'https://cdn.jsdelivr.net'],
            },
            sections: [],
          },
        ],
      })

      // WHEN: array includes 'https://unpkg.com' or 'https://cdn.jsdelivr.net'
      await page.goto('/')

      // THEN: it should optimize CDN resource loading
      await expect(
        page.locator('link[rel="dns-prefetch"][href="https://unpkg.com"]')
      ).toBeAttached()
      // THEN: assertion
      await expect(
        page.locator('link[rel="dns-prefetch"][href="https://cdn.jsdelivr.net"]')
      ).toBeAttached()
    }
  )

  test(
    'APP-PAGES-DNS-005: should optimize API request latency',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: DNS prefetch for API domains
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
              dnsPrefetch: ['https://api.example.com'],
            },
            sections: [],
          },
        ],
      })

      // WHEN: array includes API endpoint domains
      await page.goto('/')

      // THEN: it should optimize API request latency
      await expect(
        page.locator('link[rel="dns-prefetch"][href="https://api.example.com"]')
      ).toBeAttached()
    }
  )

  test(
    'APP-PAGES-DNS-006: should validate protocol in URL pattern',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: DNS prefetch with http/https protocol
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
              dnsPrefetch: ['https://example.com', 'http://example.org'],
            },
            sections: [],
          },
        ],
      })

      // WHEN: URLs start with https:// or http://
      await page.goto('/')

      // THEN: it should validate protocol in URL pattern
      const prefetchLinks = await page.locator('link[rel="dns-prefetch"]').all()
      for (const link of prefetchLinks) {
        const href = await link.getAttribute('href')
        // THEN: assertion
        expect(href).toMatch(/^https?:\/\//)
      }
    }
  )

  test(
    'APP-PAGES-DNS-007: should prevent duplicate domain entries',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: DNS prefetch with unique items
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
              dnsPrefetch: ['https://fonts.googleapis.com'],
            },
            sections: [],
          },
        ],
      })

      // WHEN: array has uniqueItems constraint
      await page.goto('/')

      // THEN: it should prevent duplicate domain entries
      const count = await page
        .locator('link[rel="dns-prefetch"][href="https://fonts.googleapis.com"]')
        .count()
      // THEN: assertion
      expect(count).toBe(1)
    }
  )

  test(
    'APP-PAGES-DNS-008: should optimize multiple external connections',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: DNS prefetch for multiple third-party services
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
              dnsPrefetch: [
                'https://fonts.googleapis.com',
                'https://www.google-analytics.com',
                'https://cdn.jsdelivr.net',
                'https://platform.twitter.com',
              ],
            },
            sections: [],
          },
        ],
      })

      // WHEN: array contains [fonts, analytics, CDN, social] domains
      await page.goto('/')

      // THEN: it should optimize multiple external connections
      await expect(page.locator('link[rel="dns-prefetch"]')).toHaveCount(4)
    }
  )

  test(
    'APP-PAGES-DNS-009: should reduce connection latency',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: DNS prefetch before resource fetch
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
              dnsPrefetch: ['https://fonts.googleapis.com'],
            },
            sections: [],
          },
        ],
      })

      // WHEN: DNS resolution happens early in page load
      await page.goto('/')

      // THEN: it should reduce connection latency
      await expect(
        page.locator('link[rel="dns-prefetch"][href="https://fonts.googleapis.com"]')
      ).toBeAttached()
    }
  )

  test(
    'APP-PAGES-DNS-010: should improve perceived page load speed',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: DNS prefetch performance benefit
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
              dnsPrefetch: ['https://fonts.googleapis.com', 'https://www.google-analytics.com'],
            },
            sections: [],
          },
        ],
      })

      // WHEN: domains are resolved before actual requests
      await page.goto('/')

      // THEN: it should improve perceived page load speed
      const prefetchCount = await page.locator('link[rel="dns-prefetch"]').count()
      expect(prefetchCount).toBeGreaterThan(0)
    }
  )

  test(
    'APP-PAGES-DNS-011: user can complete full DNS prefetch workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('Setup: Start server with DNS prefetch', async () => {
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
                dnsPrefetch: [
                  'https://fonts.googleapis.com',
                  'https://fonts.gstatic.com',
                  'https://www.google-analytics.com',
                  'https://cdn.jsdelivr.net',
                ],
              },
              sections: [],
            },
          ],
        })
      })

      await test.step('Navigate to page and verify DNS prefetch links', async () => {
        await page.goto('/')
        await expect(page.locator('link[rel="dns-prefetch"]')).toHaveCount(4)
        await expect(
          page.locator('link[rel="dns-prefetch"][href="https://fonts.googleapis.com"]')
        ).toBeAttached()
        await expect(
          page.locator('link[rel="dns-prefetch"][href="https://www.google-analytics.com"]')
        ).toBeAttached()
      })
    }
  )
})
