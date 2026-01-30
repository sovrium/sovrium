/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for List records in table
 *
 * Source: specs/api/paths/tables/{tableId}/records/get.json
 * Domain: api
 * Spec Count: 25
 *
 * Soft Delete Behavior:
 * - By default, soft-deleted records (deleted_at IS NOT NULL) are excluded
 * - Use includeDeleted=true query param to include soft-deleted records
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (25 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('List records in table', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test(
    'API-TABLES-RECORDS-LIST-001: should return 200 with array of 3 records and pagination',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table 'projects' with 3 records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'status', type: 'single-line-text', default: 'active' },
              { id: 3, name: 'priority', type: 'integer', default: 1 },
              { id: 4, name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (name, status, priority)
        VALUES
          ('Project Alpha', 'active', 5),
          ('Project Beta', 'completed', 3),
          ('Project Gamma', 'active', 4)
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests all records
      const response = await request.get('/api/tables/1/records', {})

      // THEN: Returns 200 with array of 3 records and pagination metadata
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('records')
      expect(data).toHaveProperty('pagination')
      expect(data.records).toHaveLength(3)
      expect(data.pagination.total).toBe(3)
    }
  )

  test(
    'API-TABLES-RECORDS-LIST-002: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A running server with no table ID 9999
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [],
      })

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests records from non-existent table
      const response = await request.get('/api/tables/9999/records', {})

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data.success).toBe(false)
      expect(data.message).toBe('Resource not found')
      expect(data.code).toBe('NOT_FOUND')
    }
  )

  test(
    'API-TABLES-RECORDS-LIST-003: should return 200 with only 2 active records',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with 5 records (2 active, 3 completed)
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'status', type: 'single-line-text', required: true },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (name, status)
        VALUES
          ('Task 1', 'active'),
          ('Task 2', 'active'),
          ('Task 3', 'completed'),
          ('Task 4', 'completed'),
          ('Task 5', 'completed')
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests records with filter for status=active
      const response = await request.get('/api/tables/2/records', {
        params: {
          filter: JSON.stringify({
            and: [{ field: 'status', operator: 'equals', value: 'active' }],
          }),
        },
      })

      // THEN: Returns 200 with only 2 active records
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records).toHaveLength(2)
      expect(data.pagination.total).toBe(2)
    }
  )

  test(
    'API-TABLES-RECORDS-LIST-004: should return 200 with records in descending priority order',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with 3 records having different priorities
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 3,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'priority', type: 'integer' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (name, priority)
        VALUES
          ('Low Priority', 1),
          ('High Priority', 5),
          ('Medium Priority', 3)
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests records sorted by priority descending
      const response = await request.get('/api/tables/3/records', {
        params: {
          sort: 'priority:desc',
        },
      })

      // THEN: Returns 200 with records in descending priority order
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records).toHaveLength(3)
      expect(data.records[0].fields.priority).toBe(5)
      expect(data.records[1].fields.priority).toBe(3)
      expect(data.records[2].fields.priority).toBe(1)
    }
  )

  test(
    'API-TABLES-RECORDS-LIST-005: should return 200 with records containing only specified fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with multiple fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 4,
            name: 'users',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email', required: true },
              { id: 3, name: 'phone', type: 'phone-number' },
              { id: 4, name: 'address', type: 'long-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO users (name, email, phone, address)
        VALUES ('John Doe', 'john@example.com', '555-0100', '123 Main St')
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests only specific fields
      const response = await request.get('/api/tables/4/records', {
        params: {
          fields: 'id,name,email',
        },
      })

      // THEN: Returns 200 with records containing only specified fields
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records).toHaveLength(1)
      expect(data.records[0]).toHaveProperty('id')
      expect(data.records[0].fields).toHaveProperty('name')
      expect(data.records[0].fields).toHaveProperty('email')
      expect(data.records[0].fields).not.toHaveProperty('phone')
      expect(data.records[0].fields).not.toHaveProperty('address')
    }
  )

  test(
    'API-TABLES-RECORDS-LIST-006: should return 200 with records 41-60 and correct pagination',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with 100 records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 5,
            name: 'items',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
        ],
      })

      const insertValues = Array.from({ length: 100 }, (_, i) => `('Item ${i + 1}')`).join(',')
      await executeQuery(`INSERT INTO items (name) VALUES ${insertValues}`)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests with limit=20 and offset=40
      const response = await request.get('/api/tables/5/records', {
        params: {
          limit: '20',
          offset: '40',
        },
      })

      // THEN: Returns 200 with records 41-60 and correct pagination
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records).toHaveLength(20)
      expect(data.pagination.total).toBe(100)
      expect(data.pagination.limit).toBe(20)
      expect(data.pagination.offset).toBe(40)
    }
  )

  test(
    'API-TABLES-RECORDS-LIST-007: should return 200 with records filtered by view',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with records and a predefined view
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 6,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'status', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (name, status)
        VALUES
          ('Active Project 1', 'active'),
          ('Active Project 2', 'active'),
          ('Completed Project', 'completed')
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests records with view parameter
      const response = await request.get('/api/tables/6/records', {
        params: {
          view: 'active_only',
        },
      })

      // THEN: Returns 200 with records filtered by view
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records.length).toBeGreaterThan(0)
    }
  )

  test(
    'API-TABLES-RECORDS-LIST-008: should return 200 with records grouped by status',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with records having different status values
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 7,
            name: 'tasks',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'status', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (name, status)
        VALUES
          ('Task 1', 'active'),
          ('Task 2', 'active'),
          ('Task 3', 'completed')
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests records grouped by status field
      const response = await request.get('/api/tables/7/records', {
        params: {
          groupBy: 'status',
        },
      })

      // THEN: Returns 200 with records grouped by status
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('records')
    }
  )

  test(
    'API-TABLES-RECORDS-LIST-009: should return 200 with aggregation results',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with numeric fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 8,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'budget', type: 'currency', currency: 'USD' },
              { id: 3, name: 'priority', type: 'integer' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (name, budget, priority)
        VALUES
          ('Project A', 10000, 5),
          ('Project B', 20000, 3),
          ('Project C', 15000, 4)
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests with aggregations (count, sum, avg)
      const response = await request.get('/api/tables/8/records', {
        params: {
          aggregate: JSON.stringify({
            count: true,
            sum: ['budget'],
            avg: ['priority'],
          }),
        },
      })

      // THEN: Returns 200 with aggregation results
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('aggregations')
      expect(data.aggregations.count).toBe('3')
      expect(data.aggregations.sum.budget).toBe(45_000)
      expect(data.aggregations.avg.priority).toBeCloseTo(4, 1)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-010: should return 200 with records matching formula',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with multiple fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 9,
            name: 'tasks',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'status', type: 'single-line-text' },
              { id: 3, name: 'priority', type: 'integer' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (name, status, priority)
        VALUES
          ('High Priority Active', 'active', 5),
          ('Low Priority Active', 'active', 1),
          ('High Priority Done', 'completed', 5)
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User filters by Airtable-style formula
      const response = await request.get('/api/tables/9/records', {
        params: {
          filterByFormula: "AND({status}='active', {priority}>=3)",
        },
      })

      // THEN: Returns 200 with records matching formula
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records).toHaveLength(1)
      expect(data.records[0].fields.name).toBe('High Priority Active')
    }
  )

  test(
    'API-TABLES-RECORDS-LIST-011: should return 200 with multi-field sort applied',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with multiple sortable fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 10,
            name: 'projects',
            fields: [
              { id: 1, name: 'priority', type: 'integer' },
              { id: 2, name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (priority, created_at)
        VALUES
          (5, '2025-01-01'),
          (5, '2025-01-02'),
          (3, '2025-01-03')
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User sorts by priority desc, then created_at desc
      const response = await request.get('/api/tables/10/records', {
        params: {
          sort: 'priority:desc,created_at:desc',
        },
      })

      // THEN: Returns 200 with multi-field sort applied
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records[0].fields.priority).toBe(5)
      expect(data.records[1].fields.priority).toBe(5)
      expect(data.records[2].fields.priority).toBe(3)
    }
  )

  test(
    'API-TABLES-RECORDS-LIST-012: should return 200 with both view and explicit filters',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with view and additional filter
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 11,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'status', type: 'single-line-text' },
              { id: 3, name: 'priority', type: 'integer' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (name, status, priority)
        VALUES
          ('High Active', 'active', 5),
          ('Low Active', 'active', 1)
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User combines view and explicit filter
      const response = await request.get('/api/tables/11/records', {
        params: {
          view: 'active_only',
          filter: JSON.stringify({
            and: [{ field: 'priority', operator: 'greaterThanOrEqual', value: 3 }],
          }),
        },
      })

      // THEN: Returns 200 with both view and explicit filters
      expect(response.status()).toBe(200)
    }
  )

  test(
    'API-TABLES-RECORDS-LIST-013: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A valid table with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 12,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
        ],
      })

      // WHEN: Unauthenticated user requests records
      const response = await request.get('/api/tables/12/records')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-014: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedViewer }) => {
      // GIVEN: User without read permission
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 13,
            name: 'confidential',
            fields: [{ id: 1, name: 'data', type: 'long-text' }],
          },
        ],
      })

      // Create authenticated viewer (without read permission)
      await createAuthenticatedViewer()

      // WHEN: User without permission requests records
      const response = await request.get('/api/tables/13/records', {})

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-015: should return all fields for admin',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedAdmin }) => {
      // GIVEN: Admin user with full field access
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 15,
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
        INSERT INTO employees (name, email, salary)
        VALUES ('John Doe', 'john@example.com', 75000)
      `)

      // Create authenticated admin
      await createAuthenticatedAdmin()

      // WHEN: Admin requests records
      const response = await request.get('/api/tables/15/records', {})

      // THEN: Returns all fields including salary
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records[0].fields).toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-016: should exclude salary field for member',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: Member user without salary field read permission
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 16,
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
        INSERT INTO employees (name, email, salary)
        VALUES ('John Doe', 'john@example.com', 75000)
      `)

      // Create authenticated member
      await createAuthenticatedMember()

      // WHEN: Member requests records
      const response = await request.get('/api/tables/16/records', {})

      // THEN: Returns records without salary field
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records[0].fields).toHaveProperty('name')
      expect(data.records[0].fields).toHaveProperty('email')
      expect(data.records[0].fields).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-017: should return minimal fields for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedViewer }) => {
      // GIVEN: Viewer with limited field access
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 17,
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
        INSERT INTO employees (name, email, phone, salary)
        VALUES ('John Doe', 'john@example.com', '555-0100', 75000)
      `)

      // Create authenticated viewer
      await createAuthenticatedViewer()

      // WHEN: Viewer requests records
      const response = await request.get('/api/tables/17/records', {})

      // THEN: Returns only permitted fields
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records[0]).toHaveProperty('id')
      expect(data.records[0].fields).toHaveProperty('name')
      expect(data.records[0].fields).not.toHaveProperty('email')
      expect(data.records[0].fields).not.toHaveProperty('salary')
    }
  )

  test(
    'API-TABLES-RECORDS-LIST-018: should return empty array with 200',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: User with valid permissions but no matching records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 20,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
        ],
      })

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests records (empty table)
      const response = await request.get('/api/tables/20/records', {})

      // THEN: Returns 200 with empty array
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records).toHaveLength(0)
      expect(data.pagination.total).toBe(0)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-019: should paginate with field filtering',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Member with field restrictions and large dataset
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 21,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })

      const insertValues = Array.from(
        { length: 50 },
        (_, i) => `('Employee ${i + 1}', ${50_000 + i * 1000})`
      ).join(',')
      await executeQuery(`
        INSERT INTO employees (name, salary) VALUES ${insertValues}
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: Member requests paginated records
      const response = await request.get('/api/tables/21/records', {
        params: {
          limit: '10',
          offset: '20',
        },
      })

      // THEN: Returns paginated records without restricted fields
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records).toHaveLength(10)
      expect(data.pagination.offset).toBe(20)
      expect(data.records[0].fields).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-020: should return 403 when sorting by inaccessible field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember }) => {
      // GIVEN: User attempts to sort by restricted field
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 22,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })

      // Create authenticated member (cannot read salary field)
      await createAuthenticatedMember()

      // WHEN: Member sorts by salary (field they cannot read)
      const response = await request.get('/api/tables/22/records', {
        params: {
          sort: 'salary:desc',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toContain('Cannot sort by field')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-021: should return 403 when filtering by inaccessible field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember }) => {
      // GIVEN: User attempts to filter by restricted field
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 23,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })

      // Create authenticated member (cannot read salary field)
      await createAuthenticatedMember()

      // WHEN: Member filters by salary (field they cannot read)
      const response = await request.get('/api/tables/23/records', {
        params: {
          filter: JSON.stringify({
            and: [{ field: 'salary', operator: 'greaterThan', value: 60_000 }],
          }),
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toContain('Cannot filter by field')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-022: should return 403 when aggregating inaccessible field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember }) => {
      // GIVEN: User attempts to aggregate restricted field
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 24,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })

      // Create authenticated member (cannot read salary field)
      await createAuthenticatedMember()

      // WHEN: Member aggregates salary (field they cannot read)
      const response = await request.get('/api/tables/24/records', {
        params: {
          aggregate: JSON.stringify({
            sum: ['salary'],
            avg: ['salary'],
          }),
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toContain('Cannot aggregate field')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-023: should return aggregations for accessible fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: User aggregates only accessible fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 25,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'priority', type: 'integer' },
              { id: 3, name: 'budget', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (name, priority, budget)
        VALUES
          ('P1', 5, 10000),
          ('P2', 3, 20000),
          ('P3', 4, 15000)
      `)

      // Create authenticated member
      await createAuthenticatedMember()

      // WHEN: Member aggregates permitted fields only
      const response = await request.get('/api/tables/25/records', {
        params: {
          aggregate: JSON.stringify({
            count: true,
            avg: ['priority'],
          }),
        },
      })

      // THEN: Returns aggregation results for accessible fields
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.aggregations.count).toBe('3')
      expect(data.aggregations.avg.priority).toBe(4)
      expect(data.aggregations.avg).not.toHaveProperty('budget')
    }
  )

  // ============================================================================
  // Soft Delete Filtering Tests
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-LIST-024: should exclude soft-deleted records by default',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with mix of active and soft-deleted records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 27,
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
        INSERT INTO tasks (id, title, status, deleted_at) VALUES
          (1, 'Active Task 1', 'pending', NULL),
          (2, 'Deleted Task', 'completed', NOW()),
          (3, 'Active Task 2', 'in_progress', NULL),
          (4, 'Another Deleted', 'pending', NOW())
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests records without includeDeleted parameter
      const response = await request.get('/api/tables/27/records', {})

      // THEN: Returns 200 with only active (non-deleted) records
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: Only 2 active records returned (soft-deleted excluded)
      expect(data.records).toHaveLength(2)
      expect(data.pagination.total).toBe(2)

      // Verify no soft-deleted records in response
      const titles = data.records.map((r: { fields: { title: string } }) => r.fields.title)
      expect(titles).toContain('Active Task 1')
      expect(titles).toContain('Active Task 2')
      expect(titles).not.toContain('Deleted Task')
      expect(titles).not.toContain('Another Deleted')
    }
  )

  test(
    'API-TABLES-RECORDS-LIST-025: should include deleted with includeDeleted=true',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with mix of active and soft-deleted records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 28,
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
        INSERT INTO tasks (id, title, status, deleted_at) VALUES
          (1, 'Active Task', 'pending', NULL),
          (2, 'Deleted Task 1', 'completed', NOW()),
          (3, 'Deleted Task 2', 'in_progress', NOW())
      `)

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User requests records with includeDeleted=true
      const response = await request.get('/api/tables/28/records', {
        params: {
          includeDeleted: 'true',
        },
      })

      // THEN: Returns 200 with all records (including soft-deleted)
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: All 3 records returned (active + soft-deleted)
      expect(data.records).toHaveLength(3)
      expect(data.pagination.total).toBe(3)

      // THEN: Deleted records should have deleted_at field populated
      const deletedRecords = data.records.filter(
        (r: { fields: { deleted_at: string | null } }) => r.fields.deleted_at !== null
      )
      expect(deletedRecords).toHaveLength(2)
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-LIST-REGRESSION: user can complete full list records workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // ========================================================================
      // SETUP: Consolidated schema with all fields needed for regression tests
      // ========================================================================
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'status', type: 'single-line-text', default: 'active' },
              { id: 3, name: 'priority', type: 'integer', default: 1 },
              { id: 4, name: 'budget', type: 'currency', currency: 'USD' },
              { id: 5, name: 'created_at', type: 'created-at' },
              { id: 6, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
            views: [
              {
                id: 'active_only',
                name: 'Active Only',
                filters: {
                  and: [{ field: 'status', operator: 'equals', value: 'active' }],
                },
              },
            ],
          },
          {
            id: 2,
            name: 'users',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email', required: true },
              { id: 3, name: 'phone', type: 'phone-number' },
              { id: 4, name: 'address', type: 'long-text' },
              { id: 5, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })

      // --- Step 013: 401 Unauthorized (BEFORE authentication) ---
      await test.step('API-TABLES-RECORDS-LIST-013: Return 401 for unauthenticated request', async () => {
        const response = await request.get('/api/tables/1/records')
        expect(response.status()).toBe(401)

        const data = await response.json()
        expect(data.error).toBeDefined()
        expect(data.message).toBeDefined()
      })

      // --- Authenticate as user for all subsequent test steps ---
      await createAuthenticatedUser()

      // ========================================================================
      // TEST STEPS: Each step corresponds to a @spec test
      // ========================================================================

      await test.step('API-TABLES-RECORDS-LIST-001: Returns 200 with array of records and pagination', async () => {
        // Setup: Insert 3 records
        await executeQuery(`
          INSERT INTO projects (name, status, priority)
          VALUES
            ('Project Alpha', 'active', 5),
            ('Project Beta', 'completed', 3),
            ('Project Gamma', 'active', 4)
        `)

        const response = await request.get('/api/tables/1/records', {})
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('records')
        expect(data).toHaveProperty('pagination')
        expect(data.records).toHaveLength(3)
        expect(data.pagination.total).toBe(3)
      })

      await test.step('API-TABLES-RECORDS-LIST-002: Returns 404 for non-existent table', async () => {
        const response = await request.get('/api/tables/9999/records', {})
        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-RECORDS-LIST-003: Returns filtered records by status', async () => {
        const response = await request.get('/api/tables/1/records', {
          params: {
            filter: JSON.stringify({
              and: [{ field: 'status', operator: 'equals', value: 'active' }],
            }),
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(2)
        expect(data.pagination.total).toBe(2)
      })

      await test.step('API-TABLES-RECORDS-LIST-004: Returns records sorted by priority descending', async () => {
        const response = await request.get('/api/tables/1/records', {
          params: {
            sort: 'priority:desc',
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(3)
        expect(data.records[0].fields.priority).toBe(5)
        expect(data.records[1].fields.priority).toBe(4)
        expect(data.records[2].fields.priority).toBe(3)
      })

      await test.step('API-TABLES-RECORDS-LIST-005: Returns only specified fields', async () => {
        // Setup: Insert user record
        await executeQuery(`
          INSERT INTO users (name, email, phone, address)
          VALUES ('John Doe', 'john@example.com', '555-0100', '123 Main St')
        `)

        const response = await request.get('/api/tables/2/records', {
          params: {
            fields: 'id,name,email',
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(1)
        expect(data.records[0]).toHaveProperty('id')
        expect(data.records[0].fields).toHaveProperty('name')
        expect(data.records[0].fields).toHaveProperty('email')
        expect(data.records[0].fields).not.toHaveProperty('phone')
        expect(data.records[0].fields).not.toHaveProperty('address')
      })

      await test.step('API-TABLES-RECORDS-LIST-006: Returns paginated records with limit and offset', async () => {
        // Setup: Insert 100 items for pagination test
        const insertValues = Array.from(
          { length: 100 },
          (_, i) => `('Item ${i + 1}', 'active', 1)`
        ).join(',')
        await executeQuery(`INSERT INTO projects (name, status, priority) VALUES ${insertValues}`)

        const response = await request.get('/api/tables/1/records', {
          params: {
            limit: '20',
            offset: '40',
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(20)
        expect(data.pagination.total).toBe(103) // 3 from earlier + 100 new
        expect(data.pagination.limit).toBe(20)
        expect(data.pagination.offset).toBe(40)
      })

      await test.step('API-TABLES-RECORDS-LIST-007: Returns records filtered by view', async () => {
        const response = await request.get('/api/tables/1/records', {
          params: {
            view: 'active_only',
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records.length).toBeGreaterThan(0)
      })

      await test.step('API-TABLES-RECORDS-LIST-008: Returns records grouped by field', async () => {
        const response = await request.get('/api/tables/1/records', {
          params: {
            groupBy: 'status',
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('records')
      })

      await test.step('API-TABLES-RECORDS-LIST-009: Returns aggregation results', async () => {
        // Clear and setup specific data for aggregation
        await executeQuery(`DELETE FROM projects`)
        await executeQuery(`
          INSERT INTO projects (name, budget, priority)
          VALUES
            ('Project A', 10000, 5),
            ('Project B', 20000, 3),
            ('Project C', 15000, 4)
        `)

        const response = await request.get('/api/tables/1/records', {
          params: {
            aggregate: JSON.stringify({
              count: true,
              sum: ['budget'],
              avg: ['priority'],
            }),
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('aggregations')
        expect(data.aggregations.count).toBe('3')
        expect(data.aggregations.sum.budget).toBe(45_000)
        expect(data.aggregations.avg.priority).toBeCloseTo(4, 1)
      })

      await test.step('API-TABLES-RECORDS-LIST-010: Returns records matching formula filter', async () => {
        // Clear and setup specific data for formula test
        await executeQuery(`DELETE FROM projects`)
        await executeQuery(`
          INSERT INTO projects (name, status, priority)
          VALUES
            ('High Priority Active', 'active', 5),
            ('Low Priority Active', 'active', 1),
            ('High Priority Done', 'completed', 5)
        `)

        const response = await request.get('/api/tables/1/records', {
          params: {
            filterByFormula: "AND({status}='active', {priority}>=3)",
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(1)
        expect(data.records[0].fields.name).toBe('High Priority Active')
      })

      await test.step('API-TABLES-RECORDS-LIST-011: Returns records with multi-field sort', async () => {
        // Clear and setup specific data for multi-sort test
        await executeQuery(`DELETE FROM projects`)
        await executeQuery(`
          INSERT INTO projects (priority, created_at)
          VALUES
            (5, '2025-01-01'),
            (5, '2025-01-02'),
            (3, '2025-01-03')
        `)

        const response = await request.get('/api/tables/1/records', {
          params: {
            sort: 'priority:desc,created_at:desc',
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records[0].fields.priority).toBe(5)
        expect(data.records[1].fields.priority).toBe(5)
        expect(data.records[2].fields.priority).toBe(3)
      })

      await test.step('API-TABLES-RECORDS-LIST-012: Returns records with view and explicit filters combined', async () => {
        // Clear and setup specific data
        await executeQuery(`DELETE FROM projects`)
        await executeQuery(`
          INSERT INTO projects (name, status, priority)
          VALUES
            ('High Active', 'active', 5),
            ('Low Active', 'active', 1)
        `)

        const response = await request.get('/api/tables/1/records', {
          params: {
            view: 'active_only',
            filter: JSON.stringify({
              and: [{ field: 'priority', operator: 'greaterThanOrEqual', value: 3 }],
            }),
          },
        })

        expect(response.status()).toBe(200)
      })

      // --- Step 013 covered above (before authentication) ---

      // --- Step 014 skipped: requires non-read role auth context ---
      // API-TABLES-RECORDS-LIST-014 tests 403 for user without read permission.
      // This needs a different auth context which would invalidate the current session.
      // Covered by @spec test API-TABLES-RECORDS-LIST-014.

      await test.step('API-TABLES-RECORDS-LIST-015: Returns all fields for admin user', async () => {
        // Clear and setup employee data
        await executeQuery(`DELETE FROM users`)
        await executeQuery(`
          INSERT INTO users (name, email, salary)
          VALUES ('John Doe', 'john@example.com', 75000)
        `)

        const response = await request.get('/api/tables/2/records', {})
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records[0].fields).toHaveProperty('salary')
      })

      // --- Steps 016, 017 skipped: require member/viewer auth contexts ---
      // API-TABLES-RECORDS-LIST-016 tests field-level permissions for member role.
      // API-TABLES-RECORDS-LIST-017 tests minimal fields for viewer role.
      // These need different auth contexts which would invalidate the current session.
      // Covered by @spec tests API-TABLES-RECORDS-LIST-016 and 017.

      await test.step('API-TABLES-RECORDS-LIST-018: Returns empty array with 200 for no matching records', async () => {
        await executeQuery(`DELETE FROM projects`)

        const response = await request.get('/api/tables/1/records', {})
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(0)
        expect(data.pagination.total).toBe(0)
      })

      await test.step('API-TABLES-RECORDS-LIST-019: Paginates with field filtering', async () => {
        // Setup 50 employee records
        const insertValues = Array.from(
          { length: 50 },
          (_, i) => `('Employee ${i + 1}', 'emp${i + 1}@example.com', ${50_000 + i * 1000})`
        ).join(',')
        await executeQuery(`DELETE FROM users`)
        await executeQuery(`INSERT INTO users (name, email, salary) VALUES ${insertValues}`)

        const response = await request.get('/api/tables/2/records', {
          params: {
            limit: '10',
            offset: '20',
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(10)
        expect(data.pagination.offset).toBe(20)
        // Note: salary visibility depends on role (admin sees all fields)
      })

      // --- Steps 020, 021, 022 skipped: require member/viewer auth contexts ---
      // API-TABLES-RECORDS-LIST-020 tests 403 when sorting by inaccessible field.
      // API-TABLES-RECORDS-LIST-021 tests 403 when filtering by inaccessible field.
      // API-TABLES-RECORDS-LIST-022 tests 403 when aggregating inaccessible field.
      // These need a non-admin auth context with field-level permission restrictions.
      // Covered by @spec tests API-TABLES-RECORDS-LIST-020, 021, and 022.

      await test.step('API-TABLES-RECORDS-LIST-023: Returns aggregations for accessible fields only', async () => {
        await executeQuery(`DELETE FROM projects`)
        await executeQuery(`
          INSERT INTO projects (name, priority, budget)
          VALUES
            ('P1', 5, 10000),
            ('P2', 3, 20000),
            ('P3', 4, 15000)
        `)

        const response = await request.get('/api/tables/1/records', {
          params: {
            aggregate: JSON.stringify({
              count: true,
              avg: ['priority'],
            }),
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.aggregations.count).toBe('3')
        expect(data.aggregations.avg.priority).toBe(4)
        expect(data.aggregations.avg).not.toHaveProperty('budget')
      })

      await test.step('API-TABLES-RECORDS-LIST-024: Excludes soft-deleted records by default', async () => {
        await executeQuery(`DELETE FROM projects`)
        await executeQuery(`
          INSERT INTO projects (id, name, status, deleted_at) VALUES
            (1, 'Active Task 1', 'pending', NULL),
            (2, 'Deleted Task', 'completed', NOW()),
            (3, 'Active Task 2', 'in_progress', NULL),
            (4, 'Another Deleted', 'pending', NOW())
        `)

        const response = await request.get('/api/tables/1/records', {})
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(2)
        expect(data.pagination.total).toBe(2)

        const titles = data.records.map((r: { fields: { name: string } }) => r.fields.name)
        expect(titles).toContain('Active Task 1')
        expect(titles).toContain('Active Task 2')
        expect(titles).not.toContain('Deleted Task')
        expect(titles).not.toContain('Another Deleted')
      })

      await test.step('API-TABLES-RECORDS-LIST-025: Includes deleted records with includeDeleted=true', async () => {
        await executeQuery(`DELETE FROM projects`)
        await executeQuery(`
          INSERT INTO projects (id, name, status, deleted_at) VALUES
            (1, 'Active Task', 'pending', NULL),
            (2, 'Deleted Task 1', 'completed', NOW()),
            (3, 'Deleted Task 2', 'in_progress', NOW())
        `)

        const response = await request.get('/api/tables/1/records', {
          params: {
            includeDeleted: 'true',
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(3)
        expect(data.pagination.total).toBe(3)

        const deletedRecords = data.records.filter(
          (r: { fields: { deleted_at: string | null } }) => r.fields.deleted_at !== null
        )
        expect(deletedRecords).toHaveLength(2)
      })
    }
  )
})
