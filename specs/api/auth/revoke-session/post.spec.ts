/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Revoke specific session
 *
 * Source: specs/api/paths/auth/revoke-session/post.json
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
 * Note: Better Auth's revoke-session endpoint may not be publicly exposed.
 * These tests verify the behavior when calling the endpoint.
 */

test.describe('Revoke specific session', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the /api/auth/revoke-session
  // endpoint is not yet implemented (returns 404)
  // ============================================================================

  test.fixme(
    'API-AUTH-REVOKE-SESSION-001: should return 200 OK and revoke the specified session',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user with multiple active sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // Create user and sign in to create multiple sessions
      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })
      await signIn({
        email: 'test@example.com',
        password: 'TestPassword123!',
      })

      // Get all sessions
      const sessionsResponse = await page.request.get('/api/auth/list-sessions')
      const sessions = await sessionsResponse.json()
      expect(sessions.length).toBeGreaterThanOrEqual(2)

      // Get a session to revoke (not the current one)
      const sessionToRevoke = sessions[1]

      // WHEN: User revokes a specific session
      const response = await page.request.post('/api/auth/revoke-session', {
        data: {
          token: sessionToRevoke.token,
        },
      })

      // THEN: Returns 200 OK and revokes the specified session
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('success', true)

      // Verify session was revoked
      const updatedSessions = await page.request.get('/api/auth/list-sessions')
      const updatedData = await updatedSessions.json()
      expect(updatedData.length).toBeLessThan(sessions.length)
    }
  )

  test.fixme(
    'API-AUTH-REVOKE-SESSION-002: should return 400 Bad Request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })
      await signIn({
        email: 'test@example.com',
        password: 'TestPassword123!',
      })

      // WHEN: User submits request without token field
      const response = await page.request.post('/api/auth/revoke-session', {})

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-REVOKE-SESSION-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // WHEN: Unauthenticated user attempts to revoke a session
      const response = await page.request.post('/api/auth/revoke-session', {
        data: {
          token: 'session_123',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-REVOKE-SESSION-004: should return 404 Not Found for non-existent session',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })
      await signIn({
        email: 'test@example.com',
        password: 'TestPassword123!',
      })

      // WHEN: User attempts to revoke non-existent session
      const response = await page.request.post('/api/auth/revoke-session', {
        data: {
          token: 'nonexistent_session_token',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-REVOKE-SESSION-005: should return 404 Not Found when revoking another user session',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Two users with their own sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // Create User A
      await signUp({
        email: 'userA@example.com',
        password: 'PasswordA123!',
        name: 'User A',
      })

      // Create User B
      await signUp({
        email: 'userB@example.com',
        password: 'PasswordB123!',
        name: 'User B',
      })

      // Sign in as User A
      await signIn({ email: 'userA@example.com', password: 'PasswordA123!' })

      // WHEN: User A attempts to revoke User B's session (with fake token)
      const response = await page.request.post('/api/auth/revoke-session', {
        data: {
          token: 'user_b_fake_session_token',
        },
      })

      // THEN: Returns 404 Not Found (prevent session enumeration)
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-AUTH-REVOKE-SESSION-006: should return 200 OK and revoke current session',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user with current session
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })
      await signIn({
        email: 'test@example.com',
        password: 'TestPassword123!',
      })

      // Get current session
      const sessionResponse = await page.request.get('/api/auth/get-session')
      const sessionData = await sessionResponse.json()
      const currentSessionToken = sessionData.session.token

      // WHEN: User revokes their own current session
      const response = await page.request.post('/api/auth/revoke-session', {
        data: {
          token: currentSessionToken,
        },
      })

      // THEN: Returns 200 OK and revokes current session
      expect(response.status()).toBe(200)

      // Verify session is invalidated
      const afterResponse = await page.request.get('/api/auth/get-session')
      const afterData = await afterResponse.json()
      expect(afterData).toBeNull()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-REVOKE-SESSION-007: user can complete full revoke-session workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // Test 1: Revoke fails without auth
      const noAuthResponse = await page.request.post('/api/auth/revoke-session', {
        data: { token: 'test_token' },
      })
      expect(noAuthResponse.status()).toBe(401)

      // Create user and sign in multiple times
      await signUp({
        email: 'workflow@example.com',
        password: 'WorkflowPass123!',
        name: 'Workflow User',
      })
      await signIn({ email: 'workflow@example.com', password: 'WorkflowPass123!' })

      // Get sessions list
      const sessionsResponse = await page.request.get('/api/auth/list-sessions')
      const sessions = await sessionsResponse.json()
      expect(sessions.length).toBeGreaterThanOrEqual(1)

      // Test 2: Revoke fails for non-existent session
      const notFoundResponse = await page.request.post('/api/auth/revoke-session', {
        data: { token: 'nonexistent_token' },
      })
      expect(notFoundResponse.status()).toBe(404)

      // Test 3: Revoke succeeds for valid session (if multiple exist)
      if (sessions.length >= 2) {
        const sessionToRevoke = sessions[1]
        const revokeResponse = await page.request.post('/api/auth/revoke-session', {
          data: { token: sessionToRevoke.token },
        })
        expect(revokeResponse.status()).toBe(200)
      }
    }
  )
})
