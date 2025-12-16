/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API Key Authentication - Single Table
 *
 * Domain: api/tables/{tableId}
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests API key authentication for single table operations.
 */

test.describe('API Key Authentication - Single Table', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-TABLES-GET-AUTH-001: should return 200 OK with valid Bearer token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createApiKeyAuth }) => {
      // GIVEN: Application with table and API key
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
              { id: 3, name: 'email', type: 'email' },
            ],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      const authHeaders = await createApiKeyAuth({ name: 'test-key' })

      // WHEN: Request table with valid Bearer token
      const response = await request.get('/api/tables/1', authHeaders)

      // THEN: Returns 200 OK with table configuration
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.id).toBe(1)
      expect(data.name).toBe('contacts')
      expect(Array.isArray(data.fields)).toBe(true)
      expect(data.fields.length).toBe(3)
    }
  )

  test.fixme(
    'API-TABLES-GET-AUTH-002: should return 401 with missing Authorization header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with table
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
      const response = await request.get('/api/tables/1')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('Unauthorized')
    }
  )

  test.fixme(
    'API-TABLES-GET-AUTH-003: should return 401 with invalid Bearer token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with table
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

      // WHEN: Request with invalid Bearer token
      const response = await request.get('/api/tables/1', {
        headers: {
          Authorization: 'Bearer invalid-token-xyz',
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
    'API-TABLES-GET-AUTH-004: should return 404 for non-existent table with valid API key',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createApiKeyAuth }) => {
      // GIVEN: Application with API key but no table with ID 9999
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
      const authHeaders = await createApiKeyAuth()

      // WHEN: Request non-existent table
      const response = await request.get('/api/tables/9999', authHeaders)

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('not found')
    }
  )

  test.fixme(
    'API-TABLES-GET-AUTH-005: should return 404 for cross-organization table access',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      signOut,
      executeQuery,
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
          {
            id: 2,
            name: 'org2_contacts',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      // Create user1 in org1
      await createAuthenticatedUser({
        email: 'user1@example.com',
        createOrganization: true,
      })

      // Assign table 1 to org1
      await executeQuery(`UPDATE tables SET organization_id = (
        SELECT id FROM _sovrium_auth_organizations WHERE name = 'Test User 1''s Organization'
      ) WHERE id = 1`)

      const user1ApiKey = await createApiKeyAuth({ name: 'user1-key' })
      await signOut()

      // Create user2 in org2
      await createAuthenticatedUser({
        email: 'user2@example.com',
        createOrganization: true,
      })

      // Assign table 2 to org2
      await executeQuery(`UPDATE tables SET organization_id = (
        SELECT id FROM _sovrium_auth_organizations WHERE name = 'Test User 2''s Organization'
      ) WHERE id = 2`)

      // WHEN: User1 tries to access org2's table
      const response = await request.get('/api/tables/2', user1ApiKey)

      // THEN: Returns 404 (not 403) to prevent enumeration
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('error')
    }
  )

  test.fixme(
    'API-TABLES-GET-AUTH-006: should respect field-level permissions with API key',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Table with field-level permissions for viewer role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true, apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              {
                id: 3,
                name: 'salary',
                type: 'number',
                permissions: {
                  read: ['owner', 'admin'],
                  write: ['owner', 'admin'],
                },
              },
            ],
          },
        ],
      })

      // Create viewer user with API key
      const user = await createAuthenticatedUser({
        email: 'viewer@example.com',
        createOrganization: true,
      })

      // Set user role to viewer
      await executeQuery(
        `UPDATE _sovrium_auth_members SET role = 'viewer' WHERE user_id = '${user.user.id}'`
      )

      const viewerApiKey = await createApiKeyAuth({ name: 'viewer-key' })

      // WHEN: Viewer requests table via API key
      const response = await request.get('/api/tables/1', viewerApiKey)

      // THEN: Returns table but excludes protected fields
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.fields.length).toBe(2) // Only id and name, salary excluded

      const fieldNames = data.fields.map((f: { name: string }) => f.name)
      expect(fieldNames).toContain('id')
      expect(fieldNames).toContain('name')
      expect(fieldNames).not.toContain('salary')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-TABLES-GET-AUTH-007: user can access table metadata via API key workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createApiKeyAuth }) => {
      await test.step('Setup: Start server with table configuration', async () => {
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
                { id: 2, name: 'email', type: 'email', unique: true },
                { id: 3, name: 'name', type: 'single-line-text', required: true },
                { id: 4, name: 'phone', type: 'phone' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
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
        apiKeyAuth = await createApiKeyAuth({ name: 'metadata-test-key' })
      })

      await test.step('Verify: Valid Bearer token returns table metadata', async () => {
        const response = await request.get('/api/tables/1', apiKeyAuth)
        expect(response.status()).toBe(200)

        const table = await response.json()
        expect(table.name).toBe('contacts')
        expect(table.fields.length).toBe(4)
      })

      await test.step('Verify: Invalid token returns 401', async () => {
        const invalidResponse = await request.get('/api/tables/1', {
          headers: { Authorization: 'Bearer invalid-token' },
        })
        expect(invalidResponse.status()).toBe(401)
      })

      await test.step('Verify: Non-existent table returns 404', async () => {
        const notFoundResponse = await request.get('/api/tables/9999', apiKeyAuth)
        expect(notFoundResponse.status()).toBe(404)
      })
    }
  )
})
