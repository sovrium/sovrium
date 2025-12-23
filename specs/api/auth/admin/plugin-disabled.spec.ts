/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test } from '@/specs/fixtures'

/**
 * E2E Tests for Admin Plugin Conditional Availability
 *
 * Domain: api/auth/admin
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per admin endpoint (4 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Plugin Conditional Availability:
 * - Admin endpoints MUST return 404 when admin plugin is not configured
 * - This prevents endpoint exposure when features are intentionally disabled
 * - Better Auth conditional routing based on plugin configuration
 */

test.describe('Admin Plugin Disabled - Endpoint Availability', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per endpoint)
  // ============================================================================

  test(
    'API-AUTH-ADMIN-PLUGIN-001: list users endpoint returns 404 without admin plugin',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Server with auth but WITHOUT admin plugin configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          // No admin plugin - admin endpoints should not exist
        },
      })

      // Create and authenticate a user (signUp auto-authenticates)
      await signUp({
        email: 'user@example.com',
        password: 'ValidPassword123!',
        name: 'Test User',
      })

      // WHEN: User attempts to access list users endpoint
      const response = await page.request.get('/api/auth/admin/list-users')

      // THEN: Returns 404 Not Found (endpoint does not exist without plugin)
      expect(response.status()).toBe(404)
    }
  )

  test(
    'API-AUTH-ADMIN-PLUGIN-002: get user endpoint returns 404 without admin plugin',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Server with auth but WITHOUT admin plugin configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          // No admin plugin
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'ValidPassword123!',
        name: 'Test User',
      })

      // WHEN: User attempts to access get user endpoint with any user ID
      const response = await page.request.get('/api/auth/admin/user/123')

      // THEN: Returns 404 Not Found (endpoint does not exist without plugin)
      expect(response.status()).toBe(404)
    }
  )

  test(
    'API-AUTH-ADMIN-PLUGIN-003: ban user endpoint returns 404 without admin plugin',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Server with auth but WITHOUT admin plugin configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          // No admin plugin
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'ValidPassword123!',
        name: 'Test User',
      })

      // WHEN: User attempts to ban a user via admin endpoint
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {
          userId: '123',
          reason: 'Test ban',
        },
      })

      // THEN: Returns 404 Not Found (endpoint does not exist without plugin)
      expect(response.status()).toBe(404)
    }
  )

  test(
    'API-AUTH-ADMIN-PLUGIN-004: set role endpoint returns 404 without admin plugin',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Server with auth but WITHOUT admin plugin configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          // No admin plugin
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'ValidPassword123!',
        name: 'Test User',
      })

      // WHEN: User attempts to set user role via admin endpoint
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: '123',
          role: 'admin',
        },
      })

      // THEN: Returns 404 Not Found (endpoint does not exist without plugin)
      expect(response.status()).toBe(404)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-ADMIN-PLUGIN-005: all admin endpoints return 404 without admin plugin',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp }) => {
      await test.step('Setup: Start server without admin plugin', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            // No admin plugin - all admin endpoints should be disabled
          },
        })
      })

      await test.step('Setup: Create and authenticate user', async () => {
        await signUp({
          email: 'user@example.com',
          password: 'ValidPassword123!',
          name: 'Test User',
        })
      })

      await test.step('Verify all admin endpoints return 404', async () => {
        const adminEndpoints = [
          { method: 'GET', path: '/api/auth/admin/list-users' },
          { method: 'GET', path: '/api/auth/admin/user/123' },
          { method: 'POST', path: '/api/auth/admin/ban-user', data: { userId: '123' } },
          {
            method: 'POST',
            path: '/api/auth/admin/set-role',
            data: { userId: '123', role: 'admin' },
          },
          { method: 'POST', path: '/api/auth/admin/create-user', data: {} },
          { method: 'POST', path: '/api/auth/admin/unban-user', data: { userId: '123' } },
        ]

        for (const endpoint of adminEndpoints) {
          const response =
            endpoint.method === 'GET'
              ? await page.request.get(endpoint.path)
              : await page.request.post(endpoint.path, { data: endpoint.data || {} })

          expect(response.status()).toBe(404)
        }
      })

      await test.step('Verify auth endpoints still work without admin plugin', async () => {
        // Session endpoint should work (not admin-related)
        const sessionResponse = await page.request.get('/api/auth/get-session')
        expect(sessionResponse.status()).toBe(200)
      })
    }
  )
})
