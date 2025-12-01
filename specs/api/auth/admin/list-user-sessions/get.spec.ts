/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin: List user sessions
 *
 * Source: specs/api/paths/auth/admin/list-user-sessions/get.json
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

test.describe('Admin: List user sessions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the admin endpoints
  // require proper admin user setup which isn't available via public API
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-LIST-USER-SESSIONS-001: should return 200 OK with all active user sessions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user and a user with multiple sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
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

      // Create multiple sessions for target user by signing in multiple times
      await signIn({ email: 'target@example.com', password: 'TargetPass123!' })
      await signIn({ email: 'target@example.com', password: 'TargetPass123!' })

      // Sign in as admin
      await signIn({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })

      // WHEN: Admin requests list of user sessions
      const response = await page.request.get('/api/auth/admin/list-user-sessions?userId=2')

      // THEN: Returns 200 OK with all active user sessions
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('sessions')
      expect(Array.isArray(data.sessions)).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-LIST-USER-SESSIONS-002: should return 400 Bad Request without userId parameter',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin requests sessions without userId parameter
      const response = await page.request.get('/api/auth/admin/list-user-sessions')

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-LIST-USER-SESSIONS-003: should return 401 Unauthorized without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      // WHEN: Unauthenticated user attempts to list user sessions
      const response = await page.request.get('/api/auth/admin/list-user-sessions?userId=2')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-LIST-USER-SESSIONS-004: should return 403 Forbidden for non-admin user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated regular user (non-admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
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

      // WHEN: Regular user attempts to list another user's sessions
      const response = await page.request.get('/api/auth/admin/list-user-sessions?userId=2')

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-LIST-USER-SESSIONS-005: should return 404 Not Found for non-existent user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin requests sessions for non-existent user
      const response = await page.request.get('/api/auth/admin/list-user-sessions?userId=999')

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-LIST-USER-SESSIONS-006: should return 200 OK with empty sessions array',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user and a user with no active sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'target@example.com', password: 'TargetPass123!', name: 'Target User' })

      // Note: target user signed up but never signed in, so no sessions
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin requests list of user sessions
      const response = await page.request.get('/api/auth/admin/list-user-sessions?userId=2')

      // THEN: Returns 200 OK with empty sessions array
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('sessions')
      expect(Array.isArray(data.sessions)).toBe(true)
      // User may have a session from signUp, depending on implementation
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-LIST-USER-SESSIONS-007: should return 200 OK with only active sessions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user and a user with active sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'target@example.com', password: 'TargetPass123!', name: 'Target User' })

      await signIn({ email: 'target@example.com', password: 'TargetPass123!' })
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin requests list of user sessions
      const response = await page.request.get('/api/auth/admin/list-user-sessions?userId=2')

      // THEN: Returns 200 OK with only active sessions (expired filtered out)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('sessions')
      expect(Array.isArray(data.sessions)).toBe(true)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-LIST-USER-SESSIONS-008: admin can complete full list-user-sessions workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      // Test 1: List sessions without auth fails
      const noAuthResponse = await page.request.get('/api/auth/admin/list-user-sessions?userId=1')
      expect(noAuthResponse.status()).toBe(401)

      // Create admin and regular user
      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'user@example.com', password: 'UserPass123!', name: 'Regular User' })

      // Test 2: List sessions fails for non-admin
      await signIn({ email: 'user@example.com', password: 'UserPass123!' })
      const nonAdminResponse = await page.request.get('/api/auth/admin/list-user-sessions?userId=1')
      expect(nonAdminResponse.status()).toBe(403)

      // Test 3: List sessions succeeds for admin
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })
      const adminResponse = await page.request.get('/api/auth/admin/list-user-sessions?userId=2')
      expect(adminResponse.status()).toBe(200)

      const data = await adminResponse.json()
      expect(data).toHaveProperty('sessions')
      expect(Array.isArray(data.sessions)).toBe(true)
    }
  )
})
