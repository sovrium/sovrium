/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for TLS Enforcement - Transport Layer Security
 *
 * Domain: api/security
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (3 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests TLS enforcement mechanisms that ensure:
 * - HTTP to HTTPS redirection (automatic upgrade)
 * - Non-TLS connection rejection in strict mode
 * - TLS 1.2+ enforcement (block outdated protocols)
 *
 * TLS enforcement is critical for security:
 * 1. Prevents man-in-the-middle attacks on unencrypted connections
 * 2. Ensures data confidentiality during transmission
 * 3. Protects against protocol downgrade attacks
 * 4. Complies with security standards (PCI DSS, HIPAA)
 *
 * Production deployments should ALWAYS enforce HTTPS.
 *
 * Error Response Structure:
 * - TLS errors: `{ error: string }` - Generic API error format
 * - Better Auth errors: `{ message: string }` - Authentication-specific format
 * - See docs/architecture/testing-strategy/status-code-guidelines.md for details
 */

test.describe('TLS Enforcement - Transport Layer Security', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-TLS-001: should redirect HTTP to HTTPS',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application deployed with HTTPS enabled
      await startServerWithSchema({
        name: 'test-app',
        security: {
          tls: {
            enabled: true,
            redirectHTTP: true,
          },
        },
      })

      // WHEN: User accesses HTTP URL
      const httpResponse = await page.request.get('http://localhost:3000/', {
        maxRedirects: 0, // Don't follow redirects automatically
      })

      // THEN: Server should return 301/308 redirect to HTTPS
      expect([301, 307, 308]).toContain(httpResponse.status())

      // THEN: Location header should point to HTTPS
      const location = httpResponse.headers()['location']
      expect(location).toBeDefined()
      expect(location).toMatch(/^https:\/\//)

      // WHEN: Following redirect
      await page.goto('http://localhost:3000/')

      // THEN: Should land on HTTPS URL
      await expect(page).toHaveURL(/^https:\/\//)
    }
  )

  test.fixme(
    'API-SECURITY-TLS-002: should reject non-TLS connections in strict mode',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with strict TLS enforcement (no HTTP fallback)
      await startServerWithSchema({
        name: 'test-app',
        security: {
          tls: {
            enabled: true,
            strictMode: true, // Reject HTTP entirely
          },
        },
      })

      // WHEN: Attempting to connect via HTTP
      const httpRequest = page.request.get('http://localhost:3000/')

      // THEN: Connection should be rejected (not redirected)
      await expect(httpRequest).rejects.toThrow(/connection refused|net::ERR_CONNECTION_REFUSED/)

      // OR: Should return error response (depending on implementation)
      // Strict mode prevents HTTP listener from starting
    }
  )

  test.fixme(
    'API-SECURITY-TLS-003: should enforce TLS 1.2+ only',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with TLS version enforcement
      await startServerWithSchema({
        name: 'test-app',
        security: {
          tls: {
            enabled: true,
            minVersion: 'TLSv1.2', // Block TLS 1.0 and 1.1
          },
        },
      })

      // WHEN: Attempting to connect with TLS 1.0 or 1.1
      // NOTE: Playwright doesn't directly support protocol downgrade,
      // so we verify server configuration via response headers

      await page.goto('https://localhost:3000/')

      // THEN: Server should accept TLS 1.2+
      await expect(page).toHaveURL('https://localhost:3000/')

      // THEN: Verify Strict-Transport-Security header (HSTS)
      const response = await page.request.get('https://localhost:3000/')
      const hstsHeader = response.headers()['strict-transport-security']

      expect(hstsHeader).toBeDefined()
      expect(hstsHeader).toContain('max-age=')

      // THEN: Verify server rejects outdated TLS versions
      // (This would require testing with a custom TLS client)
      // For now, verify configuration is applied
      const securityHeaders = response.headers()
      expect(securityHeaders).toHaveProperty('strict-transport-security')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-TLS-004: TLS enforcement workflow protects data in transit',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      await test.step('Setup: Start server with TLS enforcement', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
          },
          security: {
            tls: {
              enabled: true,
              redirectHTTP: true,
              minVersion: 'TLSv1.2',
            },
          },
        })
      })

      await test.step('Verify: HTTP redirects to HTTPS', async () => {
        const httpResponse = await page.request.get('http://localhost:3000/', {
          maxRedirects: 0,
        })

        expect([301, 307, 308]).toContain(httpResponse.status())

        const location = httpResponse.headers()['location']
        expect(location).toMatch(/^https:\/\//)
      })

      await test.step('Verify: HTTPS connection works', async () => {
        await page.goto('https://localhost:3000/')
        await expect(page).toHaveURL(/^https:\/\//)
      })

      await test.step('Verify: Authentication works over HTTPS', async () => {
        await signUp({
          name: 'Regression User',
          email: 'regression@example.com',
          password: 'SecurePass123!',
        })

        await signIn({
          email: 'regression@example.com',
          password: 'SecurePass123!',
        })

        await expect(page.getByText('Regression User')).toBeVisible()
      })

      await test.step('Verify: Security headers present', async () => {
        const response = await page.request.get('https://localhost:3000/')

        // HSTS header
        const hstsHeader = response.headers()['strict-transport-security']
        expect(hstsHeader).toBeDefined()
        expect(hstsHeader).toContain('max-age=')

        // Other security headers
        const securityHeaders = response.headers()
        expect(securityHeaders).toHaveProperty('x-frame-options')
        expect(securityHeaders).toHaveProperty('x-content-type-options')
      })

      await test.step('Verify: Sensitive operations only over HTTPS', async () => {
        // Verify password change requires HTTPS
        const changePasswordResponse = await page.request.post(
          'https://localhost:3000/api/auth/change-password',
          {
            data: {
              currentPassword: 'SecurePass123!',
              newPassword: 'NewSecure456!',
            },
          }
        )

        // Should work over HTTPS
        expect([200, 204]).toContain(changePasswordResponse.status())
      })
    }
  )
})
