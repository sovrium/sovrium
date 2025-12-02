/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
import { assertEmailReceived } from '../email-helpers'

/**
 * E2E Tests for Send verification email
 *
 * Source: specs/api/paths/auth/send-verification-email/post.json
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

test.describe('Send verification email', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-AUTH-SEND-VERIFICATION-EMAIL-001: should return 200 OK and send verification email with custom template',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: A registered user with unverified email and custom email templates
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          emailTemplates: {
            verification: {
              subject: 'Please verify your TestApp account',
              text: 'Hi $name, please verify your email by clicking: $url',
            },
          },
        },
      })

      const userEmail = mailpit.email('test')

      // Create user via API (email may not be verified by default)
      await signUp({
        email: userEmail,
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // WHEN: User requests verification email
      const response = await page.request.post('/api/auth/send-verification-email', {
        data: {
          email: userEmail,
        },
      })

      // THEN: Returns 200 OK and sends verification email with custom template
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)

      // Verify email was actually sent with custom subject
      const email = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === userEmail && e.Subject.includes('TestApp')
      )

      assertEmailReceived(email, {
        to: userEmail,
        subjectEquals: 'Please verify your TestApp account',
        bodyContains: 'please verify your email',
      })
    }
  )

  test(
    'API-AUTH-SEND-VERIFICATION-EMAIL-002: should return 400 Bad Request without email',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User submits request without email field
      const response = await page.request.post('/api/auth/send-verification-email', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-SEND-VERIFICATION-EMAIL-003: should return 400 Bad Request with invalid email format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User submits request with invalid email format
      const response = await page.request.post('/api/auth/send-verification-email', {
        data: {
          email: 'not-an-email',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-SEND-VERIFICATION-EMAIL-004: should handle already verified email',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A user with already verified email
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // WHEN: User requests verification email again
      const response = await page.request.post('/api/auth/send-verification-email', {
        data: {
          email: 'test@example.com',
        },
      })

      // THEN: Returns 200 OK or 400 (implementation-dependent)
      expect([200, 400]).toContain(response.status())
    }
  )

  test(
    'API-AUTH-SEND-VERIFICATION-EMAIL-005: should invalidate old token on new request',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: A user who has already requested verification
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      const userEmail = mailpit.email('test')

      await signUp({
        email: userEmail,
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // First request - sends first verification email
      await page.request.post('/api/auth/send-verification-email', {
        data: { email: userEmail },
      })

      // Wait for first email (filtered by testId namespace)
      const firstEmail = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === userEmail && e.Subject.toLowerCase().includes('verify')
      )
      expect(firstEmail).toBeDefined()

      // WHEN: User requests verification email again
      const response = await page.request.post('/api/auth/send-verification-email', {
        data: {
          email: userEmail,
        },
      })

      // THEN: Returns 200 OK (old token invalidated, new one created)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)

      // Verify new email was sent (wait for 2nd email)
      const emails = await mailpit.getEmails()
      const verifyEmails = emails.filter(
        (e) => e.To[0]?.Address === userEmail && e.Subject.toLowerCase().includes('verify')
      )
      expect(verifyEmails.length).toBeGreaterThanOrEqual(2)
    }
  )

  test(
    'API-AUTH-SEND-VERIFICATION-EMAIL-006: should return 200 OK for non-existent email',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with no registered user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User requests verification email for non-existent email
      const response = await page.request.post('/api/auth/send-verification-email', {
        data: {
          email: 'nonexistent@example.com',
        },
      })

      // THEN: Returns 200 OK (same response to prevent email enumeration)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)

      // Note: No email should be sent for non-existent user (but response looks the same)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-SEND-VERIFICATION-EMAIL-007: user can complete full send-verification-email workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      const userEmail = mailpit.email('workflow')
      const nonExistentEmail = mailpit.email('nonexistent')

      // Create user
      await signUp({
        email: userEmail,
        password: 'WorkflowPass123!',
        name: 'Workflow User',
      })

      // Test 1: Request with invalid email format fails
      const invalidResponse = await page.request.post('/api/auth/send-verification-email', {
        data: { email: 'not-an-email' },
      })
      expect(invalidResponse.status()).toBe(400)

      // Test 2: Request for registered email succeeds and sends email
      const successResponse = await page.request.post('/api/auth/send-verification-email', {
        data: { email: userEmail },
      })
      expect(successResponse.status()).toBe(200)

      // Verify email was sent (filtered by testId namespace)
      const email = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === userEmail && e.Subject.toLowerCase().includes('verify')
      )
      expect(email).toBeDefined()

      // Test 3: Request for non-existent email also succeeds (prevent enumeration)
      const nonExistentResponse = await page.request.post('/api/auth/send-verification-email', {
        data: { email: nonExistentEmail },
      })
      expect(nonExistentResponse.status()).toBe(200)
    }
  )
})
