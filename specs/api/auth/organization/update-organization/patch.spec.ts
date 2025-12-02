/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Update organization
 *
 * Source: specs/api/paths/auth/organization/update-organization/patch.json
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('Update organization', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-001: should return 200 OK with updated organization data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      // Create organization
      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Old Name', slug: 'old-slug' },
      })
      const org = await createResponse.json()

      // WHEN: Owner updates organization details
      const response = await page.request.patch('/api/auth/organization/update', {
        data: {
          organizationId: org.id,
          data: {
            name: 'New Name',
            slug: 'new-slug',
          },
        },
      })

      // THEN: Returns 200 OK with updated organization data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('name', 'New Name')
      expect(data).toHaveProperty('slug', 'new-slug')
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-002: should return 200 OK with name updated, slug unchanged',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      // Create organization
      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Old Name', slug: 'unchanged-slug' },
      })
      const org = await createResponse.json()

      // WHEN: Owner updates only name field
      const response = await page.request.patch('/api/auth/organization/update', {
        data: {
          organizationId: org.id,
          data: { name: 'Updated Name Only' },
        },
      })

      // THEN: Returns 200 OK with name updated, slug unchanged
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('name', 'Updated Name Only')
      expect(data).toHaveProperty('slug', 'unchanged-slug')
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-003: should return 400 Bad Request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      // WHEN: Owner submits request without organizationId
      const response = await page.request.patch('/api/auth/organization/update', {
        data: {
          data: { name: 'New Name' },
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-004: should return 401 Unauthorized',
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

      // WHEN: Unauthenticated user attempts to update organization
      const response = await page.request.patch('/api/auth/organization/update', {
        data: {
          organizationId: '1',
          data: { name: 'New Name' },
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-005: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization member (non-owner)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      // Owner creates organization
      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // Create member
      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      // Invite member (owner invites)
      await page.request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: org.id,
          email: 'member@example.com',
          role: 'member',
        },
      })

      // Sign in as member
      await signIn({
        email: 'member@example.com',
        password: 'MemberPass123!',
      })

      // WHEN: Member attempts to update organization
      const response = await page.request.patch('/api/auth/organization/update', {
        data: {
          organizationId: org.id,
          data: { name: 'New Name' },
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-006: should return 404 Not Found',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user
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

      // WHEN: User attempts to update non-existent organization
      const response = await page.request.patch('/api/auth/organization/update', {
        data: {
          organizationId: 'nonexistent-id',
          data: { name: 'New Name' },
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-007: should return 409 Conflict error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated organization owner and another existing organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      // Create first organization
      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'My Org', slug: 'my-org' },
      })
      const myOrg = await createResponse.json()

      // Create second organization
      await page.request.post('/api/auth/organization/create', {
        data: { name: 'Existing Org', slug: 'existing-slug' },
      })

      // WHEN: Owner attempts to update slug to existing slug
      const response = await page.request.patch('/api/auth/organization/update', {
        data: {
          organizationId: myOrg.id,
          data: { slug: 'existing-slug' },
        },
      })

      // THEN: Returns 409 Conflict error
      expect(response.status()).toBe(409)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-008: user can complete full updateOrganization workflow',
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

      await test.step('Verify update organization fails without auth', async () => {
        const noAuthResponse = await page.request.patch('/api/auth/organization/update', {
          data: { organizationId: '1', data: { name: 'New Name' } },
        })
        expect(noAuthResponse.status()).toBe(401)
      })

      let orgId: string

      await test.step('Setup: Create and authenticate user', async () => {
        await signUp({
          email: 'owner@example.com',
          password: 'OwnerPass123!',
          name: 'Owner User',
        })
      })

      await test.step('Setup: Create organization', async () => {
        const createResponse = await page.request.post('/api/auth/organization/create', {
          data: { name: 'Original Name', slug: 'original-slug' },
        })
        const org = await createResponse.json()
        orgId = org.id
      })

      await test.step('Update organization with new name', async () => {
        const updateResponse = await page.request.patch('/api/auth/organization/update', {
          data: {
            organizationId: orgId,
            data: { name: 'Updated Name' },
          },
        })
        expect(updateResponse.status()).toBe(200)

        const data = await updateResponse.json()
        expect(data).toHaveProperty('name', 'Updated Name')
      })

      await test.step('Verify update non-existent organization fails', async () => {
        const notFoundResponse = await page.request.patch('/api/auth/organization/update', {
          data: {
            organizationId: 'nonexistent-id',
            data: { name: 'New Name' },
          },
        })
        expect(notFoundResponse.status()).toBe(404)
      })
    }
  )
})
