/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Analytics Traffic Sources Query
 *
 * Source: specs/api/analytics/sources.spec.ts
 * Domain: api
 * Spec Count: 9
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (9 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Analytics Traffic Sources - Referrers & Campaigns', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-ANALYTICS-SOURCES-001: should return top referrer domains',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics enabled and referrer data
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // Insert page views with referrer data: google.com has 3, twitter.com has 2, github.com has 1
      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, referrer_url, referrer_domain, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', 'https://www.google.com/search?q=test', 'google.com', NOW() - INTERVAL '3 hours'),
          ('hash_b', '/about', 'About', 'mobile', 'Safari', 'iOS', 'https://www.google.com/search?q=sovrium', 'google.com', NOW() - INTERVAL '2 hours'),
          ('hash_c', '/pricing', 'Pricing', 'desktop', 'Firefox', 'macOS', 'https://www.google.com/', 'google.com', NOW() - INTERVAL '1 hour'),
          ('hash_a', '/docs', 'Docs', 'desktop', 'Chrome', 'Windows', 'https://twitter.com/sovrium', 'twitter.com', NOW() - INTERVAL '2 hours'),
          ('hash_d', '/', 'Home', 'desktop', 'Chrome', 'Windows', 'https://t.co/abc123', 'twitter.com', NOW() - INTERVAL '1 hour'),
          ('hash_e', '/blog', 'Blog', 'desktop', 'Chrome', 'Windows', 'https://github.com/sovrium', 'github.com', NOW())
      `)

      // WHEN: GET /api/analytics/referrers?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/referrers?from=${from}&to=${to}`)

      // THEN: Returns 200 with referrer domains ranked by pageViews
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('referrers')
      expect(data).toHaveProperty('total')
      expect(data.referrers.length).toBe(3)
      expect(data.referrers[0].domain).toBe('google.com')
      expect(data.referrers[0].pageViews).toBe(3)
      expect(data.referrers[1].domain).toBe('twitter.com')
      expect(data.referrers[1].pageViews).toBe(2)
      expect(data.referrers[2].domain).toBe('github.com')
      expect(data.referrers[2].pageViews).toBe(1)
    }
  )

  test(
    'API-ANALYTICS-SOURCES-002: should return 401 when not authenticated for referrers',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with analytics and auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      // WHEN: GET /api/analytics/referrers without authentication
      const now = new Date()
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/referrers?from=${from}&to=${to}`)

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test(
    'API-ANALYTICS-SOURCES-003: should include null domain for direct traffic',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with page views having no referrer (direct traffic)
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // Insert page views: some with referrer, some without (direct traffic)
      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, referrer_url, referrer_domain, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', NULL, NULL, NOW() - INTERVAL '2 hours'),
          ('hash_b', '/', 'Home', 'mobile', 'Safari', 'iOS', NULL, NULL, NOW() - INTERVAL '1 hour'),
          ('hash_c', '/about', 'About', 'desktop', 'Chrome', 'Windows', 'https://google.com/search?q=test', 'google.com', NOW())
      `)

      // WHEN: GET /api/analytics/referrers?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/referrers?from=${from}&to=${to}`)

      // THEN: Referrers array includes an entry with domain: null for direct traffic
      expect(response.status()).toBe(200)

      const data = await response.json()
      const directEntry = data.referrers.find((r: any) => r.domain === null)
      expect(directEntry).toBeDefined()
      expect(directEntry.pageViews).toBe(2)
    }
  )

  test(
    'API-ANALYTICS-SOURCES-004: should sort referrers by pageViews descending',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with page views from multiple referrers
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // Insert varied referrer counts: github=5, google=3, reddit=1
      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, referrer_url, referrer_domain, timestamp)
        VALUES
          ('h1', '/', 'Home', 'desktop', 'Chrome', 'Windows', 'https://github.com/a', 'github.com', NOW()),
          ('h2', '/', 'Home', 'desktop', 'Chrome', 'Windows', 'https://github.com/b', 'github.com', NOW()),
          ('h3', '/', 'Home', 'desktop', 'Chrome', 'Windows', 'https://github.com/c', 'github.com', NOW()),
          ('h4', '/', 'Home', 'desktop', 'Chrome', 'Windows', 'https://github.com/d', 'github.com', NOW()),
          ('h5', '/', 'Home', 'desktop', 'Chrome', 'Windows', 'https://github.com/e', 'github.com', NOW()),
          ('h1', '/docs', 'Docs', 'desktop', 'Chrome', 'Windows', 'https://google.com/', 'google.com', NOW()),
          ('h2', '/docs', 'Docs', 'desktop', 'Chrome', 'Windows', 'https://google.com/', 'google.com', NOW()),
          ('h3', '/docs', 'Docs', 'desktop', 'Chrome', 'Windows', 'https://google.com/', 'google.com', NOW()),
          ('h1', '/blog', 'Blog', 'desktop', 'Chrome', 'Windows', 'https://reddit.com/r/test', 'reddit.com', NOW())
      `)

      // WHEN: GET /api/analytics/referrers?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/referrers?from=${from}&to=${to}`)

      // THEN: Referrers are sorted with highest pageViews first
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.referrers.length).toBe(3)
      expect(data.referrers[0].pageViews).toBeGreaterThanOrEqual(data.referrers[1].pageViews)
      expect(data.referrers[1].pageViews).toBeGreaterThanOrEqual(data.referrers[2].pageViews)
      expect(data.referrers[0].domain).toBe('github.com')
      expect(data.referrers[2].domain).toBe('reddit.com')
    }
  )

  test.fixme(
    'API-ANALYTICS-SOURCES-005: should return UTM campaign breakdown',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with page views having UTM parameters
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // Insert page views with UTM data
      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, utm_source, utm_medium, utm_campaign, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', 'google', 'cpc', 'spring-sale', NOW() - INTERVAL '3 hours'),
          ('hash_b', '/', 'Home', 'mobile', 'Safari', 'iOS', 'google', 'cpc', 'spring-sale', NOW() - INTERVAL '2 hours'),
          ('hash_c', '/pricing', 'Pricing', 'desktop', 'Chrome', 'Windows', 'google', 'cpc', 'spring-sale', NOW() - INTERVAL '1 hour'),
          ('hash_a', '/about', 'About', 'desktop', 'Chrome', 'Windows', 'twitter', 'social', 'launch', NOW() - INTERVAL '1 hour'),
          ('hash_d', '/', 'Home', 'desktop', 'Firefox', 'macOS', 'newsletter', 'email', 'weekly-digest', NOW())
      `)

      // WHEN: GET /api/analytics/campaigns?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/campaigns?from=${from}&to=${to}`)

      // THEN: Returns 200 with campaign data including source, medium, campaign
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('campaigns')
      expect(data).toHaveProperty('total')
      expect(data.campaigns.length).toBe(3)

      // Spring sale should be first (3 page views)
      const springSale = data.campaigns.find((c: any) => c.campaign === 'spring-sale')
      expect(springSale).toBeDefined()
      expect(springSale.source).toBe('google')
      expect(springSale.medium).toBe('cpc')
      expect(springSale.pageViews).toBe(3)
    }
  )

  test(
    'API-ANALYTICS-SOURCES-006: should return 401 when not authenticated for campaigns',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with analytics and auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      // WHEN: GET /api/analytics/campaigns without authentication
      const now = new Date()
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/campaigns?from=${from}&to=${to}`)

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-ANALYTICS-SOURCES-007: should include source medium campaign fields in campaigns',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with UTM-tagged page views
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, utm_source, utm_medium, utm_campaign, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', 'facebook', 'social', 'product-launch', NOW() - INTERVAL '2 hours'),
          ('hash_b', '/pricing', 'Pricing', 'mobile', 'Safari', 'iOS', 'facebook', 'social', 'product-launch', NOW() - INTERVAL '1 hour'),
          ('hash_c', '/docs', 'Docs', 'desktop', 'Firefox', 'macOS', 'facebook', 'social', 'product-launch', NOW())
      `)

      // WHEN: GET /api/analytics/campaigns?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/campaigns?from=${from}&to=${to}`)

      // THEN: Each campaign includes source, medium, campaign, pageViews, uniqueVisitors
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.campaigns.length).toBeGreaterThanOrEqual(1)

      const campaign = data.campaigns[0]
      expect(campaign).toHaveProperty('source')
      expect(campaign).toHaveProperty('medium')
      expect(campaign).toHaveProperty('campaign')
      expect(campaign).toHaveProperty('pageViews')
      expect(campaign).toHaveProperty('uniqueVisitors')

      expect(campaign.source).toBe('facebook')
      expect(campaign.medium).toBe('social')
      expect(campaign.campaign).toBe('product-launch')
      expect(campaign.pageViews).toBe(3)
      expect(campaign.uniqueVisitors).toBe(3)
    }
  )

  test(
    'API-ANALYTICS-SOURCES-008: should return 400 when from parameter is missing',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with analytics and authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: GET /api/analytics/referrers?to=...  (missing from)
      const to = new Date().toISOString()
      const response = await request.get(`/api/analytics/referrers?to=${to}`)

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)
    }
  )

  test(
    'API-ANALYTICS-SOURCES-009: should return empty array when no referrer data exists',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with analytics but no page view data
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: GET /api/analytics/referrers?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/referrers?from=${from}&to=${to}`)

      // THEN: Returns empty referrers array with total 0
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.referrers).toHaveLength(0)
      expect(data.total).toBe(0)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-ANALYTICS-SOURCES-REGRESSION: traffic sources query works end-to-end',
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

      await test.step('API-ANALYTICS-SOURCES-002: Return 401 when not authenticated for referrers', async () => {
        const response = await request.get(`/api/analytics/referrers?from=${from}&to=${to}`)
        expect(response.status()).toBe(401)
      })

      await test.step('API-ANALYTICS-SOURCES-006: Return 401 when not authenticated for campaigns', async () => {
        const response = await request.get(`/api/analytics/campaigns?from=${from}&to=${to}`)
        expect(response.status()).toBe(401)
      })

      await createAuthenticatedUser()

      await test.step('API-ANALYTICS-SOURCES-009: Return empty when no referrer data', async () => {
        const response = await request.get(`/api/analytics/referrers?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.referrers).toHaveLength(0)
        expect(data.total).toBe(0)
      })

      // Insert referrer and campaign data
      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, referrer_url, referrer_domain, utm_source, utm_medium, utm_campaign, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', 'https://google.com/', 'google.com', NULL, NULL, NULL, NOW() - INTERVAL '3 hours'),
          ('hash_b', '/', 'Home', 'mobile', 'Safari', 'iOS', 'https://google.com/search', 'google.com', NULL, NULL, NULL, NOW() - INTERVAL '2 hours'),
          ('hash_c', '/about', 'About', 'desktop', 'Firefox', 'macOS', NULL, NULL, NULL, NULL, NULL, NOW() - INTERVAL '1 hour'),
          ('hash_d', '/pricing', 'Pricing', 'desktop', 'Chrome', 'Windows', 'https://twitter.com/link', 'twitter.com', NULL, NULL, NULL, NOW()),
          ('hash_a', '/blog', 'Blog', 'desktop', 'Chrome', 'Windows', NULL, NULL, 'google', 'cpc', 'spring-sale', NOW() - INTERVAL '2 hours'),
          ('hash_b', '/blog', 'Blog', 'mobile', 'Safari', 'iOS', NULL, NULL, 'google', 'cpc', 'spring-sale', NOW() - INTERVAL '1 hour'),
          ('hash_e', '/docs', 'Docs', 'desktop', 'Chrome', 'Windows', NULL, NULL, 'newsletter', 'email', 'weekly', NOW())
      `)

      await test.step('API-ANALYTICS-SOURCES-001: Return top referrer domains', async () => {
        const response = await request.get(`/api/analytics/referrers?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.referrers.length).toBeGreaterThanOrEqual(2)
        expect(data.referrers[0].domain).toBe('google.com')
        expect(data.referrers[0].pageViews).toBe(2)
      })

      await test.step('API-ANALYTICS-SOURCES-004: Referrers sorted by pageViews descending', async () => {
        const response = await request.get(`/api/analytics/referrers?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        for (let i = 0; i < data.referrers.length - 1; i++) {
          expect(data.referrers[i].pageViews).toBeGreaterThanOrEqual(
            data.referrers[i + 1].pageViews
          )
        }
      })

      await test.step('API-ANALYTICS-SOURCES-003: Include null domain for direct traffic', async () => {
        const response = await request.get(`/api/analytics/referrers?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        const directEntry = data.referrers.find((r: any) => r.domain === null)
        expect(directEntry).toBeDefined()
        expect(directEntry.pageViews).toBeGreaterThanOrEqual(1)
      })

      await test.step('API-ANALYTICS-SOURCES-005: Return UTM campaign breakdown', async () => {
        const response = await request.get(`/api/analytics/campaigns?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.campaigns.length).toBe(2)

        const springSale = data.campaigns.find((c: any) => c.campaign === 'spring-sale')
        expect(springSale).toBeDefined()
        expect(springSale.source).toBe('google')
        expect(springSale.medium).toBe('cpc')
        expect(springSale.pageViews).toBe(2)
      })

      await test.step('API-ANALYTICS-SOURCES-008: Return 400 when from is missing', async () => {
        const response = await request.get(`/api/analytics/referrers?to=${to}`)
        expect(response.status()).toBe(400)
      })

      // --- Steps skipped: redundant field verification ---
      // API-ANALYTICS-SOURCES-007: Campaign field details (source/medium/campaign — similar to 005 — covered by @spec)
    }
  )
})
