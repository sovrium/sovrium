/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Get record by ID
 *
 * Source: specs/api/paths/tables/{tableId}/records/{recordId}/get.json
 * Domain: api
 * Spec Count: 10
 *
 * Soft Delete Behavior:
 * - By default, soft-deleted records (deleted_at IS NOT NULL) return 404
 * - Use includeDeleted=true query param to fetch soft-deleted records
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (11 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Get record by ID', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-GET-001: should return 200 with complete record data',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table 'users' with record ID=1
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'phone', type: 'phone-number' },
              { id: 4, name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO users (email, name, phone)
        VALUES ('john.doe@example.com', 'John Doe', '555-0100')
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests record by ID
      const response = await request.get('/api/tables/1/records/1', {})

      // THEN: Returns 200 with complete record data
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.id).toBe(1)
      expect(data.fields.email).toBe('john.doe@example.com')
      expect(data.fields.name).toBe('John Doe')
      expect(data.fields.phone).toBe('555-0100')
      expect(data).toHaveProperty('createdAt')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-002: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table 'users' exists but record ID=9999 does not
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 2,
            name: 'users',
            fields: [{ id: 1, name: 'email', type: 'email', required: true }],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User requests non-existent record
      const response = await request.get('/api/tables/1/records/9999', {})

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Record not found')
    }
  )

  test(
    'API-TABLES-RECORDS-GET-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An unauthenticated user with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 3,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email', required: true },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, email)
        VALUES (1, 'Alice Cooper', 'alice@example.com')
      `)

      // WHEN: User attempts to fetch a record without auth token
      const response = await request.get('/api/tables/1/records/1')

      // THEN: Returns 401 Unauthorized error
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-004: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedViewer }) => {
      // GIVEN: User without read permission
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 4,
            name: 'confidential',
            fields: [{ id: 1, name: 'data', type: 'long-text' }],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO confidential (id, data)
        VALUES (1, 'Secret Information')
      `)

      // Create authenticated viewer (limited permissions)
      await createAuthenticatedViewer()

      // WHEN: User without permission attempts to fetch record
      const response = await request.get('/api/tables/1/records/1', {})

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Forbidden')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-005: should return all fields for admin',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedAdmin }) => {
      // GIVEN: Admin user with full field access
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 6,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email', required: true },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary)
        VALUES (1, 'John Doe', 'john@example.com', 75000)
      `)

      // Create authenticated admin with full access
      await createAuthenticatedAdmin()

      // WHEN: Admin requests record
      const response = await request.get('/api/tables/1/records/1', {})

      // THEN: Returns all fields including salary
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data.fields).toHaveProperty('name')
      expect(data.fields).toHaveProperty('email')
      expect(data.fields).toHaveProperty('salary')
      expect(data.fields.salary).toBe(75_000)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-006: should exclude salary field for member',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: Member user without salary field read permission
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 7,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email', required: true },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary)
        VALUES (1, 'Jane Smith', 'jane@example.com', 85000)
      `)

      // Create authenticated member (limited salary access)
      await createAuthenticatedMember()

      // WHEN: Member requests record
      const response = await request.get('/api/tables/1/records/1', {})

      // THEN: Returns record without salary field
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('email')
      expect(data).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-007: should return minimal fields for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedViewer }) => {
      // GIVEN: Viewer with limited field access
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 8,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email', required: true },
              { id: 3, name: 'phone', type: 'phone-number' },
              { id: 4, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, email, phone, salary)
        VALUES (1, 'Bob Wilson', 'bob@example.com', '555-0200', 95000)
      `)

      // Create authenticated viewer (minimal field access)
      await createAuthenticatedViewer()

      // WHEN: Viewer requests record
      const response = await request.get('/api/tables/1/records/1', {})

      // THEN: Returns only permitted fields
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).not.toHaveProperty('email')
      expect(data).not.toHaveProperty('phone')
      expect(data).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-008: should include readonly fields in response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with readonly system fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 10,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'created_at', type: 'created-at' },
              { id: 3, name: 'updated_at', type: 'updated-at' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title)
        VALUES (1, 'Important Task')
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests record
      const response = await request.get('/api/tables/1/records/1', {})

      // THEN: Returns readonly fields in response (can read but not write)
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('title')
      expect(data).toHaveProperty('created_at')
      expect(data).toHaveProperty('updated_at')
    }
  )

  // ============================================================================
  // Soft Delete Tests
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-GET-009: should return 404 for soft-deleted record',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with a soft-deleted record
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 11,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title, deleted_at) VALUES (1, 'Deleted Task', NOW())
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests a soft-deleted record without includeDeleted param
      const response = await request.get('/api/tables/1/records/1', {})

      // THEN: Returns 404 Not Found (soft-deleted records are hidden by default)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Record not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-GET-010: should return soft-deleted record with includeDeleted=true',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with a soft-deleted record
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 12,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'status', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title, status, deleted_at)
        VALUES (1, 'Deleted Task', 'completed', NOW())
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests a soft-deleted record with includeDeleted=true
      const response = await request.get('/api/tables/1/records/1', {
        params: {
          includeDeleted: 'true',
        },
      })

      // THEN: Returns 200 with the soft-deleted record
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.record).toBeDefined()
      expect(data.record.id).toBe(1)
      expect(data.record.fields.title).toBe('Deleted Task')
      expect(data.record.fields.status).toBe('completed')
      // THEN: deleted_at field is populated
      expect(data.record.fields.deleted_at).toBeTruthy()
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-GET-REGRESSION: user can complete full get record workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // Setup: Create comprehensive schema for all test scenarios
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'phone', type: 'phone-number' },
              { id: 4, name: 'created_at', type: 'created-at' },
            ],
          },
          {
            id: 2,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email', required: true },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
              { id: 4, name: 'phone', type: 'phone-number' },
            ],
          },
          {
            id: 3,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'status', type: 'single-line-text' },
              { id: 3, name: 'created_at', type: 'created-at' },
              { id: 4, name: 'updated_at', type: 'updated-at' },
              { id: 5, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
          {
            id: 4,
            name: 'confidential',
            fields: [{ id: 1, name: 'data', type: 'long-text' }],
          },
        ],
      })

      // Insert test data for all scenarios
      await executeQuery(`
        INSERT INTO users (id, email, name, phone)
        VALUES (1, 'john.doe@example.com', 'John Doe', '555-0100')
      `)
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary, phone)
        VALUES
          (1, 'Alice Cooper', 'alice@example.com', 75000, '555-0200'),
          (2, 'Bob Smith', 'bob@example.com', 85000, '555-0300'),
          (3, 'Jane Smith', 'jane@example.com', 85000, '555-0400')
      `)
      await executeQuery(`
        INSERT INTO tasks (id, title, status)
        VALUES (1, 'Important Task', 'pending')
      `)
      await executeQuery(`
        INSERT INTO tasks (id, title, status, deleted_at)
        VALUES (2, 'Deleted Task', 'completed', NOW())
      `)
      await executeQuery(`
        INSERT INTO confidential (id, data)
        VALUES (1, 'Secret Information')
      `)

      // Create authenticated user for API requests
      await createAuthenticatedUser()

      await test.step('API-TABLES-RECORDS-GET-001: should return 200 with complete record data', async () => {
        const response = await request.get('/api/tables/1/records/1', {})

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.id).toBe(1)
        expect(data.fields.email).toBe('john.doe@example.com')
        expect(data.fields.name).toBe('John Doe')
        expect(data.fields.phone).toBe('555-0100')
        expect(data).toHaveProperty('createdAt')
      })

      await test.step('API-TABLES-RECORDS-GET-002: should return 404 for non-existent record', async () => {
        const response = await request.get('/api/tables/1/records/9999', {})

        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.error).toBe('Record not found')
      })

      await test.step('API-TABLES-RECORDS-GET-003: should return 401 Unauthorized', async () => {
        // Note: This test requires unauthenticated request
        const response = await request.get('/api/tables/2/records/1')

        expect(response.status()).toBe(401)
      })

      await test.step('API-TABLES-RECORDS-GET-004: should return 403 Forbidden', async () => {
        // User without read permission on confidential table
        const response = await request.get('/api/tables/4/records/1', {})

        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.error).toBe('Forbidden')
      })

      await test.step('API-TABLES-RECORDS-GET-005: should return all fields for admin', async () => {
        // Admin user with full field access
        const response = await request.get('/api/tables/2/records/1', {})

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('id')
        expect(data.fields).toHaveProperty('name')
        expect(data.fields).toHaveProperty('email')
        expect(data.fields).toHaveProperty('salary')
        expect(data.fields.salary).toBe(75_000)
      })

      await test.step('API-TABLES-RECORDS-GET-006: should exclude salary field for member', async () => {
        // Member user without salary field read permission
        const response = await request.get('/api/tables/2/records/3', {})

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('id')
        expect(data).toHaveProperty('name')
        expect(data).toHaveProperty('email')
        expect(data).not.toHaveProperty('salary')
      })

      await test.step('API-TABLES-RECORDS-GET-007: should return minimal fields for viewer', async () => {
        // Viewer with limited field access
        const response = await request.get('/api/tables/2/records/1', {})

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('id')
        expect(data).toHaveProperty('name')
        expect(data).not.toHaveProperty('email')
        expect(data).not.toHaveProperty('phone')
        expect(data).not.toHaveProperty('salary')
      })

      await test.step('API-TABLES-RECORDS-GET-008: should include readonly fields in response', async () => {
        // Table with readonly system fields
        const response = await request.get('/api/tables/3/records/1', {})

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('id')
        expect(data).toHaveProperty('title')
        expect(data).toHaveProperty('created_at')
        expect(data).toHaveProperty('updated_at')
      })

      await test.step('API-TABLES-RECORDS-GET-009: should return 404 for soft-deleted record', async () => {
        // Soft-deleted record without includeDeleted param
        const response = await request.get('/api/tables/3/records/2', {})

        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.error).toBe('Record not found')
      })

      await test.step('API-TABLES-RECORDS-GET-010: should return soft-deleted record with includeDeleted=true', async () => {
        // Soft-deleted record with includeDeleted=true
        const response = await request.get('/api/tables/3/records/2', {
          params: {
            includeDeleted: 'true',
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.record).toBeDefined()
        expect(data.record.id).toBe(2)
        expect(data.record.fields.title).toBe('Deleted Task')
        expect(data.record.fields.status).toBe('completed')
        expect(data.record.fields.deleted_at).toBeTruthy()
      })
    }
  )
})
