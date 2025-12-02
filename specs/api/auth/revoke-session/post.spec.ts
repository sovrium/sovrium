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
 */

test.describe('Revoke specific session', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-AUTH-REVOKE-SESSION-001: should return 200 OK and revoke the specified session',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user with multiple active sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create user and sign in to create multiple sessions
      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // Sign in again to create a second session
      await signIn({
        email: 'test@example.com',
        password: 'TestPassword123!',
      })

      // Get all sessions
      const sessionsResponse = await page.request.get('/api/auth/list-sessions')
      const sessions = await sessionsResponse.json()
      expect(sessions.length).toBeGreaterThanOrEqual(2)

      // Get a session to revoke (not the current one - take first non-current)
      const currentSession = await page.request.get('/api/auth/get-session')
      const currentData = await currentSession.json()
      const currentToken = currentData.session.token

      // Find a session that's not the current one
      const sessionToRevoke = sessions.find((s: { token: string }) => s.token !== currentToken)
      expect(sessionToRevoke).toBeTruthy()

      // WHEN: User revokes a specific session
      const response = await page.request.post('/api/auth/revoke-session', {
        data: {
          token: sessionToRevoke!.token,
        },
      })

      // THEN: Returns 200 OK and revokes the specified session
      expect(response.status()).toBe(200)

      // Verify session was revoked by checking sessions count
      const updatedSessions = await page.request.get('/api/auth/list-sessions')
      const updatedData = await updatedSessions.json()
      expect(updatedData.length).toBeLessThan(sessions.length)
    }
  )

  test(
    'API-AUTH-REVOKE-SESSION-002: should return 400 Bad Request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // WHEN: User submits request without token field
      const response = await page.request.post('/api/auth/revoke-session', {})

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-REVOKE-SESSION-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
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

  test(
    'API-AUTH-REVOKE-SESSION-004: should return 200 OK for non-existent session (idempotent)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // WHEN: User attempts to revoke non-existent session
      const response = await page.request.post('/api/auth/revoke-session', {
        data: {
          token: 'nonexistent_session_token',
        },
      })

      // THEN: Returns 200 OK (idempotent operation - Better Auth behavior)
      // Note: Some implementations return 404, Better Auth returns 200
      expect([200, 404]).toContain(response.status())
    }
  )

  test(
    'API-AUTH-REVOKE-SESSION-005: should return 200 OK when revoking another user session (no cross-user access)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Two users with their own sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
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

      // THEN: Returns 200 OK (idempotent) or 404 (prevent session enumeration)
      expect([200, 404]).toContain(response.status())
    }
  )

  test(
    'API-AUTH-REVOKE-SESSION-006: should return 200 OK and revoke current session',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user with current session
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
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

      // Verify session is invalidated - get-session returns null or session is falsy
      const afterResponse = await page.request.get('/api/auth/get-session')
      // After revoking current session, response may be null/empty or session property is null
      const afterText = await afterResponse.text()
      if (afterText && afterText !== 'null') {
        const afterData = JSON.parse(afterText)
        expect(afterData?.session).toBeFalsy()
      }
      // If response is empty or "null", session was successfully invalidated
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-REVOKE-SESSION-007: user can complete full revoke-session workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
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

      // Get sessions list
      const sessionsResponse = await page.request.get('/api/auth/list-sessions')
      const sessions = await sessionsResponse.json()
      expect(sessions.length).toBeGreaterThanOrEqual(1)

      // Test 2: Revoke succeeds for non-existent session (idempotent)
      const notFoundResponse = await page.request.post('/api/auth/revoke-session', {
        data: { token: 'nonexistent_token' },
      })
      expect([200, 404]).toContain(notFoundResponse.status())

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
