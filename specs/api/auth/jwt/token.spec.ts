/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for JWT Token Authentication
 *
 * Tests JWT mode for authentication instead of server-side sessions.
 * When enabled, sign-in returns JWT tokens for stateless authentication.
 *
 * Test Organization:
 * 1. @spec tests - Exhaustive acceptance criteria
 * 2. @regression test - Optimized integration test
 */

test.describe('JWT Token Authentication', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-JWT-001: should return JWT token on sign-in when JWT plugin enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Server with JWT plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { jwt: true },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User signs in
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'test@example.com',
          password: 'ValidPassword123!',
        },
      })

      // THEN: Returns JWT token in response
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('token')
      // JWT tokens have 3 parts separated by dots
      expect(data.token.split('.').length).toBe(3)
    }
  )

  test.fixme(
    'API-AUTH-JWT-002: should authenticate requests with JWT token in Authorization header',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Server with JWT plugin enabled and signed-in user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { jwt: true },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const signInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'test@example.com',
          password: 'ValidPassword123!',
        },
      })
      const { token } = await signInResponse.json()

      // WHEN: User makes authenticated request with JWT
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
    'API-AUTH-JWT-003: should reject expired JWT token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with JWT plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { jwt: true },
        },
      })

      // WHEN: User makes request with expired JWT
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxfQ.invalid'
      const response = await page.request.get('/api/auth/get-session', {
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-JWT-004: should reject malformed JWT token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with JWT plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { jwt: true },
        },
      })

      // WHEN: User makes request with malformed JWT
      const response = await page.request.get('/api/auth/get-session', {
        headers: {
          Authorization: 'Bearer not-a-valid-jwt',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-JWT-005: should not set cookies when JWT mode enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Server with JWT plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { jwt: true },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User signs in
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'test@example.com',
          password: 'ValidPassword123!',
        },
      })

      // THEN: No session cookies are set (stateless JWT mode)
      expect(response.status()).toBe(200)
      const cookies = response.headers()['set-cookie']
      expect(cookies).toBeUndefined()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-JWT-006: user can complete full JWT authentication workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Server with JWT plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { jwt: true },
        },
      })

      // Sign up user
      await signUp({
        name: 'JWT User',
        email: 'jwt@example.com',
        password: 'SecurePass123!',
      })

      // WHEN: User signs in and receives JWT
      const signInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'jwt@example.com',
          password: 'SecurePass123!',
        },
      })

      expect(signInResponse.status()).toBe(200)
      const { token } = await signInResponse.json()
      expect(token).toBeDefined()
      expect(token.split('.').length).toBe(3)

      // WHEN: User uses JWT for authenticated request
      const sessionResponse = await page.request.get('/api/auth/get-session', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      // THEN: Session is valid
      expect(sessionResponse.status()).toBe(200)
      const session = await sessionResponse.json()
      expect(session.user.email).toBe('jwt@example.com')

      // WHEN: User makes request without token
      const unauthResponse = await page.request.get('/api/auth/get-session')

      // THEN: Request fails
      expect(unauthResponse.status()).toBe(401)
    }
  )
})
