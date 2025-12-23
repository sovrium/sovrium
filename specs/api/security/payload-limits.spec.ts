/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Payload Limits - Request Body Size Protection
 *
 * Domain: api/security
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests request body size limits that protect against denial of service attacks:
 * - Maximum JSON body size
 * - Maximum form data size
 * - Maximum file upload size (if applicable)
 * - Proper 413 Payload Too Large response
 * - Content-Length header validation
 * - Chunked transfer encoding limits
 *
 * Hono provides body size limits via middleware. These limits prevent:
 * - Memory exhaustion attacks (large JSON bodies)
 * - Disk exhaustion attacks (large file uploads)
 * - Slow loris / slowpost DoS attacks
 */

test.describe('Payload Limits - Request Body Size Protection', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-PAYLOAD-001: should reject JSON body exceeding maximum size limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with body size limits configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: Sending a request with body exceeding the limit (e.g., > 1MB)
      const largeContent = 'x'.repeat(2 * 1024 * 1024) // 2MB of data

      const response = await request.post('/api/tables/1/records', {
        data: { content: largeContent },
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // THEN: Returns 413 Payload Too Large
      expect(response.status()).toBe(413)

      const data = await response.json()
      expect(data).toHaveProperty('error')
    }
  )

  test.fixme(
    'API-SECURITY-PAYLOAD-002: should accept JSON body within size limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with body size limits configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: Sending a request with body within the limit (e.g., 10KB)
      const normalContent = 'This is a normal sized note content.'

      const response = await request.post('/api/tables/1/records', {
        data: { content: normalContent },
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // THEN: Request succeeds
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty('content', normalContent)
    }
  )

  test.fixme(
    'API-SECURITY-PAYLOAD-003: should validate Content-Length header against actual body',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with body size limits configured
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // WHEN: Sending a request with mismatched Content-Length header
      // (claiming large body but sending small, or vice versa)
      const response = await request.post('/api/health', {
        data: { test: 'small body' },
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '999999999', // False claim of huge body
        },
      })

      // THEN: Server should either:
      // 1. Reject immediately (400 Bad Request)
      // 2. Wait for body and timeout
      // 3. Process actual body and ignore false header
      // The key is that the false Content-Length doesn't cause issues
      expect([200, 400, 411, 413]).toContain(response.status())
    }
  )

  test.fixme(
    'API-SECURITY-PAYLOAD-004: should handle requests without Content-Length header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with body size limits configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: Sending a chunked transfer request (no Content-Length)
      // Note: This simulates streaming/chunked requests
      const response = await request.post('/api/tables/1/records', {
        data: { content: 'Chunked body content' },
        headers: {
          'Content-Type': 'application/json',
          'Transfer-Encoding': 'chunked',
        },
      })

      // THEN: Request should be processed normally or rejected cleanly
      // (depends on server configuration for chunked encoding)
      expect([200, 201, 400, 411]).toContain(response.status())
    }
  )

  test.fixme(
    'API-SECURITY-PAYLOAD-005: should enforce per-endpoint payload limits',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with different limits for different endpoints
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [],
      })

      // WHEN: Sending moderately large body to auth endpoint
      // Auth endpoints typically have smaller limits than data endpoints
      const largeAuthBody = {
        email: 'user@example.com',
        password: 'password123',
        name: 'x'.repeat(100 * 1024), // 100KB name field
      }

      const response = await request.post('/api/auth/sign-up/email', {
        data: largeAuthBody,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // THEN: Auth endpoints should have stricter limits
      // A 100KB name field should be rejected
      expect([400, 413]).toContain(response.status())
    }
  )

  test.fixme(
    'API-SECURITY-PAYLOAD-006: should include helpful error message for oversized payloads',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with body size limits configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
            ],
          },
        ],
      })

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: Sending an oversized request
      const largeContent = 'x'.repeat(2 * 1024 * 1024) // 2MB

      const response = await request.post('/api/tables/1/records', {
        data: { content: largeContent },
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // THEN: Error message should be helpful but not reveal internal limits
      expect(response.status()).toBe(413)

      const data = await response.json()
      expect(data).toHaveProperty('error')

      // Error message should indicate the issue without revealing exact limits
      const errorMessage = data.message?.toLowerCase() ?? data.error?.toLowerCase() ?? ''
      expect(
        errorMessage.includes('too large') ||
          errorMessage.includes('payload') ||
          errorMessage.includes('size') ||
          errorMessage.includes('limit')
      ).toBe(true)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-PAYLOAD-007: payload limits protect API from oversized requests',
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
              name: 'documents',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
                { id: 3, name: 'content', type: 'long-text' },
              ],
            },
          ],
        })
      })

      await test.step('Setup: Create authenticated user', async () => {
        await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
        await signIn({ email: 'user@example.com', password: 'TestPassword123!' })
      })

      await test.step('Verify: Normal-sized request succeeds', async () => {
        const response = await request.post('/api/tables/1/records', {
          data: {
            title: 'My Document',
            content: 'This is a normal sized document content.',
          },
          headers: {
            'Content-Type': 'application/json',
          },
        })

        expect(response.status()).toBe(201)
      })

      await test.step('Verify: Large request is rejected with 413', async () => {
        const largeContent = 'x'.repeat(2 * 1024 * 1024) // 2MB

        const response = await request.post('/api/tables/1/records', {
          data: {
            title: 'Large Document',
            content: largeContent,
          },
          headers: {
            'Content-Type': 'application/json',
          },
        })

        expect(response.status()).toBe(413)
      })

      await test.step('Verify: Health endpoint unaffected by large body attempts', async () => {
        // Health endpoint should not accept POST with large body
        const response = await request.get('/api/health')
        expect(response.status()).toBe(200)
      })

      await test.step('Verify: Error response is JSON formatted', async () => {
        const largeContent = 'x'.repeat(2 * 1024 * 1024)

        const response = await request.post('/api/tables/1/records', {
          data: { content: largeContent },
          headers: {
            'Content-Type': 'application/json',
          },
        })

        expect(response.status()).toBe(413)

        // Response should be valid JSON
        const data = await response.json()
        expect(data).toHaveProperty('error')
      })
    }
  )
})
