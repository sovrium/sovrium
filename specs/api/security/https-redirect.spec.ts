/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for HTTPS Redirect Security
 *
 * Priority: HIGH - Production security requirement
 * Domain: api/security
 * Spec Count: 2
 *
 * Validates that HTTP requests are redirected to HTTPS with proper status codes
 * and security headers (HSTS preload directive).
 *
 * Implementation: Requires Hono middleware configuration. HTTPS redirect is not
 * built-in but follows a standard Hono middleware pattern:
 * - Use `hono/secure-headers` middleware for HSTS headers
 * - Implement custom middleware for HTTP→HTTPS redirect in production
 * - These tests validate the middleware is correctly configured
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (2 tests)
 * 2. @regression test - ONE optimized integration test
 */

test.describe('HTTPS Redirect Security', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-REDIRECT-001: should redirect HTTP to HTTPS with 301 status',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with Hono secure-headers middleware configured
      await startServerWithSchema({
        name: 'test-app',
      })

      // WHEN: User makes HTTP request to the application
      const response = await request.get('http://localhost:3000/', {
        maxRedirects: 0, // Don't follow redirects
      })

      // THEN: Server responds with 301 Moved Permanently
      expect(response.status()).toBe(301)

      // THEN: Location header points to HTTPS URL
      const locationHeader = response.headers()['location']
      expect(locationHeader).toBeDefined()
      expect(locationHeader).toMatch(/^https:\/\//)
      expect(locationHeader).toBe('https://localhost:3000/')

      // WHEN: User makes HTTP request to specific path
      const pathResponse = await request.get('http://localhost:3000/api/users', {
        maxRedirects: 0,
      })

      // THEN: Path is preserved in redirect
      expect(pathResponse.status()).toBe(301)
      expect(pathResponse.headers()['location']).toBe('https://localhost:3000/api/users')

      // WHEN: User makes HTTP request with query parameters
      const queryResponse = await request.get('http://localhost:3000/search?q=test&page=2', {
        maxRedirects: 0,
      })

      // THEN: Query parameters are preserved in redirect
      expect(queryResponse.status()).toBe(301)
      expect(queryResponse.headers()['location']).toBe(
        'https://localhost:3000/search?q=test&page=2'
      )
    }
  )

  test.fixme(
    'API-SECURITY-REDIRECT-002: should include HSTS preload directive in response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with Hono secure-headers middleware configured
      await startServerWithSchema({
        name: 'test-app',
      })

      // WHEN: User makes HTTPS request to the application
      const response = await request.get('https://localhost:3000/')

      // THEN: Response includes Strict-Transport-Security header
      const hstsHeader = response.headers()['strict-transport-security']
      expect(hstsHeader).toBeDefined()

      // THEN: HSTS header includes max-age directive
      expect(hstsHeader).toMatch(/max-age=31536000/)

      // THEN: HSTS header includes includeSubDomains directive
      expect(hstsHeader).toMatch(/includeSubDomains/)

      // THEN: HSTS header includes preload directive
      expect(hstsHeader).toMatch(/preload/)

      // THEN: Complete HSTS header format is correct
      expect(hstsHeader).toBe('max-age=31536000; includeSubDomains; preload')

      // WHEN: User makes request to API endpoint
      const apiResponse = await request.get('https://localhost:3000/api/status')

      // THEN: HSTS header is present on all HTTPS responses
      expect(apiResponse.headers()['strict-transport-security']).toBe(
        'max-age=31536000; includeSubDomains; preload'
      )
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-REDIRECT-003: user can complete full HTTPS redirect workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with Hono secure-headers middleware configured
      await startServerWithSchema({
        name: 'test-app',
      })

      // WHEN: User makes HTTP request
      const httpResponse = await request.get('http://localhost:3000/api/users?page=1', {
        maxRedirects: 0,
      })

      // THEN: HTTP is redirected to HTTPS with 301
      expect(httpResponse.status()).toBe(301)
      expect(httpResponse.headers()['location']).toBe('https://localhost:3000/api/users?page=1')

      // WHEN: User follows redirect to HTTPS (browser auto-follows)
      const httpsResponse = await request.get('https://localhost:3000/api/users?page=1')

      // THEN: HTTPS request succeeds
      expect(httpsResponse.ok()).toBe(true)

      // Note: HSTS header validation is tested comprehensively in secure-headers.spec.ts
      // This test focuses on HTTP→HTTPS redirect workflow
    }
  )
})
