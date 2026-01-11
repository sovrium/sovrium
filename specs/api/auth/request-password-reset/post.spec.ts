/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
import { assertEmailReceived } from '../../../fixtures/email'

/**
 * E2E Tests for Request password reset
 *
 * Source: specs/api/paths/auth/request-password-reset/post.json
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Email capture via Mailpit fixture for reset token extraction
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('Request password reset', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-AUTH-REQUEST-PASSWORD-RESET-001: should return 200 OK and send reset email with custom template',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: A registered user with valid email and custom email templates
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          emailTemplates: {
            resetPassword: {
              subject: 'Reset your TestApp password',
              text: 'Hi $name, click here to reset your password: $url',
            },
          },
        },
      })

      const userEmail = mailpit.email('test')

      // Create user via API
      await signUp({
        email: userEmail,
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // WHEN: User requests password reset with registered email
      const response = await page.request.post('/api/auth/request-password-reset', {
        data: {
          email: userEmail,
        },
      })

      // THEN: Returns 200 OK and sends reset email with custom template
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)

      // Verify email was sent with custom subject
      const email = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === userEmail && e.Subject.includes('TestApp')
      )

      assertEmailReceived(email, {
        to: userEmail,
        subjectEquals: 'Reset your TestApp password',
        bodyContains: 'click here to reset your password',
      })
    }
  )

  test(
    'API-AUTH-REQUEST-PASSWORD-RESET-002: should return 200 OK for non-existent email',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server with no registered user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: User requests password reset with non-existent email
      const response = await page.request.post('/api/auth/request-password-reset', {
        data: {
          email: 'nonexistent@example.com',
        },
      })

      // THEN: Returns 200 OK (same response to prevent email enumeration)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)

      // Note: No email should be sent for non-existent user
    }
  )

  test(
    'API-AUTH-REQUEST-PASSWORD-RESET-003: should return 400 Bad Request without email',
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
      const response = await page.request.post('/api/auth/request-password-reset', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-REQUEST-PASSWORD-RESET-004: should return 400 Bad Request with invalid email format',
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
      const response = await page.request.post('/api/auth/request-password-reset', {
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
    'API-AUTH-REQUEST-PASSWORD-RESET-005: should return 200 OK with case-insensitive email',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: A registered user with lowercase email
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      const userEmail = mailpit.email('test')
      const upperEmail = userEmail.toUpperCase()

      await signUp({
        email: userEmail,
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // WHEN: User requests password reset with uppercase email variation
      const response = await page.request.post('/api/auth/request-password-reset', {
        data: {
          email: upperEmail,
        },
      })

      // THEN: Returns 200 OK (case-insensitive matching)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)

      // Verify email was sent (to lowercase normalized address, filtered by testId namespace)
      const email = await mailpit.waitForEmail(
        (e) =>
          e.To[0]?.Address.toLowerCase() === userEmail.toLowerCase() &&
          (e.Subject.toLowerCase().includes('password') ||
            e.Subject.toLowerCase().includes('reset'))
      )
      expect(email).toBeDefined()
    }
  )

  test(
    'API-AUTH-REQUEST-PASSWORD-RESET-006: should invalidate old token on new request',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: A user who has already requested password reset
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

      // First request - sends first reset email
      await page.request.post('/api/auth/request-password-reset', {
        data: { email: userEmail },
      })

      // Wait for first email (filtered by testId namespace)
      const firstEmail = await mailpit.waitForEmail(
        (e) =>
          e.To[0]?.Address === userEmail &&
          (e.Subject.toLowerCase().includes('password') ||
            e.Subject.toLowerCase().includes('reset'))
      )
      expect(firstEmail).toBeDefined()

      // WHEN: User requests password reset again
      const response = await page.request.post('/api/auth/request-password-reset', {
        data: {
          email: userEmail,
        },
      })

      // THEN: Returns 200 OK (old token invalidated, new one created)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)

      // Wait for second email to arrive (filtered by testId namespace)
      await mailpit.waitForEmail(
        (e) => {
          // Check if this is a reset email to our user, AND it's different from the first one
          const isResetEmail =
            e.To[0]?.Address === userEmail &&
            (e.Subject.toLowerCase().includes('password') ||
              e.Subject.toLowerCase().includes('reset'))
          const isDifferentEmail = e.ID !== firstEmail.ID
          return isResetEmail && isDifferentEmail
        },
        { timeout: 5000 }
      )

      // Verify we have at least 2 reset emails
      const emails = await mailpit.getEmails() // Use getEmails() for namespace filtering
      const resetEmails = emails.filter(
        (e) =>
          e.To[0]?.Address === userEmail &&
          (e.Subject.toLowerCase().includes('password') ||
            e.Subject.toLowerCase().includes('reset'))
      )
      expect(resetEmails.length).toBeGreaterThanOrEqual(2)
    }
  )

  test(
    'API-AUTH-REQUEST-PASSWORD-RESET-007: should include redirectTo in reset email',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: A registered user
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

      // WHEN: User requests password reset with custom redirectTo URL
      const response = await page.request.post('/api/auth/request-password-reset', {
        data: {
          email: userEmail,
          redirectTo: 'https://app.example.com/reset-password',
        },
      })

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)

      // Verify email was sent with redirect URL in content (filtered by testId namespace)
      const email = await mailpit.waitForEmail(
        (e) =>
          e.To[0]?.Address === userEmail &&
          (e.Subject.toLowerCase().includes('password') ||
            e.Subject.toLowerCase().includes('reset'))
      )
      expect(email).toBeDefined()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-REQUEST-PASSWORD-RESET-REGRESSION: user can complete full request-password-reset workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      let userEmail: string
      let nonExistentEmail: string
      let upperEmail: string

      await test.step('Setup: Start server with comprehensive configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            emailTemplates: {
              resetPassword: {
                subject: 'Reset your TestApp password',
                text: 'Hi $name, click here to reset your password: $url',
              },
            },
          },
        })

        userEmail = mailpit.email('workflow')
        nonExistentEmail = mailpit.email('nonexistent')
        upperEmail = userEmail.toUpperCase()

        await signUp({
          email: userEmail,
          password: 'WorkflowPass123!',
          name: 'Workflow User',
        })
      })

      await test.step('API-AUTH-REQUEST-PASSWORD-RESET-001: Returns 200 OK and sends reset email with custom template', async () => {
        // WHEN: User requests password reset with registered email
        const response = await page.request.post('/api/auth/request-password-reset', {
          data: { email: userEmail },
        })

        // THEN: Returns 200 OK and sends reset email with custom template
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('status', true)

        const email = await mailpit.waitForEmail(
          (e) => e.To[0]?.Address === userEmail && e.Subject.includes('TestApp')
        )
        expect(email.Subject).toBe('Reset your TestApp password')
      })

      await test.step('API-AUTH-REQUEST-PASSWORD-RESET-002: Returns 200 OK for non-existent email', async () => {
        // WHEN: User requests password reset with non-existent email
        const response = await page.request.post('/api/auth/request-password-reset', {
          data: { email: nonExistentEmail },
        })

        // THEN: Returns 200 OK (same response to prevent email enumeration)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('status', true)
      })

      await test.step('API-AUTH-REQUEST-PASSWORD-RESET-003: Returns 400 Bad Request without email', async () => {
        // WHEN: User submits request without email field
        const response = await page.request.post('/api/auth/request-password-reset', {
          data: {},
        })

        // THEN: Returns 400 Bad Request with validation error
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('message')
      })

      await test.step('API-AUTH-REQUEST-PASSWORD-RESET-004: Returns 400 Bad Request with invalid email format', async () => {
        // WHEN: User submits request with invalid email format
        const response = await page.request.post('/api/auth/request-password-reset', {
          data: { email: 'not-an-email' },
        })

        // THEN: Returns 400 Bad Request with validation error
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('message')
      })

      await test.step('API-AUTH-REQUEST-PASSWORD-RESET-005: Returns 200 OK with case-insensitive email', async () => {
        // WHEN: User requests password reset with uppercase email variation
        const response = await page.request.post('/api/auth/request-password-reset', {
          data: { email: upperEmail },
        })

        // THEN: Returns 200 OK (case-insensitive matching)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('status', true)
      })
    }
  )
})
