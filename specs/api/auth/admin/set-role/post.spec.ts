/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin: Set user role
 *
 * Source: specs/api/paths/auth/admin/set-role/post.json
 * Domain: api
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
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

test.describe('Admin: Set user role', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the admin endpoints
  // require proper admin user setup which isn't available via public API
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-SET-ROLE-001: should return 200 OK with updated user data',
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

      // WHEN: Admin updates user role to member
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: '2',
          role: 'member',
        },
      })

      // THEN: Returns 200 OK with updated user data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('role', 'member')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-SET-ROLE-002: should return 400 Bad Request without required fields',
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

      // WHEN: Admin submits request without required fields
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation errors
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-SET-ROLE-003: should return 400 Bad Request with invalid role value',
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
      await signUp({ email: 'target@example.com', password: 'TargetPass123!', name: 'Target User' })

      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin submits request with invalid role value
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: '2',
          role: 'superadmin', // Invalid role
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-SET-ROLE-004: should return 401 Unauthorized without authentication',
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

      // WHEN: Unauthenticated user attempts to set role
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: '2',
          role: 'member',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-SET-ROLE-005: should return 403 Forbidden for non-admin user',
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

      // WHEN: Regular user attempts to set another user's role
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: '2',
          role: 'admin',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-SET-ROLE-006: should return 404 Not Found for non-existent user',
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

      // WHEN: Admin attempts to set role for non-existent user
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: '999',
          role: 'member',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-SET-ROLE-007: should return 200 OK and user gains admin privileges',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user and a member user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({
        email: 'promotee@example.com',
        password: 'PromoteePass123!',
        name: 'Future Admin',
      })

      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin promotes member to admin role
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: '2',
          role: 'admin',
        },
      })

      // THEN: Returns 200 OK and user gains admin privileges
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('role', 'admin')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-SET-ROLE-008: should return 200 OK when setting same role (idempotent)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user and a member user
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

      // First set role to member
      await page.request.post('/api/auth/admin/set-role', {
        data: { userId: '2', role: 'member' },
      })

      // WHEN: Admin sets user role to their current role (no change)
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: '2',
          role: 'member',
        },
      })

      // THEN: Returns 200 OK (idempotent operation)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('role', 'member')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-SET-ROLE-009: admin can complete full set-role workflow',
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

      // Test 1: Set role without auth fails
      const noAuthResponse = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: '2', role: 'member' },
      })
      expect(noAuthResponse.status()).toBe(401)

      // Create admin and regular user
      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'user@example.com', password: 'UserPass123!', name: 'Regular User' })

      // Test 2: Set role fails for non-admin
      await signIn({ email: 'user@example.com', password: 'UserPass123!' })
      const nonAdminResponse = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: '1', role: 'member' },
      })
      expect(nonAdminResponse.status()).toBe(403)

      // Test 3: Set role succeeds for admin
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })
      const adminResponse = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: '2', role: 'admin' },
      })
      expect(adminResponse.status()).toBe(200)

      const data = await adminResponse.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('role', 'admin')
    }
  )
})
