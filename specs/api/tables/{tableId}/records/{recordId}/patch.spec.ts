/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Update record
 *
 * Source: specs/api/paths/tables/{tableId}/records/{recordId}/patch.json
 * Domain: api
 * Spec Count: 14
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (14 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Update record', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-001: should return 200 with updated record data',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table 'users' with record ID=1 (email='old@example.com', name='Old Name')
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true, unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'updated_at', type: 'updated-at' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO users (id, email, name)
        VALUES (1, 'old@example.com', 'Old Name')
      `)

      // WHEN: User updates record with new email and name
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          email: 'new@example.com',
          name: 'New Name',
        },
      })

      // THEN: Returns 200 with updated record and database reflects changes
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('email')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('updated_at')
      expect(data.id).toBe(1)
      expect(data.email).toBe('new@example.com')
      expect(data.name).toBe('New Name')

      // Verify database reflects updated values
      const result = await executeQuery(`SELECT email, name FROM users WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].email).toBe('new@example.com')
      expect(result.rows[0].name).toBe('New Name')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-002: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Table 'users' exists but record ID=9999 does not
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'users',
            fields: [{ id: 1, name: 'email', type: 'email', required: true }],
          },
        ],
      })

      // WHEN: User attempts to update non-existent record
      const response = await request.patch('/api/tables/1/records/9999', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          email: 'test@example.com',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Record not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An unauthenticated user (no Bearer token)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text' }],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Original Title')
      `)

      // WHEN: User attempts to update a record without auth token
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          title: 'Updated Title',
        },
      })

      // THEN: Returns 401 Unauthorized error
      expect(response.status()).toBe(401)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Unauthorized')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-004: should return 403 for member without update permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A member user without update permission for the table
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (id, name) VALUES (1, 'Alpha Project')
      `)

      // WHEN: Member attempts to update a record
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Beta Project',
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to update records in this table')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-005: should return 403 for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A viewer user without update permission
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'documents',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'content', type: 'long-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO documents (id, title, content) VALUES (1, 'Doc 1', 'Content')
      `)

      // WHEN: Viewer attempts to update a record
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          title: 'Modified Title',
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Forbidden')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-006: should return 404 for cross-org access',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A user from organization A attempting to update record from organization B
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id)
        VALUES (1, 'Alice', 'org_456')
      `)

      // WHEN: User attempts to update record in different organization
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Bob',
        },
      })

      // THEN: Returns 404 Not Found (don't leak existence)
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Record not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-007: should allow admin to update sensitive fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An admin user with write access to all fields including sensitive
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, salary) VALUES (1, 'John Doe', 75000)
      `)

      // WHEN: Admin updates record with sensitive field (salary)
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          salary: 85_000,
        },
      })

      // THEN: Returns 200 with updated record including salary
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('salary')
      expect(data.id).toBe(1)
      expect(data.salary).toBe(85_000)

      // Verify database reflects updated salary
      const result = await executeQuery(`SELECT salary FROM employees WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].salary).toBe(85_000)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-008: should return 403 when updating protected field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A member user attempting to update write-protected field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
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
        VALUES (1, 'Jane Smith', 'jane@example.com', 75000)
      `)

      // WHEN: Member includes salary field in update request
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Jane Updated',
          salary: 95_000,
        },
      })

      // THEN: Returns 403 Forbidden (cannot write to protected field)
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('field')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe("Cannot write to field 'salary': insufficient permissions")
      expect(data.field).toBe('salary')

      // Verify database unchanged (salary still 75000)
      const result = await executeQuery(`SELECT salary FROM employees WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].salary).toBe(75_000)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-009: should return 403 for readonly fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: User attempts to update system-managed readonly fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 9,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Important Task')
      `)

      // WHEN: Update request includes id or created_at fields
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          id: 999,
          title: 'Modified Task',
          created_at: '2025-01-01T00:00:00Z',
        },
      })

      // THEN: Returns 403 Forbidden (cannot write to readonly fields)
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe("Cannot write to readonly field 'id'")
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-010: should update only permitted fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Member user updates only permitted fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 10,
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
        VALUES (1, 'Alice Cooper', 'alice@example.com', 75000)
      `)

      // WHEN: Update request includes both permitted and omitted fields
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Alice Updated',
          email: 'alice.updated@example.com',
        },
      })

      // THEN: Returns 200 with permitted fields updated, protected fields unchanged
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('email')
      expect(data.id).toBe(1)
      expect(data.name).toBe('Alice Updated')
      expect(data.email).toBe('alice.updated@example.com')

      // Salary field not in response (member cannot read it)
      // THEN: assertion
      expect(data).not.toHaveProperty('salary')

      // Verify salary remains unchanged in database
      const result = await executeQuery(`SELECT salary FROM employees WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].salary).toBe(75_000)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-011: should return 403 when changing organization_id',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: User attempts to change record's organization_id
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 11,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (id, name, organization_id)
        VALUES (1, 'Alpha', 'org_123')
      `)

      // WHEN: Update body includes organization_id different from user's org
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Beta',
          organization_id: 'org_456',
        },
      })

      // THEN: Returns 403 Forbidden (cannot change organization ownership)
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('Cannot change record ownership to a different organization')

      // Verify organization ID unchanged in database
      const result = await executeQuery(`SELECT organization_id FROM projects WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].organization_id).toBe('org_123')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-012: should enforce combined permissions',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Organization isolation, field write restrictions, and table permission all apply
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 12,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email', required: true },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary, organization_id)
        VALUES (1, 'Bob Wilson', 'bob@example.com', 65000, 'org_123')
      `)

      // WHEN: Member updates record with only permitted fields in their org
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Bob Updated',
          email: 'bob.updated@example.com',
        },
      })

      // THEN: Returns 200 with updated permitted fields, org_id unchanged
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('email')
      expect(data).toHaveProperty('organization_id')
      expect(data.id).toBe(1)
      expect(data.name).toBe('Bob Updated')
      expect(data.email).toBe('bob.updated@example.com')
      expect(data.organization_id).toBe('org_123')

      // Salary field not in response
      // THEN: assertion
      expect(data).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-013: should return 403 for first forbidden field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Multiple fields with different write permission levels
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 13,
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
        VALUES (1, 'Carol Davis', 'carol@example.com', '555-0100', 70000)
      `)

      // WHEN: User updates with mix of permitted and forbidden fields
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Carol Updated',
          phone: '555-9999',
          salary: 80_000,
        },
      })

      // THEN: Returns 403 for first forbidden field encountered
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('field')

      // Verify database unchanged due to failed update
      const result = await executeQuery(`
        SELECT name, phone, salary FROM employees WHERE id=1
      `)
      // THEN: assertion
      expect(result.rows[0].name).toBe('Carol Davis')
      expect(result.rows[0].phone).toBe('555-0100')
      expect(result.rows[0].salary).toBe(70_000)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-014: should exclude unreadable fields from response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Member updates record and has field-level read restrictions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 14,
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
        VALUES (1, 'David Lee', 'david@example.com', 72000)
      `)

      // WHEN: Update is successful
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'David Updated',
        },
      })

      // THEN: Response excludes fields member cannot read (even if they exist in DB)
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('email')
      expect(data.name).toBe('David Updated')

      // Salary field not in response despite existing in database
      // THEN: assertion
      expect(data).not.toHaveProperty('salary')

      // Verify database has salary field unchanged
      const result = await executeQuery(`SELECT salary FROM employees WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].salary).toBe(72_000)
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-015: user can complete full record update workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application with representative table and permission configuration
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
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary, organization_id) VALUES
          (1, 'Admin User', 'admin@example.com', 90000, 'org_123'),
          (2, 'Member User', 'member@example.com', 60000, 'org_123'),
          (3, 'Member Update', 'update@example.com', 65000, 'org_123')
      `)

      // WHEN/THEN: Streamlined workflow testing integration points

      // Test successful update (admin with full access)
      const successResponse = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Updated Name',
          email: 'updated@example.com',
        },
      })
      // THEN: assertion
      expect(successResponse.status()).toBe(200)
      const record = await successResponse.json()
      // THEN: assertion
      expect(record.name).toBe('Updated Name')

      // Verify update in database
      const verifyUpdate = await executeQuery(`SELECT name FROM employees WHERE id=1`)
      // THEN: assertion
      expect(verifyUpdate.rows[0].name).toBe('Updated Name')

      // Test record not found
      const notFoundResponse = await request.patch('/api/tables/1/records/9999', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Test',
        },
      })
      // THEN: assertion
      expect(notFoundResponse.status()).toBe(404)

      // Test permission denied (member without update permission)
      const forbiddenResponse = await request.patch('/api/tables/1/records/2', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Unauthorized Update',
        },
      })
      // THEN: assertion
      expect(forbiddenResponse.status()).toBe(403)

      // Test unauthorized
      const unauthorizedResponse = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Test',
        },
      })
      // THEN: assertion
      expect(unauthorizedResponse.status()).toBe(401)

      // Test field-level write restriction (member trying to update salary)
      const fieldForbiddenResponse = await request.patch('/api/tables/1/records/3', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          salary: 99_999,
        },
      })
      // THEN: assertion
      expect(fieldForbiddenResponse.status()).toBe(403)
    }
  )
})
