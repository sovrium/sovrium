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
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Server with auth but WITHOUT organization plugin configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          // No organization plugin - organization endpoints should not exist
        },
      })

      // Create and authenticate a user (signUp auto-authenticates)
      await signUp({
        email: 'user@example.com',
        password: 'ValidPassword123!',
        name: 'Test User',
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
    async ({ page, startServerWithSchema, signUp }) => {
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

      // WHEN: User attempts to list organizations
      const response = await page.request.get('/api/auth/organization/list')

      // THEN: Returns 404 Not Found (endpoint does not exist without plugin)
      expect(response.status()).toBe(404)
    }
  )

  test(
    'API-AUTH-ORG-PLUGIN-003: invite member returns 404 without organization plugin',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
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
    async ({ page, startServerWithSchema, signUp }) => {
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
    'API-AUTH-ORG-PLUGIN-REGRESSION: organization endpoints unavailable without plugin',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp }) => {
      await test.step('Setup: Start server with comprehensive configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            // No organization plugin - organization endpoints should not exist
          },
        })

        // Create and authenticate a user (signUp auto-authenticates)
        await signUp({
          email: 'user@example.com',
          password: 'ValidPassword123!',
          name: 'Test User',
        })
      })

      await test.step('API-AUTH-ORG-PLUGIN-001: Creates organization returns 404 without plugin', async () => {
        // WHEN: User attempts to create an organization
        const response = await page.request.post('/api/auth/organization/create', {
          data: {
            name: 'Test Organization',
            slug: 'test-org',
          },
        })

        // THEN: Returns 404 Not Found (endpoint does not exist without plugin)
        expect(response.status()).toBe(404)
      })

      await test.step('API-AUTH-ORG-PLUGIN-002: Lists organizations returns 404 without plugin', async () => {
        // WHEN: User attempts to list organizations
        const response = await page.request.get('/api/auth/organization/list')

        // THEN: Returns 404 Not Found (endpoint does not exist without plugin)
        expect(response.status()).toBe(404)
      })

      await test.step('API-AUTH-ORG-PLUGIN-003: Invites member returns 404 without plugin', async () => {
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
      })

      await test.step('API-AUTH-ORG-PLUGIN-004: Gets organization returns 404 without plugin', async () => {
        // WHEN: User attempts to get organization details
        const response = await page.request.get('/api/auth/organization/org-123')

        // THEN: Returns 404 Not Found (endpoint does not exist without plugin)
        expect(response.status()).toBe(404)
      })
    }
  )
})
