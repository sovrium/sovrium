/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Analytics Device Breakdown Query
 *
 * Source: specs/api/analytics/devices.spec.ts
 * Domain: api
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (8 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('GET /api/analytics/devices - Device Breakdown', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-ANALYTICS-DEVICES-001: should return 200 with device type breakdown',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with analytics enabled and page views from various devices
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // Insert page views with device type data: 4 desktop, 2 mobile, 1 tablet
      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '4 hours'),
          ('hash_b', '/about', 'About', 'desktop', 'Firefox', 'macOS', NOW() - INTERVAL '3 hours'),
          ('hash_c', '/pricing', 'Pricing', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '2 hours'),
          ('hash_d', '/docs', 'Docs', 'desktop', 'Edge', 'Windows', NOW() - INTERVAL '1 hour'),
          ('hash_e', '/', 'Home', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '2 hours'),
          ('hash_f', '/about', 'About', 'mobile', 'Chrome', 'Android', NOW() - INTERVAL '1 hour'),
          ('hash_g', '/', 'Home', 'tablet', 'Safari', 'iPadOS', NOW())
      `)

      // WHEN: GET /api/analytics/devices?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/devices?from=${from}&to=${to}`)

      // THEN: Returns 200 with deviceTypes array
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('deviceTypes')
      expect(data.deviceTypes.length).toBeGreaterThanOrEqual(1)

      // Desktop should have most views
      const desktopEntry = data.deviceTypes.find((d: any) => d.name === 'desktop')
      expect(desktopEntry).toBeDefined()
      expect(desktopEntry.count).toBe(4)
    }
  )

  test(
    'API-ANALYTICS-DEVICES-002: should return 401 when user is not authenticated',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with analytics and auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      // WHEN: GET /api/analytics/devices without authentication
      const now = new Date()
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/devices?from=${from}&to=${to}`)

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test(
    'API-ANALYTICS-DEVICES-003: should include desktop mobile tablet device types',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with page views from desktop, mobile, and tablet
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
          ('hash_c', '/', 'Home', 'tablet', 'Safari', 'iPadOS', NOW() - INTERVAL '1 hour')
      `)

      // WHEN: GET /api/analytics/devices?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/devices?from=${from}&to=${to}`)

      // THEN: deviceTypes includes entries for desktop, mobile, and tablet
      expect(response.status()).toBe(200)

      const data = await response.json()
      const deviceNames = data.deviceTypes.map((d: any) => d.name)
      expect(deviceNames).toContain('desktop')
      expect(deviceNames).toContain('mobile')
      expect(deviceNames).toContain('tablet')
    }
  )

  test(
    'API-ANALYTICS-DEVICES-004: should return browser name breakdown',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with page views from different browsers
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '4 hours'),
          ('hash_b', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '3 hours'),
          ('hash_c', '/about', 'About', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '2 hours'),
          ('hash_d', '/pricing', 'Pricing', 'desktop', 'Firefox', 'macOS', NOW() - INTERVAL '1 hour'),
          ('hash_e', '/docs', 'Docs', 'desktop', 'Edge', 'Windows', NOW())
      `)

      // WHEN: GET /api/analytics/devices?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/devices?from=${from}&to=${to}`)

      // THEN: browsers array includes Chrome, Safari, Firefox, Edge entries
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('browsers')
      expect(data.browsers.length).toBeGreaterThanOrEqual(4)

      const browserNames = data.browsers.map((b: any) => b.name)
      expect(browserNames).toContain('Chrome')
      expect(browserNames).toContain('Safari')
      expect(browserNames).toContain('Firefox')
      expect(browserNames).toContain('Edge')

      // Chrome should have the most views (2)
      const chromeEntry = data.browsers.find((b: any) => b.name === 'Chrome')
      expect(chromeEntry.count).toBe(2)
    }
  )

  test(
    'API-ANALYTICS-DEVICES-005: should return OS name breakdown',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with page views from different operating systems
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '4 hours'),
          ('hash_b', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '3 hours'),
          ('hash_c', '/about', 'About', 'desktop', 'Firefox', 'macOS', NOW() - INTERVAL '2 hours'),
          ('hash_d', '/pricing', 'Pricing', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '1 hour'),
          ('hash_e', '/docs', 'Docs', 'mobile', 'Chrome', 'Android', NOW())
      `)

      // WHEN: GET /api/analytics/devices?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/devices?from=${from}&to=${to}`)

      // THEN: operatingSystems array includes Windows, macOS, iOS, Android entries
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('operatingSystems')
      expect(data.operatingSystems.length).toBeGreaterThanOrEqual(4)

      const osNames = data.operatingSystems.map((os: any) => os.name)
      expect(osNames).toContain('Windows')
      expect(osNames).toContain('macOS')
      expect(osNames).toContain('iOS')
      expect(osNames).toContain('Android')

      // Windows should have most views (2)
      const windowsEntry = data.operatingSystems.find((os: any) => os.name === 'Windows')
      expect(windowsEntry.count).toBe(2)
    }
  )

  test.fixme(
    'API-ANALYTICS-DEVICES-006: should include percentage calculation in each breakdown',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with page views from known device distribution
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // Insert 10 page views: 5 desktop, 3 mobile, 2 tablet (50%, 30%, 20%)
      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('h1', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '10 hours'),
          ('h2', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '9 hours'),
          ('h3', '/', 'Home', 'desktop', 'Firefox', 'macOS', NOW() - INTERVAL '8 hours'),
          ('h4', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '7 hours'),
          ('h5', '/', 'Home', 'desktop', 'Edge', 'Windows', NOW() - INTERVAL '6 hours'),
          ('h6', '/', 'Home', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '5 hours'),
          ('h7', '/', 'Home', 'mobile', 'Chrome', 'Android', NOW() - INTERVAL '4 hours'),
          ('h8', '/', 'Home', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '3 hours'),
          ('h9', '/', 'Home', 'tablet', 'Safari', 'iPadOS', NOW() - INTERVAL '2 hours'),
          ('h10', '/', 'Home', 'tablet', 'Chrome', 'Android', NOW() - INTERVAL '1 hour')
      `)

      // WHEN: GET /api/analytics/devices?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/devices?from=${from}&to=${to}`)

      // THEN: Each entry has percentage field that sums to 100
      expect(response.status()).toBe(200)

      const data = await response.json()

      // Device types: percentages should sum to 100
      const devicePercentageSum = data.deviceTypes.reduce(
        (sum: number, d: any) => sum + d.percentage,
        0
      )
      expect(devicePercentageSum).toBeCloseTo(100, 0)

      // Verify desktop is ~50%
      const desktopEntry = data.deviceTypes.find((d: any) => d.name === 'desktop')
      expect(desktopEntry.percentage).toBeCloseTo(50, 0)

      // Verify mobile is ~30%
      const mobileEntry = data.deviceTypes.find((d: any) => d.name === 'mobile')
      expect(mobileEntry.percentage).toBeCloseTo(30, 0)

      // Verify tablet is ~20%
      const tabletEntry = data.deviceTypes.find((d: any) => d.name === 'tablet')
      expect(tabletEntry.percentage).toBeCloseTo(20, 0)

      // Browser percentages should also sum to 100
      const browserPercentageSum = data.browsers.reduce(
        (sum: number, b: any) => sum + b.percentage,
        0
      )
      expect(browserPercentageSum).toBeCloseTo(100, 0)

      // OS percentages should also sum to 100
      const osPercentageSum = data.operatingSystems.reduce(
        (sum: number, os: any) => sum + os.percentage,
        0
      )
      expect(osPercentageSum).toBeCloseTo(100, 0)
    }
  )

  test(
    'API-ANALYTICS-DEVICES-007: should return 400 when from parameter is missing',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with analytics and authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: GET /api/analytics/devices?to=...  (missing from)
      const to = new Date().toISOString()
      const response = await request.get(`/api/analytics/devices?to=${to}`)

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)
    }
  )

  test(
    'API-ANALYTICS-DEVICES-008: should return empty breakdowns when no data exists',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with analytics but no page view data
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // WHEN: GET /api/analytics/devices?from=...&to=...
      const now = new Date()
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const to = now.toISOString()
      const response = await request.get(`/api/analytics/devices?from=${from}&to=${to}`)

      // THEN: Returns empty deviceTypes, browsers, operatingSystems arrays
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.deviceTypes).toHaveLength(0)
      expect(data.browsers).toHaveLength(0)
      expect(data.operatingSystems).toHaveLength(0)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-ANALYTICS-DEVICES-REGRESSION: device breakdown query works end-to-end',
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

      await test.step('API-ANALYTICS-DEVICES-002: Return 401 when not authenticated', async () => {
        const response = await request.get(`/api/analytics/devices?from=${from}&to=${to}`)
        expect(response.status()).toBe(401)
      })

      await createAuthenticatedUser()

      await test.step('API-ANALYTICS-DEVICES-008: Return empty when no data', async () => {
        const response = await request.get(`/api/analytics/devices?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.deviceTypes).toHaveLength(0)
        expect(data.browsers).toHaveLength(0)
        expect(data.operatingSystems).toHaveLength(0)
      })

      // Insert diverse device data: 4 desktop, 2 mobile, 1 tablet
      await executeQuery(`
        INSERT INTO system.analytics_page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, timestamp)
        VALUES
          ('hash_a', '/', 'Home', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '5 hours'),
          ('hash_b', '/about', 'About', 'desktop', 'Firefox', 'macOS', NOW() - INTERVAL '4 hours'),
          ('hash_c', '/pricing', 'Pricing', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '3 hours'),
          ('hash_d', '/docs', 'Docs', 'desktop', 'Edge', 'Windows', NOW() - INTERVAL '2 hours'),
          ('hash_e', '/', 'Home', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '1 hour'),
          ('hash_f', '/about', 'About', 'mobile', 'Chrome', 'Android', NOW() - INTERVAL '30 minutes'),
          ('hash_g', '/', 'Home', 'tablet', 'Safari', 'iPadOS', NOW())
      `)

      await test.step('API-ANALYTICS-DEVICES-001: Return 200 with device type breakdown', async () => {
        const response = await request.get(`/api/analytics/devices?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.deviceTypes.length).toBeGreaterThanOrEqual(1)

        const desktopEntry = data.deviceTypes.find((d: any) => d.name === 'desktop')
        expect(desktopEntry).toBeDefined()
        expect(desktopEntry.count).toBe(4)
      })

      await test.step('API-ANALYTICS-DEVICES-003: Include desktop, mobile, tablet types', async () => {
        const response = await request.get(`/api/analytics/devices?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        const deviceNames = data.deviceTypes.map((d: any) => d.name)
        expect(deviceNames).toContain('desktop')
        expect(deviceNames).toContain('mobile')
        expect(deviceNames).toContain('tablet')
      })

      await test.step('API-ANALYTICS-DEVICES-004: Return browser name breakdown', async () => {
        const response = await request.get(`/api/analytics/devices?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.browsers.length).toBeGreaterThanOrEqual(4)

        const browserNames = data.browsers.map((b: any) => b.name)
        expect(browserNames).toContain('Chrome')
        expect(browserNames).toContain('Safari')
        expect(browserNames).toContain('Firefox')
        expect(browserNames).toContain('Edge')
      })

      await test.step('API-ANALYTICS-DEVICES-005: Return OS name breakdown', async () => {
        const response = await request.get(`/api/analytics/devices?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.operatingSystems.length).toBeGreaterThanOrEqual(4)

        const osNames = data.operatingSystems.map((os: any) => os.name)
        expect(osNames).toContain('Windows')
        expect(osNames).toContain('macOS')
        expect(osNames).toContain('iOS')
        expect(osNames).toContain('Android')
      })

      await test.step('API-ANALYTICS-DEVICES-006: Include percentage calculation', async () => {
        const response = await request.get(`/api/analytics/devices?from=${from}&to=${to}`)
        expect(response.status()).toBe(200)

        const data = await response.json()

        // Device type percentages should sum to ~100
        const devicePercentageSum = data.deviceTypes.reduce(
          (sum: number, d: any) => sum + d.percentage,
          0
        )
        expect(devicePercentageSum).toBeCloseTo(100, 0)

        // Each entry should have percentage field
        for (const entry of data.deviceTypes) {
          expect(entry).toHaveProperty('percentage')
          expect(typeof entry.percentage).toBe('number')
        }
      })

      await test.step('API-ANALYTICS-DEVICES-007: Return 400 when from is missing', async () => {
        const response = await request.get(`/api/analytics/devices?to=${to}`)
        expect(response.status()).toBe(400)
      })
    }
  )
})
