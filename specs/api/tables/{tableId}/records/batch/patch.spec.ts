/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Batch update records
 *
 * Source: specs/api/paths/tables/{tableId}/records/batch/patch.json
 * Domain: api
 * Spec Count: 16
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (16 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Batch update records', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-001: should return 200 with updated=2 and records array',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table 'users' with records ID=1 and ID=2
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true, unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
              { id: 4, name: 'updated_at', type: 'updated-at' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO users (id, email, name, status) VALUES
          (1, 'john@example.com', 'John', 'active'),
          (2, 'jane@example.com', 'Jane', 'active')
      `)

      // WHEN: Batch update both records with returnRecords=true
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            {
              id: 1,
              status: 'inactive',
            },
            {
              id: 2,
              email: 'jane.smith@example.com',
            },
          ],
          returnRecords: true,
        },
      })

      // THEN: Returns 200 with updated=2 and records array
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('updated')
      expect(data).toHaveProperty('records')
      expect(data.updated).toBe(2)
      expect(data.records).toHaveLength(2)

      // Verify database reflects updates
      const result = await executeQuery(`
        SELECT id, status, email FROM users ORDER BY id
      `)
      // THEN: assertion
      expect(result.rows[0].status).toBe('inactive')
      expect(result.rows[1].email).toBe('jane.smith@example.com')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-002: should return 200 with updated=2 and no records array',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table 'users' with records
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'users',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'status', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO users (id, name, status) VALUES
          (1, 'User One', 'active'),
          (2, 'User Two', 'active')
      `)

      // WHEN: Batch update with returnRecords=false
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, status: 'inactive' },
            { id: 2, status: 'inactive' },
          ],
          returnRecords: false,
        },
      })

      // THEN: Returns 200 with updated count only
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('updated')
      expect(data.updated).toBe(2)
      expect(data).not.toHaveProperty('records')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-003: should return 400 with rollback on validation error',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with NOT NULL constraint
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO users (id, email, name) VALUES
          (1, 'user1@example.com', 'User One'),
          (2, 'user2@example.com', 'User Two')
      `)

      // WHEN: Batch update with invalid data (setting email to NULL)
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, name: 'Updated One' },
            { id: 2, email: null },
          ],
        },
      })

      // THEN: Returns 400 with rollback
      expect(response.status()).toBe(400)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('details')

      // Verify no updates applied (rollback)
      const result = await executeQuery(`SELECT name FROM users WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].name).toBe('User One')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-004: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An unauthenticated user
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id) VALUES
          (1, 'Alice', 'org_123')
      `)

      // WHEN: User attempts batch update without auth token
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 1, name: 'Updated Alice' }],
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')

      // Verify no updates applied
      const result = await executeQuery(`SELECT name FROM employees WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].name).toBe('Alice')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-005: should return 403 for member without update permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A member user without update permission
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (id, name, organization_id) VALUES
          (1, 'Project Alpha', 'org_123')
      `)

      // WHEN: Member attempts batch update
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 1, name: 'Updated Project' }],
        },
      })

      // THEN: Returns 403 Forbidden
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
    'API-TABLES-RECORDS-BATCH-PATCH-006: should return 403 for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A viewer user with read-only access
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'documents',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO documents (id, title, organization_id) VALUES
          (1, 'Doc 1', 'org_456')
      `)

      // WHEN: Viewer attempts batch update
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 1, title: 'Updated Doc' }],
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Forbidden')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-007: should return 404 for cross-org update',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Records from different organization
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id) VALUES
          (1, 'Alice', 'org_456'),
          (2, 'Bob', 'org_123')
      `)

      // WHEN: Admin from org_123 attempts to update record from org_456
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 1, name: 'Updated Alice' }],
        },
      })

      // THEN: Returns 404 (organization isolation)
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Record not found')

      // Verify no updates applied
      const result = await executeQuery(`
        SELECT name FROM employees WHERE id=1 AND organization_id='org_456'
      `)
      // THEN: assertion
      expect(result.rows[0].name).toBe('Alice')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-008: should return 403 when updating protected field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A member user with field-level write restrictions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
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
        INSERT INTO employees (id, name, salary, organization_id) VALUES
          (1, 'Alice', 75000, 'org_123'),
          (2, 'Bob', 80000, 'org_123')
      `)

      // WHEN: Member attempts batch update with protected field
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, salary: 85_000 },
            { id: 2, salary: 90_000 },
          ],
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to write to field: salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-009: should return 403 for readonly fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with readonly fields
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
        INSERT INTO tasks (id, title) VALUES (1, 'Task 1')
      `)

      // WHEN: Admin attempts to update readonly field
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 1, created_at: '2025-01-01T00:00:00Z' }],
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe("Cannot write to readonly field 'created_at'")
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-010: should return 403 when changing organization_id',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Member attempts to change organization_id
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 10,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id) VALUES
          (1, 'Alice', 'org_123')
      `)

      // WHEN: Member updates with different organization_id
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 1, organization_id: 'org_456' }],
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('Cannot change record ownership to a different organization')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-011: should filter protected fields from response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A member user with field-level read restrictions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 11,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary, organization_id) VALUES
          (1, 'Alice', 'alice@example.com', 75000, 'org_123'),
          (2, 'Bob', 'bob@example.com', 80000, 'org_123')
      `)

      // WHEN: Member batch updates successfully
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, name: 'Alice Updated', salary: 80_000 },
            { id: 2, name: 'Bob Updated', salary: 85_000 },
          ],
          returnRecords: true,
        },
      })

      // THEN: Returns 200 with protected fields filtered from response
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.updated).toBe(2)
      expect(data.records[0].name).toBe('Alice Updated')
      expect(data.records[1].name).toBe('Bob Updated')

      // Salary field not in response
      // THEN: assertion
      expect(data.records[0]).not.toHaveProperty('salary')
      expect(data.records[1]).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-012: should return 200 with all fields for admin',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An admin user with full permissions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 12,
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
        INSERT INTO employees (id, name, salary, organization_id) VALUES
          (1, 'Charlie', 120000, 'org_789'),
          (2, 'Diana', 95000, 'org_789')
      `)

      // WHEN: Admin batch updates with all fields
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, salary: 130_000 },
            { id: 2, salary: 100_000 },
          ],
          returnRecords: true,
        },
      })

      // THEN: Returns 200 with all fields visible
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.updated).toBe(2)
      expect(data.records[0].salary).toBe(130_000)
      expect(data.records[1].salary).toBe(100_000)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-013: should enforce combined permissions',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A member with update permission but field restrictions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 13,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary, organization_id) VALUES
          (1, 'Alice', 'alice@example.com', 75000, 'org_123'),
          (2, 'Bob', 'bob@example.com', 80000, 'org_123')
      `)

      // WHEN: Member batch updates with only permitted fields
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, name: 'Alice Updated', salary: 80_000 },
            { id: 2, email: 'bob.updated@example.com', salary: 85_000 },
          ],
          returnRecords: true,
        },
      })

      // THEN: Returns 200 with field filtering applied
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.updated).toBe(2)

      // Salary field not in response
      // THEN: assertion
      expect(data.records[0]).not.toHaveProperty('salary')
      expect(data.records[1]).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-014: should update only found records',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Some records exist, others don't
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 14,
            name: 'users',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO users (id, name) VALUES (1, 'User One')
      `)

      // WHEN: Batch update includes existing and non-existing IDs
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, name: 'Updated One' },
            { id: 999, name: 'Non-existent' },
          ],
        },
      })

      // THEN: Returns 200 with partial success
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('updated')
      expect(data.updated).toBe(1)

      // Verify only existing record was updated
      const result = await executeQuery(`SELECT name FROM users WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].name).toBe('Updated One')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-015: should exclude unreadable fields from response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Member updates with field-level read restrictions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 15,
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
        INSERT INTO employees (id, name, salary, organization_id) VALUES
          (1, 'David', 72000, 'org_123')
      `)

      // WHEN: Update is successful
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 1, name: 'David Updated' }],
          returnRecords: true,
        },
      })

      // THEN: Response excludes unreadable fields
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.updated).toBe(1)
      expect(data.records[0].name).toBe('David Updated')
      expect(data.records[0]).not.toHaveProperty('salary')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-016: user can complete full batch update workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application with representative table and permission configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 16,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'email', type: 'email', required: true, unique: true },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary, organization_id) VALUES
          (1, 'John Doe', 'john@example.com', 75000, 'org_123'),
          (2, 'Jane Smith', 'jane@example.com', 80000, 'org_123'),
          (3, 'Bob Johnson', 'bob@example.com', 70000, 'org_123')
      `)

      // WHEN/THEN: Streamlined workflow testing integration points

      // Test successful batch update (admin with full access)
      const successResponse = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, name: 'John Updated' },
            { id: 2, email: 'jane.updated@example.com' },
          ],
          returnRecords: true,
        },
      })
      // THEN: assertion
      expect(successResponse.status()).toBe(200)
      const result = await successResponse.json()
      // THEN: assertion
      expect(result.updated).toBe(2)

      // Verify updates in database
      const verifyUpdate = await executeQuery(`SELECT name FROM employees WHERE id=1`)
      // THEN: assertion
      expect(verifyUpdate.rows[0].name).toBe('John Updated')

      // Test validation error with rollback
      const validationResponse = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, name: 'Valid' },
            { id: 2, email: null }, // Invalid
          ],
        },
      })
      // THEN: assertion
      expect(validationResponse.status()).toBe(400)

      // Test permission denied (member without update permission)
      const forbiddenResponse = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 3, name: 'Test' }],
        },
      })
      // THEN: assertion
      expect(forbiddenResponse.status()).toBe(403)

      // Test unauthorized
      const unauthorizedResponse = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 1, name: 'Test' }],
        },
      })
      // THEN: assertion
      expect(unauthorizedResponse.status()).toBe(401)

      // Test field-level write restriction
      const fieldForbiddenResponse = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 3, salary: 99_999 }],
        },
      })
      // THEN: assertion
      expect(fieldForbiddenResponse.status()).toBe(403)
    }
  )
})
