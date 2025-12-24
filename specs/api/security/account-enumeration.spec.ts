/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Account Enumeration Prevention - User Existence Protection
 *
 * Domain: api/security
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (3 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests account enumeration prevention mechanisms that protect user privacy:
 * - Generic error messages (same for "user not found" vs "wrong password")
 * - Timing-safe responses (same response time for valid/invalid users)
 * - Generic password reset messages (valid/invalid email)
 *
 * Account enumeration is a security vulnerability where attackers can:
 * 1. Discover valid email addresses by observing different error messages
 * 2. Use timing attacks to detect account existence
 * 3. Build targeted attack lists of confirmed users
 * 4. Facilitate phishing and credential stuffing attacks
 *
 * Prevention measures ensure attackers cannot distinguish between:
 * - User exists vs user doesn't exist
 * - Wrong password vs non-existent account
 * - Valid email vs invalid email (password reset)
 *
 * Better Auth should implement timing-safe comparisons and generic error messages.
 *
 * Error Response Structure:
 * - Authentication errors: Generic `{ error: "Invalid credentials" }` or `{ message: "..." }`
 * - Password reset: Generic success message regardless of email validity
 * - See docs/architecture/testing-strategy/status-code-guidelines.md for details
 */

test.describe('Account Enumeration Prevention - User Existence Protection', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-ENUM-001: should return generic error on invalid sign-in (same message for user not found vs wrong password)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Application with email/password authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create a valid user
      await signUp({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'CorrectPassword123!',
      })

      // WHEN: Attempting to sign in with non-existent email
      const nonExistentResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        },
      })

      expect(nonExistentResponse.status()).toBe(401)
      const nonExistentError = await nonExistentResponse.json()

      // WHEN: Attempting to sign in with existing email but wrong password
      const wrongPasswordResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'existing@example.com',
          password: 'WrongPassword123!',
        },
      })

      expect(wrongPasswordResponse.status()).toBe(401)
      const wrongPasswordError = await wrongPasswordResponse.json()

      // THEN: Error messages should be IDENTICAL (no enumeration)
      const nonExistentMessage = nonExistentError.error || nonExistentError.message
      const wrongPasswordMessage = wrongPasswordError.error || wrongPasswordError.message

      expect(nonExistentMessage).toBe(wrongPasswordMessage)

      // THEN: Error message should be generic (not revealing)
      const genericMessages = [
        'Invalid credentials',
        'Invalid email or password',
        'Authentication failed',
        'Incorrect email or password',
      ]

      const isGeneric = genericMessages.some((msg) =>
        nonExistentMessage.toLowerCase().includes(msg.toLowerCase())
      )

      expect(isGeneric).toBe(true)

      // THEN: Error message should NOT reveal user existence
      expect(nonExistentMessage.toLowerCase()).not.toContain('user not found')
      expect(nonExistentMessage.toLowerCase()).not.toContain('does not exist')
      expect(nonExistentMessage.toLowerCase()).not.toContain('no account')
      expect(wrongPasswordMessage.toLowerCase()).not.toContain('wrong password')
      expect(wrongPasswordMessage.toLowerCase()).not.toContain('incorrect password')
    }
  )

  test.fixme(
    'API-SECURITY-ENUM-002: should return same response time for valid/invalid users (timing-safe)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Application with timing-safe authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create a valid user
      await signUp({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'CorrectPassword123!',
      })

      // WHEN: Measuring response time for non-existent user
      const nonExistentTimings: number[] = []
      for (let i = 0; i < 10; i++) {
        const start = Date.now()
        await page.request.post('/api/auth/sign-in/email', {
          data: {
            email: 'nonexistent@example.com',
            password: 'AnyPassword123!',
          },
        })
        const end = Date.now()
        nonExistentTimings.push(end - start)
      }

      // WHEN: Measuring response time for existing user (wrong password)
      const wrongPasswordTimings: number[] = []
      for (let i = 0; i < 10; i++) {
        const start = Date.now()
        await page.request.post('/api/auth/sign-in/email', {
          data: {
            email: 'existing@example.com',
            password: 'WrongPassword123!',
          },
        })
        const end = Date.now()
        wrongPasswordTimings.push(end - start)
      }

      // THEN: Average response times should be similar (within 10% margin)
      const avgNonExistent =
        nonExistentTimings.reduce((a, b) => a + b, 0) / nonExistentTimings.length
      const avgWrongPassword =
        wrongPasswordTimings.reduce((a, b) => a + b, 0) / wrongPasswordTimings.length

      const difference = Math.abs(avgNonExistent - avgWrongPassword)
      const threshold = Math.max(avgNonExistent, avgWrongPassword) * 0.1 // 10% threshold

      expect(difference).toBeLessThan(threshold)

      // THEN: Standard deviation should be similar (consistent timing)
      const stdDevNonExistent = Math.sqrt(
        nonExistentTimings.map((x) => Math.pow(x - avgNonExistent, 2)).reduce((a, b) => a + b, 0) /
          nonExistentTimings.length
      )

      const stdDevWrongPassword = Math.sqrt(
        wrongPasswordTimings
          .map((x) => Math.pow(x - avgWrongPassword, 2))
          .reduce((a, b) => a + b, 0) / wrongPasswordTimings.length
      )

      // Timing behavior should be consistent (similar variance)
      const stdDevDifference = Math.abs(stdDevNonExistent - stdDevWrongPassword)
      const stdDevThreshold = Math.max(stdDevNonExistent, stdDevWrongPassword) * 0.2 // 20% threshold

      expect(stdDevDifference).toBeLessThan(stdDevThreshold)
    }
  )

  test.fixme(
    'API-SECURITY-ENUM-003: should return generic message on password reset (valid/invalid email)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Application with password reset functionality
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          passwordReset: true,
        },
      })

      // Create a valid user
      await signUp({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'CurrentPassword123!',
      })

      // WHEN: Requesting password reset for existing email
      const existingEmailResponse = await page.request.post('/api/auth/forgot-password', {
        data: {
          email: 'existing@example.com',
        },
      })

      expect([200, 204]).toContain(existingEmailResponse.status())
      const existingEmailData = await existingEmailResponse.json()

      // WHEN: Requesting password reset for non-existent email
      const nonExistentEmailResponse = await page.request.post('/api/auth/forgot-password', {
        data: {
          email: 'nonexistent@example.com',
        },
      })

      expect([200, 204]).toContain(nonExistentEmailResponse.status())
      const nonExistentEmailData = await nonExistentEmailResponse.json()

      // THEN: Response messages should be IDENTICAL (no enumeration)
      const existingMessage = existingEmailData.message || existingEmailData.success
      const nonExistentMessage = nonExistentEmailData.message || nonExistentEmailData.success

      expect(existingMessage).toBe(nonExistentMessage)

      // THEN: Message should be generic success (not revealing)
      const genericMessages = [
        'If an account exists',
        'If your email is registered',
        'Password reset instructions sent',
        'Check your email',
      ]

      const isGeneric = genericMessages.some((msg) =>
        existingMessage.toLowerCase().includes(msg.toLowerCase())
      )

      expect(isGeneric).toBe(true)

      // THEN: Message should NOT confirm email existence
      expect(existingMessage.toLowerCase()).not.toContain('email sent')
      expect(existingMessage.toLowerCase()).not.toContain('reset link sent')
      expect(nonExistentMessage.toLowerCase()).not.toContain('email not found')
      expect(nonExistentMessage.toLowerCase()).not.toContain('no account')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-ENUM-004: account enumeration prevention workflow protects user privacy',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp }) => {
      await test.step('Setup: Start server with enumeration prevention', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            passwordReset: true,
          },
        })

        await signUp({
          name: 'Test User',
          email: 'test@example.com',
          password: 'ValidPass123!',
        })
      })

      await test.step('Verify: Generic error for non-existent user', async () => {
        const response = await page.request.post('/api/auth/sign-in/email', {
          data: {
            email: 'nonexistent@example.com',
            password: 'AnyPassword',
          },
        })

        expect(response.status()).toBe(401)

        const error = await response.json()
        const message = error.error || error.message

        expect(message.toLowerCase()).toContain('invalid')
        expect(message.toLowerCase()).not.toContain('not found')
      })

      await test.step('Verify: Generic error for wrong password', async () => {
        const response = await page.request.post('/api/auth/sign-in/email', {
          data: {
            email: 'test@example.com',
            password: 'WrongPassword',
          },
        })

        expect(response.status()).toBe(401)

        const error = await response.json()
        const message = error.error || error.message

        expect(message.toLowerCase()).toContain('invalid')
        expect(message.toLowerCase()).not.toContain('wrong password')
      })

      await test.step('Verify: Same error messages', async () => {
        const nonExistentResponse = await page.request.post('/api/auth/sign-in/email', {
          data: {
            email: 'fake@example.com',
            password: 'Pass123',
          },
        })

        const wrongPasswordResponse = await page.request.post('/api/auth/sign-in/email', {
          data: {
            email: 'test@example.com',
            password: 'WrongPass',
          },
        })

        const nonExistentError = await nonExistentResponse.json()
        const wrongPasswordError = await wrongPasswordResponse.json()

        const msg1 = nonExistentError.error || nonExistentError.message
        const msg2 = wrongPasswordError.error || wrongPasswordError.message

        expect(msg1).toBe(msg2)
      })

      await test.step('Verify: Generic password reset message', async () => {
        const validEmailResponse = await page.request.post('/api/auth/forgot-password', {
          data: {
            email: 'test@example.com',
          },
        })

        const invalidEmailResponse = await page.request.post('/api/auth/forgot-password', {
          data: {
            email: 'invalid@example.com',
          },
        })

        expect([200, 204]).toContain(validEmailResponse.status())
        expect([200, 204]).toContain(invalidEmailResponse.status())

        const validData = await validEmailResponse.json()
        const invalidData = await invalidEmailResponse.json()

        const validMsg = validData.message || validData.success
        const invalidMsg = invalidData.message || invalidData.success

        expect(validMsg).toBe(invalidMsg)
        expect(validMsg.toLowerCase()).toContain('if')
      })

      await test.step('Verify: Timing-safe responses', async () => {
        const timings: number[] = []

        for (let i = 0; i < 5; i++) {
          const start = Date.now()
          await page.request.post('/api/auth/sign-in/email', {
            data: {
              email: i % 2 === 0 ? 'test@example.com' : 'nonexistent@example.com',
              password: 'AnyPassword',
            },
          })
          const end = Date.now()
          timings.push(end - start)
        }

        // Verify no outliers (consistent timing)
        const avg = timings.reduce((a, b) => a + b, 0) / timings.length
        for (const timing of timings) {
          const difference = Math.abs(timing - avg)
          expect(difference).toBeLessThan(avg * 0.3) // Within 30% of average
        }
      })
    }
  )
})
