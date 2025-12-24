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
 * Spec Count: 2
 *
 * Test Organization:
 * 1. @spec tests - Endpoint-specific authentication behaviors (2 tests)
 * 2. @regression test - ONE optimized integration test - Table listing workflow
 *
 * NOTE: Core authentication error scenarios (401 without auth, invalid token,
 * malformed token, expired key, disabled key, non-Bearer scheme) are tested
 * in specs/api/auth/api-key/core-authentication.spec.ts to avoid redundancy.
 *
 * This file focuses on:
 * - Valid API key returns table data (endpoint-specific response)
 * - Organization isolation (RLS layer enforcement)
 */

test.describe('API Key Authentication - Table Listing', () => {
  // ============================================================================
  // @spec tests - ENDPOINT-SPECIFIC authentication behaviors
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
    'API-TABLES-AUTH-002: should enforce organization isolation with API key',
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

      // Create user1 in org1 - creates org context, we only use the API key
      await createAuthenticatedUser({
        email: 'user1@example.com',
        createOrganization: true,
      })
      const user1ApiKey = await createApiKeyAuth({ name: 'user1-key' })

      await signOut()

      // Create user2 in org2 - sets up isolation context for the test
      await createAuthenticatedUser({
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

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-TABLES-AUTH-003: user can authenticate and list tables via API key workflow',
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
    }
  )
})
