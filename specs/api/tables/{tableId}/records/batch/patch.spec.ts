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
 * Spec Count: 13
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (16 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Batch update records', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test(
    'API-TABLES-RECORDS-BATCH-PATCH-001: should return 200 with updated=2 and records array',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table 'users' with records ID=1 and ID=2
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
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
      await createAuthenticatedUser()

      // WHEN: Batch update both records with returnRecords=true
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            {
              id: 1,
              fields: { status: 'inactive' },
            },
            {
              id: 2,
              fields: { email: 'jane.smith@example.com' },
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

  test(
    'API-TABLES-RECORDS-BATCH-PATCH-002: should return 200 with updated=2 and no records array',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table 'users' with records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
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
      await createAuthenticatedUser()

      // WHEN: Batch update with returnRecords=false
      const response = await request.patch('/api/tables/2/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, fields: { status: 'inactive' } },
            { id: 2, fields: { status: 'inactive' } },
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

  test(
    'API-TABLES-RECORDS-BATCH-PATCH-003: should return 400 with rollback on validation error',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with NOT NULL constraint
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
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
      await createAuthenticatedUser()

      // WHEN: Batch update with invalid data (setting email to NULL)
      const response = await request.patch('/api/tables/3/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, fields: { name: 'Updated One' } },
            { id: 2, fields: { email: null } },
          ],
        },
      })

      // THEN: Returns 400 with rollback
      expect(response.status()).toBe(400)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data).toHaveProperty('details')

      // Verify no updates applied (rollback)
      const result = await executeQuery(`SELECT name FROM users WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].name).toBe('User One')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-PATCH-004: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An unauthenticated user with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 4,
            name: 'employees',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name) VALUES (1, 'Alice')
      `)

      // WHEN: User attempts batch update without auth token
      const response = await request.patch('/api/tables/4/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 1, fields: { name: 'Updated Alice' } }],
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data).toHaveProperty('message')

      // Verify no updates applied
      const result = await executeQuery(`SELECT name FROM employees WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].name).toBe('Alice')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-PATCH-005: should return 403 for member without update permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: A member user without update permission
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 5,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            permissions: {
              update: { type: 'roles', roles: ['admin'] },
            },
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (id, name) VALUES (1, 'Project Alpha')
      `)
      await createAuthenticatedMember()

      // WHEN: Member attempts batch update
      const response = await request.patch('/api/tables/5/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 1, fields: { name: 'Updated Project' } }],
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data.success).toBe(false)
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toBe('You do not have permission to update records in this table')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-PATCH-006: should return 403 for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedViewer }) => {
      // GIVEN: A viewer user with read-only access
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 6,
            name: 'documents',
            fields: [{ id: 1, name: 'title', type: 'single-line-text' }],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO documents (id, title) VALUES (1, 'Doc 1')
      `)
      await createAuthenticatedViewer()

      // WHEN: Viewer attempts batch update
      const response = await request.patch('/api/tables/6/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 1, fields: { title: 'Updated Doc' } }],
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-PATCH-007: should return 403 when updating protected field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: A member user with field-level write restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 8,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, salary) VALUES
          (1, 'Alice', 75000),
          (2, 'Bob', 80000)
      `)
      await createAuthenticatedMember()

      // WHEN: Member attempts batch update with protected field
      const response = await request.patch('/api/tables/8/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, fields: { salary: 85_000 } },
            { id: 2, fields: { salary: 90_000 } },
          ],
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data).toHaveProperty('message')
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toBe('You do not have permission to write to field: salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-008: should return 403 for readonly fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedAdmin }) => {
      // GIVEN: Table with readonly fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
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
      await createAuthenticatedAdmin()

      // WHEN: Admin attempts to update readonly field
      const response = await request.patch('/api/tables/9/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 1, fields: { created_at: '2025-01-01T00:00:00Z' } }],
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data).toHaveProperty('message')
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toBe("Cannot write to readonly field 'created_at'")
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-009: should filter protected fields from response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: A member user with field-level read restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 11,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary) VALUES
          (1, 'Alice', 'alice@example.com', 75000),
          (2, 'Bob', 'bob@example.com', 80000)
      `)
      await createAuthenticatedMember()

      // WHEN: Member batch updates successfully
      const response = await request.patch('/api/tables/11/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, fields: { name: 'Alice Updated', salary: 80_000 } },
            { id: 2, fields: { name: 'Bob Updated', salary: 85_000 } },
          ],
          returnRecords: true,
        },
      })

      // THEN: Returns 200 with protected fields filtered from response
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.updated).toBe(2)
      expect(data.records[0].fields.name).toBe('Alice Updated')
      expect(data.records[1].fields.name).toBe('Bob Updated')

      // Salary field not in response
      // THEN: assertion
      expect(data.records[0].fields).not.toHaveProperty('salary')
      expect(data.records[1].fields).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-010: should return 200 with all fields for admin',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedAdmin }) => {
      // GIVEN: An admin user with full permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 12,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, salary) VALUES
          (1, 'Charlie', 120000),
          (2, 'Diana', 95000)
      `)
      await createAuthenticatedAdmin()

      // WHEN: Admin batch updates with all fields
      const response = await request.patch('/api/tables/12/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, fields: { salary: 130_000 } },
            { id: 2, fields: { salary: 100_000 } },
          ],
          returnRecords: true,
        },
      })

      // THEN: Returns 200 with all fields visible
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.updated).toBe(2)
      expect(data.records[0].fields.salary).toBe(130_000)
      expect(data.records[1].fields.salary).toBe(100_000)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-011: should enforce combined permissions',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: A member with update permission but field restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 13,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary) VALUES
          (1, 'Alice', 'alice@example.com', 75000),
          (2, 'Bob', 'bob@example.com', 80000)
      `)
      await createAuthenticatedMember()

      // WHEN: Member batch updates with only permitted fields
      const response = await request.patch('/api/tables/13/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, fields: { name: 'Alice Updated', salary: 80_000 } },
            { id: 2, fields: { email: 'bob.updated@example.com', salary: 85_000 } },
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
      expect(data.records[0].fields).not.toHaveProperty('salary')
      expect(data.records[1].fields).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-012: should update only found records',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Some records exist, others don't
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
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
      await createAuthenticatedUser()

      // WHEN: Batch update includes existing and non-existing IDs
      const response = await request.patch('/api/tables/14/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: 1, fields: { name: 'Updated One' } },
            { id: 999, fields: { name: 'Non-existent' } },
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
    'API-TABLES-RECORDS-BATCH-PATCH-013: should exclude unreadable fields from response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: Member updates with field-level read restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 15,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, salary) VALUES (1, 'David', 72000)
      `)
      await createAuthenticatedMember()

      // WHEN: Update is successful
      const response = await request.patch('/api/tables/15/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 1, fields: { name: 'David Updated' } }],
          returnRecords: true,
        },
      })

      // THEN: Response excludes unreadable fields
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.updated).toBe(1)
      expect(data.records[0].fields.name).toBe('David Updated')
      expect(data.records[0].fields).not.toHaveProperty('salary')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-BATCH-PATCH-REGRESSION: user can complete full batch update workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // =====================================================================
      // Schema: 4 tables with permissions for update workflow testing
      // =====================================================================
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
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
          {
            id: 2,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD', default: 50_000 },
            ],
            permissions: {
              fields: [
                {
                  field: 'salary',
                  read: { type: 'roles', roles: ['admin'] },
                  write: { type: 'roles', roles: ['admin'] },
                },
              ],
            },
          },
          {
            id: 3,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            permissions: {
              update: { type: 'roles', roles: ['admin'] },
            },
          },
          {
            id: 4,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })

      // Insert test data
      await executeQuery(`
        INSERT INTO users (id, email, name, status) VALUES
          (1, 'john@example.com', 'John', 'active'),
          (2, 'jane@example.com', 'Jane', 'active'),
          (3, 'bob@example.com', 'Bob', 'active'),
          (4, 'alice@example.com', 'Alice', 'active')
      `)
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary) VALUES
          (1, 'Alice', 'alice@company.com', 75000),
          (2, 'Bob', 'bob@company.com', 80000)
      `)
      await executeQuery(`
        INSERT INTO projects (id, name) VALUES (1, 'Project Alpha')
      `)
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task 1')
      `)

      // =====================================================================
      // Step 004: 401 Unauthorized (BEFORE authentication)
      // =====================================================================
      await test.step('API-TABLES-RECORDS-BATCH-PATCH-004: Return 401 Unauthorized', async () => {
        const response = await request.patch('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ id: 1, fields: { name: 'Unauthorized Update' } }],
          },
        })

        expect(response.status()).toBe(401)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('UNAUTHORIZED')

        // Verify no updates applied
        const result = await executeQuery(`SELECT name FROM users WHERE id=1`)
        expect(result.rows[0].name).toBe('John')
      })

      // =====================================================================
      // Authenticate as member (default role)
      // =====================================================================
      await createAuthenticatedUser()

      // =====================================================================
      // Step 001: 200 with updated count and records array
      // =====================================================================
      await test.step('API-TABLES-RECORDS-BATCH-PATCH-001: Return 200 with updated=2 and records array', async () => {
        const response = await request.patch('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { id: 1, fields: { status: 'inactive' } },
              { id: 2, fields: { email: 'jane.smith@example.com' } },
            ],
            returnRecords: true,
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('updated')
        expect(data).toHaveProperty('records')
        expect(data.updated).toBe(2)
        expect(data.records).toHaveLength(2)

        // Verify database reflects updates
        const result = await executeQuery(`
          SELECT id, status, email FROM users WHERE id IN (1, 2) ORDER BY id
        `)
        expect(result.rows[0].status).toBe('inactive')
        expect(result.rows[1].email).toBe('jane.smith@example.com')
      })

      // =====================================================================
      // Step 002: 200 with updated count, no records array
      // =====================================================================
      await test.step('API-TABLES-RECORDS-BATCH-PATCH-002: Return 200 with updated=2 and no records array', async () => {
        const response = await request.patch('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { id: 1, fields: { status: 'active' } },
              { id: 2, fields: { status: 'active' } },
            ],
            returnRecords: false,
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('updated')
        expect(data.updated).toBe(2)
        expect(data).not.toHaveProperty('records')
      })

      // =====================================================================
      // Step 003: 400 validation error with rollback
      // =====================================================================
      await test.step('API-TABLES-RECORDS-BATCH-PATCH-003: Return 400 with rollback on validation error', async () => {
        const response = await request.patch('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { id: 1, fields: { name: 'Valid Update' } },
              { id: 2, fields: { email: null } },
            ],
          },
        })

        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data).toHaveProperty('code')
        expect(data).toHaveProperty('details')

        // Verify no updates applied (rollback)
        const result = await executeQuery(`SELECT name FROM users WHERE id=1`)
        expect(result.rows[0].name).toBe('John')
      })

      // =====================================================================
      // Step 005: 403 table-level update permission
      // =====================================================================
      await test.step('API-TABLES-RECORDS-BATCH-PATCH-005: Return 403 for member without update permission', async () => {
        const response = await request.patch('/api/tables/3/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ id: 1, fields: { name: 'Updated Project' } }],
          },
        })

        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('FORBIDDEN')
        expect(data.message).toBe('You do not have permission to update records in this table')
      })

      // =====================================================================
      // Step 007: 403 field-level write permission
      // =====================================================================
      await test.step('API-TABLES-RECORDS-BATCH-PATCH-007: Return 403 when updating protected field', async () => {
        const response = await request.patch('/api/tables/2/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { id: 1, fields: { salary: 85_000 } },
              { id: 2, fields: { salary: 90_000 } },
            ],
          },
        })

        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('FORBIDDEN')
        expect(data.message).toBe("Cannot write to field 'salary': insufficient permissions")
      })

      // =====================================================================
      // Step 008: 400 readonly field validation error
      // =====================================================================
      await test.step('API-TABLES-RECORDS-BATCH-PATCH-008: Return 400 for readonly fields', async () => {
        const response = await request.patch('/api/tables/4/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ id: 1, fields: { created_at: '2025-01-01T00:00:00Z' } }],
          },
        })

        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('VALIDATION_ERROR')
        expect(data.message).toBe("Cannot write to readonly field 'created_at'")
      })

      // =====================================================================
      // Step 009: 200 with protected fields filtered from response
      // =====================================================================
      await test.step('API-TABLES-RECORDS-BATCH-PATCH-009: Filter protected fields from response', async () => {
        const response = await request.patch('/api/tables/2/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { id: 1, fields: { name: 'Alice Updated' } },
              { id: 2, fields: { name: 'Bob Updated' } },
            ],
            returnRecords: true,
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.updated).toBe(2)
        expect(data.records[0].fields.name).toBe('Alice Updated')
        expect(data.records[1].fields.name).toBe('Bob Updated')

        // Salary field filtered from response (member cannot read)
        expect(data.records[0].fields).not.toHaveProperty('salary')
        expect(data.records[1].fields).not.toHaveProperty('salary')
      })

      // =====================================================================
      // Step 011: 200 with combined permissions enforcement
      // =====================================================================
      await test.step('API-TABLES-RECORDS-BATCH-PATCH-011: Enforce combined permissions', async () => {
        const response = await request.patch('/api/tables/2/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { id: 1, fields: { name: 'Alice Combined' } },
              { id: 2, fields: { email: 'bob.combined@company.com' } },
            ],
            returnRecords: true,
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.updated).toBe(2)

        // Salary field filtered from response (member cannot read)
        expect(data.records[0].fields).not.toHaveProperty('salary')
        expect(data.records[1].fields).not.toHaveProperty('salary')
      })

      // =====================================================================
      // Step 012: 200 partial success with non-existent IDs
      // =====================================================================
      await test.step('API-TABLES-RECORDS-BATCH-PATCH-012: Update only found records', async () => {
        const response = await request.patch('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { id: 1, fields: { name: 'Updated One' } },
              { id: 999, fields: { name: 'Non-existent' } },
            ],
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('updated')
        expect(data.updated).toBe(1)

        // Verify only existing record was updated
        const result = await executeQuery(`SELECT name FROM users WHERE id=1`)
        expect(result.rows[0].name).toBe('Updated One')
      })

      // =====================================================================
      // Step 013: 200 with unreadable fields excluded from response
      // =====================================================================
      await test.step('API-TABLES-RECORDS-BATCH-PATCH-013: Exclude unreadable fields from response', async () => {
        const response = await request.patch('/api/tables/2/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ id: 1, fields: { name: 'Final Update' } }],
            returnRecords: true,
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.updated).toBe(1)
        expect(data.records[0].fields.name).toBe('Final Update')
        expect(data.records[0].fields).not.toHaveProperty('salary')
      })
    }
  )
})
