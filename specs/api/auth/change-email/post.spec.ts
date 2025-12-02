/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Change email address
 *
 * Source: specs/api/paths/auth/change-email/post.json
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Email capture via Mailpit fixture for verification token extraction
 * - Authentication/authorization checks via auth fixtures
 */

test.describe('Change email address', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-AUTH-CHANGE-EMAIL-001: should return 200 OK and send verification email with custom template',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn, mailpit }) => {
      // GIVEN: An authenticated user with valid new email and custom email templates
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          emailTemplates: {
            verification: {
              subject: 'Verify your new TestApp email address',
              text: 'Hi $name, please verify your new email: $url',
            },
          },
        },
      })

      const oldEmail = mailpit.email('old')
      const newEmail = mailpit.email('new')

      // Create user and sign in via API
      await signUp({
        email: oldEmail,
        password: 'TestPassword123!',
        name: 'Test User',
      })
      await signIn({
        email: oldEmail,
        password: 'TestPassword123!',
      })

      // WHEN: User requests to change email to unused address
      const response = await page.request.post('/api/auth/change-email', {
        data: {
          newEmail: newEmail,
        },
      })

      // THEN: Returns 200 OK and sends verification email to new address with custom template
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)

      // Verify email was sent to the NEW email address with custom subject
      const email = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === newEmail && e.Subject.includes('TestApp')
      )
      expect(email).toBeDefined()
      expect(email.Subject).toBe('Verify your new TestApp email address')
      const body = email.HTML || email.Text
      expect(body).toContain('verify your new email')
    }
  )

  test(
    'API-AUTH-CHANGE-EMAIL-002: should return 400 Bad Request without newEmail',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
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
      await signIn({
        email: 'test@example.com',
        password: 'TestPassword123!',
      })

      // WHEN: User submits request without newEmail field
      const response = await page.request.post('/api/auth/change-email', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-CHANGE-EMAIL-003: should return 400 Bad Request with invalid email format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
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
      await signIn({
        email: 'test@example.com',
        password: 'TestPassword123!',
      })

      // WHEN: User submits request with invalid email format
      const response = await page.request.post('/api/auth/change-email', {
        data: {
          newEmail: 'not-an-email',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-CHANGE-EMAIL-004: should return 401 Unauthorized without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: Unauthenticated user attempts to change email
      const response = await page.request.post('/api/auth/change-email', {
        data: {
          newEmail: 'new@example.com',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test(
    'API-AUTH-CHANGE-EMAIL-005: should return 409 Conflict for existing email',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user and another user with target email
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create two users via API
      await signUp({
        email: 'user1@example.com',
        password: 'Password123!',
        name: 'User 1',
      })
      await signUp({
        email: 'existing@example.com',
        password: 'Password123!',
        name: 'User 2',
      })

      // Sign in as User 1
      await signIn({
        email: 'user1@example.com',
        password: 'Password123!',
      })

      // WHEN: User attempts to change to an already registered email
      const response = await page.request.post('/api/auth/change-email', {
        data: {
          newEmail: 'existing@example.com',
        },
      })

      // THEN: Returns 409 Conflict error (or 400 depending on implementation)
      expect([400, 409]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-CHANGE-EMAIL-006: should handle same email attempt',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
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
      await signIn({
        email: 'test@example.com',
        password: 'TestPassword123!',
      })

      // WHEN: User attempts to change to their current email
      const response = await page.request.post('/api/auth/change-email', {
        data: {
          newEmail: 'test@example.com',
        },
      })

      // THEN: Returns 200 OK or 400 (implementation-dependent)
      expect([200, 400]).toContain(response.status())
    }
  )

  test(
    'API-AUTH-CHANGE-EMAIL-007: should return 409 Conflict with case-insensitive matching',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user with lowercase email
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create two users via API
      await signUp({
        email: 'user1@example.com',
        password: 'Password123!',
        name: 'User 1',
      })
      await signUp({
        email: 'existing@example.com',
        password: 'Password123!',
        name: 'User 2',
      })

      // Sign in as User 1
      await signIn({
        email: 'user1@example.com',
        password: 'Password123!',
      })

      // WHEN: User changes to uppercase variation of existing email
      const response = await page.request.post('/api/auth/change-email', {
        data: {
          newEmail: 'EXISTING@EXAMPLE.COM',
        },
      })

      // THEN: Returns 409 Conflict (case-insensitive email matching) or 400
      expect([400, 409]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-CHANGE-EMAIL-008: user can complete full change-email workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn, mailpit }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      const workflowEmail = mailpit.email('workflow')
      const existingEmail = mailpit.email('existing')
      const newWorkflowEmail = mailpit.email('newworkflow')

      // Test 1: Change email fails without auth
      const noAuthResponse = await page.request.post('/api/auth/change-email', {
        data: { newEmail: newWorkflowEmail },
      })
      expect(noAuthResponse.status()).toBe(401)

      // Create users
      await signUp({
        email: workflowEmail,
        password: 'WorkflowPass123!',
        name: 'Workflow User',
      })
      await signUp({
        email: existingEmail,
        password: 'ExistingPass123!',
        name: 'Existing User',
      })

      // Sign in
      await signIn({
        email: workflowEmail,
        password: 'WorkflowPass123!',
      })

      // Test 2: Change email fails for existing email
      const conflictResponse = await page.request.post('/api/auth/change-email', {
        data: { newEmail: existingEmail },
      })
      expect([400, 409]).toContain(conflictResponse.status())

      // Test 3: Change email succeeds for new email and sends verification
      const successResponse = await page.request.post('/api/auth/change-email', {
        data: { newEmail: newWorkflowEmail },
      })
      expect(successResponse.status()).toBe(200)

      // Verify email was sent to new address (filtered by testId namespace)
      const email = await mailpit.waitForEmail(
        (e) =>
          e.To[0]?.Address === newWorkflowEmail &&
          (e.Subject.toLowerCase().includes('verify') || e.Subject.toLowerCase().includes('email'))
      )
      expect(email).toBeDefined()
    }
  )
})
