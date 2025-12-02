/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Send Magic Link
 *
 * Source: src/domain/models/app/auth/methods/magic-link.ts
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (5 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Send Magic Link', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-MAGIC-LINK-SEND-001: should send magic link email to registered user with custom template',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: Application with magic link authentication enabled and custom email templates
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['magic-link'],
          emailTemplates: {
            magicLink: {
              subject: 'Sign in to TestApp with magic link',
              text: 'Hi $name, click here to sign in: $url',
            },
          },
        },
      })

      const userEmail = mailpit.email('test')

      // Register user first
      await signUp({
        name: 'Test User',
        email: userEmail,
        password: 'ValidPassword123!',
      })

      // WHEN: User requests magic link
      const response = await page.request.post('/api/auth/magic-link/send', {
        data: {
          email: userEmail,
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('sent')
      expect(data.sent).toBe(true)

      // THEN: Magic link email is sent with custom template
      const email = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === userEmail && e.Subject.includes('TestApp')
      )
      expect(email).toBeDefined()
      expect(email.Subject).toBe('Sign in to TestApp with magic link')
      const body = email.HTML || email.Text
      expect(body).toContain('click here to sign in')
    }
  )

  test.fixme(
    'API-AUTH-MAGIC-LINK-SEND-002: should send magic link to unregistered user for signup',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, mailpit }) => {
      // GIVEN: Application with magic link authentication enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['magic-link'],
        },
      })

      const newUserEmail = mailpit.email('newuser')

      // WHEN: New user requests magic link
      const response = await page.request.post('/api/auth/magic-link/send', {
        data: {
          email: newUserEmail,
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Returns 200 OK (no user enumeration)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('sent')
      expect(data.sent).toBe(true)

      // THEN: Magic link email is sent for signup
      const email = await mailpit.waitForEmail((e) => e.To[0]?.Address === newUserEmail)
      expect(email).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-MAGIC-LINK-SEND-003: should return 400 when email is missing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with magic link enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['magic-link'],
        },
      })

      // WHEN: User submits request without email
      const response = await page.request.post('/api/auth/magic-link/send', {
        data: {
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-MAGIC-LINK-SEND-004: should return 400 with invalid email format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with magic link enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['magic-link'],
        },
      })

      // WHEN: User submits request with invalid email
      const response = await page.request.post('/api/auth/magic-link/send', {
        data: {
          email: 'not-an-email',
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-MAGIC-LINK-SEND-005: should return 400 when magic link not enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application without magic link authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          // No magic-link method
        },
      })

      // WHEN: User requests magic link
      const response = await page.request.post('/api/auth/magic-link/send', {
        data: {
          email: 'test@example.com',
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Returns 400 Bad Request or 404 Not Found
      expect([400, 404]).toContain(response.status())
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-MAGIC-LINK-SEND-006: user can complete full magic link send workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: Application with magic link authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['magic-link', 'email-and-password'],
        },
      })

      const existingUserEmail = mailpit.email('existing')
      const newUserEmail = mailpit.email('newuser')

      // Register existing user
      await signUp({
        name: 'Existing User',
        email: existingUserEmail,
        password: 'ValidPassword123!',
      })

      // WHEN: Existing user requests magic link
      const existingUserResponse = await page.request.post('/api/auth/magic-link/send', {
        data: {
          email: existingUserEmail,
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Magic link is sent
      expect(existingUserResponse.status()).toBe(200)
      const existingEmail = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === existingUserEmail
      )
      expect(existingEmail).toBeDefined()

      // WHEN: New user requests magic link
      const newUserResponse = await page.request.post('/api/auth/magic-link/send', {
        data: {
          email: newUserEmail,
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Magic link is sent for signup
      expect(newUserResponse.status()).toBe(200)
      const newEmail = await mailpit.waitForEmail((e) => e.To[0]?.Address === newUserEmail)
      expect(newEmail).toBeDefined()

      // WHEN: Invalid email is submitted
      const invalidResponse = await page.request.post('/api/auth/magic-link/send', {
        data: {
          email: 'invalid-email',
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Request fails with validation error
      expect(invalidResponse.status()).toBe(400)
    }
  )
})
