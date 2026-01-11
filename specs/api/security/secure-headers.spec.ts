/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Secure Headers - HTTP Security Response Headers
 *
 * Domain: api/security
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests HTTP security headers that protect against common web vulnerabilities:
 * - HSTS: Forces HTTPS connections
 * - CSP: Prevents XSS and data injection attacks
 * - X-Frame-Options: Prevents clickjacking
 * - X-Content-Type-Options: Prevents MIME-sniffing attacks
 * - Referrer-Policy: Controls referrer information leakage
 * - Server header: Prevents server version disclosure
 *
 * Implementation: Requires Hono `secureHeaders()` middleware from `hono/secure-headers`.
 * This middleware must be explicitly configured in the Hono app setup.
 * These tests validate that secure headers are properly configured on all API responses.
 */

test.describe('Secure Headers - HTTP Security Response Headers', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-HEADERS-001: should include Strict-Transport-Security header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with Hono secureHeaders() middleware configured
      await startServerWithSchema({
        name: 'test-app',
      })

      // WHEN: Making any API request
      const response = await request.get('/api/health')

      // THEN: HSTS header is present with secure configuration
      // max-age should be at least 1 year (31536000 seconds)
      const hstsHeader = response.headers()['strict-transport-security']
      expect(hstsHeader).toBeDefined()
      expect(hstsHeader).toContain('max-age=')

      // Extract max-age value and verify it's at least 1 year
      const maxAgeMatch = hstsHeader?.match(/max-age=(\d+)/)
      expect(maxAgeMatch).not.toBeNull()
      expect(maxAgeMatch?.[1]).toBeDefined()
      const maxAge = parseInt(maxAgeMatch![1]!, 10)
      expect(maxAge).toBeGreaterThanOrEqual(31_536_000)

      // Should include subdomains for complete protection
      expect(hstsHeader).toContain('includeSubDomains')
    }
  )

  test.fixme(
    'API-SECURITY-HEADERS-002: should include Content-Security-Policy header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with Hono secureHeaders() middleware configured
      await startServerWithSchema({
        name: 'test-app',
      })

      // WHEN: Making any API request
      const response = await request.get('/api/health')

      // THEN: CSP header is present with restrictive policy
      const cspHeader = response.headers()['content-security-policy']
      expect(cspHeader).toBeDefined()

      // Should have default-src directive
      expect(cspHeader).toContain('default-src')

      // Should restrict object-src to prevent plugin-based attacks
      expect(cspHeader).toContain("object-src 'none'")

      // Should have frame-ancestors to prevent clickjacking (CSP v2)
      expect(cspHeader).toContain('frame-ancestors')
    }
  )

  test.fixme(
    'API-SECURITY-HEADERS-003: should include X-Frame-Options header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with Hono secureHeaders() middleware configured
      await startServerWithSchema({
        name: 'test-app',
      })

      // WHEN: Making any API request
      const response = await request.get('/api/health')

      // THEN: X-Frame-Options header prevents clickjacking
      const xFrameOptions = response.headers()['x-frame-options']
      expect(xFrameOptions).toBeDefined()

      // Should be DENY or SAMEORIGIN (DENY is more secure for APIs)
      expect(['DENY', 'SAMEORIGIN']).toContain(xFrameOptions)
    }
  )

  test.fixme(
    'API-SECURITY-HEADERS-004: should include X-Content-Type-Options header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with Hono secureHeaders() middleware configured
      await startServerWithSchema({
        name: 'test-app',
      })

      // WHEN: Making any API request
      const response = await request.get('/api/health')

      // THEN: X-Content-Type-Options prevents MIME-sniffing
      const contentTypeOptions = response.headers()['x-content-type-options']
      expect(contentTypeOptions).toBeDefined()
      expect(contentTypeOptions).toBe('nosniff')
    }
  )

  test.fixme(
    'API-SECURITY-HEADERS-005: should include Referrer-Policy header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with Hono secureHeaders() middleware configured
      await startServerWithSchema({
        name: 'test-app',
      })

      // WHEN: Making any API request
      const response = await request.get('/api/health')

      // THEN: Referrer-Policy controls information leakage
      const referrerPolicy = response.headers()['referrer-policy']
      expect(referrerPolicy).toBeDefined()

      // Should be a secure policy (not 'unsafe-url')
      const securePolicies = [
        'no-referrer',
        'no-referrer-when-downgrade',
        'same-origin',
        'origin',
        'strict-origin',
        'origin-when-cross-origin',
        'strict-origin-when-cross-origin',
      ]
      expect(securePolicies).toContain(referrerPolicy)
    }
  )

  test(
    'API-SECURITY-HEADERS-006: should not expose server version in headers',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with Hono secureHeaders() middleware configured
      await startServerWithSchema({
        name: 'test-app',
      })

      // WHEN: Making any API request
      const response = await request.get('/api/health')

      // THEN: Server header should not reveal version information
      const serverHeader = response.headers()['server']

      // Server header should either be:
      // 1. Not present at all
      // 2. Generic name without version (e.g., "Hono" but not "Hono/4.x.x")
      if (serverHeader) {
        // Should not contain version numbers (pattern: digits with dots)
        expect(serverHeader).not.toMatch(/\d+\.\d+/)

        // Should not contain specific framework versions
        expect(serverHeader.toLowerCase()).not.toMatch(/hono\/\d/)
        expect(serverHeader.toLowerCase()).not.toMatch(/bun\/\d/)
        expect(serverHeader.toLowerCase()).not.toMatch(/node\/\d/)
      }

      // X-Powered-By should not be present (security best practice)
      const poweredByHeader = response.headers()['x-powered-by']
      expect(poweredByHeader).toBeUndefined()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // Generated from 6 @spec tests - covers all HTTP security headers
  // ============================================================================

  test.fixme(
    'API-SECURITY-HEADERS-REGRESSION: secure headers protect all API endpoints',
    { tag: '@regression' },
    async ({ request, startServerWithSchema }) => {
      await test.step('Setup: starts server with minimal configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
        })
      })

      await test.step('API-SECURITY-HEADERS-001: includes Strict-Transport-Security header', async () => {
        const response = await request.get('/api/health')

        const hstsHeader = response.headers()['strict-transport-security']
        expect(hstsHeader).toBeDefined()
        expect(hstsHeader).toContain('max-age=')

        const maxAgeMatch = hstsHeader?.match(/max-age=(\d+)/)
        expect(maxAgeMatch).not.toBeNull()
        expect(maxAgeMatch?.[1]).toBeDefined()
        const maxAge = parseInt(maxAgeMatch![1]!, 10)
        expect(maxAge).toBeGreaterThanOrEqual(31_536_000)
        expect(hstsHeader).toContain('includeSubDomains')
      })

      await test.step('API-SECURITY-HEADERS-002: includes Content-Security-Policy header', async () => {
        const response = await request.get('/api/health')

        const cspHeader = response.headers()['content-security-policy']
        expect(cspHeader).toBeDefined()
        expect(cspHeader).toContain('default-src')
        expect(cspHeader).toContain("object-src 'none'")
        expect(cspHeader).toContain('frame-ancestors')
      })

      await test.step('API-SECURITY-HEADERS-003: includes X-Frame-Options header', async () => {
        const response = await request.get('/api/health')

        const xFrameOptions = response.headers()['x-frame-options']
        expect(xFrameOptions).toBeDefined()
        expect(['DENY', 'SAMEORIGIN']).toContain(xFrameOptions)
      })

      await test.step('API-SECURITY-HEADERS-004: includes X-Content-Type-Options header', async () => {
        const response = await request.get('/api/health')

        const contentTypeOptions = response.headers()['x-content-type-options']
        expect(contentTypeOptions).toBeDefined()
        expect(contentTypeOptions).toBe('nosniff')
      })

      await test.step('API-SECURITY-HEADERS-005: includes Referrer-Policy header', async () => {
        const response = await request.get('/api/health')

        const referrerPolicy = response.headers()['referrer-policy']
        expect(referrerPolicy).toBeDefined()

        const securePolicies = [
          'no-referrer',
          'no-referrer-when-downgrade',
          'same-origin',
          'origin',
          'strict-origin',
          'origin-when-cross-origin',
          'strict-origin-when-cross-origin',
        ]
        expect(securePolicies).toContain(referrerPolicy)
      })

      await test.step('API-SECURITY-HEADERS-006: does not expose server version in headers', async () => {
        const response = await request.get('/api/health')

        const serverHeader = response.headers()['server']

        if (serverHeader) {
          expect(serverHeader).not.toMatch(/\d+\.\d+/)
          expect(serverHeader.toLowerCase()).not.toMatch(/hono\/\d/)
          expect(serverHeader.toLowerCase()).not.toMatch(/bun\/\d/)
          expect(serverHeader.toLowerCase()).not.toMatch(/node\/\d/)
        }

        expect(response.headers()['x-powered-by']).toBeUndefined()
      })
    }
  )
})
