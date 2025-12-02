/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin: Impersonate user
 *
 * Source: specs/api/paths/auth/admin/impersonate-user/post.json
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
 *
 * Note: Admin tests require an admin user. Since there's no public API to create
 * the first admin, these tests assume admin features are properly configured.
 */

test.describe('Admin: Impersonate user', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the admin endpoints
  // require proper admin user setup which isn't available via public API
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-USER-001: should return 200 OK with impersonation session',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated admin user and an existing user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      await signUp({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        name: 'Admin User',
      })
      await signUp({
        email: 'target@example.com',
        password: 'TargetPass123!',
        name: 'Target User',
      })

      // WHEN: Admin impersonates the user
      const response = await page.request.post('/api/auth/admin/impersonate-user', {
        data: {
          userId: '2',
        },
      })

      // THEN: Returns 200 OK with impersonation session
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('session')
      expect(data).toHaveProperty('user')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-USER-002: should return 400 Bad Request without userId',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })

      // WHEN: Admin submits request without userId
      const response = await page.request.post('/api/auth/admin/impersonate-user', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-USER-003: should return 401 Unauthorized without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      // WHEN: Unauthenticated user attempts to impersonate user
      const response = await page.request.post('/api/auth/admin/impersonate-user', {
        data: {
          userId: '2',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-USER-004: should return 403 Forbidden for non-admin user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated regular user (non-admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Regular User',
      })
      await signUp({
        email: 'target@example.com',
        password: 'TargetPass123!',
        name: 'Target User',
      })

      // WHEN: Regular user attempts to impersonate another user
      const response = await page.request.post('/api/auth/admin/impersonate-user', {
        data: {
          userId: '2',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-USER-005: should return 403 Forbidden for banned user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated admin user and a banned user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'target@example.com', password: 'TargetPass123!', name: 'Target User' })

      // Ban the user first
      await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: '2' },
      })

      // WHEN: Admin attempts to impersonate banned user
      const response = await page.request.post('/api/auth/admin/impersonate-user', {
        data: {
          userId: '2',
        },
      })

      // THEN: Returns 403 Forbidden (cannot impersonate banned users)
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-USER-006: should return 404 Not Found for non-existent user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })

      // WHEN: Admin attempts to impersonate non-existent user
      const response = await page.request.post('/api/auth/admin/impersonate-user', {
        data: {
          userId: '999',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-USER-007: should return 200 OK with audit trail',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated admin user and an existing user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'target@example.com', password: 'TargetPass123!', name: 'Target User' })

      // WHEN: Admin impersonates user
      const response = await page.request.post('/api/auth/admin/impersonate-user', {
        data: {
          userId: '2',
        },
      })

      // THEN: Returns 200 OK and creates audit trail in session metadata
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('session')
      // Session should include impersonation metadata for audit
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-IMPERSONATE-USER-008: admin can complete full impersonate-user workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      await test.step('Setup: Start server with admin plugin', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            plugins: { admin: true },
          },
        })
      })

      await test.step('Verify impersonate user fails without auth', async () => {
        const noAuthResponse = await page.request.post('/api/auth/admin/impersonate-user', {
          data: { userId: '2' },
        })
        expect(noAuthResponse.status()).toBe(401)
      })

      await test.step('Setup: Create admin and regular user', async () => {
        await signUp({
          email: 'admin@example.com',
          password: 'AdminPass123!',
          name: 'Admin User',
        })
        await signUp({ email: 'user@example.com', password: 'UserPass123!', name: 'Regular User' })
      })

      await test.step('Verify impersonate user fails for non-admin', async () => {
        await signIn({ email: 'user@example.com', password: 'UserPass123!' })
        const nonAdminResponse = await page.request.post('/api/auth/admin/impersonate-user', {
          data: { userId: '1' },
        })
        expect(nonAdminResponse.status()).toBe(403)
      })

      await test.step('Impersonate user as admin', async () => {
        await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })
        const adminResponse = await page.request.post('/api/auth/admin/impersonate-user', {
          data: { userId: '2' },
        })
        expect(adminResponse.status()).toBe(200)

        const data = await adminResponse.json()
        expect(data).toHaveProperty('session')
        expect(data).toHaveProperty('user')
      })
    }
  )
})
