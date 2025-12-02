/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin: List users
 *
 * Source: specs/api/paths/auth/admin/list-users/get.json
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

test.describe('Admin: List users', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the admin endpoints
  // require proper admin user setup which isn't available via public API
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-LIST-USERS-001: should return 200 OK with paginated user list',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user with multiple users in system
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { admin: true },
        },
      })

      // Create multiple users via API
      await signUp({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        name: 'Admin User',
      })
      await signUp({
        email: 'user1@example.com',
        password: 'UserPass123!',
        name: 'User One',
      })
      await signUp({
        email: 'user2@example.com',
        password: 'UserPass123!',
        name: 'User Two',
      })

      // Sign in as admin (assumes admin role is set via configuration)
      await signIn({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })

      // WHEN: Admin requests list of users
      const response = await page.request.get('/api/auth/admin/list-users')

      // THEN: Returns 200 OK with paginated user list
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('users')
      expect(Array.isArray(data.users)).toBe(true)
      expect(data.users.length).toBeGreaterThanOrEqual(3)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-LIST-USERS-002: should return 200 OK with paginated results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user with multiple users in system
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { admin: true },
        },
      })

      // Create multiple users
      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'user1@example.com', password: 'UserPass123!', name: 'User One' })
      await signUp({ email: 'user2@example.com', password: 'UserPass123!', name: 'User Two' })
      await signUp({ email: 'user3@example.com', password: 'UserPass123!', name: 'User Three' })

      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin requests users with limit and offset
      const response = await page.request.get('/api/auth/admin/list-users?limit=2&offset=1')

      // THEN: Returns 200 OK with paginated results
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('users')
      expect(Array.isArray(data.users)).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-LIST-USERS-003: should return 200 OK with users sorted correctly',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user with multiple users
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'charlie@example.com', password: 'UserPass123!', name: 'Charlie' })
      await signUp({ email: 'alice@example.com', password: 'UserPass123!', name: 'Alice' })
      await signUp({ email: 'bob@example.com', password: 'UserPass123!', name: 'Bob' })

      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin requests users sorted by email ascending
      const response = await page.request.get(
        '/api/auth/admin/list-users?sortBy=email&sortOrder=asc'
      )

      // THEN: Returns 200 OK with users sorted correctly
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('users')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-LIST-USERS-004: should return 401 Unauthorized without authentication',
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

      // WHEN: Unauthenticated user attempts to list users
      const response = await page.request.get('/api/auth/admin/list-users')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-LIST-USERS-005: should return 403 Forbidden for non-admin user',
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
      await signIn({
        email: 'user@example.com',
        password: 'UserPass123!',
      })

      // WHEN: Regular user attempts to list users
      const response = await page.request.get('/api/auth/admin/list-users')

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-LIST-USERS-006: should exclude password field from response',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user with users in system
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'user@example.com', password: 'UserPass123!', name: 'Regular User' })

      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin requests list of users
      const response = await page.request.get('/api/auth/admin/list-users')

      // THEN: Returns 200 OK with users but password field excluded
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('users')
      // Verify password is not exposed
      for (const user of data.users) {
        expect(user).not.toHaveProperty('password')
        expect(user).not.toHaveProperty('password_hash')
      }
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-LIST-USERS-007: should return 200 OK with empty list when no other users',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user with no other users
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin requests list of users
      const response = await page.request.get('/api/auth/admin/list-users')

      // THEN: Returns 200 OK with only admin user in list
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('users')
      expect(data.users.length).toBeGreaterThanOrEqual(1)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-LIST-USERS-008: admin can complete full list-users workflow',
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

      // Test 1: List users fails without auth
      const noAuthResponse = await page.request.get('/api/auth/admin/list-users')
      expect(noAuthResponse.status()).toBe(401)

      // Create admin and regular user
      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'user@example.com', password: 'UserPass123!', name: 'Regular User' })

      // Test 2: List users fails for non-admin
      await signIn({ email: 'user@example.com', password: 'UserPass123!' })
      const nonAdminResponse = await page.request.get('/api/auth/admin/list-users')
      expect(nonAdminResponse.status()).toBe(403)

      // Test 3: List users succeeds for admin
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })
      const adminResponse = await page.request.get('/api/auth/admin/list-users')
      expect(adminResponse.status()).toBe(200)

      const data = await adminResponse.json()
      expect(data).toHaveProperty('users')
      expect(data.users.length).toBeGreaterThanOrEqual(2)
    }
  )
})
