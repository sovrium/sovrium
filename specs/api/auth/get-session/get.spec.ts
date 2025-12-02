/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Get current session
 *
 * Source: specs/api/paths/auth/get-session/get.json
 * Domain: api
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks
 */

test.describe('Get current session', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-AUTH-GET-SESSION-001: should return 200 OK with session and user data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user with active session (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // Create user and sign in via API
      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })
      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User requests current session information
      const response = await page.request.get('/api/auth/get-session')

      // THEN: Returns 200 OK with session and user data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('session')
      expect(data).toHaveProperty('user')
      expect(data.user.email).toBe('test@example.com')
      expect(data.user.name).toBe('Test User')
      // User password is not included in response (security)
      expect(data.user).not.toHaveProperty('password')
      expect(data.user).not.toHaveProperty('password_hash')
    }
  )

  test(
    'API-AUTH-GET-SESSION-002: should return null session without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // WHEN: User requests session without authentication
      const response = await page.request.get('/api/auth/get-session')

      // THEN: Better Auth returns 200 with null (no session)
      // Note: Better Auth's get-session returns null body when no session exists
      expect(response.status()).toBe(200)

      const data = await response.json()
      // Better Auth returns null as body when no session
      expect(data).toBeNull()
    }
  )

  test(
    'API-AUTH-GET-SESSION-003: should return null session with invalid token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // WHEN: User requests session with invalid token (via header)
      const response = await page.request.get('/api/auth/get-session', {
        headers: {
          Authorization: 'Bearer invalid_token_12345',
        },
      })

      // THEN: Better Auth returns 200 with null body
      expect(response.status()).toBe(200)

      const data = await response.json()
      // Better Auth returns null as body when session is invalid
      expect(data).toBeNull()
    }
  )

  test(
    'API-AUTH-GET-SESSION-004: should return null session after sign-out',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user who signs out (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // Create user, sign in, then sign out
      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })
      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })
      await page.request.post('/api/auth/sign-out')

      // WHEN: User requests session after sign-out
      const response = await page.request.get('/api/auth/get-session')

      // THEN: Returns 200 with null body (session was invalidated)
      expect(response.status()).toBe(200)

      const data = await response.json()
      // Better Auth returns null body when no active session
      expect(data).toBeNull()
    }
  )

  test(
    'API-AUTH-GET-SESSION-005: should return session with metadata',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // Create user and sign in
      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })
      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User requests session information
      const response = await page.request.get('/api/auth/get-session')

      // THEN: Returns session with metadata (id, expiration, etc)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('session')
      expect(data.session).toHaveProperty('id')
      expect(data.session).toHaveProperty('userId')
      expect(data.session).toHaveProperty('expiresAt')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-GET-SESSION-006: user can complete full get-session workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // Test 1: No session before sign-in (returns null body)
      const noSessionResponse = await page.request.get('/api/auth/get-session')
      expect(noSessionResponse.status()).toBe(200)
      const noSessionData = await noSessionResponse.json()
      expect(noSessionData).toBeNull()

      // Create user and sign in
      await signUp({
        name: 'Regression User',
        email: 'regression@example.com',
        password: 'SecurePass123!',
      })
      await signIn({
        email: 'regression@example.com',
        password: 'SecurePass123!',
      })

      // Test 2: Session exists after sign-in
      const sessionResponse = await page.request.get('/api/auth/get-session')
      expect(sessionResponse.status()).toBe(200)
      const sessionData = await sessionResponse.json()
      expect(sessionData).toHaveProperty('session')
      expect(sessionData).toHaveProperty('user')
      expect(sessionData.user.email).toBe('regression@example.com')

      // Sign out
      await page.request.post('/api/auth/sign-out')

      // Test 3: No session after sign-out (returns null body)
      const afterSignOutResponse = await page.request.get('/api/auth/get-session')
      expect(afterSignOutResponse.status()).toBe(200)
      const afterSignOutData = await afterSignOutResponse.json()
      expect(afterSignOutData).toBeNull()
    }
  )
})
