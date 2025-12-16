/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API Key Authentication - Table Listing
 *
 * Domain: api/tables
 * Spec Count: 9
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (8 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests API key authentication using "Authorization: Bearer <key>" header format
 * following industry standards (Airtable, Notion, GitHub).
 */

test.describe('API Key Authentication - Table Listing', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-TABLES-AUTH-001: should return 200 OK with valid Bearer token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createApiKeyAuth }) => {
      // GIVEN: Application with tables and authenticated user with API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'contacts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      const authHeaders = await createApiKeyAuth({ name: 'test-key' })

      // WHEN: Request with valid Bearer token
      const response = await request.get('/api/tables', authHeaders)

      // THEN: Returns 200 OK with tables data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(1)
      expect(data[0].name).toBe('contacts')
    }
  )

  test.fixme(
    'API-TABLES-AUTH-002: should return 401 with missing Authorization header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with auth enabled
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
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      // WHEN: Request without Authorization header
      const response = await request.get('/api/tables')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('Unauthorized')
    }
  )

  test.fixme(
    'API-TABLES-AUTH-003: should return 401 with invalid Bearer token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with auth enabled
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
      expect(data.message).toContain('Invalid API key')
    }
  )

  test.fixme(
    'API-TABLES-AUTH-004: should return 401 with malformed Bearer token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with auth enabled
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
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      // WHEN: Request with malformed Bearer token (missing key part)
      const response = await request.get('/api/tables', {
        headers: {
          Authorization: 'Bearer',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
    }
  )

  test.fixme(
    'API-TABLES-AUTH-005: should return 401 with expired API key',
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
            name: 'tasks',
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
      expect(data.message).toContain('expired')
    }
  )

  test.fixme(
    'API-TABLES-AUTH-006: should return 401 with disabled API key',
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
            name: 'tasks',
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
      expect(data.message).toContain('Invalid API key')
    }
  )

  test.fixme(
    'API-TABLES-AUTH-007: should enforce organization isolation with API key',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      signOut,
    }) => {
      // GIVEN: Two organizations with separate tables
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true, apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'org1_contacts',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      // Create user1 in org1 - we need the org context but only use the API key
      const _user1 = await createAuthenticatedUser({
        email: 'user1@example.com',
        createOrganization: true,
      })
      const user1ApiKey = await createApiKeyAuth({ name: 'user1-key' })

      await signOut()

      // Create user2 in org2 - sets up isolation context for the test
      const _user2 = await createAuthenticatedUser({
        email: 'user2@example.com',
        createOrganization: true,
      })

      // WHEN: User1 requests tables with their API key
      const response = await request.get('/api/tables', user1ApiKey)

      // THEN: Returns only org1's tables (organization isolation enforced)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)

      // Each user should only see their own organization's tables
      // Not all tables from all organizations
      const tableNames = data.map((t: { name: string }) => t.name)
      expect(tableNames).toContain('org1_contacts')
      expect(tableNames).not.toContain('org2_contacts')
    }
  )

  test.fixme(
    'API-TABLES-AUTH-008: should reject non-Bearer Authorization schemes',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with auth enabled
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
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      // WHEN: Request with non-Bearer auth scheme (e.g., Basic auth)
      const response = await request.get('/api/tables', {
        headers: {
          Authorization: 'Basic dXNlcjpwYXNzd29yZA==',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-TABLES-AUTH-009: user can authenticate and list tables via API key workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createApiKeyAuth }) => {
      await test.step('Setup: Start server with multi-tenant tables', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            plugins: { organization: true, apiKeys: true },
          },
          tables: [
            {
              id: 1,
              name: 'contacts',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'email', type: 'email' },
              ],
            },
            {
              id: 2,
              name: 'tasks',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
                { id: 3, name: 'completed', type: 'checkbox' },
              ],
            },
          ],
        })
      })

      let apiKeyAuth: { headers: { Authorization: string } }

      await test.step('Setup: Create user and generate API key', async () => {
        await createAuthenticatedUser({
          email: 'api-user@example.com',
          createOrganization: true,
        })
        apiKeyAuth = await createApiKeyAuth({ name: 'integration-test-key' })
      })

      await test.step('Verify: Valid Bearer token returns tables', async () => {
        const response = await request.get('/api/tables', apiKeyAuth)
        expect(response.status()).toBe(200)

        const tables = await response.json()
        expect(Array.isArray(tables)).toBe(true)
        expect(tables.length).toBe(2)
      })

      await test.step('Verify: Invalid token returns 401', async () => {
        const invalidResponse = await request.get('/api/tables', {
          headers: { Authorization: 'Bearer invalid-token' },
        })
        expect(invalidResponse.status()).toBe(401)
      })

      await test.step('Verify: Missing token returns 401', async () => {
        const missingResponse = await request.get('/api/tables')
        expect(missingResponse.status()).toBe(401)
      })
    }
  )
})
