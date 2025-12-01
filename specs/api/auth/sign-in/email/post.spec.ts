/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Sign in with email and password
 *
 * Source: specs/api/paths/auth/sign-in/email/post.json
 * Domain: api
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks
 */

test.describe('Sign in with email and password', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-AUTH-SIGN-IN-EMAIL-001: should returns 200 OK with session token and user data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A registered user with valid credentials (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // Create user via sign-up API (not executeQuery)
      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User submits correct email and password
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'test@example.com',
          password: 'ValidPassword123!',
        },
      })

      // THEN: Returns 200 OK with session token and user data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data).toHaveProperty('token') // Better Auth returns token, not session
    }
  )

  test(
    'API-AUTH-SIGN-IN-EMAIL-002: should returns 400 Bad Request when email is missing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User submits request without email field
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          password: 'ValidPassword123!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-SIGN-IN-EMAIL-003: should returns 400 Bad Request when password is missing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User submits request without password field
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'test@example.com',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-SIGN-IN-EMAIL-004: should returns 400 Bad Request with invalid email format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User submits request with invalid email format
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'not-an-email',
          password: 'ValidPassword123!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-SIGN-IN-EMAIL-005: should returns 401 Unauthorized with wrong password',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A registered user (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // Create user via sign-up API
      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User submits correct email but wrong password
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'test@example.com',
          password: 'WrongPassword123!',
        },
      })

      // THEN: Returns 401 Unauthorized with generic error to prevent enumeration
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-SIGN-IN-EMAIL-006: should returns 401 Unauthorized for non-existent user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with no registered user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User attempts sign-in with non-existent email
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        },
      })

      // THEN: Returns 401 Unauthorized with same generic error to prevent enumeration
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-SIGN-IN-EMAIL-007: should returns 200 OK with case-insensitive email matching',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A registered user with lowercase email (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // Create user via sign-up API
      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User signs in with uppercase email variation
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'TEST@EXAMPLE.COM',
          password: 'ValidPassword123!',
        },
      })

      // THEN: Returns 200 OK with session token (case-insensitive matching)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data).toHaveProperty('token') // Better Auth returns token, not session
    }
  )

  test(
    'API-AUTH-SIGN-IN-EMAIL-008: should returns 200 OK with rememberMe option',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A registered user (created via API)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // Create user via sign-up API
      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User signs in with rememberMe set to true
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'test@example.com',
          password: 'ValidPassword123!',
          rememberMe: true,
        },
      })

      // THEN: Returns 200 OK with extended session token
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data).toHaveProperty('token') // Better Auth returns token, not session
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-SIGN-IN-EMAIL-009: user can complete full sign-in workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // Create a user first via sign-up
      await signUp({
        name: 'Regression User',
        email: 'regression@example.com',
        password: 'SecurePass123!',
      })

      // WHEN: User signs in with valid credentials
      const signInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'regression@example.com',
          password: 'SecurePass123!',
        },
      })

      // THEN: Sign-in succeeds
      expect(signInResponse.status()).toBe(200)
      const signInData = await signInResponse.json()
      expect(signInData).toHaveProperty('user')
      expect(signInData.user.email).toBe('regression@example.com')
      expect(signInData).toHaveProperty('token')

      // WHEN: User tries to sign in again with wrong password
      const failedResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'regression@example.com',
          password: 'WrongPassword!',
        },
      })

      // THEN: Sign-in fails with 401
      expect(failedResponse.status()).toBe(401)
    }
  )
})
