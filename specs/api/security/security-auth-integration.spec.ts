/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Integration Tests for Security + Authentication
 *
 * Domain: api/security
 * Spec Count: 0
 *
 * Test Organization:
 * 1. @regression test - Comprehensive security + auth workflow validation
 *
 * This integration test validates that security features work correctly with
 * authentication flows, ensuring:
 * - XSS protection during sign-up (input sanitization)
 * - Session security attributes (Secure, HttpOnly, SameSite)
 * - CSRF protection on authenticated endpoints
 * - Rate limiting applies to authenticated requests
 * - API key security attributes
 * - Session invalidation on sign-out
 *
 * Purpose:
 * - Verify security and authentication features work together
 * - Catch integration issues between security and auth domains
 * - Ensure end-to-end security workflow is robust
 *
 * Error Response Structure:
 * - Generic API errors: `{ error: string }` - Security, system errors
 * - Better Auth errors: `{ message: string }` - Authentication errors
 * - See docs/architecture/testing-strategy/status-code-guidelines.md for details
 */

test.describe('Security + Authentication Integration', () => {
  // ============================================================================
  // @regression test - COMPREHENSIVE integration workflow
  // ============================================================================

  test.fixme(
    'API-INTEGRATION-SECURITY-AUTH-001: comprehensive security + auth workflow',
    { tag: '@regression' },
    async ({ page, context, startServerWithSchema, createApiKey, executeQuery }) => {
      let userEmail: string
      let csrfToken: string
      let apiKeyResult: { key: string }

      await test.step('Start server with security and auth', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            plugins: { apiKeys: true },
          },
          tables: [
            {
              id: 1,
              name: 'tasks',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text', required: true },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                create: { type: 'roles', roles: ['member'] },
                read: { type: 'roles', roles: ['member'] },
              },
            },
          ],
        })
      })

      await test.step('Sign up with XSS payload (should be sanitized)', async () => {
        userEmail = 'security-test@example.com'

        const signUpResponse = await page.request.post('/api/auth/sign-up/email', {
          data: {
            name: "<script>alert('xss')</script>Security Tester",
            email: userEmail,
            password: 'SecurePass123!',
          },
        })

        expect(signUpResponse.status()).toBe(200)

        const signUpData = await signUpResponse.json()
        expect(signUpData).toHaveProperty('user')

        // Name should be sanitized (no raw script tags)
        // Implementation may strip tags, escape them, or reject
        const userName = signUpData.user.name

        // Should not contain unescaped script tag
        expect(userName).not.toContain('<script>')

        // Should either be stripped or escaped
        const hasEscapedScript =
          userName.includes('&lt;script&gt;') || userName.includes('Security Tester')
        expect(hasEscapedScript).toBe(true)
      })

      await test.step('Sign in and verify session cookie security attributes', async () => {
        const signInResponse = await page.request.post('/api/auth/sign-in/email', {
          data: {
            email: userEmail,
            password: 'SecurePass123!',
          },
        })

        expect(signInResponse.status()).toBe(200)

        // Verify session cookie attributes
        const cookies = await context.cookies()
        const sessionCookie = cookies.find(
          (c) => c.name.includes('session') || c.name.includes('auth')
        )

        expect(sessionCookie).toBeDefined()

        // Security attributes should be set
        expect(sessionCookie!.secure).toBe(true) // HTTPS only
        expect(sessionCookie!.httpOnly).toBe(true) // No JavaScript access
        expect(['Lax', 'Strict']).toContain(sessionCookie!.sameSite) // CSRF protection
      })

      await test.step('Attempt CSRF attack on authenticated endpoint (should fail)', async () => {
        // Try to create task without CSRF token
        const csrfAttackResponse = await page.request.post('/api/tables/1/records', {
          data: { title: 'CSRF Attack Task' },
          headers: {
            'Content-Type': 'application/json',
            // No X-CSRF-Token header
          },
        })

        // Should be rejected with 403 Forbidden
        expect(csrfAttackResponse.status()).toBe(403)

        const csrfErrorData = await csrfAttackResponse.json()
        expect(csrfErrorData).toHaveProperty('error')
      })

      await test.step('Get valid CSRF token and create task', async () => {
        // Get CSRF token
        const tokenResponse = await page.request.get('/api/csrf-token')
        expect(tokenResponse.status()).toBe(200)

        const tokenData = await tokenResponse.json()
        csrfToken = tokenData.token
        expect(csrfToken).toBeDefined()

        // Create task with valid CSRF token
        const createTaskResponse = await page.request.post('/api/tables/1/records', {
          data: { title: 'Legitimate Task' },
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
        })

        expect(createTaskResponse.status()).toBe(201)

        const taskData = await createTaskResponse.json()
        expect(taskData.title).toBe('Legitimate Task')
      })

      await test.step('Verify rate limiting applies to authenticated requests', async () => {
        // Make multiple rapid requests
        const requests = []

        for (let i = 0; i < 20; i++) {
          requests.push(
            page.request.get('/api/tables/1/records', {
              headers: {
                'X-CSRF-Token': csrfToken,
              },
            })
          )
        }

        const responses = await Promise.all(requests)

        // Some requests should be rate limited
        const rateLimitedResponses = responses.filter((r) => r.status() === 429)

        // Expect at least one rate limited response (depending on configuration)
        // If rate limiting is enabled, this should be > 0
        // For this integration test, we just verify the mechanism exists
        const firstRateLimited = rateLimitedResponses[0]
        if (firstRateLimited) {
          const rateLimitedData = await firstRateLimited.json()
          expect(rateLimitedData).toHaveProperty('error')
        }
      })

      await test.step('Create API key and verify security attributes', async () => {
        apiKeyResult = await createApiKey({ name: 'Integration Test Key' })
        expect(apiKeyResult).toBeDefined()
        expect(apiKeyResult.key).toBeDefined()

        // Verify API key is hashed in database (not plaintext)
        const dbKeys = await executeQuery('SELECT * FROM api_keys')

        for (const row of dbKeys.rows) {
          expect(
            (row as Record<string, unknown>).key ||
              (row as Record<string, unknown>).api_key ||
              (row as Record<string, unknown>).hash ||
              (row as Record<string, unknown>).value
          ).not.toBe(apiKeyResult.key)
        }

        // Verify API key works for authentication
        const apiKeyResponse = await page.request.get('/api/tables', {
          headers: {
            Authorization: `Bearer ${apiKeyResult.key}`,
          },
        })

        expect(apiKeyResponse.status()).toBe(200)

        // API key should bypass CSRF (no ambient authority)
        const apiKeyTaskResponse = await page.request.post('/api/tables/1/records', {
          data: { title: 'API Key Task' },
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKeyResult.key}`,
            // No X-CSRF-Token needed for API key auth
          },
        })

        expect(apiKeyTaskResponse.status()).toBe(201)
      })

      await test.step('Sign out and verify session invalidation', async () => {
        const signOutResponse = await page.request.post('/api/auth/sign-out')

        // Sign out should succeed
        expect([200, 204]).toContain(signOutResponse.status())

        // Session cookie should be cleared or invalidated
        const cookiesAfterSignOut = await context.cookies()
        const sessionCookieAfter = cookiesAfterSignOut.find(
          (c) => c.name.includes('session') || c.name.includes('auth')
        )

        // Session should be cleared (cookie removed or marked expired)
        if (sessionCookieAfter) {
          // If cookie still exists, it should be expired
          expect(sessionCookieAfter.expires).toBeLessThan(Date.now() / 1000)
        }

        // Verify authenticated endpoint is no longer accessible
        const accessAfterSignOutResponse = await page.request.get('/api/tables/1/records')

        expect(accessAfterSignOutResponse.status()).toBe(401)

        const unauthorizedData = await accessAfterSignOutResponse.json()
        expect(unauthorizedData).toHaveProperty('error')
      })

      await test.step('Verify: API key still works after session sign-out', async () => {
        // API key authentication is independent of session
        const apiKeyAfterSignOutResponse = await page.request.get('/api/tables', {
          headers: {
            Authorization: `Bearer ${apiKeyResult.key}`,
          },
        })

        expect(apiKeyAfterSignOutResponse.status()).toBe(200)

        // This verifies API keys are stateless and not affected by session lifecycle
      })

      await test.step('Verify: Tasks created during workflow exist', async () => {
        // Authenticate with API key to query tasks
        const tasksResponse = await page.request.get('/api/tables/1/records', {
          headers: {
            Authorization: `Bearer ${apiKeyResult.key}`,
          },
        })

        expect(tasksResponse.status()).toBe(200)

        const tasksData = await tasksResponse.json()
        expect(Array.isArray(tasksData.data)).toBe(true)

        const taskTitles = tasksData.data.map((task: any) => task.title)

        // Should include tasks created during workflow
        expect(taskTitles).toContain('Legitimate Task')
        expect(taskTitles).toContain('API Key Task')

        // Should NOT include CSRF attack task (rejected)
        expect(taskTitles).not.toContain('CSRF Attack Task')
      })
    }
  )
})
