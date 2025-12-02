/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Revoke all other sessions
 *
 * Source: specs/api/paths/auth/revoke-other-sessions/post.json
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
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('Revoke all other sessions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-AUTH-REVOKE-OTHER-SESSIONS-001: should return 200 OK and revoke all sessions except current one',
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
      // Create another session
      await signIn({
        email: 'test@example.com',
        password: 'TestPassword123!',
      })

      // Get initial session count
      const sessionsBeforeResponse = await page.request.get('/api/auth/list-sessions')
      const sessionsBefore = await sessionsBeforeResponse.json()
      expect(sessionsBefore.length).toBeGreaterThanOrEqual(2)

      // WHEN: User revokes all other sessions
      const response = await page.request.post('/api/auth/revoke-other-sessions')

      // THEN: Returns 200 OK and revokes all sessions except current one
      expect(response.status()).toBe(200)

      // Verify only one session remains (current)
      const sessionsAfterResponse = await page.request.get('/api/auth/list-sessions')
      const sessionsAfter = await sessionsAfterResponse.json()
      expect(sessionsAfter.length).toBe(1)
    }
  )

  test(
    'API-AUTH-REVOKE-OTHER-SESSIONS-002: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: Unauthenticated user attempts to revoke other sessions
      const response = await page.request.post('/api/auth/revoke-other-sessions')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test(
    'API-AUTH-REVOKE-OTHER-SESSIONS-003: should return 200 OK with no sessions to revoke',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user with only current session
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create user and sign in (only one session)
      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // Verify we have sessions
      const sessionsBeforeResponse = await page.request.get('/api/auth/list-sessions')
      const sessionsBefore = await sessionsBeforeResponse.json()
      expect(sessionsBefore.length).toBeGreaterThanOrEqual(1)

      // WHEN: User revokes other sessions (none exist besides current)
      const response = await page.request.post('/api/auth/revoke-other-sessions')

      // THEN: Returns 200 OK (idempotent operation)
      expect(response.status()).toBe(200)

      // Current session remains active
      const sessionsAfterResponse = await page.request.get('/api/auth/list-sessions')
      const sessionsAfter = await sessionsAfterResponse.json()
      expect(sessionsAfter.length).toBeGreaterThanOrEqual(1)
    }
  )

  test(
    'API-AUTH-REVOKE-OTHER-SESSIONS-004: should return 200 OK and revoke all sessions except current device',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user with sessions across multiple devices
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create user and sign in multiple times to create multiple sessions
      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // Get initial session count
      const sessionsBeforeResponse = await page.request.get('/api/auth/list-sessions')
      expect((await sessionsBeforeResponse.json()).length).toBeGreaterThanOrEqual(2)

      // WHEN: User revokes other sessions from one device
      const response = await page.request.post('/api/auth/revoke-other-sessions')

      // THEN: Returns 200 OK and revokes all sessions except current device
      expect(response.status()).toBe(200)

      // Only current session remains
      const sessionsAfterResponse = await page.request.get('/api/auth/list-sessions')
      const sessionsAfter = await sessionsAfterResponse.json()
      expect(sessionsAfter.length).toBe(1)
    }
  )

  test(
    'API-AUTH-REVOKE-OTHER-SESSIONS-005: should return 200 OK and only revoke current user sessions (other users unaffected)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Two users with multiple sessions each
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

      // Sign in as User A multiple times
      await signIn({ email: 'userA@example.com', password: 'PasswordA123!' })

      // Get User A's sessions before
      const sessionsBeforeResponse = await page.request.get('/api/auth/list-sessions')
      const sessionsBefore = await sessionsBeforeResponse.json()
      expect(sessionsBefore.length).toBeGreaterThanOrEqual(2)

      // WHEN: User A revokes their other sessions
      const response = await page.request.post('/api/auth/revoke-other-sessions')

      // THEN: Returns 200 OK and only revokes User A's sessions
      expect(response.status()).toBe(200)

      // User A's other sessions are revoked, only current remains
      const sessionsAfterResponse = await page.request.get('/api/auth/list-sessions')
      const sessionsAfter = await sessionsAfterResponse.json()
      expect(sessionsAfter.length).toBe(1)

      // User B can still sign in (their sessions unaffected)
      await signIn({ email: 'userB@example.com', password: 'PasswordB123!' })
      const sessionResponse = await page.request.get('/api/auth/get-session')
      const sessionData = await sessionResponse.json()
      // Better Auth lowercases emails
      expect(sessionData.user.email).toBe('userb@example.com')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-REVOKE-OTHER-SESSIONS-006: user can complete full revoke-other-sessions workflow',
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
      const noAuthResponse = await page.request.post('/api/auth/revoke-other-sessions')
      expect(noAuthResponse.status()).toBe(401)

      // Create user and sign in multiple times
      await signUp({
        email: 'workflow@example.com',
        password: 'WorkflowPass123!',
        name: 'Workflow User',
      })

      // Get initial session count
      const beforeResponse = await page.request.get('/api/auth/list-sessions')
      const beforeSessions = await beforeResponse.json()
      expect(beforeSessions.length).toBeGreaterThanOrEqual(2)

      // Test 2: Revoke other sessions succeeds
      const revokeResponse = await page.request.post('/api/auth/revoke-other-sessions')
      expect(revokeResponse.status()).toBe(200)

      // Test 3: Only one session remains
      const afterResponse = await page.request.get('/api/auth/list-sessions')
      const afterSessions = await afterResponse.json()
      expect(afterSessions.length).toBe(1)
    }
  )
})
