/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin: Create user
 *
 * Source: specs/api/paths/auth/admin/create-user/post.json
 * Domain: api
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
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

test.describe('Admin: Create user', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the admin endpoints
  // require proper admin user setup which isn't available via public API
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-CREATE-USER-001: should return 201 Created with user data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { admin: true },
        },
      })

      await signUp({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        name: 'Admin User',
      })
      await signIn({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })

      // WHEN: Admin creates a new user with valid data
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'newuser@example.com',
          name: 'New User',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 201 Created with user data
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('email', 'newuser@example.com')
      expect(data.user).toHaveProperty('name', 'New User')
      // Password should not be exposed
      expect(data.user).not.toHaveProperty('password')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-CREATE-USER-002: should return 201 Created with email pre-verified',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin creates user with emailVerified: true
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'verified@example.com',
          name: 'Verified User',
          password: 'SecurePass123!',
          emailVerified: true,
        },
      })

      // THEN: Returns 201 Created with email pre-verified
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('emailVerified', true)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-CREATE-USER-003: should return 400 Bad Request without required fields',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin submits request without required fields
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation errors
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-CREATE-USER-004: should return 400 Bad Request with invalid email format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin submits request with invalid email format
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'not-an-email',
          name: 'Test User',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-CREATE-USER-005: should return 400 Bad Request with short password',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin submits request with password shorter than 8 characters
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'newuser@example.com',
          name: 'Test User',
          password: 'short',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-CREATE-USER-006: should return 401 Unauthorized without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { admin: true },
        },
      })

      // WHEN: Unauthenticated user attempts to create user
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'newuser@example.com',
          name: 'Test User',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-CREATE-USER-007: should return 403 Forbidden for non-admin user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated regular user (non-admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
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

      // WHEN: Regular user attempts to create user
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'newuser@example.com',
          name: 'Test User',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-CREATE-USER-008: should return 409 Conflict for duplicate email',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user and an existing user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({
        email: 'existing@example.com',
        password: 'ExistingPass123!',
        name: 'Existing User',
      })

      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin attempts to create user with existing email
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'existing@example.com',
          name: 'Another User',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 409 Conflict
      expect(response.status()).toBe(409)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-CREATE-USER-009: should return 201 Created with XSS payload sanitized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin submits name with XSS payload
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'xsstest@example.com',
          name: "<script>alert('xss')</script>Malicious",
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 201 Created with sanitized name
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      // Name should be sanitized (no script tags)
      expect(data.user.name).not.toContain('<script>')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-CREATE-USER-010: should return 201 Created with Unicode name preserved',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin creates user with Unicode characters in name
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'unicode@example.com',
          name: 'José García 日本語',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 201 Created with Unicode name preserved
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user.name).toBe('José García 日本語')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-CREATE-USER-011: admin can complete full create-user workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { admin: true },
        },
      })

      // Test 1: Create user without auth fails
      const noAuthResponse = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'SecurePass123!',
        },
      })
      expect(noAuthResponse.status()).toBe(401)

      // Create admin and regular user
      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'user@example.com', password: 'UserPass123!', name: 'Regular User' })

      // Test 2: Create user fails for non-admin
      await signIn({ email: 'user@example.com', password: 'UserPass123!' })
      const nonAdminResponse = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'SecurePass123!',
        },
      })
      expect(nonAdminResponse.status()).toBe(403)

      // Test 3: Create user succeeds for admin
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })
      const adminResponse = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'newuser@example.com',
          name: 'New User',
          password: 'SecurePass123!',
          emailVerified: true,
        },
      })
      expect(adminResponse.status()).toBe(201)

      const data = await adminResponse.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('email', 'newuser@example.com')
    }
  )
})
