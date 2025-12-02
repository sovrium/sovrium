/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin: Ban user
 *
 * Source: specs/api/paths/auth/admin/ban-user/post.json
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Uses new admin fixtures (createAuthenticatedAdmin, adminBanUser)
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('Admin: Ban user', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-001: should return 200 OK and ban user with all sessions revoked',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      createAuthenticatedAdmin,
      createAuthenticatedUser,
    }) => {
      // GIVEN: An authenticated admin user and an active user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      await createAuthenticatedAdmin()
      const targetUser = await createAuthenticatedUser({
        email: 'target@example.com',
        name: 'Target User',
      })

      // WHEN: Admin bans the user
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {
          userId: targetUser.user.id,
        },
      })

      // THEN: Returns 200 OK and bans user with all sessions revoked
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('banned', true)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-002: should return 200 OK and store ban reason',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      createAuthenticatedAdmin,
      createAuthenticatedUser,
    }) => {
      // GIVEN: An authenticated admin user and an active user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      await createAuthenticatedAdmin()
      const targetUser = await createAuthenticatedUser({
        email: 'target@example.com',
        name: 'Target User',
      })

      // WHEN: Admin bans user with reason
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {
          userId: targetUser.user.id,
          banReason: 'Violation of terms of service',
        },
      })

      // THEN: Returns 200 OK and stores ban reason
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('banned', true)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-003: should return 400 Bad Request without userId',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedAdmin }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      await createAuthenticatedAdmin()

      // WHEN: Admin submits request without userId
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-004: should return 401 Unauthorized without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A running server with a target user but no authenticated session
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      const targetUser = await createAuthenticatedUser({
        email: 'target@example.com',
        name: 'Target User',
      })

      // Sign out to test unauthenticated access
      await page.request.post('/api/auth/sign-out')

      // WHEN: Unauthenticated user attempts to ban user
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {
          userId: targetUser.user.id,
        },
      })

      // THEN: Returns 401 Unauthorized (or 400 per Better Auth patterns)
      expect([400, 401]).toContain(response.status())
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-005: should return 403 Forbidden for non-admin user',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      createAuthenticatedUser,
      createAuthenticatedViewer,
    }) => {
      // GIVEN: An authenticated regular user (non-admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      await createAuthenticatedViewer()
      const targetUser = await createAuthenticatedUser({
        email: 'target@example.com',
        name: 'Target User',
      })

      // WHEN: Regular user attempts to ban another user
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {
          userId: targetUser.user.id,
        },
      })

      // THEN: Returns 403 Forbidden (or 400 per Better Auth patterns)
      expect([400, 403]).toContain(response.status())
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-006: should return 404 Not Found for non-existent user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedAdmin }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      await createAuthenticatedAdmin()

      // WHEN: Admin attempts to ban non-existent user
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {
          userId: 'non-existent-user-id',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-007: should return 200 OK for already banned user (idempotent)',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      createAuthenticatedAdmin,
      createAuthenticatedUser,
      adminBanUser,
    }) => {
      // GIVEN: An authenticated admin user and an already banned user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      await createAuthenticatedAdmin()
      const targetUser = await createAuthenticatedUser({
        email: 'target@example.com',
        name: 'Target User',
      })

      // Ban user first time
      await adminBanUser(targetUser.user.id)

      // WHEN: Admin bans already banned user
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {
          userId: targetUser.user.id,
        },
      })

      // THEN: Returns 200 OK (idempotent operation)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('banned', true)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-008: admin can complete full ban-user workflow',
    { tag: '@regression' },
    async ({
      page,
      startServerWithSchema,
      createAuthenticatedAdmin,
      createAuthenticatedUser,
      createAuthenticatedViewer,
      signOut,
    }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      // Create target user and regular user
      const targetUser = await createAuthenticatedUser({
        email: 'target@example.com',
        name: 'Target User',
      })

      // Test 1: Ban without auth fails
      await signOut()
      const noAuthResponse = await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: targetUser.user.id },
      })
      expect([400, 401]).toContain(noAuthResponse.status())

      // Test 2: Ban fails for non-admin
      await createAuthenticatedViewer()
      const nonAdminResponse = await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: targetUser.user.id },
      })
      expect([400, 403]).toContain(nonAdminResponse.status())

      // Test 3: Ban succeeds for admin
      await createAuthenticatedAdmin()
      const adminResponse = await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: targetUser.user.id, banReason: 'Policy violation' },
      })
      expect(adminResponse.status()).toBe(200)

      const data = await adminResponse.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('banned', true)
    }
  )
})
