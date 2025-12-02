/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Disabled Auth Endpoints
 *
 * Domain: api/auth
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Disabled Auth Scenarios:
 * - No auth config means no auth endpoints available
 * - All auth routes return 404 when auth is not configured
 */

test.describe('Disabled Auth Endpoints', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'API-AUTH-DISABLED-001: should return 404 for sign-up endpoint when auth is not configured',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with no auth configuration
      await startServerWithSchema({
        name: 'test-app',
        // No auth config - auth endpoints should be disabled
      })

      // WHEN: User attempts to access sign-up endpoint
      const response = await page.request.post('/api/auth/sign-up/email', {
        data: {
          email: 'test@example.com',
          password: 'Password123!',
          name: 'Test User',
        },
      })

      // THEN: Returns 404 Not Found (endpoint does not exist)
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-DISABLED-002: should return 404 for sign-in endpoint when auth is not configured',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with no auth configuration
      await startServerWithSchema({
        name: 'test-app',
        // No auth config - auth endpoints should be disabled
      })

      // WHEN: User attempts to access sign-in endpoint
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'test@example.com',
          password: 'Password123!',
        },
      })

      // THEN: Returns 404 Not Found (endpoint does not exist)
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-DISABLED-003: should return 404 for session endpoints when auth is not configured',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with no auth configuration
      await startServerWithSchema({
        name: 'test-app',
        // No auth config - auth endpoints should be disabled
      })

      // WHEN: User attempts to access session endpoint
      const response = await page.request.get('/api/auth/get-session')

      // THEN: Returns 404 Not Found (endpoint does not exist)
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-DISABLED-004: should return 404 for admin endpoints when auth features do not include admin',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with auth but without admin feature
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          // No features - admin endpoints should be disabled
        },
      })

      // WHEN: User attempts to access admin endpoint
      const response = await page.request.get('/api/auth/admin/list-users')

      // THEN: Returns 404 Not Found (endpoint does not exist)
      expect(response.status()).toBe(404)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-DISABLED-005: all auth endpoints should be disabled when no auth config',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with no auth configuration
      await startServerWithSchema({
        name: 'test-app',
        // No auth config - all auth endpoints should be disabled
      })

      // WHEN: User attempts to access various auth endpoints
      const authEndpoints = [
        { method: 'POST', path: '/api/auth/sign-up/email' },
        { method: 'POST', path: '/api/auth/sign-in/email' },
        { method: 'GET', path: '/api/auth/get-session' },
        { method: 'POST', path: '/api/auth/sign-out' },
        { method: 'POST', path: '/api/auth/change-password' },
        { method: 'POST', path: '/api/auth/request-password-reset' },
        { method: 'GET', path: '/api/auth/admin/list-users' },
        { method: 'GET', path: '/api/auth/organization/list-organizations' },
      ]

      // THEN: All endpoints return 404 Not Found
      for (const endpoint of authEndpoints) {
        const response =
          endpoint.method === 'GET'
            ? await page.request.get(endpoint.path)
            : await page.request.post(endpoint.path, { data: {} })

        expect(response.status()).toBe(404)
      }
    }
  )
})
