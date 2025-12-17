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
 * Rate limiting is enabled by default for all security-critical endpoints:
 * - Sign-in: Prevent credential stuffing and brute force attacks
 * - Password reset: Prevent email enumeration
 * - API key creation: Prevent key flooding
 *
 * Note: These tests validate default rate limiting behavior. If default limits change,
 * test assertions may need adjustment.
 */

test.describe('Rate Limiting - Security Critical Endpoints', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-AUTH-RATE-001: should return 429 after exceeding sign-in rate limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp }) => {
      // GIVEN: Application with default rate limiting enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [],
      })

      // Create a user to attempt sign-in against
      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })

      // WHEN: User exceeds default sign-in rate limit with wrong password
      // Note: Test assumes default limit is 5 attempts per 60 seconds
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
      // This test waits 60+ seconds for rate limit window to expire
      test.slow()

      // GIVEN: Application with default rate limiting enabled
      // Note: This test validates rate limit window reset behavior.
      // If default window is longer than 60 seconds, this test may need adjustment
      // (either skip or use a mock time controller).
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })

      // WHEN: User hits default rate limit (assumes 5 attempts)
      for (let i = 0; i < 5; i++) {
        await request.post('/api/auth/sign-in/email', {
          data: { email: 'user@example.com', password: 'WrongPassword' },
        })
      }

      // Verify rate limit is hit
      const blockedResponse = await request.post('/api/auth/sign-in/email', {
        data: { email: 'user@example.com', password: 'WrongPassword' },
      })
      expect(blockedResponse.status()).toBe(429)

      // THEN: Wait for default window to expire (assumes 60 seconds)
      await new Promise((resolve) => setTimeout(resolve, 60_100))

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
      // GIVEN: Application with default password reset rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })

      // WHEN: User exceeds default password reset rate limit
      // Note: Test assumes default limit is 3 attempts per 60 seconds
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
      // GIVEN: Application with default sign-up rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [],
      })

      // WHEN: User exceeds default sign-up rate limit
      // Note: Test assumes default limit is 5 attempts per 60 seconds
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
      // GIVEN: Application with default API key creation rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })

      // WHEN: User exceeds default API key creation rate limit
      // Note: Test assumes default limit is 10 attempts per 60 seconds
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
      // GIVEN: Application with default rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })

      // WHEN: User exceeds default rate limit
      // Note: Test assumes default limit is 5 attempts per 60 seconds
      for (let i = 0; i < 5; i++) {
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
      expect(parseInt(retryAfter!)).toBeGreaterThan(0)
    }
  )

  test.fixme(
    'API-AUTH-RATE-007: should rate limit by IP address, not by user',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp }) => {
      // GIVEN: Application with default IP-based rate limiting
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [],
      })

      await signUp({
        email: 'user1@example.com',
        password: 'TestPassword123!',
        name: 'Test User 1',
      })
      await signUp({
        email: 'user2@example.com',
        password: 'TestPassword123!',
        name: 'Test User 2',
      })

      // WHEN: Same IP attempts sign-in for different users
      // Note: Test assumes default limit is 5 attempts per 60 seconds per IP
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
      // This test waits 60+ seconds for rate limit window to expire
      test.slow()

      await test.step('Setup: Start server with default rate limiting', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
          },
          tables: [],
        })
      })

      await test.step('Setup: Create test user', async () => {
        await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      })

      await test.step('Verify: Sign-in rate limiting enforced', async () => {
        // Exhaust default rate limit (assumes 5 attempts)
        for (let i = 0; i < 5; i++) {
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
        // Wait for default rate limit window to expire (assumes 60 seconds)
        await new Promise((resolve) => setTimeout(resolve, 60_100))

        // Should succeed now
        const response = await request.post('/api/auth/sign-in/email', {
          data: { email: 'user@example.com', password: 'TestPassword123!' },
        })
        expect(response.status()).toBe(200)
      })

      await test.step('Verify: Sign-up rate limiting enforced', async () => {
        // Exhaust default rate limit (assumes 5 attempts)
        for (let i = 0; i < 5; i++) {
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
            email: 'newuser6@example.com',
            password: 'TestPassword123!',
            name: 'User 6',
          },
        })
        expect(blockedResponse.status()).toBe(429)
      })
    }
  )
})
