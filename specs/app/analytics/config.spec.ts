/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Analytics Configuration
 *
 * Source: specs/app/analytics/config.spec.ts
 * Domain: app
 * Spec Count: 11
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (11 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * NOTE: These app-level tests verify schema parsing, page behavior, and DB state
 * directly — they do NOT use analytics API endpoints.
 */

test.describe('Analytics Configuration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'APP-ANALYTICS-CONFIG-001: should enable analytics by default when analytics property exists',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: App schema with analytics enabled via shorthand
      await startServerWithSchema({
        name: 'test-app',
        analytics: true,
      })

      // WHEN: Server starts and page is visited
      await page.goto('/')
      const html = await page.content()

      // THEN: Analytics is enabled (tracking script injected)
      expect(html).toContain('/api/analytics/collect')
    }
  )

  test(
    'APP-ANALYTICS-CONFIG-002: should disable analytics when set to false',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: App schema with analytics disabled
      await startServerWithSchema({
        name: 'test-app',
        analytics: false,
      })

      // WHEN: Server starts and page is visited
      await page.goto('/')
      const html = await page.content()

      // THEN: No tracking script injected
      expect(html).not.toContain('/api/analytics/collect')
    }
  )

  test(
    'APP-ANALYTICS-CONFIG-003: should default retentionDays to 365 when not specified',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: App schema with analytics enabled but no retentionDays specified
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // Insert a page view from 364 days ago (within default 365-day retention)
      await executeQuery(`
        INSERT INTO system.page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, created_at)
        VALUES ('hash_recent', '/within-retention', 'Within Retention', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '364 days')
      `)

      // Insert a page view from 366 days ago (beyond default 365-day retention)
      await executeQuery(`
        INSERT INTO system.page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, created_at)
        VALUES ('hash_old', '/beyond-retention', 'Beyond Retention', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '366 days')
      `)

      // WHEN: Navigating triggers retention cleanup (server processes stale records)
      await page.goto('/')

      // THEN: The 364-day-old record is preserved (within 365-day default retention)
      const recentResult = await executeQuery(`
        SELECT COUNT(*) as count FROM system.page_views WHERE page_path = '/within-retention'
      `)
      expect(Number(recentResult.rows[0].count)).toBe(1)

      // AND: The 366-day-old record is purged (beyond 365-day default retention)
      const oldResult = await executeQuery(`
        SELECT COUNT(*) as count FROM system.page_views WHERE page_path = '/beyond-retention'
      `)
      expect(Number(oldResult.rows[0].count)).toBe(0)
    }
  )

  test(
    'APP-ANALYTICS-CONFIG-004: should reject retentionDays below 1',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: App schema with analytics.retentionDays = 0
      // WHEN: Server attempts to start
      // THEN: Schema validation fails
      await expect(
        startServerWithSchema({
          name: 'test-app',
          analytics: { retentionDays: 0 },
        })
      ).rejects.toThrow()
    }
  )

  test(
    'APP-ANALYTICS-CONFIG-005: should reject retentionDays above 730',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: App schema with analytics.retentionDays = 731
      // WHEN: Server attempts to start
      // THEN: Schema validation fails
      await expect(
        startServerWithSchema({
          name: 'test-app',
          analytics: { retentionDays: 731 },
        })
      ).rejects.toThrow()
    }
  )

  test(
    'APP-ANALYTICS-CONFIG-006: should default sessionTimeout to 30 minutes when not specified',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: App schema with analytics enabled but no sessionTimeout
      await startServerWithSchema({
        name: 'test-app',
        analytics: true,
      })

      // WHEN: Server starts and page is visited
      await page.goto('/')
      const html = await page.content()

      // THEN: Tracking script is injected with the default 30-minute session timeout
      expect(html).toContain('/api/analytics/collect')

      // AND: The tracking script contains the default sessionTimeout value of 30
      // (The inline script configures the session timeout in minutes)
      expect(html).toMatch(/sessionTimeout["']?\s*[:=]\s*30/)
    }
  )

  test(
    'APP-ANALYTICS-CONFIG-007: should reject sessionTimeout below 1',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: App schema with analytics.sessionTimeout = 0
      // WHEN: Server attempts to start
      // THEN: Schema validation fails
      await expect(
        startServerWithSchema({
          name: 'test-app',
          analytics: { sessionTimeout: 0 },
        })
      ).rejects.toThrow()
    }
  )

  test.fixme(
    'APP-ANALYTICS-CONFIG-008: should reject sessionTimeout above 120',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: App schema with analytics.sessionTimeout = 121
      // WHEN: Server attempts to start
      // THEN: Schema validation fails
      await expect(
        startServerWithSchema({
          name: 'test-app',
          analytics: { sessionTimeout: 121 },
        })
      ).rejects.toThrow()
    }
  )

  test.fixme(
    'APP-ANALYTICS-CONFIG-009: should accept excludedPaths with glob patterns',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: App schema with analytics.excludedPaths = ['/admin/*', '/api/*']
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: {
          excludedPaths: ['/admin/*', '/api/*'],
        },
      })

      await createAuthenticatedUser()

      // WHEN: Server starts and a non-excluded page is visited
      await page.goto('/')

      // THEN: App starts successfully and non-excluded page view is recorded
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM system.page_views WHERE page_path = '/'
      `)
      expect(Number(result.rows[0].count)).toBeGreaterThanOrEqual(1)

      // AND: Excluded paths should not have records in DB
      // (This is verified by the tracking script filtering client-side)
      const excludedResult = await executeQuery(`
        SELECT COUNT(*) as count FROM system.page_views WHERE page_path LIKE '/admin/%'
      `)
      expect(Number(excludedResult.rows[0].count)).toBe(0)
    }
  )

  test.fixme(
    'APP-ANALYTICS-CONFIG-010: should default respectDoNotTrack to true when not specified',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: App schema with analytics enabled but no respectDoNotTrack
      await startServerWithSchema({
        name: 'test-app',
        analytics: true,
      })

      // WHEN: Server starts and page is visited
      await page.goto('/')
      const html = await page.content()

      // THEN: Tracking script is injected with respectDoNotTrack defaulting to true
      expect(html).toContain('/api/analytics/collect')

      // AND: The tracking script contains the default respectDoNotTrack=true configuration
      // (The inline script checks navigator.doNotTrack before sending page views)
      expect(html).toMatch(/respectDoNotTrack["']?\s*[:=]\s*true|doNotTrack/)
    }
  )

  test.fixme(
    'APP-ANALYTICS-CONFIG-011: should start successfully without analytics property',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: App schema with no analytics property at all
      await startServerWithSchema({
        name: 'test-app',
      })

      // WHEN: Server starts
      await page.goto('/')
      const html = await page.content()

      // THEN: App starts successfully, no tracking script injected
      expect(html).not.toContain('/api/analytics/collect')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test(
    'APP-ANALYTICS-CONFIG-REGRESSION: analytics configuration validates and app starts',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      await test.step('APP-ANALYTICS-CONFIG-011: App starts without analytics property', async () => {
        // Start server without analytics — should succeed
        await startServerWithSchema({
          name: 'test-app',
        })

        await page.goto('/')
        const html = await page.content()
        expect(html).not.toContain('/api/analytics/collect')
      })

      await test.step('APP-ANALYTICS-CONFIG-001: Analytics enabled by default when property exists', async () => {
        // Start server with analytics: true — tracking should be active
        await startServerWithSchema({
          name: 'test-app',
          analytics: true,
        })

        await page.goto('/')
        const html = await page.content()
        expect(html).toContain('/api/analytics/collect')
      })

      await test.step('APP-ANALYTICS-CONFIG-002: Analytics disabled with false', async () => {
        // Start server with analytics: false — tracking should be inactive
        await startServerWithSchema({
          name: 'test-app',
          analytics: false,
        })

        await page.goto('/')
        const html = await page.content()
        expect(html).not.toContain('/api/analytics/collect')
      })

      await test.step('APP-ANALYTICS-CONFIG-009: Excluded paths with glob patterns', async () => {
        // Start server with excludedPaths — verify non-excluded pages are tracked
        await startServerWithSchema({
          name: 'test-app',
          auth: { strategies: [{ type: 'emailAndPassword' }] },
          analytics: { excludedPaths: ['/admin/*'] },
        })

        await createAuthenticatedUser()

        // Visit a non-excluded page
        await page.goto('/')

        // Verify page view is recorded in database
        const result = await executeQuery(`
          SELECT COUNT(*) as count FROM system.page_views WHERE page_path = '/'
        `)
        expect(Number(result.rows[0].count)).toBeGreaterThanOrEqual(1)
      })

      await test.step('APP-ANALYTICS-CONFIG-004: Reject invalid retentionDays', async () => {
        // Attempt to start with retentionDays = 0 — should fail validation
        await expect(
          startServerWithSchema({
            name: 'test-app',
            analytics: { retentionDays: 0 },
          })
        ).rejects.toThrow()
      })

      await test.step('APP-ANALYTICS-CONFIG-007: Reject invalid sessionTimeout', async () => {
        // Attempt to start with sessionTimeout = 0 — should fail validation
        await expect(
          startServerWithSchema({
            name: 'test-app',
            analytics: { sessionTimeout: 0 },
          })
        ).rejects.toThrow()
      })

      // --- Steps skipped: require time-based verification or redundant boundary checks ---
      // APP-ANALYTICS-CONFIG-003: Default retentionDays to 365 (requires aged records + cleanup — covered by @spec)
      // APP-ANALYTICS-CONFIG-005: Reject retentionDays above 730 (boundary — covered by @spec)
      // APP-ANALYTICS-CONFIG-006: Default sessionTimeout to 30 minutes (script content check — covered by @spec)
      // APP-ANALYTICS-CONFIG-008: Reject sessionTimeout above 120 (boundary — covered by @spec)
      // APP-ANALYTICS-CONFIG-010: Default respectDoNotTrack to true (script content check — covered by @spec)
    }
  )
})
