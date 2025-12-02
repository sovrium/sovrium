/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin: Get user by ID
 *
 * Source: specs/api/paths/auth/admin/get-user/get.json
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
 *
 * Note: Admin tests require an admin user. Since there's no public API to create
 * the first admin, these tests assume admin features are properly configured.
 */

test.describe('Admin: Get user by ID', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the admin endpoints
  // require proper admin user setup which isn't available via public API
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-GET-USER-001: should return 200 OK with user details',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user and an existing user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
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

      await signIn({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })

      // WHEN: Admin requests user details by ID
      const response = await page.request.get('/api/auth/admin/get-user?userId=2')

      // THEN: Returns 200 OK with user details
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('id')
      expect(data.user).toHaveProperty('email', 'target@example.com')
      expect(data.user).toHaveProperty('name', 'Target User')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-GET-USER-002: should return 400 Bad Request without userId parameter',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin requests user without userId parameter
      const response = await page.request.get('/api/auth/admin/get-user')

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-GET-USER-003: should return 401 Unauthorized without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { admin: true },
        },
      })

      // WHEN: Unauthenticated user attempts to get user
      const response = await page.request.get('/api/auth/admin/get-user?userId=2')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-GET-USER-004: should return 403 Forbidden for non-admin user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated regular user (non-admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
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
      await signIn({
        email: 'user@example.com',
        password: 'UserPass123!',
      })

      // WHEN: Regular user attempts to get another user's details
      const response = await page.request.get('/api/auth/admin/get-user?userId=2')

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-GET-USER-005: should return 404 Not Found for non-existent user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin requests user with non-existent ID
      const response = await page.request.get('/api/auth/admin/get-user?userId=999')

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-GET-USER-006: should return 200 OK with password field excluded',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user and an existing user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'target@example.com', password: 'TargetPass123!', name: 'Target User' })

      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin requests user details
      const response = await page.request.get('/api/auth/admin/get-user?userId=2')

      // THEN: Returns 200 OK with password field excluded for security
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      // Password should not be exposed
      expect(data.user).not.toHaveProperty('password')
      expect(data.user).not.toHaveProperty('password_hash')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-GET-USER-007: admin can complete full get-user workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { admin: true },
        },
      })

      // Test 1: Get user without auth fails
      const noAuthResponse = await page.request.get('/api/auth/admin/get-user?userId=1')
      expect(noAuthResponse.status()).toBe(401)

      // Create admin and regular user
      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'user@example.com', password: 'UserPass123!', name: 'Regular User' })

      // Test 2: Get user fails for non-admin
      await signIn({ email: 'user@example.com', password: 'UserPass123!' })
      const nonAdminResponse = await page.request.get('/api/auth/admin/get-user?userId=1')
      expect(nonAdminResponse.status()).toBe(403)

      // Test 3: Get user succeeds for admin
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })
      const adminResponse = await page.request.get('/api/auth/admin/get-user?userId=2')
      expect(adminResponse.status()).toBe(200)

      const data = await adminResponse.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('email', 'user@example.com')
      expect(data.user).not.toHaveProperty('password')
    }
  )
})
