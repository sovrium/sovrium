/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Error Disclosure - Secure Error Responses
 *
 * Domain: api/security
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests that error responses don't leak sensitive information:
 * - No stack traces in production
 * - No internal file paths
 * - No database query details
 * - No internal IP addresses
 * - No framework version information
 * - Generic error messages for security-sensitive operations
 *
 * Proper error handling prevents information disclosure that attackers
 * could use to understand system architecture and find vulnerabilities.
 * Hono's error handling middleware can be configured for secure responses.
 */

test.describe('Error Disclosure - Secure Error Responses', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-ERROR-001: should not expose stack traces in error responses',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application running in production mode
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // WHEN: Triggering an internal server error
      // (e.g., accessing an endpoint that would cause an error)
      const response = await request.post('/api/tables/nonexistent/records', {
        data: { trigger: 'error' },
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // THEN: Response should not contain stack trace
      const body = await response.text()

      // Should not contain stack trace indicators
      expect(body).not.toContain('at ')
      expect(body).not.toContain('.ts:')
      expect(body).not.toContain('.js:')
      expect(body).not.toContain('Error:')
      expect(body).not.toMatch(/at \w+\s+\(/) // Function call pattern in stack trace
    }
  )

  test.fixme(
    'API-SECURITY-ERROR-002: should not expose internal file paths',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application running
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // WHEN: Triggering an error that might expose file paths
      const response = await request.get('/api/invalid-endpoint-xyz')

      // THEN: Response should not contain file system paths
      const body = await response.text()

      // Should not contain common path patterns
      expect(body).not.toMatch(/\/Users\//)
      expect(body).not.toMatch(/\/home\//)
      expect(body).not.toMatch(/C:\\/)
      expect(body).not.toMatch(/\/var\//)
      expect(body).not.toMatch(/\/app\//)
      expect(body).not.toMatch(/node_modules/)
      expect(body).not.toContain('src/')
    }
  )

  test.fixme(
    'API-SECURITY-ERROR-003: should not expose database query details',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with database tables
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'users_data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'data', type: 'single-line-text' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: Sending a malformed request that might trigger DB error
      const response = await request.get('/api/tables/1/records?filter=invalid')

      // THEN: Response should not contain SQL or database details
      const body = await response.text()

      // Should not contain SQL keywords in error context
      expect(body.toLowerCase()).not.toContain('select ')
      expect(body.toLowerCase()).not.toContain('insert ')
      expect(body.toLowerCase()).not.toContain('update ')
      expect(body.toLowerCase()).not.toContain('delete ')
      expect(body.toLowerCase()).not.toContain('postgresql')
      expect(body.toLowerCase()).not.toContain('postgres')
      expect(body.toLowerCase()).not.toContain('sqlite')
      expect(body.toLowerCase()).not.toContain('column ')
      expect(body.toLowerCase()).not.toContain('table ')
    }
  )

  test.fixme(
    'API-SECURITY-ERROR-004: should return generic error for authentication failures',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with authentication enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [],
      })

      // WHEN: Attempting to sign in with wrong credentials
      const response = await request.post('/api/auth/sign-in/email', {
        data: {
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        },
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // THEN: Error should be generic (not revealing whether user exists)
      expect([400, 401]).toContain(response.status())

      const data = await response.json()

      // Should NOT say "user not found" (reveals user existence)
      const errorMessage = JSON.stringify(data).toLowerCase()
      expect(errorMessage).not.toContain('user not found')
      expect(errorMessage).not.toContain('no user')
      expect(errorMessage).not.toContain('user does not exist')

      // Should use generic message
      expect(
        errorMessage.includes('invalid') ||
          errorMessage.includes('incorrect') ||
          errorMessage.includes('failed') ||
          errorMessage.includes('unauthorized')
      ).toBe(true)
    }
  )

  test.fixme(
    'API-SECURITY-ERROR-005: should not expose internal IP addresses or hostnames',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application running
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // WHEN: Making various requests that might expose internal info
      const endpoints = ['/api/health', '/api/nonexistent', '/api/tables/999999/records']

      for (const endpoint of endpoints) {
        const response = await request.get(endpoint)
        const body = await response.text()

        // THEN: Response should not contain internal IPs or hostnames
        // Private IP ranges
        expect(body).not.toMatch(/\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)
        expect(body).not.toMatch(/\b172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/)
        expect(body).not.toMatch(/\b192\.168\.\d{1,3}\.\d{1,3}\b/)

        // Localhost variations
        expect(body).not.toContain('127.0.0.1')
        expect(body).not.toContain('0.0.0.0')

        // Common internal hostnames (unless intentionally exposed)
        expect(body.toLowerCase()).not.toContain('localhost:')
        expect(body.toLowerCase()).not.toContain('internal.')
      }
    }
  )

  test.fixme(
    'API-SECURITY-ERROR-006: should return consistent error format for all endpoints',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application running
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'items',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      // WHEN: Triggering errors on different endpoints
      const errorResponses = await Promise.all([
        request.get('/api/nonexistent'),
        request.get('/api/tables/999'),
        request.post('/api/auth/sign-in/email', {
          data: { email: 'bad@example.com', password: 'wrong' },
        }),
      ])

      // THEN: All error responses should follow consistent format
      for (const response of errorResponses) {
        if (response.status() >= 400) {
          const data = await response.json()

          // Should have 'error' field
          expect(data).toHaveProperty('error')

          // Error should be a string (not an object with internal details)
          expect(typeof data.error).toBe('string')

          // Should not have debug/internal fields
          expect(data).not.toHaveProperty('stack')
          expect(data).not.toHaveProperty('trace')
          expect(data).not.toHaveProperty('debug')
          expect(data).not.toHaveProperty('internal')
        }
      }
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    "API-SECURITY-ERROR-007: error responses are secure and don't leak information",
    { tag: '@regression' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      await test.step('Setup: Start server with auth and tables', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
          },
          tables: [
            {
              id: 1,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'value', type: 'single-line-text' },
              ],
            },
          ],
        })
      })

      await test.step('Setup: Create authenticated user', async () => {
        await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
        await signIn({ email: 'user@example.com', password: 'TestPassword123!' })
      })

      await test.step('Verify: 404 errors are generic', async () => {
        const response = await request.get('/api/tables/999/records')
        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data).toHaveProperty('error')

        // Should not reveal internal structure
        const errorText = JSON.stringify(data)
        expect(errorText).not.toContain('src/')
        expect(errorText).not.toContain('.ts')
      })

      await test.step("Verify: Auth errors don't reveal user existence", async () => {
        const response = await request.post('/api/auth/sign-in/email', {
          data: {
            email: 'doesnotexist@example.com',
            password: 'anypassword',
          },
        })

        expect([400, 401]).toContain(response.status())

        const data = await response.json()
        const errorText = JSON.stringify(data).toLowerCase()

        // Should not reveal if user exists
        expect(errorText).not.toContain('user not found')
        expect(errorText).not.toContain('no such user')
      })

      await test.step('Verify: Validation errors are helpful but safe', async () => {
        const response = await request.post('/api/tables/1/records', {
          data: { value: 12_345 }, // Wrong type
        })

        // Should return validation error without internal details
        if (response.status() === 400) {
          const data = await response.json()
          expect(data).toHaveProperty('error')

          const errorText = JSON.stringify(data)
          expect(errorText).not.toContain('at ')
          expect(errorText).not.toContain('.ts:')
        }
      })

      await test.step('Verify: Error responses are JSON', async () => {
        const response = await request.get('/api/nonexistent-endpoint-xyz')

        expect(response.status()).toBe(404)

        // Should be valid JSON
        const data = await response.json()
        expect(typeof data).toBe('object')
        expect(data).toHaveProperty('error')
      })

      await test.step('Verify: No stack traces in any error', async () => {
        const endpoints = ['/api/nonexistent', '/api/tables/999', '/api/auth/invalid-endpoint']

        for (const endpoint of endpoints) {
          const response = await request.get(endpoint)
          const body = await response.text()

          // No stack trace patterns
          expect(body).not.toMatch(/at \w+\s+\(/)
          expect(body).not.toContain('.ts:')
          expect(body).not.toContain('node_modules')
        }
      })
    }
  )
})
