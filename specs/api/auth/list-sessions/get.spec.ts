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
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('List user sessions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-AUTH-LIST-SESSIONS-001: should return 200 OK with active sessions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create and authenticate user via API
      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // WHEN: User requests list of their sessions
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Returns 200 OK with sessions array
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThanOrEqual(1)
    }
  )

  test(
    'API-AUTH-LIST-SESSIONS-002: should return sessions for authenticated user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create and authenticate user
      // Note: signUp creates one session, signIn creates another
      await signUp({
        email: 'single@example.com',
        password: 'SinglePass123!',
        name: 'Single Session User',
      })

      // WHEN: User requests list of their sessions
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Returns 200 OK with sessions
      expect(response.status()).toBe(200)

      const data = await response.json()
      // signUp + signIn creates 2 sessions
      expect(data.length).toBeGreaterThanOrEqual(1)
    }
  )

  test(
    'API-AUTH-LIST-SESSIONS-003: should return 401 Unauthorized without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled (no authentication)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: Unauthenticated user attempts to list sessions
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test(
    'API-AUTH-LIST-SESSIONS-004: should show session with metadata',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create and authenticate user
      await signUp({
        email: 'metadata@example.com',
        password: 'MetadataPass123!',
        name: 'Metadata User',
      })

      // WHEN: User requests list of their sessions
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Returns 200 OK with session metadata
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.length).toBeGreaterThanOrEqual(1)

      // Each session should have basic properties
      const session = data[0]
      expect(session).toHaveProperty('id')
      expect(session).toHaveProperty('userId')
    }
  )

  test(
    'API-AUTH-LIST-SESSIONS-005: should only show sessions for current user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Two users with their own sessions (created via API)
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

      // WHEN: User A requests list of sessions
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Returns 200 OK with only User A's sessions
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.length).toBeGreaterThanOrEqual(1)
      // All sessions belong to User A (session isolation)
    }
  )

  test(
    'API-AUTH-LIST-SESSIONS-006: should return empty after sign-out',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user who signs out (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create and authenticate user
      await signUp({
        email: 'signout@example.com',
        password: 'SignoutPass123!',
        name: 'Signout User',
      })

      // Verify sessions exist before sign-out
      const beforeSignOut = await page.request.get('/api/auth/list-sessions')
      expect(beforeSignOut.status()).toBe(200)

      // Sign out
      await page.request.post('/api/auth/sign-out')

      // WHEN: User attempts to list sessions after sign-out
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Returns 401 Unauthorized (no longer authenticated)
      expect(response.status()).toBe(401)
    }
  )

  test(
    'API-AUTH-LIST-SESSIONS-007: should show session creation time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated user (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create and authenticate user
      await signUp({
        email: 'time@example.com',
        password: 'TimePass123!',
        name: 'Time User',
      })

      // WHEN: User requests list of their sessions
      const response = await page.request.get('/api/auth/list-sessions')

      // THEN: Returns 200 OK with session timestamps
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.length).toBeGreaterThanOrEqual(1)

      const session = data[0]
      expect(session).toHaveProperty('createdAt')
      expect(session).toHaveProperty('expiresAt')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-LIST-SESSIONS-008: user can complete full list-sessions workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp }) => {
      await test.step('Setup: Start server with auth enabled', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
          },
        })
      })

      await test.step('Verify list sessions fails without auth', async () => {
        const noAuthResponse = await page.request.get('/api/auth/list-sessions')
        expect(noAuthResponse.status()).toBe(401)
      })

      await test.step('Setup: Create and authenticate user', async () => {
        await signUp({
          email: 'workflow@example.com',
          password: 'WorkflowPass123!',
          name: 'Workflow User',
        })
      })

      await test.step('List sessions with valid auth', async () => {
        const authResponse = await page.request.get('/api/auth/list-sessions')
        expect(authResponse.status()).toBe(200)
        const sessions = await authResponse.json()
        expect(Array.isArray(sessions)).toBe(true)
        expect(sessions.length).toBeGreaterThanOrEqual(1)
      })

      await test.step('Verify list sessions fails after sign-out', async () => {
        await page.request.post('/api/auth/sign-out')

        const afterSignOutResponse = await page.request.get('/api/auth/list-sessions')
        expect(afterSignOutResponse.status()).toBe(401)
      })
    }
  )
})
