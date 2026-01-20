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
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Send Magic Link', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-AUTH-MAGIC-LINK-SEND-001: should send magic link email to registered user with custom template',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // GIVEN: Application with magic link authentication enabled and custom email templates
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          magicLink: true,
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
      const response = await page.request.post('/api/auth/sign-in/magic-link', {
        data: {
          email: userEmail,
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status')
      expect(data.status).toBe(true)

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

  test(
    'API-AUTH-MAGIC-LINK-SEND-002: should send magic link to unregistered user for signup',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, mailpit }) => {
      // GIVEN: Application with magic link authentication enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          magicLink: true,
        },
      })

      const newUserEmail = mailpit.email('newuser')

      // WHEN: New user requests magic link
      const response = await page.request.post('/api/auth/sign-in/magic-link', {
        data: {
          email: newUserEmail,
          callbackUrl: '/dashboard',
        },
      })

      // THEN: Returns 200 OK (no user enumeration)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status')
      expect(data.status).toBe(true)

      // THEN: Magic link email is sent for signup
      const email = await mailpit.waitForEmail((e) => e.To[0]?.Address === newUserEmail)
      expect(email).toBeDefined()
    }
  )

  test(
    'API-AUTH-MAGIC-LINK-SEND-003: should return 400 when email is missing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with magic link enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          magicLink: true,
        },
      })

      // WHEN: User submits request without email
      const response = await page.request.post('/api/auth/sign-in/magic-link', {
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

  test(
    'API-AUTH-MAGIC-LINK-SEND-004: should return 400 with invalid email format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with magic link enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          magicLink: true,
        },
      })

      // WHEN: User submits request with invalid email
      const response = await page.request.post('/api/auth/sign-in/magic-link', {
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

  test(
    'API-AUTH-MAGIC-LINK-SEND-005: should return 400 when magic link not enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application without magic link authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          // No magic-link method
        },
      })

      // WHEN: User requests magic link
      const response = await page.request.post('/api/auth/sign-in/magic-link', {
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

  test(
    'API-AUTH-MAGIC-LINK-SEND-REGRESSION: user can complete full magic link send workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, mailpit }) => {
      // Setup: Start server with magic link auth and custom templates
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          magicLink: true,
          emailAndPassword: true,
          emailTemplates: {
            magicLink: {
              subject: 'Sign in to TestApp with magic link',
              text: 'Hi $name, click here to sign in: $url',
            },
          },
        },
      })

      const registeredUserEmail = mailpit.email('registered')
      const newUserEmail = mailpit.email('newuser')

      // Setup: Register a user for testing
      await signUp({
        name: 'Test User',
        email: registeredUserEmail,
        password: 'ValidPassword123!',
      })

      await test.step('API-AUTH-MAGIC-LINK-SEND-001: should send magic link email to registered user with custom template', async () => {
        // WHEN: User requests magic link
        const response = await page.request.post('/api/auth/sign-in/magic-link', {
          data: {
            email: registeredUserEmail,
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
          (e) => e.To[0]?.Address === registeredUserEmail && e.Subject.includes('TestApp')
        )
        expect(email).toBeDefined()
        expect(email.Subject).toBe('Sign in to TestApp with magic link')
        const body = email.HTML || email.Text
        expect(body).toContain('click here to sign in')
      })

      await test.step('API-AUTH-MAGIC-LINK-SEND-002: should send magic link to unregistered user for signup', async () => {
        // WHEN: New user requests magic link
        const response = await page.request.post('/api/auth/sign-in/magic-link', {
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
      })

      await test.step('API-AUTH-MAGIC-LINK-SEND-003: should return 400 when email is missing', async () => {
        // WHEN: User submits request without email
        const response = await page.request.post('/api/auth/sign-in/magic-link', {
          data: {
            callbackUrl: '/dashboard',
          },
        })

        // THEN: Returns 400 Bad Request with validation error
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('message')
      })

      await test.step('API-AUTH-MAGIC-LINK-SEND-004: should return 400 with invalid email format', async () => {
        // WHEN: User submits request with invalid email
        const response = await page.request.post('/api/auth/sign-in/magic-link', {
          data: {
            email: 'not-an-email',
            callbackUrl: '/dashboard',
          },
        })

        // THEN: Returns 400 Bad Request with validation error
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('message')
      })
    }
  )
})
