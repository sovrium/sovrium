/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API Key Authentication - Batch Operations
 *
 * Domain: api/tables/{tableId}/records/batch
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests API key authentication for batch record operations (create, update, delete, restore).
 */

test.describe('API Key Authentication - Batch Operations', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-BATCH-AUTH-001: should batch create records with valid Bearer token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createApiKeyAuth }) => {
      // GIVEN: Table and API key
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
      const authHeaders = await createApiKeyAuth()

      // WHEN: Batch create records with Bearer token
      const response = await request.post('/api/tables/1/records/batch', {
        ...authHeaders,
        data: {
          records: [{ title: 'Task 1' }, { title: 'Task 2' }, { title: 'Task 3' }],
        },
      })

      // THEN: Returns 201 Created with all records
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(3)
      expect(data[0].title).toBe('Task 1')
    }
  )

  test.fixme(
    'API-TABLES-BATCH-AUTH-002: should batch update records with valid Bearer token',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Table with records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, plugins: { apiKeys: true } },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'completed', type: 'checkbox' },
            ],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      await executeQuery(
        `INSERT INTO tasks (id, completed) VALUES (1, false), (2, false), (3, false)`
      )

      const authHeaders = await createApiKeyAuth()

      // WHEN: Batch update records
      const response = await request.patch('/api/tables/1/records/batch', {
        ...authHeaders,
        data: {
          updates: [
            { id: 1, data: { completed: true } },
            { id: 2, data: { completed: true } },
          ],
        },
      })

      // THEN: Returns 200 OK with updated records
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.length).toBe(2)
      expect(data[0].completed).toBe(true)
    }
  )

  test.fixme(
    'API-TABLES-BATCH-AUTH-003: should batch delete records with valid Bearer token',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Table with records
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
      await executeQuery(`INSERT INTO tasks (id) VALUES (1), (2), (3)`)

      const authHeaders = await createApiKeyAuth()

      // WHEN: Batch delete records
      const response = await request.delete('/api/tables/1/records/batch', {
        ...authHeaders,
        data: { ids: [1, 2] },
      })

      // THEN: Returns 204 No Content
      expect(response.status()).toBe(204)

      // Verify deletions
      const getResponse = await request.get('/api/tables/1/records', authHeaders)
      const records = await getResponse.json()
      expect(records.length).toBe(1)
      expect(records[0].id).toBe(3)
    }
  )

  test.fixme(
    'API-TABLES-BATCH-AUTH-004: should return 401 without Authorization header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Table configured
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

      // WHEN: Batch create without auth
      const response = await request.post('/api/tables/1/records/batch', {
        data: { records: [{}] },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-BATCH-AUTH-005: should return 401 with invalid Bearer token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table configured
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

      // WHEN: Request with invalid token
      const response = await request.post('/api/tables/1/records/batch', {
        headers: { Authorization: 'Bearer invalid-token' },
        data: { records: [{}] },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-BATCH-AUTH-006: should enforce organization isolation on batch operations',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      signOut,
      executeQuery,
    }) => {
      // GIVEN: Two organizations
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
        `INSERT INTO tasks (id, organization_id) VALUES (1, '${user1.organizationId}'), (2, '${user1.organizationId}')`
      )

      const user1ApiKey = await createApiKeyAuth()
      await signOut()

      const user2 = await createAuthenticatedUser({
        email: 'user2@example.com',
        createOrganization: true,
      })

      await executeQuery(
        `INSERT INTO tasks (id, organization_id) VALUES (3, '${user2.organizationId}')`
      )

      // WHEN: User1 tries batch delete including org2's record
      const response = await request.delete('/api/tables/1/records/batch', {
        ...user1ApiKey,
        data: { ids: [1, 3] },
      })

      // THEN: Only deletes org1's records (record 3 ignored)
      expect(response.status()).toBe(204)

      // Verify org2's record still exists
      const checkResponse = await request.get('/api/tables/1/records', user1ApiKey)
      const records = await checkResponse.json()
      expect(records.find((r: { id: number }) => r.id === 3)).toBeUndefined()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-BATCH-AUTH-007: user can perform batch operations via API key',
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
      let created: Array<{ id: number }>

      await test.step('Setup: Create user and generate API key', async () => {
        await createAuthenticatedUser({
          email: 'api-user@example.com',
          createOrganization: true,
        })
        apiKey = await createApiKeyAuth({ name: 'batch-ops-key' })
      })

      await test.step('Action: Batch create records with Bearer token', async () => {
        const createResponse = await request.post('/api/tables/1/records/batch', {
          ...apiKey,
          data: {
            records: [
              { title: 'Task 1', completed: false },
              { title: 'Task 2', completed: false },
              { title: 'Task 3', completed: false },
            ],
          },
        })
        expect(createResponse.status()).toBe(201)

        created = await createResponse.json()
        expect(created.length).toBe(3)
      })

      await test.step('Action: Batch update records with Bearer token', async () => {
        const updateResponse = await request.patch('/api/tables/1/records/batch', {
          ...apiKey,
          data: {
            updates: [
              { id: created[0].id, data: { completed: true } },
              { id: created[1].id, data: { completed: true } },
            ],
          },
        })
        expect(updateResponse.status()).toBe(200)
      })

      await test.step('Action: Batch delete records with Bearer token', async () => {
        const deleteResponse = await request.delete('/api/tables/1/records/batch', {
          ...apiKey,
          data: { ids: [created[0].id, created[1].id] },
        })
        expect(deleteResponse.status()).toBe(204)
      })

      await test.step('Verify: Only one record remains after batch operations', async () => {
        const listResponse = await request.get('/api/tables/1/records', apiKey)
        const records = await listResponse.json()
        expect(records.length).toBe(1)
        expect(records[0].id).toBe(created[2].id)
      })
    }
  )
})
