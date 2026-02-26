/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Analytics Overview Query
 *
 * Source: specs/api/analytics/overview.spec.ts
 * Domain: api
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (10 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('GET /api/analytics/overview - Analytics Overview', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-ANALYTICS-OVERVIEW-001: should return 200 with summary and time series data',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics enabled and page view data
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // Insert page view data across multiple days
      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '2 days'),
          ('hash_b', '/about', 'About', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '1 day'),
          ('hash_a', '/contact', 'Contact', 'desktop', 'Chrome', 'Windows', NOW()),
          ('hash_c', '/', 'Home', 'desktop', 'Firefox', 'macOS', NOW())
      `)

      // WHEN: GET /api/analytics/overview?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/overview?from=${from}&to=${to}`)

      // THEN: Returns 200 with summary and timeSeries arrays
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('summary')
      expect(data).toHaveProperty('timeSeries')
      expect(data.summary).toHaveProperty('pageViews')
      expect(data.summary).toHaveProperty('uniqueVisitors')
      expect(data.summary).toHaveProperty('sessions')
      expect(data.summary.pageViews).toBe(4)
      expect(Array.isArray(data.timeSeries)).toBe(true)
    }
  )

  test(
    'API-ANALYTICS-OVERVIEW-002: should return 401 when user is not authenticated',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with analytics and auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      // WHEN: GET /api/analytics/overview without authentication
      const now = new Date()
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/overview?from=${from}&to=${to}`)

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-ANALYTICS-OVERVIEW-003: should include pageViews uniqueVisitors sessions in summary',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with known page view data
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // Insert known data: 5 page views, 3 unique visitors
      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('visitor_1', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '1 hour'),
          ('visitor_1', '/about', 'About', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '50 minutes'),
          ('visitor_2', '/', 'Home', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '30 minutes'),
          ('visitor_2', '/pricing', 'Pricing', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '20 minutes'),
          ('visitor_3', '/', 'Home', 'desktop', 'Firefox', 'macOS', NOW())
      `)

      // WHEN: GET /api/analytics/overview?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/overview?from=${from}&to=${to}`)

      // THEN: Summary contains pageViews, uniqueVisitors, sessions with correct counts
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.summary.pageViews).toBe(5)
      expect(data.summary.uniqueVisitors).toBe(3)
      expect(data.summary.sessions).toBeGreaterThanOrEqual(3)
    }
  )

  test.fixme(
    'API-ANALYTICS-OVERVIEW-004: should respect granularity=hour in time series',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with page views across multiple hours
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '3 hours'),
          ('hash_b', '/', 'Home', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '2 hours'),
          ('hash_c', '/', 'Home', 'desktop', 'Firefox', 'macOS', NOW() - INTERVAL '1 hour'),
          ('hash_d', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW())
      `)

      // WHEN: GET /api/analytics/overview?from=...&to=...&granularity=hour
      const now = new Date()
      const from = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(
        `/api/analytics/overview?from=${from}&to=${to}&granularity=hour`
      )

      // THEN: Time series has hourly data points
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data.timeSeries)).toBe(true)
      expect(data.timeSeries.length).toBeGreaterThanOrEqual(4)

      // Each point should have period, pageViews, uniqueVisitors, sessions
      for (const point of data.timeSeries) {
        expect(point).toHaveProperty('period')
        expect(point).toHaveProperty('pageViews')
        expect(point).toHaveProperty('uniqueVisitors')
        expect(point).toHaveProperty('sessions')
      }
    }
  )

  test.fixme(
    'API-ANALYTICS-OVERVIEW-005: should respect granularity=day in time series',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with page views across multiple days
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '3 days'),
          ('hash_b', '/', 'Home', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '2 days'),
          ('hash_c', '/', 'Home', 'desktop', 'Firefox', 'macOS', NOW() - INTERVAL '1 day'),
          ('hash_d', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW())
      `)

      // WHEN: GET /api/analytics/overview?from=...&to=...&granularity=day
      const now = new Date()
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(
        `/api/analytics/overview?from=${from}&to=${to}&granularity=day`
      )

      // THEN: Time series has daily data points
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data.timeSeries)).toBe(true)
      // With 7 days range and daily granularity, expect around 7-8 data points
      expect(data.timeSeries.length).toBeGreaterThanOrEqual(4)

      for (const point of data.timeSeries) {
        expect(point).toHaveProperty('period')
        expect(point).toHaveProperty('pageViews')
      }
    }
  )

  test.fixme(
    'API-ANALYTICS-OVERVIEW-006: should respect granularity=week in time series',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with page views across multiple weeks
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '21 days'),
          ('hash_b', '/', 'Home', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '14 days'),
          ('hash_c', '/', 'Home', 'desktop', 'Firefox', 'macOS', NOW() - INTERVAL '7 days'),
          ('hash_d', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW())
      `)

      // WHEN: GET /api/analytics/overview?from=...&to=...&granularity=week
      const now = new Date()
      const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(
        `/api/analytics/overview?from=${from}&to=${to}&granularity=week`
      )

      // THEN: Time series has weekly data points
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data.timeSeries)).toBe(true)
      // 30 days = ~4 weeks, so expect around 4-5 data points
      expect(data.timeSeries.length).toBeGreaterThanOrEqual(3)
    }
  )

  test.fixme(
    'API-ANALYTICS-OVERVIEW-007: should respect granularity=month in time series',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with page views across multiple months
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '90 days'),
          ('hash_b', '/', 'Home', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '60 days'),
          ('hash_c', '/', 'Home', 'desktop', 'Firefox', 'macOS', NOW() - INTERVAL '30 days'),
          ('hash_d', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW())
      `)

      // WHEN: GET /api/analytics/overview?from=...&to=...&granularity=month
      const now = new Date()
      const from = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(
        `/api/analytics/overview?from=${from}&to=${to}&granularity=month`
      )

      // THEN: Time series has monthly data points
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data.timeSeries)).toBe(true)
      // 120 days = ~4 months
      expect(data.timeSeries.length).toBeGreaterThanOrEqual(3)
    }
  )

  test(
    'API-ANALYTICS-OVERVIEW-008: should return 400 when from parameter is missing',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with analytics and authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: GET /api/analytics/overview?to=...  (missing from)
      const to = new Date().toISOString()
      const response = await request.get(`/api/analytics/overview?to=${to}`)

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)
    }
  )

  test(
    'API-ANALYTICS-OVERVIEW-009: should return 400 when to parameter is missing',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with analytics and authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: GET /api/analytics/overview?from=...  (missing to)
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const response = await request.get(`/api/analytics/overview?from=${from}`)

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)
    }
  )

  test(
    'API-ANALYTICS-OVERVIEW-010: should return empty data for periods with no traffic',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with analytics but no page view data
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: GET /api/analytics/overview?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/overview?from=${from}&to=${to}`)

      // THEN: Returns summary with all zeros and empty/zero timeSeries
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.summary.pageViews).toBe(0)
      expect(data.summary.uniqueVisitors).toBe(0)
      expect(data.summary.sessions).toBe(0)
      expect(Array.isArray(data.timeSeries)).toBe(true)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-ANALYTICS-OVERVIEW-REGRESSION: analytics overview query works end-to-end',
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

      await test.step('API-ANALYTICS-OVERVIEW-002: Return 401 when not authenticated', async () => {
        const response = await request.get(`/api/analytics/overview?from=${from}&to=${to}`)
        expect(response.status()).toBe(401)
      })

      // Authenticate
      await createAuthenticatedUser()

      await test.step('API-ANALYTICS-OVERVIEW-010: Return empty data for no traffic', async () => {
        const response = await request.get(`/api/analytics/overview?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.summary.pageViews).toBe(0)
        expect(data.summary.uniqueVisitors).toBe(0)
        expect(data.summary.sessions).toBe(0)
      })

      // Insert page view data
      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '2 days'),
          ('hash_b', '/about', 'About', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '1 day'),
          ('hash_a', '/contact', 'Contact', 'desktop', 'Chrome', 'Windows', NOW()),
          ('hash_c', '/', 'Home', 'desktop', 'Firefox', 'macOS', NOW())
      `)

      await test.step('API-ANALYTICS-OVERVIEW-001: Return 200 with summary and time series', async () => {
        const response = await request.get(`/api/analytics/overview?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.summary.pageViews).toBe(4)
        expect(data.summary.uniqueVisitors).toBe(3)
        expect(data).toHaveProperty('timeSeries')
        expect(Array.isArray(data.timeSeries)).toBe(true)
      })

      await test.step('API-ANALYTICS-OVERVIEW-005: Granularity=day in time series', async () => {
        const response = await request.get(
          `/api/analytics/overview?from=${from}&to=${to}&granularity=day`
        )
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.timeSeries.length).toBeGreaterThanOrEqual(3)

        for (const point of data.timeSeries) {
          expect(point).toHaveProperty('period')
          expect(point).toHaveProperty('pageViews')
        }
      })

      await test.step('API-ANALYTICS-OVERVIEW-008: Return 400 when from is missing', async () => {
        const response = await request.get(`/api/analytics/overview?to=${to}`)
        expect(response.status()).toBe(400)
      })

      // --- Steps skipped: redundant granularity variants or duplicate validation ---
      // API-ANALYTICS-OVERVIEW-003: Summary field detail (similar to 001 — covered by @spec)
      // API-ANALYTICS-OVERVIEW-004: Granularity=hour (granularity variant — covered by @spec)
      // API-ANALYTICS-OVERVIEW-006: Granularity=week (granularity variant — covered by @spec)
      // API-ANALYTICS-OVERVIEW-007: Granularity=month (granularity variant — covered by @spec)
      // API-ANALYTICS-OVERVIEW-009: Missing to param (similar to 008 — covered by @spec)
    }
  )
})
