/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Rate Limiting - Activity API Endpoints
 *
 * Domain: api/activity
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests rate limiting behavior on activity log API endpoints to prevent
 * excessive polling, resource exhaustion, and denial-of-service attacks.
 *
 * Activity API endpoints are read-only audit log endpoints. Rate limits are
 * moderate since activity logs can be polled frequently for real-time updates
 * but excessive polling must be prevented to protect database performance.
 *
 * Rate limiting targets for activity endpoints:
 * - GET /api/activity (list): 60 requests per 60 seconds per IP
 * - GET /api/activity/:id (detail): 60 requests per 60 seconds per IP
 *
 * Note: Activity endpoints are always authenticated. Rate limiting is applied
 * per IP address regardless of which authenticated user makes the request.
 *
 * **CONFIGURABLE RATE LIMIT WINDOWS:**
 * Rate limit implementation should respect RATE_LIMIT_WINDOW_SECONDS environment variable:
 * - Production default: 60 seconds (when env var not set)
 * - Test environment: 5 seconds (set RATE_LIMIT_WINDOW_SECONDS=5)
 * - Impact: Window expiration tests run in ~10s (test) vs ~65s (production)
 * - Why: Playwright clock doesn't control server-side time, so we make windows configurable
 *
 * Each test runs in an isolated environment with its own server process and
 * database, so rate limiting in one test does not affect other tests.
 */

