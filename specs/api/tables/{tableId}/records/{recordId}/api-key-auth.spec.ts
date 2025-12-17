/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API Key Authentication - Single Record Operations
 *
 * Domain: api/tables/{tableId}/records/{recordId}
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (8 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests API key authentication for single record GET, PATCH, DELETE operations.
 */

test.describe('API Key Authentication - Single Record Operations', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORD-AUTH-001: should get single record with valid Bearer token',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Table with record and API key
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { apiKeys: true } },
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

      await createAuthenticatedUser({ email: 'user@example.com' })
      await executeQuery(`INSERT INTO tasks (id, title) VALUES (1, 'My Task')`)

      const authHeaders = await createApiKeyAuth()

      // WHEN: Get record with Bearer token
      const response = await request.get('/api/tables/1/records/1', authHeaders)

      // THEN: Returns 200 OK with record
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.id).toBe(1)
      expect(data.title).toBe('My Task')
    }
  )

  test.fixme(
    'API-TABLES-RECORD-AUTH-002: should update record with valid Bearer token',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Table with record
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { apiKeys: true } },
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

      await createAuthenticatedUser({ email: 'user@example.com' })
      await executeQuery(`INSERT INTO tasks (id, title) VALUES (1, 'Original')`)

      const authHeaders = await createApiKeyAuth()

      // WHEN: Update record with Bearer token
      const response = await request.patch('/api/tables/1/records/1', {
        ...authHeaders,
        data: { title: 'Updated' },
      })

      // THEN: Returns 200 OK with updated record
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.title).toBe('Updated')
    }
  )

  test.fixme(
    'API-TABLES-RECORD-AUTH-003: should delete record with valid Bearer token',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Table with record
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { apiKeys: true } },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      await executeQuery(`INSERT INTO tasks (id) VALUES (1)`)

      const authHeaders = await createApiKeyAuth()

      // WHEN: Delete record with Bearer token
      const response = await request.delete('/api/tables/1/records/1', authHeaders)

      // THEN: Returns 204 No Content
      expect(response.status()).toBe(204)

      // Verify deletion
      const getResponse = await request.get('/api/tables/1/records/1', authHeaders)
      expect(getResponse.status()).toBe(404)
    }
  )

  test.fixme(
    'API-TABLES-RECORD-AUTH-004: should return 401 without Authorization header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with record
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { apiKeys: true } },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      await executeQuery(`INSERT INTO tasks (id) VALUES (1)`)

      // WHEN: Request without auth
      const response = await request.get('/api/tables/1/records/1')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-RECORD-AUTH-005: should return 401 with invalid Bearer token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Table with record
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { apiKeys: true } },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      await executeQuery(`INSERT INTO tasks (id) VALUES (1)`)

      // WHEN: Request with invalid token
      const response = await request.get('/api/tables/1/records/1', {
        headers: { Authorization: 'Bearer invalid-token' },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-RECORD-AUTH-006: should return 404 for cross-organization record access',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      signOut,
      executeQuery,
    }) => {
      // GIVEN: Two organizations with separate records
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true, apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      const user1 = await createAuthenticatedUser({
        email: 'user1@example.com',
        createOrganization: true,
      })

      await executeQuery(
        `INSERT INTO tasks (id, organization_id) VALUES (1, '${user1.organizationId}')`
      )

      const user1ApiKey = await createApiKeyAuth()
      await signOut()

      const user2 = await createAuthenticatedUser({
        email: 'user2@example.com',
        createOrganization: true,
      })

      await executeQuery(
        `INSERT INTO tasks (id, organization_id) VALUES (2, '${user2.organizationId}')`
      )

      // WHEN: User1 tries to access org2's record
      const response = await request.get('/api/tables/1/records/2', user1ApiKey)

      // THEN: Returns 404 (not 403) to prevent enumeration
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-TABLES-RECORD-AUTH-007: should respect field-level write permissions on update',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Table with protected field
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
              { id: 3, name: 'salary', type: 'integer' },
            ],
            permissions: {
              fields: [{ field: 'salary', write: { type: 'roles', roles: ['owner', 'admin'] } }],
            },
          },
        ],
      })

      const user = await createAuthenticatedUser({
        email: 'member@example.com',
        createOrganization: true,
      })

      await executeQuery(
        `UPDATE _sovrium_auth_members SET role = 'member' WHERE user_id = '${user.user.id}'`
      )

      await executeQuery(`INSERT INTO employees (id, name, salary) VALUES (1, 'John', 50000)`)

      const memberApiKey = await createApiKeyAuth()

      // WHEN: Member tries to update protected field
      const response = await request.patch('/api/tables/1/records/1', {
        ...memberApiKey,
        data: { salary: 60_000 },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('permission')
    }
  )

  test.fixme(
    'API-TABLES-RECORD-AUTH-008: should respect field-level read permissions on get',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Table with protected field
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
              { id: 3, name: 'salary', type: 'integer' },
            ],
            permissions: {
              fields: [{ field: 'salary', read: { type: 'roles', roles: ['owner', 'admin'] } }],
            },
          },
        ],
      })

      const user = await createAuthenticatedUser({
        email: 'viewer@example.com',
        createOrganization: true,
      })

      await executeQuery(
        `UPDATE _sovrium_auth_members SET role = 'viewer' WHERE user_id = '${user.user.id}'`
      )

      await executeQuery(`INSERT INTO employees (id, name, salary) VALUES (1, 'John', 50000)`)

      const viewerApiKey = await createApiKeyAuth()

      // WHEN: Viewer gets record
      const response = await request.get('/api/tables/1/records/1', viewerApiKey)

      // THEN: Salary field is excluded
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.name).toBe('John')
      expect(data).not.toHaveProperty('salary')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORD-AUTH-009: user can perform single record operations via API key',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
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

      let apiKey: { headers: { Authorization: string } }

      await test.step('Setup: Create user, insert test record, generate API key', async () => {
        await createAuthenticatedUser({
          email: 'api-user@example.com',
          createOrganization: true,
        })
        await executeQuery(
          `INSERT INTO tasks (id, title, completed) VALUES (1, 'Test Task', false)`
        )
        apiKey = await createApiKeyAuth({ name: 'record-ops-key' })
      })

      await test.step('Verify: Get record returns expected data', async () => {
        const getResponse = await request.get('/api/tables/1/records/1', apiKey)
        expect(getResponse.status()).toBe(200)

        const record = await getResponse.json()
        expect(record.title).toBe('Test Task')
      })

      await test.step('Action: Update record with Bearer token', async () => {
        const updateResponse = await request.patch('/api/tables/1/records/1', {
          ...apiKey,
          data: { completed: true },
        })
        expect(updateResponse.status()).toBe(200)

        const updated = await updateResponse.json()
        expect(updated.completed).toBe(true)
      })

      await test.step('Action: Delete record with Bearer token', async () => {
        const deleteResponse = await request.delete('/api/tables/1/records/1', apiKey)
        expect(deleteResponse.status()).toBe(204)
      })

      await test.step('Verify: Deleted record returns 404', async () => {
        const notFoundResponse = await request.get('/api/tables/1/records/1', apiKey)
        expect(notFoundResponse.status()).toBe(404)
      })
    }
  )
})
