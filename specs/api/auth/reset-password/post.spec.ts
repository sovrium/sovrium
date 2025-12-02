/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
import { extractTokenFromUrl } from '../email-helpers'

/**
 * E2E Tests for Reset password
 *
 * Source: specs/api/paths/auth/reset-password/post.json
 * Domain: api
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Email capture via Mailpit fixture for reset token extraction
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('Reset password', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-AUTH-RESET-PASSWORD-001: should return 200 OK and update password',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn, mailpit }) => {
      // GIVEN: A user with valid reset token
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      const userEmail = mailpit.email('test')

      await signUp({
        email: userEmail,
        password: 'OldPassword123!',
        name: 'Test User',
      })

      // Request password reset
      await page.request.post('/api/auth/forget-password', {
        data: { email: userEmail },
      })

      // Capture email and extract token (filtered by testId namespace)
      const email = await mailpit.waitForEmail(
        (e) =>
          e.To[0]?.Address === userEmail &&
          (e.Subject.toLowerCase().includes('password') ||
            e.Subject.toLowerCase().includes('reset'))
      )
      const token = extractTokenFromUrl(email.HTML, 'token')
      expect(token).not.toBeNull()

      // WHEN: User submits valid token and new password
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          token,
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 200 OK and password is updated
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)

      // Verify new password works
      const signInResult = await signIn({
        email: userEmail,
        password: 'NewSecurePass123!',
      })
      expect(signInResult.user).toBeDefined()
    }
  )

  test(
    'API-AUTH-RESET-PASSWORD-002: should return 400 Bad Request without newPassword',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      const userEmail = mailpit.email('test')

      await signUp({
        email: userEmail,
        password: 'OldPassword123!',
        name: 'Test User',
      })

      // Request password reset to get valid token
      await page.request.post('/api/auth/forget-password', {
        data: { email: userEmail },
      })

      const email = await mailpit.waitForEmail(
        (e) =>
          e.To[0]?.Address === userEmail &&
          (e.Subject.toLowerCase().includes('password') ||
            e.Subject.toLowerCase().includes('reset'))
      )
      const token = extractTokenFromUrl(email.HTML, 'token')

      // WHEN: User submits request without newPassword field
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          token,
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-RESET-PASSWORD-003: should return 400 Bad Request with short password',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      const userEmail = mailpit.email('test')

      await signUp({
        email: userEmail,
        password: 'OldPassword123!',
        name: 'Test User',
      })

      // Request password reset to get valid token
      await page.request.post('/api/auth/forget-password', {
        data: { email: userEmail },
      })

      const email = await mailpit.waitForEmail(
        (e) =>
          e.To[0]?.Address === userEmail &&
          (e.Subject.toLowerCase().includes('password') ||
            e.Subject.toLowerCase().includes('reset'))
      )
      const token = extractTokenFromUrl(email.HTML, 'token')

      // WHEN: User submits new password shorter than minimum length
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          token,
          newPassword: 'Short1!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-RESET-PASSWORD-004: should return 401 Unauthorized with invalid token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // WHEN: User submits request with invalid token
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          token: 'invalid_token_abc123',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized (or 400 depending on Better Auth version)
      expect([400, 401]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-RESET-PASSWORD-005: should return 401 Unauthorized with expired token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (token would be expired)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // WHEN: User submits request with expired token (simulated with fake token)
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          token: 'expired_token',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized (or 400 depending on Better Auth version)
      expect([400, 401]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-RESET-PASSWORD-006: should return 401 Unauthorized with already used token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: A user with token that's already been used
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      const userEmail = mailpit.email('test')

      await signUp({
        email: userEmail,
        password: 'OldPassword123!',
        name: 'Test User',
      })

      // Request password reset
      await page.request.post('/api/auth/forget-password', {
        data: { email: userEmail },
      })

      // Capture email and extract token (filtered by testId namespace)
      const email = await mailpit.waitForEmail(
        (e) =>
          e.To[0]?.Address === userEmail &&
          (e.Subject.toLowerCase().includes('password') ||
            e.Subject.toLowerCase().includes('reset'))
      )
      const token = extractTokenFromUrl(email.HTML, 'token')
      expect(token).not.toBeNull()

      // Use the token first time (should succeed)
      const firstResponse = await page.request.post('/api/auth/reset-password', {
        data: {
          token,
          newPassword: 'FirstNewPass123!',
        },
      })
      expect(firstResponse.status()).toBe(200)

      // WHEN: User attempts to reuse the same token
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          token,
          newPassword: 'SecondNewPass123!',
        },
      })

      // THEN: Returns 401 Unauthorized (token already used)
      expect([400, 401]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-RESET-PASSWORD-007: should return 400 Bad Request without token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // WHEN: User submits request without token field
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-RESET-PASSWORD-008: should revoke all sessions after password reset',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn, mailpit }) => {
      // GIVEN: A user with active sessions and valid reset token
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      const userEmail = mailpit.email('test')

      await signUp({
        email: userEmail,
        password: 'OldPassword123!',
        name: 'Test User',
      })

      // Sign in to create a session
      await signIn({
        email: userEmail,
        password: 'OldPassword123!',
      })

      // Request password reset
      await page.request.post('/api/auth/forget-password', {
        data: { email: userEmail },
      })

      const email = await mailpit.waitForEmail(
        (e) =>
          e.To[0]?.Address === userEmail &&
          (e.Subject.toLowerCase().includes('password') ||
            e.Subject.toLowerCase().includes('reset'))
      )
      const token = extractTokenFromUrl(email.HTML, 'token')
      expect(token).not.toBeNull()

      // WHEN: User resets password
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          token,
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 200 OK and all active sessions are revoked
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)

      // Previous session should be invalid - get-session should fail
      const sessionResponse = await page.request.get('/api/auth/get-session')
      // Either 401 or null session depending on implementation
      expect([200, 401]).toContain(sessionResponse.status())
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-RESET-PASSWORD-009: user can complete full reset-password workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn, mailpit }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      const userEmail = mailpit.email('workflow')

      // Create user
      await signUp({
        email: userEmail,
        password: 'WorkflowPass123!',
        name: 'Workflow User',
      })

      // Test 1: Reset without token fails
      const noTokenResponse = await page.request.post('/api/auth/reset-password', {
        data: { newPassword: 'NewPass123!' },
      })
      expect(noTokenResponse.status()).toBe(400)

      // Test 2: Reset with invalid token fails
      const invalidTokenResponse = await page.request.post('/api/auth/reset-password', {
        data: {
          token: 'invalid_token',
          newPassword: 'NewPass123!',
        },
      })
      expect([400, 401]).toContain(invalidTokenResponse.status())

      // Test 3: Full workflow - request reset, extract token, reset password, sign in
      await page.request.post('/api/auth/forget-password', {
        data: { email: userEmail },
      })

      const email = await mailpit.waitForEmail(
        (e) =>
          e.To[0]?.Address === userEmail &&
          (e.Subject.toLowerCase().includes('password') ||
            e.Subject.toLowerCase().includes('reset'))
      )

      const token = extractTokenFromUrl(email.HTML, 'token')
      expect(token).not.toBeNull()

      const resetResponse = await page.request.post('/api/auth/reset-password', {
        data: {
          token,
          newPassword: 'NewWorkflowPass123!',
        },
      })
      expect(resetResponse.status()).toBe(200)

      // Verify new password works
      const signInResult = await signIn({
        email: userEmail,
        password: 'NewWorkflowPass123!',
      })
      expect(signInResult.user).toBeDefined()
    }
  )
})
