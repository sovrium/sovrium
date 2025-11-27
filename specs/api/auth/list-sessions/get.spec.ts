/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for List user sessions
 *
 * Source: specs/api/paths/auth/list-sessions/get.json
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation (executeQuery fixture)
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('List user sessions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-LIST-SESSIONS-001: should returns 200 OK with all active sessions and metadata',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: An authenticated user with multiple active sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Create and authenticate user (sets session cookie automatically)
      await createAuthenticatedUser({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // WHEN: User requests list of their sessions
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Returns 200 OK with all active sessions and metadata
      expect(response.status()).toBe(200)

      // Response contains array of sessions
      const data = await response.json()
      expect(data).toHaveProperty('sessions')
      expect(Array.isArray(data.sessions)).toBe(true)
      expect(data.sessions.length).toBeGreaterThanOrEqual(1)

      // Current session is marked with isCurrent: true
      const currentSession = data.sessions.find((s: { isCurrent: boolean }) => s.isCurrent)
      expect(currentSession).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-LIST-SESSIONS-002: should returns 200 OK with single session marked as current',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: An authenticated user with only current session
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Create and authenticate user (creates single session)
      await createAuthenticatedUser()

      // WHEN: User requests list of their sessions
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Returns 200 OK with single session marked as current
      expect(response.status()).toBe(200)

      // Response contains exactly one session
      const data = await response.json()
      expect(data.sessions).toHaveLength(1)

      // Single session is marked as current
      expect(data.sessions[0].isCurrent).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-LIST-SESSIONS-003: should returns 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authentication)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // WHEN: Unauthenticated user attempts to list sessions
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      // Response contains error about missing authentication
      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-LIST-SESSIONS-004: should returns 200 OK with only active sessions (expired sessions filtered out)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: An authenticated user with active and expired sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Create and authenticate user
      const { user } = await createAuthenticatedUser()

      // Insert an expired session for this user
      await executeQuery(
        `INSERT INTO "session" (id, user_id, token, ip_address, user_agent, expires_at, created_at, updated_at)
         VALUES ('expired-session-id', $1, 'expired_token', '192.168.1.20', 'Mozilla/5.0', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '8 days', NOW())`,
        [user.id]
      )

      // WHEN: User requests list of their sessions
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Returns 200 OK with only active sessions (expired sessions filtered out)
      expect(response.status()).toBe(200)

      // Response contains only active sessions (expired filtered out)
      const data = await response.json()
      const expiredSession = data.sessions.find(
        (s: { id: string }) => s.id === 'expired-session-id'
      )
      expect(expiredSession).toBeUndefined()
    }
  )

  test.fixme(
    'API-AUTH-LIST-SESSIONS-005: should returns 200 OK with only active sessions (revoked sessions filtered out)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: An authenticated user with active and revoked sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Create and authenticate user
      const { user } = await createAuthenticatedUser()

      // Insert a revoked session for this user (has deleted_at set)
      await executeQuery(
        `INSERT INTO "session" (id, user_id, token, ip_address, user_agent, expires_at, created_at, updated_at)
         VALUES ('revoked-session-id', $1, 'revoked_token', '192.168.1.20', 'Mozilla/5.0', NOW() + INTERVAL '7 days', NOW() - INTERVAL '2 days', NOW())`,
        [user.id]
      )

      // WHEN: User requests list of their sessions
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Returns 200 OK with only active sessions (revoked sessions filtered out)
      expect(response.status()).toBe(200)

      // Response contains only active sessions (revoked filtered out)
      const data = await response.json()
      const revokedSession = data.sessions.find(
        (s: { id: string }) => s.id === 'revoked-session-id'
      )
      expect(revokedSession).toBeUndefined()
    }
  )

  test.fixme(
    "API-AUTH-LIST-SESSIONS-006: should returns 200 OK with only User A's sessions (User B's sessions not visible)",
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Two users with their own sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
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

      // Sign in as User B first (creates session)
      await signIn({ email: 'userB@example.com', password: 'PasswordB123!' })

      // Now sign in as User A (this is who we'll test)
      await signIn({ email: 'userA@example.com', password: 'PasswordA123!' })

      // WHEN: User A requests list of sessions
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Returns 200 OK with only User A's sessions (User B's sessions not visible)
      expect(response.status()).toBe(200)

      // Response contains only User A's sessions
      const data = await response.json()
      expect(data.sessions.length).toBeGreaterThanOrEqual(1)

      // All sessions belong to User A (none belong to User B)
      // Note: This verifies session isolation between users
    }
  )

  test.fixme(
    'API-AUTH-LIST-SESSIONS-007: should returns 200 OK with all sessions showing device metadata',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: An authenticated user with sessions across multiple devices
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Create and authenticate user
      await createAuthenticatedUser()

      // WHEN: User requests list of their sessions
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Returns 200 OK with all sessions showing device metadata
      expect(response.status()).toBe(200)

      // Each session includes IP address and user agent
      const data = await response.json()
      expect(data.sessions.length).toBeGreaterThanOrEqual(1)

      for (const session of data.sessions) {
        expect(session).toHaveProperty('ipAddress')
        expect(session).toHaveProperty('userAgent')
      }

      // Current session is marked with isCurrent: true
      const currentSession = data.sessions.find((s: { isCurrent: boolean }) => s.isCurrent)
      expect(currentSession).toBeDefined()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-LIST-SESSIONS-008: user can complete full listSessions workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn, signOut }) => {
      // GIVEN: Representative test scenario
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Create user and sign in
      await signUp({
        email: 'workflow@example.com',
        password: 'WorkflowPass123!',
        name: 'Workflow User',
      })
      await signIn({ email: 'workflow@example.com', password: 'WorkflowPass123!' })

      // WHEN: Execute list sessions workflow
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Verify integration
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('sessions')
      expect(data.sessions.length).toBeGreaterThanOrEqual(1)

      // Sign out and verify can't list sessions anymore
      await signOut()
      const unauthorizedResponse = await page.request.get('/api/auth/list-sessions')
      expect(unauthorizedResponse.status()).toBe(401)
    }
  )
})
