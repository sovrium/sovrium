/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures.ts'

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
    async ({ request }) => {
      // GIVEN: Table 'projects' with 3 records
      // TODO: CREATE TABLE projects (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, status VARCHAR(50) DEFAULT 'active', priority INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT NOW())
      // TODO: INSERT INTO projects (name, status, priority) VALUES ('Project Alpha', 'active', 5), ('Project Beta', 'completed', 3), ('Project Gamma', 'active', 4)

      // WHEN: User requests all records
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })

      // THEN: Returns 200 with array of 3 records and pagination metadata
      expect(response.status()).toBe(200)

      const data = await response.json()
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
      const response = await request.get('/api/tables/9999/records', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Table not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-003: should return 200 with only 2 active records',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: Table with 5 records (2 active, 3 completed)
      // TODO: CREATE TABLE tasks (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, status VARCHAR(50) NOT NULL)
      // TODO: INSERT INTO tasks (name, status) VALUES ('Task 1', 'active'), ('Task 2', 'active'), ('Task 3', 'completed'), ('Task 4', 'completed'), ('Task 5', 'completed')

      // WHEN: User requests records with filter for status=active
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
        },
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
      expect(data.pagination.total).toBe(2)
      expect(data.records).toHaveLength(2)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-004: should return 200 with records in descending priority order',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: Table with 3 records having different priorities
      // TODO: CREATE TABLE projects (id SERIAL PRIMARY KEY, name VARCHAR(255), priority INTEGER)
      // TODO: INSERT INTO projects (name, priority) VALUES ('Low Priority', 1), ('High Priority', 5), ('Medium Priority', 3)

      // WHEN: User requests records sorted by priority descending
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
        },
        params: {
          sort: 'priority:desc',
        },
      })

      // THEN: Returns 200 with records in descending priority order
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records[0].priority).toBe(5)
      expect(data.records[1].priority).toBe(3)
      expect(data.records[2].priority).toBe(1)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-005: should return 200 with records containing only specified fields',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: Table with records containing 5 fields each
      // TODO: CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), phone VARCHAR(50), address TEXT, created_at TIMESTAMP)
      // TODO: INSERT INTO users (name, email, phone, address, created_at) VALUES ('John Doe', 'john@example.com', '555-0100', '123 Main St', NOW())

      // WHEN: User requests only id and name fields
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
        },
        params: {
          fields: 'id,name',
        },
      })

      // THEN: Returns 200 with records containing only specified fields
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records[0]).toHaveProperty('id')
      expect(data.records[0]).toHaveProperty('name')
      expect(data.records[0]).not.toHaveProperty('email')
      expect(data.records[0]).not.toHaveProperty('phone')
      expect(data.records[0].name).toBe('John Doe')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-006: should return 200 with records 41-60 and correct pagination',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: Table with 150 records
      // TODO: CREATE TABLE items (id SERIAL PRIMARY KEY, name VARCHAR(255))
      // TODO: INSERT INTO items (name) SELECT 'Item ' || generate_series(1, 150)

      // WHEN: User requests records with limit=20 and offset=40
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
        },
        params: {
          limit: 20,
          offset: 40,
        },
      })

      // THEN: Returns 200 with records 41-60 and correct pagination metadata
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.pagination.total).toBe(150)
      expect(data.pagination.limit).toBe(20)
      expect(data.pagination.offset).toBe(40)
      expect(data.records).toHaveLength(20)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-007: should return 200 with records filtered by view',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: Table with predefined view filtering active status
      // TODO: CREATE TABLE tasks (id SERIAL PRIMARY KEY, name VARCHAR(255), status VARCHAR(50))
      // TODO: INSERT INTO tasks (name, status) VALUES ('Task 1', 'active'), ('Task 2', 'inactive'), ('Task 3', 'active')
      // TODO: Setup view 'active_view' with filter status=active

      // WHEN: User requests records with view parameter
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
        },
        params: {
          view: 'active_view',
        },
      })

      // THEN: Returns 200 with records filtered by view configuration
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.pagination.total).toBe(2)
      expect(data.records).toHaveLength(2)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-008: should return 200 with records grouped by status',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: Table with records of different statuses
      // TODO: CREATE TABLE projects (id SERIAL PRIMARY KEY, name VARCHAR(255), status VARCHAR(50))
      // TODO: INSERT INTO projects (name, status) VALUES ('P1', 'active'), ('P2', 'active'), ('P3', 'completed'), ('P4', 'pending')

      // WHEN: User requests records grouped by status field
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
        },
        params: {
          groupBy: 'status',
        },
      })

      // THEN: Returns 200 with records grouped by distinct status values
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('records')
      expect(data).toHaveProperty('groups')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-009: should return 200 with aggregation results',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: Table with numeric budget and priority fields
      // TODO: CREATE TABLE projects (id SERIAL PRIMARY KEY, name VARCHAR(255), budget INTEGER, priority INTEGER)
      // TODO: INSERT INTO projects (name, budget, priority) VALUES ('P1', 10000, 5), ('P2', 20000, 3), ('P3', 15000, 4)

      // WHEN: User requests aggregations (count, sum, avg)
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
        },
        params: {
          aggregate: JSON.stringify({ count: true, sum: ['budget'], avg: ['priority'] }),
        },
      })

      // THEN: Returns 200 with aggregation results in response
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('aggregations')
      expect(data.aggregations.count).toBe(3)
      expect(data.aggregations.sum.budget).toBe(45000)
      expect(data.aggregations.avg.priority).toBe(4)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-010: should return 200 with records matching formula',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: Table with status and priority fields
      // TODO: CREATE TABLE tasks (id SERIAL PRIMARY KEY, name VARCHAR(255), status VARCHAR(50), priority INTEGER)
      // TODO: INSERT INTO tasks (name, status, priority) VALUES ('T1', 'active', 5), ('T2', 'active', 2), ('T3', 'completed', 5)

      // WHEN: User filters records using Airtable-style formula
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
        },
        params: {
          filterByFormula: "AND({status}='active', {priority}>=3)",
        },
      })

      // THEN: Returns 200 with records matching formula criteria
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.pagination.total).toBe(1)
      expect(data.records).toHaveLength(1)
      expect(data.records[0].name).toBe('T1')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-011: should return 200 with multi-field sort applied',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: Table with status and created_at fields
      // TODO: CREATE TABLE tasks (id SERIAL PRIMARY KEY, name VARCHAR(255), status VARCHAR(50), created_at TIMESTAMP)
      // TODO: INSERT INTO tasks (name, status, created_at) VALUES ('T1', 'active', '2025-01-01'), ('T2', 'active', '2025-01-15'), ('T3', 'completed', '2025-01-10')

      // WHEN: User sorts by status ascending, then created_at descending
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
        },
        params: {
          sort: 'status:asc,created_at:desc',
        },
      })

      // THEN: Returns 200 with records sorted by primary then secondary field
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records[0].status).toBe('active')
      expect(data.records[0].name).toBe('T2')
      expect(data.records[1].status).toBe('active')
      expect(data.records[1].name).toBe('T1')
      expect(data.records[2].status).toBe('completed')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-012: should return 200 with both view and explicit filters',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: Table with view filtering status=active and explicit priority filter
      // TODO: CREATE TABLE tasks (id SERIAL PRIMARY KEY, name VARCHAR(255), status VARCHAR(50), priority INTEGER)
      // TODO: INSERT INTO tasks (name, status, priority) VALUES ('T1', 'active', 5), ('T2', 'active', 2), ('T3', 'completed', 5)
      // TODO: Setup view 'active_view' with filter status=active

      // WHEN: User combines view parameter with filter parameter
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
        },
        params: {
          view: 'active_view',
          filter: JSON.stringify({
            operator: 'AND',
            conditions: [{ field: 'priority', operator: 'greaterThan', value: 3 }],
          }),
        },
      })

      // THEN: Returns 200 with both view and explicit filters applied (AND logic)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.pagination.total).toBe(1)
      expect(data.records).toHaveLength(1)
      expect(data.records[0].name).toBe('T1')
      expect(data.records[0].status).toBe('active')
      expect(data.records[0].priority).toBe(5)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-UNAUTHORIZED-001: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: An unauthenticated user (no Bearer token)
      // TODO: CREATE TABLE employees (id SERIAL PRIMARY KEY, name VARCHAR(255), salary DECIMAL(10,2))
      // TODO: INSERT INTO employees (name, salary) VALUES ('John Doe', 75000)

      // WHEN: User attempts to list records from a table
      const response = await request.get('/api/tables/1/records')

      // THEN: Returns 401 Unauthorized error
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-FORBIDDEN-VIEWER-001: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A viewer user without read permission for the table
      // TODO: CREATE TABLE confidential_data (id SERIAL PRIMARY KEY, data TEXT)
      // TODO: Setup viewer role with read=false permission for table

      // WHEN: User attempts to list records
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer viewer_token',
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-ORG-ISOLATION-001: should return 404 for cross-org table',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A user from organization A attempting to access table from organization B
      // TODO: CREATE TABLE projects (id SERIAL PRIMARY KEY, name VARCHAR(255), organization_id VARCHAR(255))
      // TODO: INSERT INTO projects (name, organization_id) VALUES ('Project A', 'org_456')
      // TODO: Setup admin user with organizationId='org_123'

      // WHEN: User attempts to list records from different organization's table
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
      })

      // THEN: Returns 404 Not Found (don't leak existence of other org's data)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Table not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-ORG-FILTER-001: should return only user org records',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: Multiple organizations with records in the same table
      // TODO: CREATE TABLE employees (id SERIAL PRIMARY KEY, name VARCHAR(255), organization_id VARCHAR(255))
      // TODO: INSERT INTO employees (name, organization_id) VALUES ('Alice', 'org_123'), ('Bob', 'org_123'), ('Charlie', 'org_456')
      // TODO: Setup admin user with organizationId='org_123'

      // WHEN: User lists records
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
      })

      // THEN: Returns only records belonging to user's organization
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.pagination.total).toBe(2)
      expect(data.records).toHaveLength(2)
      // TODO: Verify all records have organization_id='org_123'
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-FIELD-FILTER-ADMIN-001: should return all fields for admin',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: An admin user listing records with sensitive fields
      // TODO: CREATE TABLE employees (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), salary DECIMAL(10,2))
      // TODO: INSERT INTO employees (name, email, salary) VALUES ('John Doe', 'john@example.com', 75000), ('Jane Smith', 'jane@example.com', 85000)
      // TODO: Setup admin permissions: salary.read=true, salary.write=true

      // WHEN: Admin lists records from employees table
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
      })

      // THEN: Returns all fields including sensitive fields (salary)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(2)
      expect(data.records[0]).toHaveProperty('id')
      expect(data.records[0]).toHaveProperty('name')
      expect(data.records[0]).toHaveProperty('email')
      expect(data.records[0]).toHaveProperty('salary')
      expect(data.records[0].salary).toBe(75000)
      expect(data.records[1].salary).toBe(85000)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-FIELD-FILTER-MEMBER-001: should exclude salary for member',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A member user with field-level restrictions (salary field hidden)
      // TODO: CREATE TABLE employees (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), salary DECIMAL(10,2))
      // TODO: INSERT INTO employees (name, email, salary) VALUES ('John Doe', 'john@example.com', 75000), ('Jane Smith', 'jane@example.com', 85000)
      // TODO: Setup member permissions: salary.read=false, salary.write=false

      // WHEN: Member lists records from employees table
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_token',
        },
      })

      // THEN: Returns records with salary field excluded from response
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(2)
      expect(data.records[0]).toHaveProperty('id')
      expect(data.records[0]).toHaveProperty('name')
      expect(data.records[0]).toHaveProperty('email')
      expect(data.records[0]).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-FIELD-FILTER-VIEWER-001: should exclude multiple fields for viewer',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A viewer user with field-level restrictions (salary and email hidden)
      // TODO: CREATE TABLE employees (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), salary DECIMAL(10,2))
      // TODO: INSERT INTO employees (name, email, salary) VALUES ('John Doe', 'john@example.com', 75000)
      // TODO: Setup viewer permissions: salary.read=false, email.read=false

      // WHEN: Viewer lists records from employees table
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer viewer_token',
        },
      })

      // THEN: Returns records with sensitive fields excluded
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records[0]).toHaveProperty('id')
      expect(data.records[0]).toHaveProperty('name')
      expect(data.records[0]).not.toHaveProperty('email')
      expect(data.records[0]).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-FIELD-FILTER-MULTIPLE-001: should apply granular field filtering',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: Multiple sensitive fields with different permission levels per role
      // TODO: CREATE TABLE employees (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), phone VARCHAR(50), salary DECIMAL(10,2), ssn VARCHAR(11))
      // TODO: INSERT INTO employees (name, email, phone, salary, ssn) VALUES ('John Doe', 'john@example.com', '555-0100', 75000, '123-45-6789')
      // TODO: Setup member permissions: email.read=true, phone.read=true, salary.read=false, ssn.read=false

      // WHEN: User lists records
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_token',
        },
      })

      // THEN: Returns records with appropriate field filtering based on role
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records[0]).toHaveProperty('id')
      expect(data.records[0]).toHaveProperty('name')
      expect(data.records[0]).toHaveProperty('email')
      expect(data.records[0]).toHaveProperty('phone')
      expect(data.records[0]).not.toHaveProperty('salary')
      expect(data.records[0]).not.toHaveProperty('ssn')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-FIELD-PROJECTION-001: should combine projection with permissions',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: User requests specific fields using 'fields' query parameter
      // TODO: CREATE TABLE employees (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), salary DECIMAL(10,2))
      // TODO: INSERT INTO employees (name, email, salary) VALUES ('John Doe', 'john@example.com', 75000)
      // TODO: Setup member permissions: salary.read=false

      // WHEN: Field projection combined with permission filtering
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_token',
        },
        params: {
          fields: 'id,name,email,salary',
        },
      })

      // THEN: Returns only fields that are both requested AND permitted
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records[0]).toHaveProperty('id')
      expect(data.records[0]).toHaveProperty('name')
      expect(data.records[0]).toHaveProperty('email')
      expect(data.records[0]).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-COMBINED-001: should apply org isolation and field filtering',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: Organization isolation and field-level filtering both apply
      // TODO: CREATE TABLE employees (id SERIAL PRIMARY KEY, name VARCHAR(255), salary DECIMAL(10,2), organization_id VARCHAR(255))
      // TODO: INSERT INTO employees (name, salary, organization_id) VALUES ('Alice', 75000, 'org_123'), ('Bob', 85000, 'org_123'), ('Charlie', 95000, 'org_456')
      // TODO: Setup member permissions: salary.read=false

      // WHEN: User lists records
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_token',
        },
      })

      // THEN: Returns only own organization's records with field filtering applied
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.pagination.total).toBe(2)
      expect(data.records).toHaveLength(2)
      // TODO: Verify all records are from org_123 and salary field is hidden
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-EMPTY-RESULTS-001: should return 200 with empty array',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: User has permission to read table but no records exist in their organization
      // TODO: CREATE TABLE projects (id SERIAL PRIMARY KEY, name VARCHAR(255), organization_id VARCHAR(255))
      // TODO: INSERT INTO projects (name, organization_id) VALUES ('Project X', 'org_456')
      // TODO: Setup admin user with organizationId='org_123'

      // WHEN: User lists records
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
      })

      // THEN: Returns 200 with empty records array and total: 0
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.pagination.total).toBe(0)
      expect(data.records).toHaveLength(0)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-PAGINATION-001: should respect field filtering in pagination',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: Large dataset with field-level permissions and pagination
      // TODO: CREATE TABLE employees (id SERIAL PRIMARY KEY, name VARCHAR(255), salary DECIMAL(10,2))
      // TODO: INSERT INTO employees (name, salary) SELECT 'Employee ' || generate_series(1, 50), generate_series(50000, 99000, 1000)
      // TODO: Setup member permissions: salary.read=false

      // WHEN: User paginates through records
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_token',
        },
        params: {
          limit: 20,
          offset: 10,
        },
      })

      // THEN: All paginated results respect field-level permissions
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.pagination.total).toBe(50)
      expect(data.pagination.limit).toBe(20)
      expect(data.pagination.offset).toBe(10)
      expect(data.records).toHaveLength(20)
      // TODO: Verify all records have salary field filtered
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-SORTING-001: should return 403 when sorting by inaccessible field',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: User attempts to sort by a field they cannot read
      // TODO: CREATE TABLE employees (id SERIAL PRIMARY KEY, name VARCHAR(255), salary DECIMAL(10,2))
      // TODO: INSERT INTO employees (name, salary) VALUES ('Alice', 75000), ('Bob', 85000)
      // TODO: Setup member permissions: salary.read=false

      // WHEN: Sort parameter includes hidden field (salary)
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_token',
        },
        params: {
          sort: 'salary:desc',
        },
      })

      // THEN: Returns 403 Forbidden (cannot sort by inaccessible field)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe("Cannot sort by field 'salary': insufficient permissions")
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-FILTERING-001: should return 403 when filtering by inaccessible field',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: User attempts to filter by a field they cannot read
      // TODO: CREATE TABLE employees (id SERIAL PRIMARY KEY, name VARCHAR(255), salary DECIMAL(10,2))
      // TODO: INSERT INTO employees (name, salary) VALUES ('Alice', 75000), ('Bob', 85000)
      // TODO: Setup member permissions: salary.read=false

      // WHEN: Filter parameter includes hidden field (salary)
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_token',
        },
        params: {
          filter: JSON.stringify({
            operator: 'AND',
            conditions: [{ field: 'salary', operator: 'greaterThan', value: 70000 }],
          }),
        },
      })

      // THEN: Returns 403 Forbidden (cannot filter by inaccessible field)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe("Cannot filter by field 'salary': insufficient permissions")
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-AGGREGATE-001: should return 403 when aggregating inaccessible field',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: User attempts to aggregate field they cannot read
      // TODO: CREATE TABLE employees (id SERIAL PRIMARY KEY, name VARCHAR(255), salary DECIMAL(10,2))
      // TODO: INSERT INTO employees (name, salary) VALUES ('Alice', 75000), ('Bob', 85000)
      // TODO: Setup member permissions: salary.read=false

      // WHEN: Aggregate parameter includes hidden field (salary)
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_token',
        },
        params: {
          aggregate: JSON.stringify({ avg: ['salary'] }),
        },
      })

      // THEN: Returns 403 Forbidden (cannot aggregate inaccessible field)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe("Cannot aggregate field 'salary': insufficient permissions")
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-LIST-PERMISSIONS-AGGREGATE-ALLOWED-001: should return aggregations for accessible fields',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: User aggregates only accessible fields
      // TODO: CREATE TABLE projects (id SERIAL PRIMARY KEY, name VARCHAR(255), priority INTEGER, budget DECIMAL(10,2))
      // TODO: INSERT INTO projects (name, priority, budget) VALUES ('P1', 5, 10000), ('P2', 3, 20000), ('P3', 4, 15000)
      // TODO: Setup member permissions: priority.read=true, budget.read=false

      // WHEN: Aggregate parameter includes only permitted fields
      const response = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_token',
        },
        params: {
          aggregate: JSON.stringify({ count: true, avg: ['priority'] }),
        },
      })

      // THEN: Returns aggregation results for accessible fields
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('aggregations')
      expect(data.aggregations.count).toBe(3)
      expect(data.aggregations.avg.priority).toBe(4)
      expect(data.aggregations.avg).not.toHaveProperty('budget')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'user can complete full record listing workflow',
    { tag: '@regression' },
    async ({ request }) => {
      // GIVEN: Application with representative table and permission configuration
      // TODO: Setup employees table with various roles, field restrictions, org isolation

      // WHEN/THEN: Streamlined workflow testing integration points
      // Test successful list with pagination
      const listResponse = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
        params: {
          limit: 10,
          offset: 0,
        },
      })
      expect(listResponse.status()).toBe(200)
      const listData = await listResponse.json()
      expect(listData).toHaveProperty('records')
      expect(listData).toHaveProperty('pagination')

      // Test filtering
      const filterResponse = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
        params: {
          filter: JSON.stringify({
            operator: 'AND',
            conditions: [{ field: 'status', operator: 'equals', value: 'active' }],
          }),
        },
      })
      expect(filterResponse.status()).toBe(200)

      // Test sorting
      const sortResponse = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
        params: {
          sort: 'priority:desc',
        },
      })
      expect(sortResponse.status()).toBe(200)

      // Test field projection
      const projectionResponse = await request.get('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
        params: {
          fields: 'id,name',
        },
      })
      expect(projectionResponse.status()).toBe(200)

      // Test unauthorized
      const unauthorizedResponse = await request.get('/api/tables/1/records')
      expect(unauthorizedResponse.status()).toBe(401)

      // Test table not found
      const notFoundResponse = await request.get('/api/tables/9999/records', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
      })
      expect(notFoundResponse.status()).toBe(404)
    }
  )
})
