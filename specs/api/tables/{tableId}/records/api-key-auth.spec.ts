/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API Key Authentication - Record CRUD
 *
 * Domain: api/tables/{tableId}/records
 * Spec Count: 13
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (12 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests API key authentication for record CREATE, READ operations.
 */

test.describe('API Key Authentication - Record CRUD', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-AUTH-001: should list records with valid Bearer token',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Table with records and API key
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

      await createAuthenticatedUser({ email: 'user@example.com' })
      await executeQuery(`INSERT INTO tasks (id, title) VALUES (1, 'Task 1'), (2, 'Task 2')`)

      const authHeaders = await createApiKeyAuth({ name: 'read-key' })

      // WHEN: Request records with Bearer token
      const response = await request.get('/api/tables/1/records', authHeaders)

      // THEN: Returns 200 OK with records
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(2)
      expect(data[0].title).toBe('Task 1')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTH-002: should create record with valid Bearer token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createApiKeyAuth }) => {
      // GIVEN: Table and API key
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
              { id: 2, name: 'name', type: 'single-line-text', required: true },
            ],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      const authHeaders = await createApiKeyAuth({ name: 'write-key' })

      // WHEN: Create record with Bearer token
      const response = await request.post('/api/tables/1/records', {
        ...authHeaders,
        data: {
          name: 'John Doe',
        },
      })

      // THEN: Returns 201 Created
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data.name).toBe('John Doe')
      expect(data).toHaveProperty('id')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTH-003: should return 401 when listing records without auth',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Table with records
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
      const response = await request.get('/api/tables/1/records')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTH-004: should return 401 when creating record without auth',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Table configured
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

      // WHEN: Create record without auth
      const response = await request.post('/api/tables/1/records', {
        data: { title: 'Unauthorized Task' },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTH-005: should return 401 with invalid Bearer token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table configured
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

      // WHEN: Request with invalid token
      const response = await request.get('/api/tables/1/records', {
        headers: { Authorization: 'Bearer invalid-token' },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTH-006: should enforce organization isolation on record list',
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
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
          },
        ],
      })

      // Create org1 user and record
      const user1 = await createAuthenticatedUser({
        email: 'user1@example.com',
        createOrganization: true,
      })

      await executeQuery(
        `INSERT INTO tasks (id, title, organization_id) VALUES (1, 'Org1 Task', '${user1.organizationId}')`
      )

      const user1ApiKey = await createApiKeyAuth({ name: 'org1-key' })
      await signOut()

      // Create org2 user and record
      const user2 = await createAuthenticatedUser({
        email: 'user2@example.com',
        createOrganization: true,
      })

      await executeQuery(
        `INSERT INTO tasks (id, title, organization_id) VALUES (2, 'Org2 Task', '${user2.organizationId}')`
      )

      // WHEN: Org1 user lists records
      const response = await request.get('/api/tables/1/records', user1ApiKey)

      // THEN: Returns only org1's records
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.length).toBe(1)
      expect(data[0].title).toBe('Org1 Task')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTH-007: should enforce organization isolation on record create',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createApiKeyAuth }) => {
      // GIVEN: Multi-tenant application
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
            ],
          },
        ],
      })

      const user = await createAuthenticatedUser({
        email: 'user@example.com',
        createOrganization: true,
      })

      const apiKey = await createApiKeyAuth({ name: 'create-key' })

      // WHEN: Create record via API key
      const response = await request.post('/api/tables/1/records', {
        ...apiKey,
        data: { title: 'New Task' },
      })

      // THEN: Record is created with user's organization_id
      expect(response.status()).toBe(201)

      const record = await response.json()
      expect(record.organization_id).toBe(user.organizationId)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTH-008: should respect field-level read permissions',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Table with protected salary field
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
                permissions: { read: ['owner', 'admin'] },
              },
            ],
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

      const viewerApiKey = await createApiKeyAuth({ name: 'viewer-key' })

      // WHEN: Viewer lists records
      const response = await request.get('/api/tables/1/records', viewerApiKey)

      // THEN: Salary field is excluded
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data[0].name).toBe('John')
      expect(data[0]).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTH-009: should respect field-level write permissions',
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
              {
                id: 3,
                name: 'salary',
                type: 'number',
                permissions: { write: ['owner', 'admin'] },
              },
            ],
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

      const memberApiKey = await createApiKeyAuth({ name: 'member-key' })

      // WHEN: Member tries to create record with protected field
      const response = await request.post('/api/tables/1/records', {
        ...memberApiKey,
        data: {
          name: 'Jane',
          salary: 60000,
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('permission')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTH-010: should validate required fields on create',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createApiKeyAuth }) => {
      // GIVEN: Table with required field
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
              { id: 2, name: 'email', type: 'email', required: true },
            ],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      const apiKey = await createApiKeyAuth()

      // WHEN: Create record without required field
      const response = await request.post('/api/tables/1/records', {
        ...apiKey,
        data: {},
      })

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('required')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTH-011: should enforce unique constraints on create',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Table with unique field
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'email', type: 'email', unique: true, required: true },
            ],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      await executeQuery(`INSERT INTO users (id, email) VALUES (1, 'existing@example.com')`)

      const apiKey = await createApiKeyAuth()

      // WHEN: Create record with duplicate email
      const response = await request.post('/api/tables/1/records', {
        ...apiKey,
        data: { email: 'existing@example.com' },
      })

      // THEN: Returns 409 Conflict
      expect(response.status()).toBe(409)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('unique')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTH-012: should return empty array for empty table',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createApiKeyAuth }) => {
      // GIVEN: Empty table
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
      const apiKey = await createApiKeyAuth()

      // WHEN: List records from empty table
      const response = await request.get('/api/tables/1/records', apiKey)

      // THEN: Returns empty array
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(0)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-AUTH-013: user can perform complete record CRUD via API key',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createApiKeyAuth }) => {
      // GIVEN: Comprehensive table configuration
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
              { id: 2, name: 'email', type: 'email', unique: true, required: true },
              { id: 3, name: 'name', type: 'single-line-text', required: true },
              { id: 4, name: 'phone', type: 'phone' },
            ],
          },
        ],
      })

      // WHEN/THEN: Complete workflow
      await createAuthenticatedUser({
        email: 'api-user@example.com',
        createOrganization: true,
      })

      const apiKey = await createApiKeyAuth({ name: 'crud-test-key' })

      // Create record
      const createResponse = await request.post('/api/tables/1/records', {
        ...apiKey,
        data: {
          email: 'contact@example.com',
          name: 'John Doe',
          phone: '+1234567890',
        },
      })
      expect(createResponse.status()).toBe(201)

      const created = await createResponse.json()
      expect(created.email).toBe('contact@example.com')

      // List records
      const listResponse = await request.get('/api/tables/1/records', apiKey)
      expect(listResponse.status()).toBe(200)

      const records = await listResponse.json()
      expect(records.length).toBe(1)

      // Unauthorized access rejected
      const unauthorizedResponse = await request.get('/api/tables/1/records')
      expect(unauthorizedResponse.status()).toBe(401)
    }
  )
})
