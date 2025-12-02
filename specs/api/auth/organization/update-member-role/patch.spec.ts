/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Update member role
 *
 * Source: specs/api/paths/auth/organization/update-member-role/patch.json
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('Update member role', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-UPDATE-MEMBER-ROLE-001: should return 200 OK with updated member data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner and an existing member
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      // Create owner and organization
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

      // Sign back in as owner and add member
      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      await page.request.post('/api/auth/organization/add-member', {
        data: {
          organizationId: org.id,
          userId: '2',
          role: 'member',
        },
      })

      // WHEN: Owner updates member role to admin
      const response = await page.request.patch('/api/auth/organization/update-member-role', {
        data: {
          organizationId: org.id,
          userId: '2',
          role: 'admin',
        },
      })

      // THEN: Returns 200 OK with updated member data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('member')
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-MEMBER-ROLE-002: should return 400 Bad Request with validation errors',
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

      await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })

      // WHEN: Owner submits request without required fields
      const response = await page.request.patch('/api/auth/organization/update-member-role', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation errors
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-MEMBER-ROLE-003: should return 401 Unauthorized',
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

      // WHEN: Unauthenticated user attempts to update member role
      const response = await page.request.patch('/api/auth/organization/update-member-role', {
        data: {
          organizationId: '1',
          userId: '2',
          role: 'admin',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-MEMBER-ROLE-004: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated regular member (not owner/admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      // Create owner and organization
      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // Create two members
      await signUp({
        email: 'member1@example.com',
        password: 'Member1Pass123!',
        name: 'Member 1',
      })
      await signUp({
        email: 'member2@example.com',
        password: 'Member2Pass123!',
        name: 'Member 2',
      })

      // Owner adds both as members
      await page.request.post('/api/auth/organization/add-member', {
        data: { organizationId: org.id, userId: '2', role: 'member' },
      })
      await page.request.post('/api/auth/organization/add-member', {
        data: { organizationId: org.id, userId: '3', role: 'member' },
      })

      // Sign in as member1
      await signIn({
        email: 'member1@example.com',
        password: 'Member1Pass123!',
      })

      // WHEN: Member attempts to update another member's role
      const response = await page.request.patch('/api/auth/organization/update-member-role', {
        data: {
          organizationId: org.id,
          userId: '3',
          role: 'admin',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-MEMBER-ROLE-005: should return 404 Not Found',
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

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // WHEN: Owner attempts to update role of non-existent member
      const response = await page.request.patch('/api/auth/organization/update-member-role', {
        data: {
          organizationId: org.id,
          userId: 'nonexistent-user-id',
          role: 'admin',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-MEMBER-ROLE-006: should return 200 OK (idempotent operation)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated organization owner and an existing admin member
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
      })

      // Create owner and organization
      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const createResponse = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Test Org', slug: 'test-org' },
      })
      const org = await createResponse.json()

      // Create member and add as admin
      await signUp({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        name: 'Admin User',
      })

      await signIn({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
      })

      await page.request.post('/api/auth/organization/add-member', {
        data: { organizationId: org.id, userId: '2', role: 'admin' },
      })

      // WHEN: Owner updates member role to their current role
      const response = await page.request.patch('/api/auth/organization/update-member-role', {
        data: {
          organizationId: org.id,
          userId: '2',
          role: 'admin',
        },
      })

      // THEN: Returns 200 OK (idempotent operation)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('member')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-UPDATE-MEMBER-ROLE-007: user can complete full updateMemberRole workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      await test.step('Setup: Start server with organization plugin', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            plugins: { organization: true },
          },
        })
      })

      await test.step('Verify update member role fails without auth', async () => {
        const noAuthResponse = await page.request.patch(
          '/api/auth/organization/update-member-role',
          {
            data: { organizationId: '1', userId: '2', role: 'admin' },
          }
        )
        expect(noAuthResponse.status()).toBe(401)
      })

      let orgId: string

      await test.step('Setup: Create owner and organization', async () => {
        await signUp({
          email: 'owner@example.com',
          password: 'OwnerPass123!',
          name: 'Owner User',
        })

        const createResponse = await page.request.post('/api/auth/organization/create', {
          data: { name: 'Test Org', slug: 'test-org' },
        })
        const org = await createResponse.json()
        orgId = org.id
      })

      await test.step('Setup: Create and add member', async () => {
        await signUp({
          email: 'member@example.com',
          password: 'MemberPass123!',
          name: 'Member User',
        })

        await signIn({
          email: 'owner@example.com',
          password: 'OwnerPass123!',
        })

        await page.request.post('/api/auth/organization/add-member', {
          data: { organizationId: orgId, userId: '2', role: 'member' },
        })
      })

      await test.step('Update member role to admin', async () => {
        const updateResponse = await page.request.patch(
          '/api/auth/organization/update-member-role',
          {
            data: {
              organizationId: orgId,
              userId: '2',
              role: 'admin',
            },
          }
        )
        expect(updateResponse.status()).toBe(200)

        const data = await updateResponse.json()
        expect(data).toHaveProperty('member')
      })

      await test.step('Verify update non-existent member fails', async () => {
        const notFoundResponse = await page.request.patch(
          '/api/auth/organization/update-member-role',
          {
            data: {
              organizationId: orgId,
              userId: 'nonexistent-id',
              role: 'admin',
            },
          }
        )
        expect(notFoundResponse.status()).toBe(404)
      })
    }
  )
})
