/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for CORS Configuration - Cross-Origin Resource Sharing
 *
 * Domain: api/security
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests CORS headers that control cross-origin access to API resources:
 * - Access-Control-Allow-Origin: Which origins can access resources
 * - Access-Control-Allow-Methods: Which HTTP methods are allowed
 * - Access-Control-Allow-Headers: Which headers can be sent in requests
 * - Access-Control-Allow-Credentials: Whether cookies/auth can be sent
 * - Access-Control-Max-Age: Preflight cache duration
 * - Preflight (OPTIONS) request handling
 *
 * Hono provides built-in CORS middleware (hono/cors) for comprehensive configuration.
 * Proper CORS configuration is essential for API security while enabling legitimate
 * cross-origin requests from frontend applications.
 */

test.describe('CORS Configuration - Cross-Origin Resource Sharing', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-CORS-001: should include Access-Control-Allow-Origin header for allowed origins',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with CORS enabled and configured allowed origins
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // WHEN: Making a request with Origin header from allowed domain
      const response = await request.get('/api/health', {
        headers: {
          Origin: 'https://app.example.com',
        },
      })

      // THEN: Response includes Access-Control-Allow-Origin header
      const allowOrigin = response.headers()['access-control-allow-origin']
      expect(allowOrigin).toBeDefined()

      // Should either be the specific origin or '*' (for public APIs)
      expect(['https://app.example.com', '*']).toContain(allowOrigin)
    }
  )

  test.fixme(
    'API-SECURITY-CORS-002: should reject requests from disallowed origins',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with CORS configured for specific origins only
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // WHEN: Making a request from a non-allowed origin
      const response = await request.get('/api/health', {
        headers: {
          Origin: 'https://malicious-site.com',
        },
      })

      // THEN: Response should NOT include Access-Control-Allow-Origin
      // for the malicious origin (or should return 403)
      const allowOrigin = response.headers()['access-control-allow-origin']

      // Either no CORS header, or it doesn't match the malicious origin
      if (allowOrigin) {
        expect(allowOrigin).not.toBe('https://malicious-site.com')
      }
    }
  )

  test.fixme(
    'API-SECURITY-CORS-003: should handle preflight OPTIONS requests',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with CORS enabled
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // WHEN: Sending a preflight OPTIONS request
      const response = await request.fetch('/api/health', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://app.example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      })

      // THEN: Response should be 200 or 204 with CORS headers
      expect([200, 204]).toContain(response.status())

      // Should include allowed methods
      const allowMethods = response.headers()['access-control-allow-methods']
      expect(allowMethods).toBeDefined()

      // Should include allowed headers
      const allowHeaders = response.headers()['access-control-allow-headers']
      expect(allowHeaders).toBeDefined()
    }
  )

  test.fixme(
    'API-SECURITY-CORS-004: should include Access-Control-Allow-Methods header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with CORS enabled
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // WHEN: Sending a preflight request
      const response = await request.fetch('/api/health', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://app.example.com',
          'Access-Control-Request-Method': 'POST',
        },
      })

      // THEN: Response includes allowed HTTP methods
      const allowMethods = response.headers()['access-control-allow-methods']
      expect(allowMethods).toBeDefined()

      // Should include common methods
      const methods = allowMethods?.split(',').map((m) => m.trim().toUpperCase()) ?? []
      expect(methods).toContain('GET')
      expect(methods).toContain('POST')
    }
  )

  test.fixme(
    'API-SECURITY-CORS-005: should include Access-Control-Allow-Credentials for authenticated requests',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with CORS and authentication enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [],
      })

      // WHEN: Making a request that requires credentials
      const response = await request.get('/api/auth/get-session', {
        headers: {
          Origin: 'https://app.example.com',
        },
      })

      // THEN: Response should include Access-Control-Allow-Credentials
      const allowCredentials = response.headers()['access-control-allow-credentials']

      // For authenticated endpoints, credentials should be allowed
      expect(allowCredentials).toBe('true')

      // When credentials are allowed, origin cannot be '*'
      const allowOrigin = response.headers()['access-control-allow-origin']
      if (allowCredentials === 'true') {
        expect(allowOrigin).not.toBe('*')
      }
    }
  )

  test.fixme(
    'API-SECURITY-CORS-006: should include Access-Control-Max-Age for preflight caching',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with CORS enabled
      await startServerWithSchema({
        name: 'test-app',
        tables: [],
      })

      // WHEN: Sending a preflight request
      const response = await request.fetch('/api/health', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://app.example.com',
          'Access-Control-Request-Method': 'POST',
        },
      })

      // THEN: Response should include Access-Control-Max-Age
      const maxAge = response.headers()['access-control-max-age']
      expect(maxAge).toBeDefined()

      // Max age should be a positive number (seconds)
      const maxAgeSeconds = parseInt(maxAge!, 10)
      expect(maxAgeSeconds).toBeGreaterThan(0)

      // Reasonable max age (e.g., at least 1 hour, up to 24 hours)
      expect(maxAgeSeconds).toBeGreaterThanOrEqual(3600)
      expect(maxAgeSeconds).toBeLessThanOrEqual(86400)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-CORS-007: CORS configuration protects API while allowing legitimate requests',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      await test.step('Setup: Start server with auth enabled', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
          },
          tables: [
            {
              id: 1,
              name: 'tasks',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
              ],
            },
          ],
        })
      })

      await test.step('Setup: Create authenticated user', async () => {
        await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
        await signIn({ email: 'user@example.com', password: 'TestPassword123!' })
      })

      await test.step('Verify: Preflight request returns proper headers', async () => {
        const response = await request.fetch('/api/tables', {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://app.example.com',
            'Access-Control-Request-Method': 'GET',
          },
        })

        expect([200, 204]).toContain(response.status())
        expect(response.headers()['access-control-allow-origin']).toBeDefined()
        expect(response.headers()['access-control-allow-methods']).toBeDefined()
      })

      await test.step('Verify: Actual request includes CORS headers', async () => {
        const response = await request.get('/api/tables', {
          headers: {
            Origin: 'https://app.example.com',
          },
        })

        expect(response.status()).toBe(200)
        expect(response.headers()['access-control-allow-origin']).toBeDefined()
      })

      await test.step('Verify: Credentials allowed for authenticated endpoints', async () => {
        const response = await request.get('/api/auth/get-session', {
          headers: {
            Origin: 'https://app.example.com',
          },
        })

        // When credentials are allowed, origin must be specific (not *)
        const allowOrigin = response.headers()['access-control-allow-origin']
        const allowCredentials = response.headers()['access-control-allow-credentials']

        if (allowCredentials === 'true') {
          expect(allowOrigin).not.toBe('*')
        }
      })

      await test.step('Verify: Public endpoints work without credentials', async () => {
        const response = await request.get('/api/health', {
          headers: {
            Origin: 'https://app.example.com',
          },
        })

        expect(response.status()).toBe(200)
        expect(response.headers()['access-control-allow-origin']).toBeDefined()
      })
    }
  )
})
