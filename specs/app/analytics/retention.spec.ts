/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Analytics Data Retention
 *
 * Source: specs/app/analytics/retention.spec.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (5 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * NOTE: These app-level tests verify retention purge behavior by inserting records
 * directly into the database and verifying counts after server restart — they do
 * NOT use analytics API endpoints.
 */

test.describe('Analytics Data Retention', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'APP-ANALYTICS-RETENTION-001: should purge records older than retentionDays on server startup',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Analytics data with records older than retentionDays
      // First start server to create the analytics tables
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: { retentionDays: 30 },
      })

      await createAuthenticatedUser()

      // Insert records: some older than 30 days, some within retention
      await executeQuery(`
        INSERT INTO system.page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, created_at)
        VALUES
          ('hash_old_1', '/old-page-1', 'Old Page 1', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '45 days'),
          ('hash_old_2', '/old-page-2', 'Old Page 2', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '60 days'),
          ('hash_recent_1', '/recent-page', 'Recent Page', 'desktop', 'Firefox', 'macOS', NOW() - INTERVAL '10 days'),
          ('hash_today', '/today-page', 'Today Page', 'desktop', 'Chrome', 'Windows', NOW())
      `)

      // WHEN: Server restarts with analytics.retentionDays = 30
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: { retentionDays: 30 },
      })

      await createAuthenticatedUser()

      // THEN: Records older than 30 days are purged from the database
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM system.page_views
      `)
      // Only recent records (within 30 days) should remain: /recent-page and /today-page
      expect(Number(result.rows[0].count)).toBe(2)
    }
  )

  test.fixme(
    'APP-ANALYTICS-RETENTION-002: should respect the configured retentionDays value',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Analytics data with records of various ages
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: { retentionDays: 7 },
      })

      await createAuthenticatedUser()

      // Insert records of varying ages
      await executeQuery(`
        INSERT INTO system.page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, created_at)
        VALUES
          ('hash_1', '/page-1', 'Page 1', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '10 days'),
          ('hash_2', '/page-2', 'Page 2', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '8 days'),
          ('hash_3', '/page-3', 'Page 3', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '5 days'),
          ('hash_4', '/page-4', 'Page 4', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '2 days'),
          ('hash_5', '/page-5', 'Page 5', 'desktop', 'Chrome', 'Windows', NOW())
      `)

      // WHEN: Server starts with analytics.retentionDays = 7
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: { retentionDays: 7 },
      })

      await createAuthenticatedUser()

      // THEN: Only records older than 7 days are purged (10d and 8d old)
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM system.page_views
      `)
      expect(Number(result.rows[0].count)).toBe(3)
    }
  )

  test.fixme(
    'APP-ANALYTICS-RETENTION-003: should preserve records within retention period',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Analytics data with records within and beyond retention period
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: { retentionDays: 90 },
      })

      await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO system.page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, created_at)
        VALUES
          ('hash_old', '/expired', 'Expired', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '100 days'),
          ('hash_within_1', '/within-1', 'Within 1', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '60 days'),
          ('hash_within_2', '/within-2', 'Within 2', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '30 days'),
          ('hash_within_3', '/within-3', 'Within 3', 'desktop', 'Firefox', 'macOS', NOW() - INTERVAL '1 day')
      `)

      // WHEN: Server starts with analytics.retentionDays = 90
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: { retentionDays: 90 },
      })

      await createAuthenticatedUser()

      // THEN: Records within 90 days are preserved, older ones are purged
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM system.page_views
      `)
      expect(Number(result.rows[0].count)).toBe(3)

      // Verify the expired record is gone
      const expiredResult = await executeQuery(`
        SELECT COUNT(*) as count FROM system.page_views WHERE page_path = '/expired'
      `)
      expect(Number(expiredResult.rows[0].count)).toBe(0)

      // Verify a within-period record is still present
      const withinResult = await executeQuery(`
        SELECT COUNT(*) as count FROM system.page_views WHERE page_path = '/within-1'
      `)
      expect(Number(withinResult.rows[0].count)).toBe(1)
    }
  )

  test.fixme(
    'APP-ANALYTICS-RETENTION-004: should run purge without error when no expired records exist',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Analytics data with all records within retention period
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: { retentionDays: 365 },
      })

      await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO system.page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, created_at)
        VALUES
          ('hash_1', '/page-1', 'Page 1', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '30 days'),
          ('hash_2', '/page-2', 'Page 2', 'mobile', 'Safari', 'iOS', NOW() - INTERVAL '7 days'),
          ('hash_3', '/page-3', 'Page 3', 'desktop', 'Firefox', 'macOS', NOW())
      `)

      // WHEN: Server starts with analytics.retentionDays = 365
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: { retentionDays: 365 },
      })

      await createAuthenticatedUser()

      // THEN: Purge completes successfully, all records preserved
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM system.page_views
      `)
      expect(Number(result.rows[0].count)).toBe(3)
    }
  )

  test.fixme(
    'APP-ANALYTICS-RETENTION-005: should use default 365 days retention when not configured',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Analytics config without explicit retentionDays
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO system.page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, created_at)
        VALUES
          ('hash_very_old', '/very-old', 'Very Old', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '400 days'),
          ('hash_within', '/within', 'Within', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '200 days'),
          ('hash_recent', '/recent', 'Recent', 'desktop', 'Chrome', 'Windows', NOW())
      `)

      // WHEN: Server restarts (retentionDays defaults to 365)
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        analytics: true,
      })

      await createAuthenticatedUser()

      // THEN: Records older than 365 days are purged, recent ones preserved
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM system.page_views
      `)
      expect(Number(result.rows[0].count)).toBe(2)

      // Verify the very old record is gone
      const veryOldResult = await executeQuery(`
        SELECT COUNT(*) as count FROM system.page_views WHERE page_path = '/very-old'
      `)
      expect(Number(veryOldResult.rows[0].count)).toBe(0)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'APP-ANALYTICS-RETENTION-REGRESSION: data retention purge works correctly',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      await test.step('APP-ANALYTICS-RETENTION-001: Purge expired records on startup', async () => {
        // Start server, insert records with various ages, restart, verify old records purged
        await startServerWithSchema({
          name: 'test-app',
          auth: { strategies: [{ type: 'emailAndPassword' }] },
          analytics: { retentionDays: 30 },
        })

        await createAuthenticatedUser()

        await executeQuery(`
          INSERT INTO system.page_views (visitor_hash, page_path, page_title, device_type, browser_name, os_name, created_at)
          VALUES
            ('hash_expired', '/expired', 'Expired', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '45 days'),
            ('hash_recent', '/recent', 'Recent', 'desktop', 'Chrome', 'Windows', NOW() - INTERVAL '5 days'),
            ('hash_today', '/today', 'Today', 'desktop', 'Chrome', 'Windows', NOW())
        `)

        // Restart triggers purge
        await startServerWithSchema({
          name: 'test-app',
          auth: { strategies: [{ type: 'emailAndPassword' }] },
          analytics: { retentionDays: 30 },
        })

        await createAuthenticatedUser()

        const result = await executeQuery(`
          SELECT COUNT(*) as count FROM system.page_views
        `)
        expect(Number(result.rows[0].count)).toBe(2)
      })

      await test.step('APP-ANALYTICS-RETENTION-003: Preserve records within retention period', async () => {
        // Verify recent records are still present after purge
        const recentResult = await executeQuery(`
          SELECT COUNT(*) as count FROM system.page_views WHERE page_path = '/recent'
        `)
        expect(Number(recentResult.rows[0].count)).toBe(1)

        const todayResult = await executeQuery(`
          SELECT COUNT(*) as count FROM system.page_views WHERE page_path = '/today'
        `)
        expect(Number(todayResult.rows[0].count)).toBe(1)
      })

      await test.step('APP-ANALYTICS-RETENTION-004: No error when no expired records', async () => {
        // Restart server with all recent data — no purge errors
        await startServerWithSchema({
          name: 'test-app',
          auth: { strategies: [{ type: 'emailAndPassword' }] },
          analytics: { retentionDays: 365 },
        })

        await createAuthenticatedUser()

        const result = await executeQuery(`
          SELECT COUNT(*) as count FROM system.page_views
        `)
        // Records from previous step should still be present (within 365 days)
        expect(Number(result.rows[0].count)).toBeGreaterThanOrEqual(1)
      })
    }
  )
})
