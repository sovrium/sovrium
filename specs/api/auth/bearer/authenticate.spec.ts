/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Bearer Token Authentication
 *
 * Tests bearer token authentication for API requests.
 * Enables stateless API authentication via Authorization header.
 *
 * Test Organization:
 * 1. @spec tests - Exhaustive acceptance criteria
 * 2. @regression test - Optimized integration test
 */

test.describe('Bearer Token Authentication', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-BEARER-001: should authenticate request with valid bearer token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Server with bearer plugin enabled and authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { bearer: true },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const { token } = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User makes request with bearer token
      const response = await page.request.get('/api/auth/get-session', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      // THEN: Request is authenticated
      expect(response.status()).toBe(200)
      const session = await response.json()
      expect(session.user.email).toBe('test@example.com')
    }
  )

  test.fixme(
    'API-AUTH-BEARER-002: should reject request without bearer token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with bearer plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { bearer: true },
        },
      })

      // WHEN: User makes request without Authorization header
      const response = await page.request.get('/api/auth/get-session')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-BEARER-003: should reject request with invalid bearer token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with bearer plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { bearer: true },
        },
      })

      // WHEN: User makes request with invalid token
      const response = await page.request.get('/api/auth/get-session', {
        headers: {
          Authorization: 'Bearer invalid-token-12345',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-BEARER-004: should reject request with wrong authorization scheme',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Server with bearer plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { bearer: true },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const { token } = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User uses wrong authorization scheme (Basic instead of Bearer)
      const response = await page.request.get('/api/auth/get-session', {
        headers: {
          Authorization: `Basic ${token}`,
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-BEARER-005: should reject request with revoked session token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Server with bearer plugin enabled and authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { bearer: true },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const { token } = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // Revoke the session
      await page.request.post('/api/auth/sign-out', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      // WHEN: User uses revoked token
      const response = await page.request.get('/api/auth/get-session', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-BEARER-006: should work alongside cookie authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Server with bearer plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { bearer: true },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // Sign in via cookies (normal browser flow)
      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User makes request with cookies (no bearer token)
      const response = await page.request.get('/api/auth/get-session')

      // THEN: Request is authenticated via cookies
      expect(response.status()).toBe(200)
      const session = await response.json()
      expect(session.user.email).toBe('test@example.com')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-BEARER-007: user can complete full bearer authentication workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Server with bearer plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
          plugins: { bearer: true },
        },
      })

      // Sign up user
      await signUp({
        name: 'Bearer User',
        email: 'bearer@example.com',
        password: 'SecurePass123!',
      })

      // WHEN: User signs in and gets token
      const { token } = await signIn({
        email: 'bearer@example.com',
        password: 'SecurePass123!',
      })

      expect(token).toBeDefined()

      // WHEN: User uses token for authenticated requests
      const sessionResponse = await page.request.get('/api/auth/get-session', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      // THEN: Session is valid
      expect(sessionResponse.status()).toBe(200)
      const session = await sessionResponse.json()
      expect(session.user.email).toBe('bearer@example.com')

      // WHEN: User signs out
      const signOutResponse = await page.request.post('/api/auth/sign-out', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      expect(signOutResponse.status()).toBe(200)

      // WHEN: User tries to use revoked token
      const revokedResponse = await page.request.get('/api/auth/get-session', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      // THEN: Token is rejected
      expect(revokedResponse.status()).toBe(401)
    }
  )
})
