/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Rate Limiting - Security Critical Endpoints
 *
 * Domain: api/auth
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (7 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests rate limiting behavior on security-critical authentication endpoints
 * to prevent brute force attacks and abuse.
 *
 * Rate limiting is essential for:
 * - Sign-in: Prevent credential stuffing and brute force attacks
 * - Password reset: Prevent email enumeration
 * - API key creation: Prevent key flooding
 */

test.describe('Rate Limiting - Security Critical Endpoints', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-AUTH-RATE-001: should return 429 after exceeding sign-in rate limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp }) => {
      // GIVEN: Application with rate limiting enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          rateLimit: {
            signIn: { maxAttempts: 5, windowMs: 60_000 },
          },
        },
        tables: [],
      })

      // Create a user to attempt sign-in against
      await signUp({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: User exceeds sign-in rate limit with wrong password
      for (let i = 0; i < 5; i++) {
        await request.post('/api/auth/sign-in/email', {
          data: { email: 'user@example.com', password: 'WrongPassword' },
        })
      }

      // THEN: 6th attempt returns 429 Too Many Requests
      const response = await request.post('/api/auth/sign-in/email', {
        data: { email: 'user@example.com', password: 'WrongPassword' },
      })

      expect(response.status()).toBe(429)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('Too many requests')
    }
  )

  test.fixme(
    'API-AUTH-RATE-002: should reset sign-in rate limit after window expires',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp }) => {
      // GIVEN: Application with short rate limit window (2 seconds for testing)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          rateLimit: {
            signIn: { maxAttempts: 3, windowMs: 2000 },
          },
        },
        tables: [],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: User hits rate limit
      for (let i = 0; i < 3; i++) {
        await request.post('/api/auth/sign-in/email', {
          data: { email: 'user@example.com', password: 'WrongPassword' },
        })
      }

      // Verify rate limit is hit
      const blockedResponse = await request.post('/api/auth/sign-in/email', {
        data: { email: 'user@example.com', password: 'WrongPassword' },
      })
      expect(blockedResponse.status()).toBe(429)

      // THEN: Wait for window to expire and retry
      await new Promise((resolve) => setTimeout(resolve, 2100))

      const response = await request.post('/api/auth/sign-in/email', {
        data: { email: 'user@example.com', password: 'TestPassword123!' },
      })

      // Should succeed after rate limit window expires
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-RATE-003: should return 429 after exceeding password reset rate limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp }) => {
      // GIVEN: Application with password reset rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          rateLimit: {
            passwordReset: { maxAttempts: 3, windowMs: 60_000 },
          },
        },
        tables: [],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: User exceeds password reset rate limit
      for (let i = 0; i < 3; i++) {
        await request.post('/api/auth/request-password-reset', {
          data: { email: 'user@example.com' },
        })
      }

      // THEN: 4th attempt returns 429 Too Many Requests
      const response = await request.post('/api/auth/request-password-reset', {
        data: { email: 'user@example.com' },
      })

      expect(response.status()).toBe(429)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('Too many requests')
    }
  )

  test.fixme(
    'API-AUTH-RATE-004: should return 429 after exceeding sign-up rate limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with sign-up rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          rateLimit: {
            signUp: { maxAttempts: 5, windowMs: 60_000 },
          },
        },
        tables: [],
      })

      // WHEN: User exceeds sign-up rate limit
      for (let i = 0; i < 5; i++) {
        await request.post('/api/auth/sign-up/email', {
          data: {
            email: `user${i}@example.com`,
            password: 'TestPassword123!',
            name: `User ${i}`,
          },
        })
      }

      // THEN: 6th attempt returns 429 Too Many Requests
      const response = await request.post('/api/auth/sign-up/email', {
        data: {
          email: 'user6@example.com',
          password: 'TestPassword123!',
          name: 'User 6',
        },
      })

      expect(response.status()).toBe(429)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('Too many requests')
    }
  )

  test.fixme(
    'API-AUTH-RATE-005: should return 429 after exceeding API key creation rate limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with API key creation rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
          rateLimit: {
            apiKeyCreate: { maxAttempts: 10, windowMs: 60_000 },
          },
        },
        tables: [],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })

      // WHEN: User exceeds API key creation rate limit
      for (let i = 0; i < 10; i++) {
        await request.post('/api/auth/api-key/create', {
          data: { name: `key-${i}` },
        })
      }

      // THEN: 11th attempt returns 429 Too Many Requests
      const response = await request.post('/api/auth/api-key/create', {
        data: { name: 'key-11' },
      })

      expect(response.status()).toBe(429)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('Too many requests')
    }
  )

  test.fixme(
    'API-AUTH-RATE-006: should include Retry-After header in 429 response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp }) => {
      // GIVEN: Application with rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          rateLimit: {
            signIn: { maxAttempts: 3, windowMs: 60_000 },
          },
        },
        tables: [],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: User exceeds rate limit
      for (let i = 0; i < 3; i++) {
        await request.post('/api/auth/sign-in/email', {
          data: { email: 'user@example.com', password: 'WrongPassword' },
        })
      }

      const response = await request.post('/api/auth/sign-in/email', {
        data: { email: 'user@example.com', password: 'WrongPassword' },
      })

      // THEN: Response includes Retry-After header
      expect(response.status()).toBe(429)

      const retryAfter = response.headers()['retry-after']
      expect(retryAfter).toBeDefined()
      expect(parseInt(retryAfter)).toBeGreaterThan(0)
    }
  )

  test.fixme(
    'API-AUTH-RATE-007: should rate limit by IP address, not by user',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp }) => {
      // GIVEN: Application with IP-based rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          rateLimit: {
            signIn: { maxAttempts: 5, windowMs: 60_000, byIp: true },
          },
        },
        tables: [],
      })

      await signUp({ email: 'user1@example.com', password: 'TestPassword123!' })
      await signUp({ email: 'user2@example.com', password: 'TestPassword123!' })

      // WHEN: Same IP attempts sign-in for different users
      for (let i = 0; i < 3; i++) {
        await request.post('/api/auth/sign-in/email', {
          data: { email: 'user1@example.com', password: 'WrongPassword' },
        })
      }

      // Continue with different user from same IP
      for (let i = 0; i < 2; i++) {
        await request.post('/api/auth/sign-in/email', {
          data: { email: 'user2@example.com', password: 'WrongPassword' },
        })
      }

      // THEN: Rate limit is enforced across all users from same IP
      const response = await request.post('/api/auth/sign-in/email', {
        data: { email: 'user2@example.com', password: 'WrongPassword' },
      })

      expect(response.status()).toBe(429)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-AUTH-RATE-008: rate limiting protects security-critical endpoints',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, signUp }) => {
      await test.step('Setup: Start server with rate limiting configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            rateLimit: {
              signIn: { maxAttempts: 3, windowMs: 5000 },
              signUp: { maxAttempts: 3, windowMs: 5000 },
            },
          },
          tables: [],
        })
      })

      await test.step('Setup: Create test user', async () => {
        await signUp({ email: 'user@example.com', password: 'TestPassword123!' })
      })

      await test.step('Verify: Sign-in rate limiting enforced', async () => {
        // Exhaust rate limit
        for (let i = 0; i < 3; i++) {
          await request.post('/api/auth/sign-in/email', {
            data: { email: 'user@example.com', password: 'WrongPassword' },
          })
        }

        // Next attempt should be blocked
        const blockedResponse = await request.post('/api/auth/sign-in/email', {
          data: { email: 'user@example.com', password: 'TestPassword123!' },
        })
        expect(blockedResponse.status()).toBe(429)

        const data = await blockedResponse.json()
        expect(data).toHaveProperty('error')
      })

      await test.step('Verify: Rate limit resets after window', async () => {
        // Wait for rate limit window to expire
        await new Promise((resolve) => setTimeout(resolve, 5100))

        // Should succeed now
        const response = await request.post('/api/auth/sign-in/email', {
          data: { email: 'user@example.com', password: 'TestPassword123!' },
        })
        expect(response.status()).toBe(200)
      })

      await test.step('Verify: Sign-up rate limiting enforced', async () => {
        // Exhaust rate limit
        for (let i = 0; i < 3; i++) {
          await request.post('/api/auth/sign-up/email', {
            data: {
              email: `newuser${i}@example.com`,
              password: 'TestPassword123!',
              name: `User ${i}`,
            },
          })
        }

        // Next attempt should be blocked
        const blockedResponse = await request.post('/api/auth/sign-up/email', {
          data: {
            email: 'newuser4@example.com',
            password: 'TestPassword123!',
            name: 'User 4',
          },
        })
        expect(blockedResponse.status()).toBe(429)
      })
    }
  )
})