test.describe('Rate Limiting - Activity API Endpoints', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'API-ACTIVITY-RATE-001: should return 429 after exceeding list activity rate limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with default rate limiting enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User exceeds default list activity rate limit
      // Note: Test assumes default limit is 60 requests per 60 seconds
      // (lower than table endpoints because activity logs hit the database harder
      // with joins and aggregations)
      for (let i = 0; i < 60; i++) {
        await request.get('/api/activity')
      }

      // THEN: 61st request returns 429 Too Many Requests
      const response = await request.get('/api/activity')

      expect(response.status()).toBe(429)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('Too many requests')
    }
  )

  test(
    'API-ACTIVITY-RATE-002: should return 429 after exceeding activity detail rate limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with an activity log entry to query
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })

      const { user } = await createAuthenticatedUser()

      // Create an activity log entry to query against
      await executeQuery(`
        INSERT INTO system.activity_logs (id, user_id, action, table_name, table_id, record_id, changes, created_at)
        VALUES (gen_random_uuid(), '${user.id}', 'create', 'tasks', 1, 1, '{"title": "Task 1"}', NOW())
      `)

      // Get the activity ID for the detail endpoint
      const result = await executeQuery(
        'SELECT id FROM system.activity_logs ORDER BY created_at DESC LIMIT 1'
      )
      const activityId = (result as any).rows?.[0]?.id ?? 1

      // WHEN: User exceeds default activity detail rate limit
      // Note: Test assumes default limit is 60 requests per 60 seconds
      for (let i = 0; i < 60; i++) {
        await request.get(`/api/activity/${activityId}`)
      }

      // THEN: 61st request returns 429 Too Many Requests
      const response = await request.get(`/api/activity/${activityId}`)

      expect(response.status()).toBe(429)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('Too many requests')
    }
  )

  test(
    'API-ACTIVITY-RATE-003: should reset activity rate limit after window expires',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // PERFORMANCE NOTE: This test waits for rate limit window to expire.
      // Production: 60 seconds (RATE_LIMIT_WINDOW_SECONDS not set)
      // Test environment: 5 seconds (set RATE_LIMIT_WINDOW_SECONDS=5)
      // Runs in ~10 seconds with test config vs ~65 seconds with production config
      test.slow()

      // GIVEN: Application with configurable rate limiting window
      // Note: Rate limit implementation should respect RATE_LIMIT_WINDOW_SECONDS env var
      // Default: 60 seconds (production), Tests should use: 5 seconds
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User hits default activity rate limit (assumes 60 requests)
      for (let i = 0; i < 60; i++) {
        await request.get('/api/activity')
      }

      // Verify rate limit is hit
      const blockedResponse = await request.get('/api/activity')
      expect(blockedResponse.status()).toBe(429)

      // THEN: Wait for window to expire (5 seconds configured in fixtures + 1 second buffer)
      await new Promise((resolve) => setTimeout(resolve, 6000))

      const response = await request.get('/api/activity')

      // Should succeed after rate limit window expires
      expect(response.status()).not.toBe(429)
    }
  )

  test(
    'API-ACTIVITY-RATE-004: should include Retry-After header in 429 response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with default rate limiting enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User exceeds default activity rate limit
      // Note: Test assumes default limit is 60 requests per 60 seconds
      for (let i = 0; i < 60; i++) {
        await request.get('/api/activity')
      }

      const response = await request.get('/api/activity')

      // THEN: Response includes Retry-After header with positive integer
      expect(response.status()).toBe(429)

      const retryAfter = response.headers()['retry-after']
      expect(retryAfter).toBeDefined()
      expect(parseInt(retryAfter!)).toBeGreaterThan(0)
    }
  )

  test(
    'API-ACTIVITY-RATE-005: should rate limit by IP address, not by authenticated user',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with default IP-based rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })

      // Create two users
      await signUp({
        email: 'user1@example.com',
        password: 'TestPassword123!',
        name: 'User One',
      })
      await signUp({
        email: 'user2@example.com',
        password: 'TestPassword123!',
        name: 'User Two',
      })

      // WHEN: Same IP makes requests as user1
      await signIn({ email: 'user1@example.com', password: 'TestPassword123!' })
      for (let i = 0; i < 30; i++) {
        await request.get('/api/activity')
      }

      // Switch to user2 from same IP and continue
      await signIn({ email: 'user2@example.com', password: 'TestPassword123!' })
      for (let i = 0; i < 30; i++) {
        await request.get('/api/activity')
      }

      // THEN: Rate limit is enforced across all users from same IP (61st request total)
      const response = await request.get('/api/activity')

      expect(response.status()).toBe(429)
    }
  )

  test(
    'API-ACTIVITY-RATE-006: should apply rate limit to filtered activity queries equally',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with default rate limiting enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
          {
            id: 2,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text', required: true }],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User makes requests with different query filters
      // (all count toward the same IP-based rate limit regardless of filter params)
      for (let i = 0; i < 20; i++) {
        await request.get('/api/activity?tableName=tasks')
      }
      for (let i = 0; i < 20; i++) {
        await request.get('/api/activity?action=create')
      }
      for (let i = 0; i < 20; i++) {
        await request.get('/api/activity?tableName=projects&action=update')
      }

      // THEN: 61st request returns 429 regardless of different query params
      const response = await request.get('/api/activity')

      expect(response.status()).toBe(429)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('Too many requests')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test(
    'API-ACTIVITY-RATE-REGRESSION: rate limiting protects activity API endpoints from abuse',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // PERFORMANCE NOTE: This test waits for rate limit window to expire.
      // Production: 60 seconds (RATE_LIMIT_WINDOW_SECONDS not set)
      // Test environment: 5 seconds (set RATE_LIMIT_WINDOW_SECONDS=5)
      // Runs in ~10 seconds with test config vs ~65 seconds with production config
      test.slow()

      // Setup: Start server with configurable rate limiting and activity logging
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })

      // Setup: Create authenticated user
      await createAuthenticatedUser()

      await test.step('API-ACTIVITY-RATE-001: Returns 429 after exceeding list activity rate limit', async () => {
        // WHEN: User exceeds default list activity rate limit
        for (let i = 0; i < 60; i++) {
          await request.get('/api/activity')
        }

        // THEN: 61st request returns 429 Too Many Requests
        const response = await request.get('/api/activity')

        expect(response.status()).toBe(429)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.message).toContain('Too many requests')
      })

      await test.step('API-ACTIVITY-RATE-004: Includes Retry-After header in 429 response', async () => {
        // WHEN: Rate limit is already exceeded from previous step
        const response = await request.get('/api/activity')

        // THEN: Response includes Retry-After header
        expect(response.status()).toBe(429)

        const retryAfter = response.headers()['retry-after']
        expect(retryAfter).toBeDefined()
        expect(parseInt(retryAfter!)).toBeGreaterThan(0)
      })

      await test.step('API-ACTIVITY-RATE-003: Resets activity rate limit after window expires', async () => {
        // WHEN: Wait for window to expire (5 seconds configured in fixtures + 1 second buffer)
        await new Promise((resolve) => setTimeout(resolve, 6000))

        const response = await request.get('/api/activity')

        // THEN: Should succeed after rate limit window expires
        expect(response.status()).not.toBe(429)
      })

      await test.step('API-ACTIVITY-RATE-006: Applies rate limit to filtered queries equally', async () => {
        // WHEN: User makes requests with different query filters
        for (let i = 0; i < 20; i++) {
          await request.get('/api/activity?tableName=tasks')
        }
        for (let i = 0; i < 20; i++) {
          await request.get('/api/activity?action=create')
        }
        for (let i = 0; i < 20; i++) {
          await request.get('/api/activity?action=update')
        }

        // THEN: 61st request returns 429 regardless of filter params
        const response = await request.get('/api/activity')

        expect(response.status()).toBe(429)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.message).toContain('Too many requests')
      })
    }
  )
})
