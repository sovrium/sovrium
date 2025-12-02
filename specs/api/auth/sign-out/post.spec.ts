/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Sign out user
 *
 * Source: specs/api/paths/auth/sign-out/post.json
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

test.describe('Sign out user', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-AUTH-SIGN-OUT-001: should invalidate session token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user with valid session (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
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

      // WHEN: User requests to sign out
      const response = await page.request.post('/api/auth/sign-out')

      // THEN: Returns 200 OK and invalidates session
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('success', true)
    }
  )

  test(
    'API-AUTH-SIGN-OUT-002: should return 200 OK even without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User attempts sign-out without authentication
      const response = await page.request.post('/api/auth/sign-out')

      // THEN: Better Auth returns 200 OK even without auth (idempotent operation)
      // Note: Sign-out is typically idempotent - succeeds even if not logged in
      expect(response.status()).toBe(200)
    }
  )

  test(
    'API-AUTH-SIGN-OUT-003: should invalidate session and prevent further authenticated requests',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
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

      // Verify session is valid before sign-out
      const sessionBefore = await page.request.get('/api/auth/get-session')
      expect(sessionBefore.status()).toBe(200)
      const sessionBeforeData = await sessionBefore.json()
      expect(sessionBeforeData).toHaveProperty('session')

      // WHEN: User signs out
      const signOutResponse = await page.request.post('/api/auth/sign-out')
      expect(signOutResponse.status()).toBe(200)

      // THEN: Session is invalidated - get-session returns null body
      const sessionAfter = await page.request.get('/api/auth/get-session')
      const sessionAfterData = await sessionAfter.json()
      // Better Auth returns null body when no session exists
      expect(sessionAfterData).toBeNull()
    }
  )

  test(
    'API-AUTH-SIGN-OUT-004: should allow re-login after sign-out',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user who signs out (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
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

      // WHEN: User signs in again
      const signInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'test@example.com',
          password: 'ValidPassword123!',
        },
      })

      // THEN: Re-login succeeds
      expect(signInResponse.status()).toBe(200)
      const signInData = await signInResponse.json()
      expect(signInData).toHaveProperty('user')
      expect(signInData).toHaveProperty('token')
    }
  )

  test(
    'API-AUTH-SIGN-OUT-005: should handle multiple sign-out calls gracefully',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
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

      // WHEN: User signs out multiple times
      const firstSignOut = await page.request.post('/api/auth/sign-out')
      const secondSignOut = await page.request.post('/api/auth/sign-out')

      // THEN: Both calls succeed (idempotent operation)
      expect(firstSignOut.status()).toBe(200)
      expect(secondSignOut.status()).toBe(200)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-SIGN-OUT-006: user can complete full sign-out workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // Create user and authenticate
      await signUp({
        name: 'Regression User',
        email: 'regression@example.com',
        password: 'SecurePass123!',
      })
      await signIn({
        email: 'regression@example.com',
        password: 'SecurePass123!',
      })

      // WHEN: User signs out
      const signOutResponse = await page.request.post('/api/auth/sign-out')

      // THEN: Sign-out succeeds
      expect(signOutResponse.status()).toBe(200)

      // Verify session is invalidated (Better Auth returns null body)
      const sessionResponse = await page.request.get('/api/auth/get-session')
      const sessionData = await sessionResponse.json()
      expect(sessionData).toBeNull()

      // Verify user can sign in again
      const reSignInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'regression@example.com',
          password: 'SecurePass123!',
        },
      })
      expect(reSignInResponse.status()).toBe(200)
    }
  )
})
