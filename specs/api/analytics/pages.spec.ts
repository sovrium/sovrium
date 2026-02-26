/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Analytics Top Pages Query
 *
 * Source: specs/api/analytics/pages.spec.ts
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (7 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('GET /api/analytics/pages - Top Pages', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-ANALYTICS-PAGES-001: should return 200 with pages ranked by page views',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics enabled and page view data for multiple pages
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // Insert page views: / has 4, /about has 2, /pricing has 1
      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '3 hours'),
          ('hash_b', '/', 'Home', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '2 hours'),
          ('hash_c', '/', 'Home', 'desktop', 'Firefox', 'macOS', NOW() - INTERVAL '1 hour'),
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW()),
          ('hash_a', '/about', 'About', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '2 hours'),
          ('hash_b', '/about', 'About', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '1 hour'),
          ('hash_c', '/pricing', 'Pricing', 'desktop', 'Firefox', 'macOS', NOW())
      `)

      // WHEN: GET /api/analytics/pages?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/pages?from=${from}&to=${to}`)

      // THEN: Returns 200 with pages array ranked by pageViews
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('pages')
      expect(data).toHaveProperty('total')
      expect(data.pages.length).toBe(3)
      expect(data.pages[0].path).toBe('/')
      expect(data.pages[0].pageViews).toBe(4)
      expect(data.pages[1].path).toBe('/about')
      expect(data.pages[1].pageViews).toBe(2)
      expect(data.pages[2].path).toBe('/pricing')
      expect(data.pages[2].pageViews).toBe(1)
    }
  )

  test(
    'API-ANALYTICS-PAGES-002: should return 401 when user is not authenticated',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with analytics and auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      // WHEN: GET /api/analytics/pages without authentication
      const now = new Date()
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/pages?from=${from}&to=${to}`)

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-ANALYTICS-PAGES-003: should include path pageViews uniqueVisitors for each page',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with page view data
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('visitor_1', '/blog', 'Blog', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '1 hour'),
          ('visitor_1', '/blog', 'Blog', 'desktop', 'Chrome', 'Windows', NOW()),
          ('visitor_2', '/blog', 'Blog', 'mobile', 'Safari', 'iOS', NOW())
      `)

      // WHEN: GET /api/analytics/pages?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/pages?from=${from}&to=${to}`)

      // THEN: Each page object includes path, pageViews, uniqueVisitors
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.pages.length).toBeGreaterThanOrEqual(1)

      const blogPage = data.pages.find((p: any) => p.path === '/blog')
      expect(blogPage).toBeDefined()
      expect(blogPage.path).toBe('/blog')
      expect(blogPage.pageViews).toBe(3)
      expect(blogPage.uniqueVisitors).toBe(2)
    }
  )

  test.fixme(
    'API-ANALYTICS-PAGES-004: should sort pages by pageViews descending',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with page views for multiple pages
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // Insert varied view counts: /docs=5, /blog=3, /faq=1
      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('h1', '/docs', 'Docs', 'desktop', 'Chrome', 'Windows', NOW()),
          ('h2', '/docs', 'Docs', 'desktop', 'Chrome', 'Windows', NOW()),
          ('h3', '/docs', 'Docs', 'desktop', 'Chrome', 'Windows', NOW()),
          ('h4', '/docs', 'Docs', 'desktop', 'Chrome', 'Windows', NOW()),
          ('h5', '/docs', 'Docs', 'desktop', 'Chrome', 'Windows', NOW()),
          ('h1', '/blog', 'Blog', 'desktop', 'Chrome', 'Windows', NOW()),
          ('h2', '/blog', 'Blog', 'desktop', 'Chrome', 'Windows', NOW()),
          ('h3', '/blog', 'Blog', 'desktop', 'Chrome', 'Windows', NOW()),
          ('h1', '/faq', 'FAQ', 'desktop', 'Chrome', 'Windows', NOW())
      `)

      // WHEN: GET /api/analytics/pages?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/pages?from=${from}&to=${to}`)

      // THEN: Pages are sorted with highest pageViews first
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.pages.length).toBe(3)
      expect(data.pages[0].pageViews).toBeGreaterThanOrEqual(data.pages[1].pageViews)
      expect(data.pages[1].pageViews).toBeGreaterThanOrEqual(data.pages[2].pageViews)
      expect(data.pages[0].path).toBe('/docs')
      expect(data.pages[2].path).toBe('/faq')
    }
  )

  test(
    'API-ANALYTICS-PAGES-005: should return 400 when from parameter is missing',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with analytics and authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: GET /api/analytics/pages?to=...  (missing from)
      const to = new Date().toISOString()
      const response = await request.get(`/api/analytics/pages?to=${to}`)

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)
    }
  )

  test(
    'API-ANALYTICS-PAGES-006: should return empty array when no page views exist',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with analytics but no page view data
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: GET /api/analytics/pages?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/pages?from=${from}&to=${to}`)

      // THEN: Returns empty pages array with total 0
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.pages).toHaveLength(0)
      expect(data.total).toBe(0)
    }
  )

  test.fixme(
    'API-ANALYTICS-PAGES-007: should support filtering by date range',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with page views across different dates
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('hash_a', '/old-page', 'Old', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '30 days'),
          ('hash_b', '/recent-page', 'Recent', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '2 days'),
          ('hash_c', '/today-page', 'Today', 'desktop', 'Chrome', 'Windows', NOW())
      `)

      // WHEN: GET /api/analytics/pages?from=...&to=... (narrow range: last 7 days)
      const now = new Date()
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/pages?from=${from}&to=${to}`)

      // THEN: Only pages with views in the date range are returned
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.pages.length).toBe(2)
      const paths = data.pages.map((p: any) => p.path)
      expect(paths).toContain('/recent-page')
      expect(paths).toContain('/today-page')
      expect(paths).not.toContain('/old-page')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-ANALYTICS-PAGES-REGRESSION: top pages query works end-to-end',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics and auth
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      const now = new Date()
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()

      await test.step('API-ANALYTICS-PAGES-002: Return 401 when not authenticated', async () => {
        const response = await request.get(`/api/analytics/pages?from=${from}&to=${to}`)
        expect(response.status()).toBe(401)
      })

      await createAuthenticatedUser()

      await test.step('API-ANALYTICS-PAGES-006: Return empty array when no data', async () => {
        const response = await request.get(`/api/analytics/pages?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.pages).toHaveLength(0)
        expect(data.total).toBe(0)
      })

      // Insert page view data
      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '2 hours'),
          ('hash_b', '/', 'Home', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '1 hour'),
          ('hash_c', '/', 'Home', 'desktop', 'Firefox', 'macOS', NOW()),
          ('hash_a', '/about', 'About', 'desktop', 'Chrome', 'Windows', NOW()),
          ('hash_b', '/pricing', 'Pricing', 'mobile', 'Safari', 'iOS', NOW())
      `)

      await test.step('API-ANALYTICS-PAGES-001: Return 200 with pages ranked by views', async () => {
        const response = await request.get(`/api/analytics/pages?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.pages.length).toBe(3)
        expect(data.pages[0].path).toBe('/')
        expect(data.pages[0].pageViews).toBe(3)
      })

      await test.step('API-ANALYTICS-PAGES-004: Pages sorted by views descending', async () => {
        const response = await request.get(`/api/analytics/pages?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.pages[0].pageViews).toBeGreaterThanOrEqual(data.pages[1].pageViews)
        expect(data.pages[1].pageViews).toBeGreaterThanOrEqual(data.pages[2].pageViews)
      })

      await test.step('API-ANALYTICS-PAGES-005: Return 400 when from is missing', async () => {
        const response = await request.get(`/api/analytics/pages?to=${to}`)
        expect(response.status()).toBe(400)
      })

      // --- Steps skipped: redundant field checks or date range variants ---
      // API-ANALYTICS-PAGES-003: Path/pageViews/uniqueVisitors fields (similar to 001 — covered by @spec)
      // API-ANALYTICS-PAGES-007: Date range filtering (covered by @spec)
    }
  )
})
