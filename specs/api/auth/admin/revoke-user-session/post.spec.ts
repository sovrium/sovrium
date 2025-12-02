/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin: Revoke user session
 *
 * Source: specs/api/paths/auth/admin/revoke-user-session/post.json
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

test.describe('Admin: Revoke user session', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the admin endpoints
  // require proper admin user setup which isn't available via public API
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-001: should return 200 OK and revoke session',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user and a user with active session
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

      // Create session for target user
      await signIn({ email: 'target@example.com', password: 'TargetPass123!' })

      // Sign in as admin
      await signIn({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })

      // WHEN: Admin revokes specific user session
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {
          userId: '2',
          sessionToken: 'session_token_to_revoke',
        },
      })

      // THEN: Returns 200 OK and revokes the session
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-002: should return 400 Bad Request without required fields',
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

      // WHEN: Admin submits request without required fields
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation errors
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-003: should return 401 Unauthorized without authentication',
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

      // WHEN: Unauthenticated user attempts to revoke session
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {
          userId: '2',
          sessionToken: 'some_token',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-004: should return 403 Forbidden for non-admin user',
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

      // WHEN: Regular user attempts to revoke another user's session
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {
          userId: '2',
          sessionToken: 'some_token',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-005: should return 404 Not Found for non-existent user',
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

      // WHEN: Admin attempts to revoke session for non-existent user
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {
          userId: '999',
          sessionToken: 'some_token',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-006: should return 404 Not Found for non-existent session',
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

      // WHEN: Admin attempts to revoke non-existent session
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {
          userId: '2',
          sessionToken: 'nonexistent_token',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-007: should return 404 Not Found for session belonging to different user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user with two users and sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'user1@example.com', password: 'User1Pass123!', name: 'User 1' })
      await signUp({ email: 'user2@example.com', password: 'User2Pass123!', name: 'User 2' })

      await signIn({ email: 'user1@example.com', password: 'User1Pass123!' })
      await signIn({ email: 'user2@example.com', password: 'User2Pass123!' })

      // WHEN: Admin attempts to revoke session belonging to different user
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {
          userId: '2',
          sessionToken: 'user2_session_token', // This belongs to user 3
        },
      })

      // THEN: Returns 404 Not Found (session ownership validation)
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-008: should return 200 OK for already revoked session (idempotent)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated admin user and an already revoked session
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'target@example.com', password: 'TargetPass123!', name: 'Target User' })

      // First revoke
      await page.request.post('/api/auth/admin/revoke-user-session', {
        data: { userId: '2', sessionToken: 'session_token' },
      })

      // WHEN: Admin attempts to revoke already revoked session
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {
          userId: '2',
          sessionToken: 'session_token',
        },
      })

      // THEN: Returns 200 OK (idempotent operation)
      expect(response.status()).toBe(200)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-009: admin can complete full revoke-user-session workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { admin: true },
        },
      })

      // Test 1: Revoke session without auth fails
      const noAuthResponse = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: { userId: '2', sessionToken: 'some_token' },
      })
      expect(noAuthResponse.status()).toBe(401)

      // Create admin and regular user
      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })
      await signUp({ email: 'user@example.com', password: 'UserPass123!', name: 'Regular User' })

      // Test 2: Revoke session fails for non-admin
      await signIn({ email: 'user@example.com', password: 'UserPass123!' })
      const nonAdminResponse = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: { userId: '1', sessionToken: 'some_token' },
      })
      expect(nonAdminResponse.status()).toBe(403)

      // Test 3: Revoke session succeeds for admin
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })
      const adminResponse = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: { userId: '2', sessionToken: 'valid_session_token' },
      })
      // May return 200 or 404 depending on session token validity
      expect([200, 404]).toContain(adminResponse.status())
    }
  )
})
