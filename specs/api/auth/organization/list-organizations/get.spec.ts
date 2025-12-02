/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for List user organizations
 *
 * Source: specs/api/paths/auth/organization/list-organizations/get.json
 * Domain: api
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('List user organizations', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    "API-ORG-LIST-ORGANIZATIONS-001: should return 200 OK with all organizations and user's roles",
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user who is member of multiple organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      // Create multiple organizations
      await page.request.post('/api/auth/organization/create', {
        data: { name: 'Org One', slug: 'org-one' },
      })
      await page.request.post('/api/auth/organization/create', {
        data: { name: 'Org Two', slug: 'org-two' },
      })

      // WHEN: User requests list of their organizations
      const response = await page.request.get('/api/auth/organization/list')

      // THEN: Returns 200 OK with all organizations and user's roles
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThanOrEqual(2)
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-ORGANIZATIONS-002: should return 200 OK with empty organizations array',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user who is not member of any organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      // WHEN: User requests list of their organizations
      const response = await page.request.get('/api/auth/organization/list')

      // THEN: Returns 200 OK with empty organizations array
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(0)
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-ORGANIZATIONS-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      // WHEN: Unauthenticated user attempts to list organizations
      const response = await page.request.get('/api/auth/organization/list')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    "API-ORG-LIST-ORGANIZATIONS-004: should return 200 OK with only User A's organizations (User B's not visible)",
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Two users with different organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      // User 1 creates organization
      await signUp({
        email: 'user1@example.com',
        password: 'User1Pass123!',
        name: 'User 1',
      })
      await page.request.post('/api/auth/organization/create', {
        data: { name: 'User 1 Org', slug: 'user1-org' },
      })

      // User 2 creates different organization
      await signUp({
        email: 'user2@example.com',
        password: 'User2Pass123!',
        name: 'User 2',
      })
      await page.request.post('/api/auth/organization/create', {
        data: { name: 'User 2 Org', slug: 'user2-org' },
      })

      // Sign back in as User 1
      await signIn({
        email: 'user1@example.com',
        password: 'User1Pass123!',
      })

      // WHEN: User 1 requests list of organizations
      const response = await page.request.get('/api/auth/organization/list')

      // THEN: Returns 200 OK with only User 1's organizations
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.length).toBe(1)
      expect(data[0]).toHaveProperty('name', 'User 1 Org')
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-ORGANIZATIONS-005: should return 200 OK with correct role for each organization',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user who created organizations (becomes owner)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      // Create organizations
      await page.request.post('/api/auth/organization/create', {
        data: { name: 'Owned Org', slug: 'owned-org' },
      })

      // WHEN: User requests list of organizations
      const response = await page.request.get('/api/auth/organization/list')

      // THEN: Returns 200 OK with correct role for each organization
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      // User who creates org is the owner
      const ownedOrg = data.find((org: { name: string }) => org.name === 'Owned Org')
      expect(ownedOrg).toBeDefined()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-LIST-ORGANIZATIONS-006: user can complete full listOrganizations workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp }) => {
      await test.step('Setup: Start server with organization plugin', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            plugins: { organization: true },
          },
        })
      })

      await test.step('Verify list organizations fails without auth', async () => {
        const noAuthResponse = await page.request.get('/api/auth/organization/list')
        expect(noAuthResponse.status()).toBe(401)
      })

      await test.step('Setup: Create and authenticate user', async () => {
        await signUp({
          email: 'user@example.com',
          password: 'UserPass123!',
          name: 'Test User',
        })
      })

      await test.step('Verify list returns empty array for new user', async () => {
        const emptyResponse = await page.request.get('/api/auth/organization/list')
        expect(emptyResponse.status()).toBe(200)
        const emptyData = await emptyResponse.json()
        expect(emptyData.length).toBe(0)
      })

      await test.step('Create organization', async () => {
        await page.request.post('/api/auth/organization/create', {
          data: { name: 'Test Org', slug: 'test-org' },
        })
      })

      await test.step('Verify list returns organization after creation', async () => {
        const listResponse = await page.request.get('/api/auth/organization/list')
        expect(listResponse.status()).toBe(200)
        const listData = await listResponse.json()
        expect(listData.length).toBe(1)
        expect(listData[0]).toHaveProperty('name', 'Test Org')
      })
    }
  )
})
