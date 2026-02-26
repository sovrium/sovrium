/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Analytics Page View Collection
 *
 * Source: specs/api/analytics/collect.spec.ts
 * Domain: api
 * Spec Count: 14
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (14 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('POST /api/analytics/collect - Page View Collection', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-ANALYTICS-COLLECT-001: should return 204 No Content on valid page view',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with analytics enabled
      await startServerWithSchema({
        name: 'test-app',
        analytics: true,
      })

      // WHEN: POST /api/analytics/collect with valid payload { p: '/about' }
      const response = await request.post('/api/analytics/collect', {
        data: { p: '/about' },
      })

      // THEN: Returns 204 No Content
      expect(response.status()).toBe(204)
    }
  )

  // NOTE: COLLECT-002 and COLLECT-003 overlap with APP-ANALYTICS-CONFIG-001 and
  // APP-ANALYTICS-CONFIG-002 (same script-injection checks). Kept here for API-domain
  // completeness; the app/ tests validate schema-level behavior independently.
  test(
    'API-ANALYTICS-COLLECT-002: should inject tracking script into pages when analytics enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with analytics enabled and pages configured
      await startServerWithSchema({
        name: 'test-app',
        analytics: true,
      })

      // WHEN: Visiting a page
      await page.goto('/')
      const html = await page.content()

      // THEN: HTML contains <script> tag for analytics tracking script
      expect(html).toContain('<script')
      expect(html).toContain('/api/analytics/collect')
    }
  )

  test(
    'API-ANALYTICS-COLLECT-003: should NOT inject tracking script when analytics disabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with analytics disabled
      await startServerWithSchema({
        name: 'test-app',
        analytics: false,
      })

      // WHEN: Visiting a page
      await page.goto('/')
      const html = await page.content()

      // THEN: HTML does NOT contain analytics tracking script
      expect(html).not.toContain('/api/analytics/collect')
    }
  )

  test(
    'API-ANALYTICS-COLLECT-004: should use SHA-256 visitor hash without cookies',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: POST /api/analytics/collect
      const response = await request.post('/api/analytics/collect', {
        data: { p: '/test-page', t: 'Test Page' },
      })

      // THEN: Returns 204
      expect(response.status()).toBe(204)

      // AND: No analytics cookies are set on the response
      const setCookieHeader = response.headers()['set-cookie'] ?? ''
      expect(setCookieHeader).not.toContain('analytics')
      expect(setCookieHeader).not.toContain('_pk')
      expect(setCookieHeader).not.toContain('_ga')

      // AND: Page view record has visitorHash in the database
      // Use poll() to wait for the fire-and-forget DB write to complete
      await expect
        .poll(
          async () => {
            const result = await executeQuery(`
              SELECT visitor_hash FROM system.analytics_page_views WHERE page_path = '/test-page'
            `)
            return result.rows.length
          },
          { timeout: 5000 }
        )
        .toBeGreaterThanOrEqual(1)

      const result = await executeQuery(`
        SELECT visitor_hash FROM system.analytics_page_views WHERE page_path = '/test-page'
      `)
      expect(result.rows[0].visitor_hash).toBeTruthy()
      // SHA-256 produces 64-character hex string
      expect(result.rows[0].visitor_hash).toMatch(/^[a-f0-9]{64}$/)
    }
  )

  test(
    'API-ANALYTICS-COLLECT-005: should parse device type from UA string',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: POST /api/analytics/collect with mobile UA string
      const mobileUA =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
      await request.post('/api/analytics/collect', {
        data: { p: '/mobile-test' },
        headers: { 'User-Agent': mobileUA },
      })

      // THEN: Page view record has deviceType = 'mobile'
      // Use poll() to wait for the fire-and-forget DB write to complete
      await expect
        .poll(
          async () => {
            const result = await executeQuery(`
              SELECT device_type FROM system.analytics_page_views WHERE page_path = '/mobile-test'
            `)
            return result.rows.length
          },
          { timeout: 5000 }
        )
        .toBeGreaterThanOrEqual(1)

      const result = await executeQuery(`
        SELECT device_type FROM system.analytics_page_views WHERE page_path = '/mobile-test'
      `)
      expect(result.rows[0].device_type).toBe('mobile')
    }
  )

  test(
    'API-ANALYTICS-COLLECT-006: should extract browser name from UA string',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: POST /api/analytics/collect with Chrome UA string
      const chromeUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      await request.post('/api/analytics/collect', {
        data: { p: '/chrome-test' },
        headers: { 'User-Agent': chromeUA },
      })

      // THEN: Page view record has browserName = 'Chrome'
      // Use poll() to wait for the fire-and-forget DB write to complete
      await expect
        .poll(
          async () => {
            const result = await executeQuery(`
              SELECT browser_name FROM system.analytics_page_views WHERE page_path = '/chrome-test'
            `)
            return result.rows.length
          },
          { timeout: 5000 }
        )
        .toBeGreaterThanOrEqual(1)

      const result = await executeQuery(`
        SELECT browser_name FROM system.analytics_page_views WHERE page_path = '/chrome-test'
      `)
      expect(result.rows[0].browser_name).toBe('Chrome')
    }
  )

  test(
    'API-ANALYTICS-COLLECT-007: should extract OS name from UA string',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: POST /api/analytics/collect with macOS UA string
      const macUA =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      await request.post('/api/analytics/collect', {
        data: { p: '/mac-test' },
        headers: { 'User-Agent': macUA },
      })

      // THEN: Page view record has osName = 'macOS'
      // Use poll() to wait for the fire-and-forget DB write to complete
      await expect
        .poll(
          async () => {
            const result = await executeQuery(`
              SELECT os_name FROM system.analytics_page_views WHERE page_path = '/mac-test'
            `)
            return result.rows.length
          },
          { timeout: 5000 }
        )
        .toBeGreaterThanOrEqual(1)

      const result = await executeQuery(`
        SELECT os_name FROM system.analytics_page_views WHERE page_path = '/mac-test'
      `)
      expect(result.rows[0].os_name).toBe('macOS')
    }
  )

  test(
    'API-ANALYTICS-COLLECT-008: should extract language from Accept-Language header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: POST /api/analytics/collect with Accept-Language: en-US,en;q=0.9
      await request.post('/api/analytics/collect', {
        data: { p: '/language-test' },
        headers: { 'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8' },
      })

      // THEN: Page view record has language = 'en-US'
      // Use poll() to wait for the fire-and-forget DB write to complete
      await expect
        .poll(
          async () => {
            const result = await executeQuery(`
              SELECT language FROM system.analytics_page_views WHERE page_path = '/language-test'
            `)
            return result.rows.length
          },
          { timeout: 5000 }
        )
        .toBeGreaterThanOrEqual(1)

      const result = await executeQuery(`
        SELECT language FROM system.analytics_page_views WHERE page_path = '/language-test'
      `)
      expect(result.rows[0].language).toBe('en-US')
    }
  )

  test(
    'API-ANALYTICS-COLLECT-009: should extract referrer domain from full referrer URL',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: POST /api/analytics/collect with r: 'https://www.google.com/search?q=test'
      await request.post('/api/analytics/collect', {
        data: {
          p: '/referred-page',
          r: 'https://www.google.com/search?q=test',
        },
      })

      // THEN: Page view record has referrerDomain = 'google.com'
      // Use poll() to wait for the fire-and-forget DB write to complete
      await expect
        .poll(
          async () => {
            const result = await executeQuery(`
              SELECT referrer_domain, referrer_url FROM system.analytics_page_views WHERE page_path = '/referred-page'
            `)
            return result.rows.length
          },
          { timeout: 5000 }
        )
        .toBeGreaterThanOrEqual(1)

      const result = await executeQuery(`
        SELECT referrer_domain, referrer_url FROM system.analytics_page_views WHERE page_path = '/referred-page'
      `)
      expect(result.rows[0].referrer_domain).toBe('google.com')
      expect(result.rows[0].referrer_url).toBe('https://www.google.com/search?q=test')
    }
  )

  test(
    'API-ANALYTICS-COLLECT-010: should capture UTM parameters from tracking payload',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: POST /api/analytics/collect with UTM params in the payload
      await request.post('/api/analytics/collect', {
        data: {
          p: '/utm-page',
          us: 'newsletter',
          um: 'email',
          uc: 'spring-sale',
          ux: 'banner-top',
          ut: 'discount',
        },
      })

      // THEN: Page view record has utmSource, utmMedium, utmCampaign populated
      // Use poll() to wait for the fire-and-forget DB write to complete
      await expect
        .poll(
          async () => {
            const result = await executeQuery(`
              SELECT utm_source FROM system.analytics_page_views WHERE page_path = '/utm-page'
            `)
            return result.rows.length
          },
          { timeout: 5000 }
        )
        .toBeGreaterThanOrEqual(1)

      const result = await executeQuery(`
        SELECT utm_source, utm_medium, utm_campaign, utm_content, utm_term
        FROM system.analytics_page_views WHERE page_path = '/utm-page'
      `)
      expect(result.rows[0].utm_source).toBe('newsletter')
      expect(result.rows[0].utm_medium).toBe('email')
      expect(result.rows[0].utm_campaign).toBe('spring-sale')
      expect(result.rows[0].utm_content).toBe('banner-top')
      expect(result.rows[0].utm_term).toBe('discount')
    }
  )

  test(
    'API-ANALYTICS-COLLECT-011: should not track excluded paths',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics.excludedPaths = ['/admin/*']
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: { excludedPaths: ['/admin/*'] },
      })

      await createAuthenticatedUser()

      // WHEN: POST /api/analytics/collect with p: '/admin/dashboard'
      const response = await request.post('/api/analytics/collect', {
        data: { p: '/admin/dashboard' },
      })

      // THEN: Returns 204 (graceful) but no DB record
      expect(response.status()).toBe(204)

      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM system.analytics_page_views WHERE page_path = '/admin/dashboard'
      `)
      expect(Number(result.rows[0].count)).toBe(0)
    }
  )

  test(
    'API-ANALYTICS-COLLECT-012: should honor Do Not Track when respectDoNotTrack is true',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics.respectDoNotTrack = true (default)
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: { respectDoNotTrack: true },
      })

      await createAuthenticatedUser()

      // WHEN: POST /api/analytics/collect with DNT: 1 header
      const response = await request.post('/api/analytics/collect', {
        data: { p: '/dnt-test' },
        headers: { DNT: '1' },
      })

      // THEN: Returns 204 (graceful) but page view is not recorded
      expect(response.status()).toBe(204)

      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM system.analytics_page_views WHERE page_path = '/dnt-test'
      `)
      expect(Number(result.rows[0].count)).toBe(0)
    }
  )

  test(
    'API-ANALYTICS-COLLECT-013: should return 400 when page path is missing',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with analytics enabled
      await startServerWithSchema({
        name: 'test-app',
        analytics: true,
      })

      // WHEN: POST /api/analytics/collect with empty body {}
      const response = await request.post('/api/analytics/collect', {
        data: {},
      })

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)
    }
  )

  test.fixme(
    'API-ANALYTICS-COLLECT-014: should return 404 when analytics is not configured',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application WITHOUT analytics property
      await startServerWithSchema({
        name: 'test-app',
      })

      // WHEN: POST /api/analytics/collect
      const response = await request.post('/api/analytics/collect', {
        data: { p: '/test' },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-ANALYTICS-COLLECT-REGRESSION: page view collection works end-to-end',
    { tag: '@regression' },
    async ({ page, request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics enabled and auth
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: { excludedPaths: ['/admin/*'] },
      })

      await createAuthenticatedUser()

      await test.step('API-ANALYTICS-COLLECT-001: Return 204 on valid page view', async () => {
        const response = await request.post('/api/analytics/collect', {
          data: { p: '/about' },
        })
        expect(response.status()).toBe(204)
      })

      await test.step('API-ANALYTICS-COLLECT-002: Tracking script injected in pages', async () => {
        await page.goto('/')
        const html = await page.content()
        expect(html).toContain('<script')
        expect(html).toContain('/api/analytics/collect')
      })

      await test.step('API-ANALYTICS-COLLECT-004: Visitor hash without cookies', async () => {
        const response = await request.post('/api/analytics/collect', {
          data: { p: '/hash-check' },
        })
        expect(response.status()).toBe(204)

        const setCookieHeader = response.headers()['set-cookie'] ?? ''
        expect(setCookieHeader).not.toContain('analytics')

        const result = await executeQuery(`
          SELECT visitor_hash FROM system.analytics_page_views WHERE page_path = '/hash-check'
        `)
        expect(result.rows.length).toBeGreaterThanOrEqual(1)
        expect(result.rows[0].visitor_hash).toMatch(/^[a-f0-9]{64}$/)
      })

      await test.step('API-ANALYTICS-COLLECT-005: Device type parsed from UA', async () => {
        const mobileUA =
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        await request.post('/api/analytics/collect', {
          data: { p: '/mobile-regression' },
          headers: { 'User-Agent': mobileUA },
        })

        const result = await executeQuery(`
          SELECT device_type FROM system.analytics_page_views WHERE page_path = '/mobile-regression'
        `)
        expect(result.rows.length).toBeGreaterThanOrEqual(1)
        expect(result.rows[0].device_type).toBe('mobile')
      })

      await test.step('API-ANALYTICS-COLLECT-009: Referrer domain extracted', async () => {
        await request.post('/api/analytics/collect', {
          data: {
            p: '/referrer-regression',
            r: 'https://www.google.com/search?q=test',
          },
        })

        const result = await executeQuery(`
          SELECT referrer_domain FROM system.analytics_page_views WHERE page_path = '/referrer-regression'
        `)
        expect(result.rows.length).toBeGreaterThanOrEqual(1)
        expect(result.rows[0].referrer_domain).toBe('google.com')
      })

      await test.step('API-ANALYTICS-COLLECT-013: Return 400 for missing path', async () => {
        const response = await request.post('/api/analytics/collect', {
          data: {},
        })
        expect(response.status()).toBe(400)
      })

      await test.step('API-ANALYTICS-COLLECT-011: Excluded paths not tracked', async () => {
        const response = await request.post('/api/analytics/collect', {
          data: { p: '/admin/dashboard' },
        })
        expect(response.status()).toBe(204)

        const result = await executeQuery(`
          SELECT COUNT(*) as count FROM system.analytics_page_views WHERE page_path = '/admin/dashboard'
        `)
        expect(Number(result.rows[0].count)).toBe(0)
      })

      // --- Steps skipped: require different schema or redundant UA parsing checks ---
      // API-ANALYTICS-COLLECT-003: No tracking script without analytics (different schema — covered by @spec)
      // API-ANALYTICS-COLLECT-006: Browser name parsed from UA (similar to 005 — covered by @spec)
      // API-ANALYTICS-COLLECT-007: OS name parsed from UA (similar to 005 — covered by @spec)
      // API-ANALYTICS-COLLECT-008: Page title stored from payload (covered by @spec)
      // API-ANALYTICS-COLLECT-010: UTM parameters captured (covered by @spec)
      // API-ANALYTICS-COLLECT-012: ExcludedPaths glob matching (similar to 011 — covered by @spec)
      // API-ANALYTICS-COLLECT-014: 404 when analytics not configured (different schema — covered by @spec)
    }
  )
})
