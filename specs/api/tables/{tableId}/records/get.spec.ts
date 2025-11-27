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
 * Spec Count: 28
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (28 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('List records in table', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-LIST-001: should return 200 with array of 3 records and pagination',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table 'projects' with 3 records
      await startServerWithSchema({
        name: 'test-app',
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

  test.fixme(
    'API-TABLES-RECORDS-LIST-002: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A running server with no table ID 9999

      // WHEN: User requests records from non-existent table
      const response = await request.get('/api/tables/9999/records', {})

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Table not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-003: should return 200 with only 2 active records',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with 5 records (2 active, 3 completed)
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: User requests records with filter for status=active
      const response = await request.get('/api/tables/1/records', {
        params: {
          filter: JSON.stringify({
            operator: 'AND',
            conditions: [{ field: 'status', operator: 'equals', value: 'active' }],
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

  test.fixme(
    'API-TABLES-RECORDS-LIST-004: should return 200 with records in descending priority order',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with 3 records having different priorities
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: User requests records sorted by priority descending
      const response = await request.get('/api/tables/1/records', {
        params: {
          sort: 'priority:desc',
        },
      })

      // THEN: Returns 200 with records in descending priority order
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records).toHaveLength(3)
      expect(data.records[0].priority).toBe(5)
      expect(data.records[1].priority).toBe(3)
      expect(data.records[2].priority).toBe(1)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-005: should return 200 with records containing only specified fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with multiple fields
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: User requests only specific fields
      const response = await request.get('/api/tables/1/records', {
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
      expect(data.records[0]).toHaveProperty('name')
      expect(data.records[0]).toHaveProperty('email')
      expect(data.records[0]).not.toHaveProperty('phone')
      expect(data.records[0]).not.toHaveProperty('address')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-006: should return 200 with records 41-60 and correct pagination',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with 100 records
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          { id: 5, name: 'items', fields: [{ id: 1, name: 'name', type: 'single-line-text' }] },
        ],
      })

      const insertValues = Array.from({ length: 100 }, (_, i) => `('Item ${i + 1}')`).join(',')
      await executeQuery(`INSERT INTO items (name) VALUES ${insertValues}`)

      // WHEN: User requests with limit=20 and offset=40
      const response = await request.get('/api/tables/1/records', {
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

  test.fixme(
    'API-TABLES-RECORDS-LIST-007: should return 200 with records filtered by view',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with records and a predefined view
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: User requests records with view parameter
      const response = await request.get('/api/tables/1/records', {
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

  test.fixme(
    'API-TABLES-RECORDS-LIST-008: should return 200 with records grouped by status',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with records having different status values
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: User requests records grouped by status field
      const response = await request.get('/api/tables/1/records', {
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

  test.fixme(
    'API-TABLES-RECORDS-LIST-009: should return 200 with aggregation results',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with numeric fields
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: User requests with aggregations (count, sum, avg)
      const response = await request.get('/api/tables/1/records', {
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
      expect(data.aggregations.count).toBe(3)
      expect(data.aggregations.sum.budget).toBe(45_000)
      expect(data.aggregations.avg.priority).toBeCloseTo(4, 1)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-010: should return 200 with records matching formula',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with multiple fields
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: User filters by Airtable-style formula
      const response = await request.get('/api/tables/1/records', {
        params: {
          filterByFormula: "AND({status}='active', {priority}>=3)",
        },
      })

      // THEN: Returns 200 with records matching formula
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records).toHaveLength(1)
      expect(data.records[0].name).toBe('High Priority Active')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-011: should return 200 with multi-field sort applied',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with multiple sortable fields
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: User sorts by priority desc, then created_at desc
      const response = await request.get('/api/tables/1/records', {
        params: {
          sort: 'priority:desc,created_at:desc',
        },
      })

      // THEN: Returns 200 with multi-field sort applied
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records[0].priority).toBe(5)
      expect(data.records[1].priority).toBe(5)
      expect(data.records[2].priority).toBe(3)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-012: should return 200 with both view and explicit filters',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with view and additional filter
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: User combines view and explicit filter
      const response = await request.get('/api/tables/1/records', {
        params: {
          view: 'active_only',
          filter: JSON.stringify({
            operator: 'AND',
            conditions: [{ field: 'priority', operator: 'greaterThanOrEqual', value: 3 }],
          }),
        },
      })

      // THEN: Returns 200 with both view and explicit filters
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-013: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A valid table
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          { id: 12, name: 'projects', fields: [{ id: 1, name: 'name', type: 'single-line-text' }] },
        ],
      })

      // WHEN: Unauthenticated user requests records
      const response = await request.get('/api/tables/1/records')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-014: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: User without read permission
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          { id: 13, name: 'confidential', fields: [{ id: 1, name: 'data', type: 'long-text' }] },
        ],
      })

      // WHEN: User without permission requests records
      const response = await request.get('/api/tables/1/records', {})

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-015: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: User from different organization
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 14,
            name: 'employees',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
        ],
      })

      // WHEN: User attempts to list records from different org's table
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer other_org_token',
        },
      })

      // THEN: Returns 404 Not Found (don't leak existence)
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-016: should return all fields for admin',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Admin user with full field access
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: Admin requests records
      const response = await request.get('/api/tables/1/records', {})

      // THEN: Returns all fields including salary
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records[0]).toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-017: should exclude salary field for member',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Member user without salary field read permission
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: Member requests records
      const response = await request.get('/api/tables/1/records', {})

      // THEN: Returns records without salary field
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records[0]).toHaveProperty('name')
      expect(data.records[0]).toHaveProperty('email')
      expect(data.records[0]).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-018: should return minimal fields for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Viewer with limited field access
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: Viewer requests records
      const response = await request.get('/api/tables/1/records', {})

      // THEN: Returns only permitted fields
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records[0]).toHaveProperty('id')
      expect(data.records[0]).toHaveProperty('name')
      expect(data.records[0]).not.toHaveProperty('email')
      expect(data.records[0]).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-019: should auto-filter by organization',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Multi-tenant table with records from different orgs
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 18,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (name, organization_id)
        VALUES
          ('Org1 Project', 'org_123'),
          ('Org2 Project', 'org_456')
      `)

      // WHEN: User from org_123 requests records
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer org1_token',
        },
      })

      // THEN: Returns only org_123 records
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records).toHaveLength(1)
      expect(data.records[0].organization_id).toBe('org_123')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-020: should apply both org and field filtering',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Multi-tenant table with field permissions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 19,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'salary', type: 'currency', currency: 'USD' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (name, salary, organization_id)
        VALUES
          ('John Doe', 75000, 'org_123'),
          ('Jane Smith', 85000, 'org_456')
      `)

      // WHEN: Member from org_123 requests records
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_org1_token',
        },
      })

      // THEN: Returns org_123 records without salary field
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records).toHaveLength(1)
      expect(data.records[0].name).toBe('John Doe')
      expect(data.records[0]).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-021: should return empty array with 200',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: User with valid permissions but no matching records
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 20,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })

      // WHEN: User requests records (no data in their org)
      const response = await request.get('/api/tables/1/records', {})

      // THEN: Returns 200 with empty array
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records).toHaveLength(0)
      expect(data.pagination.total).toBe(0)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-022: should paginate with field filtering',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Member with field restrictions and large dataset
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: Member requests paginated records
      const response = await request.get('/api/tables/1/records', {
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
      expect(data.records[0]).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-023: should return 403 when sorting by inaccessible field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: User attempts to sort by restricted field
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: Member sorts by salary (field they cannot read)
      const response = await request.get('/api/tables/1/records', {
        params: {
          sort: 'salary:desc',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Forbidden')
      expect(data.message).toContain('Cannot sort by field')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-024: should return 403 when filtering by inaccessible field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: User attempts to filter by restricted field
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: Member filters by salary (field they cannot read)
      const response = await request.get('/api/tables/1/records', {
        params: {
          filter: JSON.stringify({
            operator: 'AND',
            conditions: [{ field: 'salary', operator: 'greaterThan', value: 60_000 }],
          }),
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Forbidden')
      expect(data.message).toContain('Cannot filter by field')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-025: should return 403 when aggregating inaccessible field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: User attempts to aggregate restricted field
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: Member aggregates salary (field they cannot read)
      const response = await request.get('/api/tables/1/records', {
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
      expect(data.error).toBe('Forbidden')
      expect(data.message).toContain('Cannot aggregate field')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-026: should return aggregations for accessible fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: User aggregates only accessible fields
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: Member aggregates permitted fields only
      const response = await request.get('/api/tables/1/records', {
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
      expect(data.aggregations.count).toBe(3)
      expect(data.aggregations.avg.priority).toBe(4)
      expect(data.aggregations.avg).not.toHaveProperty('budget')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-LIST-027: user can complete full list records workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with records and permissions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 26,
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
          ('Project A', 'active', 5),
          ('Project B', 'completed', 3),
          ('Project C', 'active', 4)
      `)

      // WHEN/THEN: List records with filtering and sorting
      const response = await request.get('/api/tables/1/records', {
        params: {
          filter: JSON.stringify({
            operator: 'AND',
            conditions: [{ field: 'status', operator: 'equals', value: 'active' }],
          }),
          sort: 'priority:desc',
        },
      })

      // THEN: assertion
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.records.length).toBeGreaterThan(0)
      expect(data).toHaveProperty('pagination')
      expect(data.records[0].priority).toBeGreaterThanOrEqual(data.records[1].priority)
    }
  )
})
