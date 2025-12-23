/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for CSRF Protection - Cross-Site Request Forgery Prevention
 *
 * Domain: api/security
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (5 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests CSRF protection mechanisms that prevent malicious cross-site request attacks:
 * - Token-based CSRF protection for session-authenticated requests
 * - Origin/Referer header validation
 * - API key authentication exemption (stateless auth doesn't need CSRF)
 * - SameSite cookie attribute enforcement
 *
 * Hono provides CSRF middleware (@hono/csrf) for comprehensive protection.
 * CSRF protection is critical for session-based authentication to prevent
 * attackers from performing unauthorized actions on behalf of authenticated users.
 *
 * Note: API key authentication is exempt from CSRF checks because:
 * 1. API keys are transmitted via header, not cookies (no ambient authority)
 * 2. API keys are for programmatic access, not browser-based sessions
 */

test.describe('CSRF Protection - Cross-Site Request Forgery Prevention', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-CSRF-001: should reject POST request without CSRF token for session auth',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with session-based authentication and CSRF protection
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

      // Sign in to establish session
      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: Making a state-changing request without CSRF token
      const response = await request.post('/api/tables/1/records', {
        data: { title: 'New Task' },
        headers: {
          // Explicitly no CSRF token header
          'Content-Type': 'application/json',
        },
      })

      // THEN: Request is rejected with 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message?.toLowerCase()).toContain('csrf')
    }
  )

  test.fixme(
    'API-SECURITY-CSRF-002: should accept POST request with valid CSRF token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with session-based authentication
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

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: Getting CSRF token from dedicated endpoint
      const tokenResponse = await request.get('/api/csrf-token')
      expect(tokenResponse.status()).toBe(200)

      const { token: csrfToken } = await tokenResponse.json()
      expect(csrfToken).toBeDefined()

      // THEN: Making request with valid CSRF token succeeds
      const response = await request.post('/api/tables/1/records', {
        data: { title: 'New Task' },
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      })

      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data.title).toBe('New Task')
    }
  )

  test.fixme(
    'API-SECURITY-CSRF-003: should reject request with invalid CSRF token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with session-based authentication
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

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // WHEN: Making request with fabricated/invalid CSRF token
      const response = await request.post('/api/tables/1/records', {
        data: { title: 'New Task' },
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'invalid-fabricated-token-12345',
        },
      })

      // THEN: Request is rejected with 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
    }
  )

  test.fixme(
    'API-SECURITY-CSRF-004: should validate Origin header matches expected domain',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with CSRF protection enabled
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

      await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
      await signIn({ email: 'user@example.com', password: 'TestPassword123!' })

      // Get valid CSRF token
      const tokenResponse = await request.get('/api/csrf-token')
      const { token: csrfToken } = await tokenResponse.json()

      // WHEN: Making request with mismatched Origin header (cross-site attack simulation)
      const response = await request.post('/api/tables/1/records', {
        data: { title: 'New Task' },
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          Origin: 'https://malicious-site.com', // Attacker's site
        },
      })

      // THEN: Request is rejected due to origin mismatch
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-SECURITY-CSRF-005: should exempt API key authentication from CSRF protection',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createApiKey }) => {
      // GIVEN: Application with API key authentication
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
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
          },
        ],
      })

      // Create API key for authentication
      const apiKey = await createApiKey({ name: 'Test API Key' })

      // WHEN: Making request with API key (no CSRF token needed)
      const response = await request.post('/api/tables/1/records', {
        data: { title: 'New Task' },
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          // No X-CSRF-Token header
        },
      })

      // THEN: Request succeeds because API key auth is exempt from CSRF
      // API keys are transmitted via header, not cookies, so no ambient authority exists
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data.title).toBe('New Task')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-CSRF-006: CSRF protection secures session-authenticated requests',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, signUp, signIn, createApiKey }) => {
      await test.step('Setup: Start server with auth and CSRF protection', async () => {
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
                { id: 2, name: 'title', type: 'single-line-text' },
              ],
            },
          ],
        })
      })

      await test.step('Setup: Authenticate with session', async () => {
        await signUp({ email: 'user@example.com', password: 'TestPassword123!', name: 'Test User' })
        await signIn({ email: 'user@example.com', password: 'TestPassword123!' })
      })

      await test.step('Verify: POST without CSRF token is rejected', async () => {
        const response = await request.post('/api/tables/1/records', {
          data: { title: 'Task Without Token' },
          headers: { 'Content-Type': 'application/json' },
        })

        expect(response.status()).toBe(403)
      })

      await test.step('Verify: POST with valid CSRF token succeeds', async () => {
        // Get CSRF token
        const tokenResponse = await request.get('/api/csrf-token')
        const { token: csrfToken } = await tokenResponse.json()

        const response = await request.post('/api/tables/1/records', {
          data: { title: 'Task With Token' },
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
        })

        expect(response.status()).toBe(201)
      })

      await test.step('Verify: Invalid CSRF token is rejected', async () => {
        const response = await request.post('/api/tables/1/records', {
          data: { title: 'Task With Bad Token' },
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'fabricated-invalid-token',
          },
        })

        expect(response.status()).toBe(403)
      })

      await test.step('Verify: API key auth bypasses CSRF (no ambient authority)', async () => {
        const apiKey = await createApiKey({ name: 'Integration Test Key' })

        const response = await request.post('/api/tables/1/records', {
          data: { title: 'Task Via API Key' },
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            // No CSRF token - API keys are exempt
          },
        })

        expect(response.status()).toBe(201)
      })

      await test.step('Verify: GET requests do not require CSRF token', async () => {
        // GET requests are safe methods (read-only) and don't need CSRF
        const response = await request.get('/api/tables')

        expect(response.status()).toBe(200)
      })
    }
  )
})
