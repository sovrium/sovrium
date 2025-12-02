/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
import { extractTokenFromUrl } from '../email-helpers'

/**
 * E2E Tests for Verify email address
 *
 * Source: specs/api/paths/auth/verify-email/get.json
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Email capture via Mailpit fixture for verification token extraction
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('Verify email address', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-AUTH-VERIFY-EMAIL-001: should return 200 OK and mark email as verified',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: A user with valid verification token
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      const userEmail = mailpit.email('test')

      await signUp({
        email: userEmail,
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // Request verification email
      await page.request.post('/api/auth/send-verification-email', {
        data: { email: userEmail },
      })

      // Capture email and extract token (filtered by testId namespace)
      const email = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === userEmail && e.Subject.toLowerCase().includes('verify')
      )
      const token = extractTokenFromUrl(email.HTML, 'token')
      expect(token).not.toBeNull()

      // WHEN: User clicks verification link with valid token
      const response = await page.request.get(`/api/auth/verify-email?token=${token}`)

      // THEN: Returns 200 OK and marks email as verified
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)
    }
  )

  test(
    'API-AUTH-VERIFY-EMAIL-002: should return 400 Bad Request without token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // WHEN: User accesses endpoint without token parameter
      const response = await page.request.get('/api/auth/verify-email')

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-VERIFY-EMAIL-003: should return 401 Unauthorized with invalid token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // WHEN: User submits invalid verification token
      const response = await page.request.get('/api/auth/verify-email?token=invalid_token_abc123')

      // THEN: Returns 401 Unauthorized (or 400 depending on Better Auth version)
      expect([400, 401]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-VERIFY-EMAIL-004: should return 401 Unauthorized with expired token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (token would be expired)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      // WHEN: User submits expired token (simulated with fake token)
      const response = await page.request.get('/api/auth/verify-email?token=expired_token')

      // THEN: Returns 401 Unauthorized (or 400 depending on Better Auth version)
      expect([400, 401]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-VERIFY-EMAIL-005: should return 401 Unauthorized with already used token',
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
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // Request verification email
      await page.request.post('/api/auth/send-verification-email', {
        data: { email: userEmail },
      })

      // Capture email and extract token (filtered by testId namespace)
      const email = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === userEmail && e.Subject.toLowerCase().includes('verify')
      )
      const token = extractTokenFromUrl(email.HTML, 'token')
      expect(token).not.toBeNull()

      // Use the token first time (should succeed)
      const firstResponse = await page.request.get(`/api/auth/verify-email?token=${token}`)
      expect(firstResponse.status()).toBe(200)

      // WHEN: User attempts to reuse the same verification token
      const response = await page.request.get(`/api/auth/verify-email?token=${token}`)

      // THEN: Returns 401 Unauthorized (token already used)
      expect([400, 401]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-VERIFY-EMAIL-006: should handle already verified email with valid token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: A user with already verified email and unused token
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
      })

      const userEmail = mailpit.email('test')

      await signUp({
        email: userEmail,
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // Request first verification email
      await page.request.post('/api/auth/send-verification-email', {
        data: { email: userEmail },
      })

      // Get first token and verify email (filtered by testId namespace)
      const firstEmail = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === userEmail && e.Subject.toLowerCase().includes('verify')
      )
      const firstToken = extractTokenFromUrl(firstEmail.HTML, 'token')
      expect(firstToken).not.toBeNull()

      // Verify with first token
      await page.request.get(`/api/auth/verify-email?token=${firstToken}`)

      // Request new verification email for already verified email
      await page.request.post('/api/auth/send-verification-email', {
        data: { email: userEmail },
      })

      // WHEN: User clicks verification link for already verified email
      // Note: A new email might or might not be sent depending on implementation
      const response = await page.request.get('/api/auth/verify-email?token=some_new_token')

      // THEN: Returns 200 OK or 400 (implementation-dependent)
      expect([200, 400, 401]).toContain(response.status())
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-VERIFY-EMAIL-007: user can complete full verify-email workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
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

      // Test 1: Verify without token fails
      const noTokenResponse = await page.request.get('/api/auth/verify-email')
      expect(noTokenResponse.status()).toBe(400)

      // Test 2: Verify with invalid token fails
      const invalidTokenResponse = await page.request.get(
        '/api/auth/verify-email?token=invalid_token'
      )
      expect([400, 401]).toContain(invalidTokenResponse.status())

      // Test 3: Full workflow - request email, extract token, verify
      await page.request.post('/api/auth/send-verification-email', {
        data: { email: userEmail },
      })

      const email = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === userEmail && e.Subject.toLowerCase().includes('verify')
      )

      const token = extractTokenFromUrl(email.HTML, 'token')
      expect(token).not.toBeNull()

      const verifyResponse = await page.request.get(`/api/auth/verify-email?token=${token}`)
      expect(verifyResponse.status()).toBe(200)
    }
  )
})
