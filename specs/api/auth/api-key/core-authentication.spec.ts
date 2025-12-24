/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * Core API Key Authentication Tests
 *
 * Domain: api/auth/api-key
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - Core authentication error scenarios (6 tests) - Tested ONCE here
 * 2. @regression test - ONE optimized integration test - Complete auth workflow
 *
 * PURPOSE:
 * This file consolidates common API key authentication error scenarios that apply
 * uniformly across ALL protected endpoints. These tests verify the authentication
 * middleware behavior, not endpoint-specific logic.
 *
 * WHAT'S TESTED HERE (authentication layer):
 * - Missing Authorization header → 401
 * - Invalid Bearer token → 401
 * - Malformed Bearer token → 401
 * - Expired API key → 401
 * - Disabled API key → 401
 * - Non-Bearer authorization scheme → 401
 *
 * WHAT'S TESTED IN ENDPOINT-SPECIFIC FILES:
 * - 200 OK with valid token (tests actual endpoint functionality)
 * - Organization isolation (RLS layer)
 * - Field-level permissions
 * - Role-based access (admin/member/viewer)
 * - Domain-specific validation
 *
 * This consolidation removes ~14-21 redundant tests from 7 endpoint-specific files.
 */

test.describe('Core API Key Authentication', () => {
  // ============================================================================
  // @spec tests - CORE authentication error scenarios (tested once)
  // ============================================================================

  test(
    'API-AUTH-APIKEY-001: should return 401 without Authorization header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with API keys plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'test_table',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      // Test multiple endpoints to verify middleware applies uniformly
      const endpoints = ['/api/tables', '/api/activity']

      for (const endpoint of endpoints) {
        // WHEN: Request without Authorization header
        const response = await request.get(endpoint)

        // THEN: Returns 401 Unauthorized
        expect(response.status()).toBe(401)

        const data = await response.json()
        expect(data).toHaveProperty('error')
      }
    }
  )

  test(
    'API-AUTH-APIKEY-002: should return 401 with invalid Bearer token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with API keys plugin and authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'test_table',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })

      // WHEN: Request with invalid/fake Bearer token
      const response = await request.get('/api/tables', {
        headers: {
          Authorization: 'Bearer invalid-fake-token-12345',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
    }
  )

  test(
    'API-AUTH-APIKEY-003: should return 401 with malformed Bearer token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with API keys plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'test_table',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      // Test various malformed tokens
      const malformedTokens = [
        'Bearer', // Missing token part
        'Bearer ', // Empty token
        'Bearer  ', // Whitespace only
      ]

      for (const token of malformedTokens) {
        // WHEN: Request with malformed Bearer token
        const response = await request.get('/api/tables', {
          headers: { Authorization: token },
        })

        // THEN: Returns 401 Unauthorized
        expect(response.status()).toBe(401)
      }
    }
  )

  test.fixme(
    'API-AUTH-APIKEY-004: should return 401 with expired API key',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createApiKey }) => {
      // GIVEN: Application with expired API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'test_table',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })

      // Create API key with 1 second expiration
      const apiKey = await createApiKey({ name: 'expired-key', expiresIn: 1 })

      // Wait for key to expire
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // WHEN: Request with expired Bearer token
      const response = await request.get('/api/tables', {
        headers: {
          Authorization: `Bearer ${apiKey.key}`,
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
    }
  )

  test.fixme(
    'API-AUTH-APIKEY-005: should return 401 with disabled API key',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKey,
      deleteApiKey,
    }) => {
      // GIVEN: Application with disabled/deleted API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'test_table',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      const apiKey = await createApiKey({ name: 'to-be-deleted' })

      // Delete/disable the API key
      await deleteApiKey(apiKey.id)

      // WHEN: Request with deleted Bearer token
      const response = await request.get('/api/tables', {
        headers: {
          Authorization: `Bearer ${apiKey.key}`,
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
    }
  )

  test(
    'API-AUTH-APIKEY-006: should return 401 with non-Bearer Authorization scheme',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with API keys plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'test_table',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      // Test non-Bearer authorization schemes
      const invalidSchemes = [
        'Basic dXNlcjpwYXNzd29yZA==', // Base64 encoded "user:password"
        'Digest username="user"',
        'NTLM abcdefg',
      ]

      for (const scheme of invalidSchemes) {
        // WHEN: Request with non-Bearer auth scheme
        const response = await request.get('/api/tables', {
          headers: { Authorization: scheme },
        })

        // THEN: Returns 401 Unauthorized
        expect(response.status()).toBe(401)
      }
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test(
    'API-AUTH-APIKEY-007: complete API key authentication workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createApiKeyAuth }) => {
      await test.step('Setup: Start server with API keys enabled', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            plugins: { organization: true, apiKeys: true },
          },
          tables: [
            {
              id: 1,
              name: 'test_table',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
              ],
            },
          ],
        })
      })

      await test.step('Verify: Unauthenticated request fails', async () => {
        const noAuthResponse = await request.get('/api/tables')
        expect(noAuthResponse.status()).toBe(401)
      })

      await test.step('Verify: Invalid token fails', async () => {
        const invalidResponse = await request.get('/api/tables', {
          headers: { Authorization: 'Bearer invalid-token' },
        })
        expect(invalidResponse.status()).toBe(401)
      })

      let apiKeyAuth: { headers: { Authorization: string } }

      await test.step('Setup: Create user and generate valid API key', async () => {
        await createAuthenticatedUser({
          email: 'api-user@example.com',
          createOrganization: true,
        })
        apiKeyAuth = await createApiKeyAuth({ name: 'test-key' })
      })

      await test.step('Verify: Valid API key succeeds', async () => {
        const validResponse = await request.get('/api/tables', apiKeyAuth)
        expect(validResponse.status()).toBe(200)

        const tables = await validResponse.json()
        expect(Array.isArray(tables)).toBe(true)
      })

      await test.step('Verify: Non-Bearer scheme fails', async () => {
        const basicAuthResponse = await request.get('/api/tables', {
          headers: { Authorization: 'Basic dXNlcjpwYXNzd29yZA==' },
        })
        expect(basicAuthResponse.status()).toBe(401)
      })
    }
  )
})
