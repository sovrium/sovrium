/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Refresh session token
 *
 * Source: specs/api/paths/auth/refresh-session/post.json
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
 *
 * Note: Better Auth may not expose a refresh-session endpoint - session refresh
 * may be handled automatically via cookies.
 */

test.describe('Refresh session token', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: Better Auth may not have a dedicated refresh-session endpoint.
  // Session refresh is typically handled automatically by the session middleware.
  // ============================================================================

  test.fixme(
    'API-AUTH-REFRESH-SESSION-001: should return 200 OK with refreshed session',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user with valid session (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
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

      // Get initial session
      const initialSession = await page.request.get('/api/auth/get-session')
      const initialData = await initialSession.json()
      expect(initialData.session).toBeTruthy()

      // WHEN: User requests to refresh their session
      const response = await page.request.post('/api/auth/refresh-session')

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)

      // Session still valid after refresh
      const afterRefresh = await page.request.get('/api/auth/get-session')
      const afterRefreshData = await afterRefresh.json()
      expect(afterRefreshData.session).toBeTruthy()
    }
  )

  test.fixme(
    'API-AUTH-REFRESH-SESSION-002: should return 401 Unauthorized without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User attempts refresh without authentication
      const response = await page.request.post('/api/auth/refresh-session')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-REFRESH-SESSION-003: should return 401 Unauthorized with invalid token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User attempts refresh with invalid token
      const response = await page.request.post('/api/auth/refresh-session', {
        headers: {
          Authorization: 'Bearer invalid_token_12345',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-REFRESH-SESSION-004: should return 401 Unauthorized after sign-out',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user who signs out (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
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

      // WHEN: User attempts to refresh after sign-out
      const response = await page.request.post('/api/auth/refresh-session')

      // THEN: Returns 401 Unauthorized (session was invalidated)
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-REFRESH-SESSION-005: should maintain user data after refresh',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
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

      // WHEN: User refreshes session
      const response = await page.request.post('/api/auth/refresh-session')
      expect(response.status()).toBe(200)

      // THEN: User data is maintained
      const sessionResponse = await page.request.get('/api/auth/get-session')
      const sessionData = await sessionResponse.json()
      expect(sessionData.user.email).toBe('test@example.com')
      expect(sessionData.user.name).toBe('Test User')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-REFRESH-SESSION-006: user can complete full refresh-session workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Test 1: Refresh fails without auth
      const noAuthRefresh = await page.request.post('/api/auth/refresh-session')
      expect(noAuthRefresh.status()).toBe(401)

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

      // Test 2: Refresh succeeds with valid session
      const authRefresh = await page.request.post('/api/auth/refresh-session')
      expect(authRefresh.status()).toBe(200)

      // Verify session is still valid
      const sessionResponse = await page.request.get('/api/auth/get-session')
      const sessionData = await sessionResponse.json()
      expect(sessionData.session).toBeTruthy()
      expect(sessionData.user.email).toBe('regression@example.com')

      // Sign out
      await page.request.post('/api/auth/sign-out')

      // Test 3: Refresh fails after sign-out
      const afterSignOutRefresh = await page.request.post('/api/auth/refresh-session')
      expect(afterSignOutRefresh.status()).toBe(401)
    }
  )
})
