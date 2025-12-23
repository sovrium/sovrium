/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Organization Plugin Conditional Availability
 *
 * Domain: api/auth/organization
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per organization endpoint (4 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Plugin Conditional Availability:
 * - Organization endpoints MUST return 404 when organization plugin is not configured
 * - This prevents endpoint exposure when multi-tenancy features are intentionally disabled
 * - Better Auth conditional routing based on plugin configuration
 */

test.describe('Organization Plugin Disabled - Endpoint Availability', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per endpoint)
  // ============================================================================

  test(
    'API-AUTH-ORG-PLUGIN-001: create organization returns 404 without organization plugin',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Server with auth but WITHOUT organization plugin configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          // No organization plugin - organization endpoints should not exist
        },
      })

      // Create and authenticate a user (auth endpoints still work)
      await signUp({
        email: 'user@example.com',
        password: 'ValidPassword123!',
        name: 'Test User',
      })

      await signIn({
        email: 'user@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User attempts to create an organization
      const response = await page.request.post('/api/auth/organization/create', {
        data: {
          name: 'Test Organization',
          slug: 'test-org',
        },
      })

      // THEN: Returns 404 Not Found (endpoint does not exist without plugin)
      expect(response.status()).toBe(404)
    }
  )

  test(
    'API-AUTH-ORG-PLUGIN-002: list organizations returns 404 without organization plugin',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Server with auth but WITHOUT organization plugin configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          // No organization plugin
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'ValidPassword123!',
        name: 'Test User',
      })

      await signIn({
        email: 'user@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User attempts to list organizations
      const response = await page.request.get('/api/auth/organization/list')

      // THEN: Returns 404 Not Found (endpoint does not exist without plugin)
      expect(response.status()).toBe(404)
    }
  )

  test(
    'API-AUTH-ORG-PLUGIN-003: invite member returns 404 without organization plugin',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Server with auth but WITHOUT organization plugin configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          // No organization plugin
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'ValidPassword123!',
        name: 'Test User',
      })

      await signIn({
        email: 'user@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User attempts to invite a member to an organization
      const response = await page.request.post('/api/auth/organization/invite-member', {
        data: {
          email: 'member@example.com',
          organizationId: 'org-123',
          role: 'member',
        },
      })

      // THEN: Returns 404 Not Found (endpoint does not exist without plugin)
      expect(response.status()).toBe(404)
    }
  )

  test(
    'API-AUTH-ORG-PLUGIN-004: get organization returns 404 without organization plugin',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Server with auth but WITHOUT organization plugin configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          // No organization plugin
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'ValidPassword123!',
        name: 'Test User',
      })

      await signIn({
        email: 'user@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User attempts to get organization details
      const response = await page.request.get('/api/auth/organization/org-123')

      // THEN: Returns 404 Not Found (endpoint does not exist without plugin)
      expect(response.status()).toBe(404)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-ORG-PLUGIN-005: all organization endpoints return 404 without organization plugin',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      await test.step('Setup: Start server without organization plugin', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            // No organization plugin - all organization endpoints should be disabled
          },
        })
      })

      await test.step('Setup: Create and authenticate user', async () => {
        await signUp({
          email: 'user@example.com',
          password: 'ValidPassword123!',
          name: 'Test User',
        })

        await signIn({
          email: 'user@example.com',
          password: 'ValidPassword123!',
        })
      })

      await test.step('Verify all organization endpoints return 404', async () => {
        const organizationEndpoints = [
          {
            method: 'POST',
            path: '/api/auth/organization/create',
            data: { name: 'Test Org', slug: 'test' },
          },
          { method: 'GET', path: '/api/auth/organization/list' },
          {
            method: 'POST',
            path: '/api/auth/organization/invite-member',
            data: { email: 'member@example.com', organizationId: 'org-123' },
          },
          { method: 'GET', path: '/api/auth/organization/org-123' },
          { method: 'GET', path: '/api/auth/organization/list-members?organizationId=org-123' },
          {
            method: 'POST',
            path: '/api/auth/organization/set-active',
            data: { organizationId: 'org-123' },
          },
          {
            method: 'DELETE',
            path: '/api/auth/organization/remove-member',
            data: { userId: '123', organizationId: 'org-123' },
          },
          { method: 'GET', path: '/api/auth/organization/invitations' },
        ]

        for (const endpoint of organizationEndpoints) {
          const response =
            endpoint.method === 'GET'
              ? await page.request.get(endpoint.path)
              : endpoint.method === 'DELETE'
                ? await page.request.delete(endpoint.path, { data: endpoint.data })
                : await page.request.post(endpoint.path, { data: endpoint.data || {} })

          expect(response.status()).toBe(404)
        }
      })

      await test.step('Verify auth endpoints still work without organization plugin', async () => {
        // Session endpoint should work (not organization-related)
        const sessionResponse = await page.request.get('/api/auth/get-session')
        expect(sessionResponse.status()).toBe(200)
      })
    }
  )
})
