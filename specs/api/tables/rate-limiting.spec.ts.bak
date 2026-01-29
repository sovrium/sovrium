/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Rate Limiting - Table API Endpoints
 *
 * Domain: api/tables
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests rate limiting behavior on table-related API endpoints to prevent
 * API abuse, resource exhaustion, and denial-of-service attacks.
 *
 * Table API endpoints use higher rate limits than authentication endpoints
 * because legitimate usage involves frequent data operations (CRUD on records).
 * Rate limits are applied per IP address to prevent abuse while allowing
 * authenticated users to perform bulk operations within reasonable bounds.
 *
 * Rate limiting targets for table endpoints:
 * - GET /api/tables (list): 100 requests per 60 seconds per IP
 * - GET /api/tables/:id/records (read): 100 requests per 60 seconds per IP
 * - POST /api/tables/:id/records (write): 50 requests per 60 seconds per IP
 *
 * Note: These tests validate default rate limiting behavior. If default limits
 * change, test assertions may need adjustment.
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

test.describe('Rate Limiting - Table API Endpoints', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'API-TABLES-RATE-001: should return 429 after exceeding list tables rate limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with default rate limiting enabled and tables configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            permissions: {
              read: { type: 'roles', roles: ['owner', 'admin', 'member'] },
            },
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User exceeds default list tables rate limit
      // Note: Test assumes default limit is 100 requests per 60 seconds
      for (let i = 0; i < 100; i++) {
        await request.get('/api/tables')
      }

      // THEN: 101st request returns 429 Too Many Requests
      const response = await request.get('/api/tables')

      expect(response.status()).toBe(429)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('Too many requests')
    }
  )

  test(
    'API-TABLES-RATE-002: should return 429 after exceeding record read rate limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with a table containing records
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
            permissions: {
              read: { type: 'roles', roles: ['owner', 'admin', 'member'] },
            },
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User exceeds default record read rate limit
      // Note: Test assumes default limit is 100 requests per 60 seconds
      for (let i = 0; i < 100; i++) {
        await request.get('/api/tables/1/records')
      }

      // THEN: 101st request returns 429 Too Many Requests
      const response = await request.get('/api/tables/1/records')

      expect(response.status()).toBe(429)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('Too many requests')
    }
  )

  test(
    'API-TABLES-RATE-003: should return 429 after exceeding record write rate limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with a table configured for writes
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
            permissions: {
              read: { type: 'roles', roles: ['owner', 'admin', 'member'] },
              create: { type: 'roles', roles: ['owner', 'admin', 'member'] },
            },
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User exceeds default record write rate limit
      // Note: Test assumes default write limit is 50 requests per 60 seconds
      // (write limits are stricter than read limits to prevent data flooding)
      for (let i = 0; i < 50; i++) {
        await request.post('/api/tables/1/records', {
          data: { title: `Task ${i}` },
        })
      }

      // THEN: 51st write request returns 429 Too Many Requests
      const response = await request.post('/api/tables/1/records', {
        data: { title: 'One more task' },
      })

      expect(response.status()).toBe(429)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('Too many requests')
    }
  )

  test(
    'API-TABLES-RATE-004: should reset table read rate limit after window expires',
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
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            permissions: {
              read: { type: 'roles', roles: ['owner', 'admin', 'member'] },
            },
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User hits default read rate limit (assumes 100 requests)
      for (let i = 0; i < 100; i++) {
        await request.get('/api/tables')
      }

      // Verify rate limit is hit
      const blockedResponse = await request.get('/api/tables')
      expect(blockedResponse.status()).toBe(429)

      // THEN: Wait for window to expire (5 seconds configured in fixtures + 1 second buffer)
      await new Promise((resolve) => setTimeout(resolve, 6000))

      const response = await request.get('/api/tables')

      // Should succeed after rate limit window expires
      expect(response.status()).toBe(200)
    }
  )

  test(
    'API-TABLES-RATE-005: should include Retry-After header in 429 response',
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
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            permissions: {
              read: { type: 'roles', roles: ['owner', 'admin', 'member'] },
            },
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User exceeds default rate limit
      // Note: Test assumes default limit is 100 requests per 60 seconds
      for (let i = 0; i < 100; i++) {
        await request.get('/api/tables')
      }

      const response = await request.get('/api/tables')

      // THEN: Response includes Retry-After header with positive integer
      expect(response.status()).toBe(429)

      const retryAfter = response.headers()['retry-after']
      expect(retryAfter).toBeDefined()
      expect(parseInt(retryAfter!)).toBeGreaterThan(0)
    }
  )

  test(
    'API-TABLES-RATE-006: should rate limit by IP address, not by authenticated user',
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
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            permissions: {
              read: { type: 'roles', roles: ['owner', 'admin', 'member'] },
            },
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
      for (let i = 0; i < 50; i++) {
        await request.get('/api/tables')
      }

      // Switch to user2 from same IP and continue
      await signIn({ email: 'user2@example.com', password: 'TestPassword123!' })
      for (let i = 0; i < 50; i++) {
        await request.get('/api/tables')
      }

      // THEN: Rate limit is enforced across all users from same IP (101st request total)
      const response = await request.get('/api/tables')

      expect(response.status()).toBe(429)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test(
    'API-TABLES-RATE-REGRESSION: rate limiting protects table API endpoints from abuse',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // PERFORMANCE NOTE: This test waits for rate limit window to expire.
      // Production: 60 seconds (RATE_LIMIT_WINDOW_SECONDS not set)
      // Test environment: 5 seconds (set RATE_LIMIT_WINDOW_SECONDS=5)
      // Runs in ~10 seconds with test config vs ~65 seconds with production config
      test.slow()

      // Setup: Start server with configurable rate limiting and tables
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text', required: true }],
            permissions: {
              read: { type: 'roles', roles: ['owner', 'admin', 'member'] },
              create: { type: 'roles', roles: ['owner', 'admin', 'member'] },
            },
          },
        ],
      })

      // Setup: Create authenticated user
      await createAuthenticatedUser()

      await test.step('API-TABLES-RATE-001: Returns 429 after exceeding list tables rate limit', async () => {
        // WHEN: User exceeds default list tables rate limit
        for (let i = 0; i < 100; i++) {
          await request.get('/api/tables')
        }

        // THEN: 101st request returns 429 Too Many Requests
        const response = await request.get('/api/tables')

        expect(response.status()).toBe(429)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.message).toContain('Too many requests')
      })

      await test.step('API-TABLES-RATE-005: Includes Retry-After header in 429 response', async () => {
        // WHEN: Rate limit is already exceeded from previous step
        const response = await request.get('/api/tables')

        // THEN: Response includes Retry-After header
        expect(response.status()).toBe(429)

        const retryAfter = response.headers()['retry-after']
        expect(retryAfter).toBeDefined()
        expect(parseInt(retryAfter!)).toBeGreaterThan(0)
      })

      await test.step('API-TABLES-RATE-004: Resets table read rate limit after window expires', async () => {
        // WHEN: Wait for window to expire (5 seconds configured in fixtures + 1 second buffer)
        await new Promise((resolve) => setTimeout(resolve, 6000))

        const response = await request.get('/api/tables')

        // THEN: Should succeed after rate limit window expires
        expect(response.status()).toBe(200)
      })

      await test.step('API-TABLES-RATE-003: Returns 429 after exceeding record write rate limit', async () => {
        // WHEN: User exceeds default record write rate limit
        for (let i = 0; i < 50; i++) {
          await request.post('/api/tables/1/records', {
            data: { name: `Project ${i}` },
          })
        }

        // THEN: 51st write request returns 429 Too Many Requests
        const response = await request.post('/api/tables/1/records', {
          data: { name: 'One more project' },
        })

        expect(response.status()).toBe(429)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.message).toContain('Too many requests')
      })
    }
  )
})
