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
 * Spec Count: 15
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (16 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Update record', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test(
    'API-TABLES-RECORDS-UPDATE-001: should return 200 with updated record data',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table 'users' with record ID=1 (email='old@example.com', name='Old Name')
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // Create authenticated user
      await createAuthenticatedUser()

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
      expect(data.fields).toHaveProperty('email')
      expect(data.fields).toHaveProperty('name')
      expect(data.fields).toHaveProperty('updated_at')
      expect(data.id).toBe(1)
      expect(data.fields.email).toBe('new@example.com')
      expect(data.fields.name).toBe('New Name')

      // Verify database reflects updated values
      const result = await executeQuery(`SELECT email, name FROM users WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].email).toBe('new@example.com')
      expect(result.rows[0].name).toBe('New Name')
    }
  )

  test(
    'API-TABLES-RECORDS-UPDATE-002: should return 404 Not Found',
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

      // WHEN: User attempts to update non-existent record
      const response = await request.patch('/api/tables/2/records/9999', {
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

  test(
    'API-TABLES-RECORDS-UPDATE-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An unauthenticated user (no Bearer token) with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
      const response = await request.patch('/api/tables/3/records/1', {
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
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: A member user without update permission for the table
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // Create authenticated member (without update permission)
      await createAuthenticatedMember()

      // WHEN: Member attempts to update a record
      const response = await request.patch('/api/tables/4/records/1', {
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
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedViewer }) => {
      // GIVEN: A viewer user without update permission
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // Create authenticated viewer (no update permission)
      await createAuthenticatedViewer()

      // WHEN: Viewer attempts to update a record
      const response = await request.patch('/api/tables/5/records/1', {
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
    'API-TABLES-RECORDS-UPDATE-006: should allow admin to update sensitive fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedAdmin }) => {
      // GIVEN: An admin user with write access to all fields including sensitive
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // Create authenticated admin (full field access)
      await createAuthenticatedAdmin()

      // WHEN: Admin updates record with sensitive field (salary)
      const response = await request.patch('/api/tables/7/records/1', {
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
      expect(data.fields).toHaveProperty('salary')
      expect(data.id).toBe(1)
      expect(data.fields.salary).toBe(85_000)

      // Verify database reflects updated salary
      const result = await executeQuery(`SELECT salary FROM employees WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].salary).toBe(85_000)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-007: should return 403 when updating protected field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: A member user attempting to update write-protected field
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
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, email, salary)
        VALUES (1, 'Jane Smith', 'jane@example.com', 75000)
      `)

      // Create authenticated member (limited field permissions)
      await createAuthenticatedMember()

      // WHEN: Member includes salary field in update request
      const response = await request.patch('/api/tables/8/records/1', {
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
    'API-TABLES-RECORDS-UPDATE-008: should return 403 for readonly fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: User attempts to update system-managed readonly fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: Update request includes id or created_at fields
      const response = await request.patch('/api/tables/9/records/1', {
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
    'API-TABLES-RECORDS-UPDATE-009: should update only permitted fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: Member user updates only permitted fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // Create authenticated member (limited permissions)
      await createAuthenticatedMember()

      // WHEN: Update request includes both permitted and omitted fields
      const response = await request.patch('/api/tables/10/records/1', {
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
      expect(data.fields).toHaveProperty('name')
      expect(data.fields).toHaveProperty('email')
      expect(data.id).toBe(1)
      expect(data.fields.name).toBe('Alice Updated')
      expect(data.fields.email).toBe('alice.updated@example.com')

      // Salary field not in response (member cannot read it)
      // THEN: assertion
      expect(data.fields).not.toHaveProperty('salary')

      // Verify salary remains unchanged in database
      const result = await executeQuery(`SELECT salary FROM employees WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].salary).toBe(75_000)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-010: should enforce combined permissions',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: Field write restrictions and table permission apply
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 12,
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
        VALUES (1, 'Bob Wilson', 'bob@example.com', 65000)
      `)

      // Create authenticated member (combined permissions test)
      await createAuthenticatedMember()

      // WHEN: Member updates record with only permitted fields
      const response = await request.patch('/api/tables/12/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Bob Updated',
          email: 'bob.updated@example.com',
        },
      })

      // THEN: Returns 200 with updated permitted fields
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data.fields).toHaveProperty('name')
      expect(data.fields).toHaveProperty('email')
      expect(data.id).toBe(1)
      expect(data.fields.name).toBe('Bob Updated')
      expect(data.fields.email).toBe('bob.updated@example.com')

      // Salary field not in response
      // THEN: assertion
      expect(data.fields).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-011: should return 403 for first forbidden field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: Multiple fields with different write permission levels
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // Create authenticated member (testing forbidden field access)
      await createAuthenticatedMember()

      // WHEN: User updates with mix of permitted and forbidden fields
      const response = await request.patch('/api/tables/13/records/1', {
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
    'API-TABLES-RECORDS-UPDATE-012: should exclude unreadable fields from response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: Member updates record and has field-level read restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // Create authenticated member (testing read restrictions in response)
      await createAuthenticatedMember()

      // WHEN: Update is successful
      const response = await request.patch('/api/tables/14/records/1', {
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
      expect(data.fields).toHaveProperty('name')
      expect(data.fields).toHaveProperty('email')
      expect(data.fields.name).toBe('David Updated')

      // Salary field not in response despite existing in database
      // THEN: assertion
      expect(data.fields).not.toHaveProperty('salary')

      // Verify database has salary field unchanged
      const result = await executeQuery(`SELECT salary FROM employees WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].salary).toBe(72_000)
    }
  )

  // ============================================================================
  // Activity Log Tests
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-013: should create activity log entry when record is updated',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Application with auth and activity logging configured
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 15,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'autonumber', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
              { id: 3, name: 'status', type: 'single-line-text' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({ email: 'user@example.com' })

      await executeQuery(`
        INSERT INTO tasks (id, title, status)
        VALUES (1, 'Original Title', 'pending')
      `)

      // WHEN: User updates the record
      const response = await request.patch('/api/tables/15/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          title: 'Updated Title',
          status: 'completed',
        },
      })

      expect(response.status()).toBe(200)

      // THEN: Activity log entry is created with before and after values
      const logs = await executeQuery(`
        SELECT * FROM system.activity_logs
        WHERE table_name = 'tasks' AND action = 'update' AND record_id = '1'
        ORDER BY created_at DESC
        LIMIT 1
      `)

      expect(logs.rows).toHaveLength(1)
      const log = logs.rows[0]
      expect(log.action).toBe('update')
      expect(log.user_id).toBe(user.id)
      expect(log.table_id).toBe('1')
      expect(log.record_id).toBe('1')

      // Parse and verify changes field
      const changes = JSON.parse(log.changes)
      expect(changes.before.title).toBe('Original Title')
      expect(changes.before.status).toBe('pending')
      expect(changes.after.title).toBe('Updated Title')
      expect(changes.after.status).toBe('completed')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-014: should only log changed fields in activity log',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Record with multiple fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 16,
            name: 'contacts',
            fields: [
              { id: 1, name: 'id', type: 'autonumber', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'email', type: 'email', required: true },
              { id: 4, name: 'phone', type: 'phone-number' },
            ],
          },
        ],
      })

      await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO contacts (id, name, email, phone)
        VALUES (1, 'John Doe', 'john@example.com', '555-1234')
      `)

      // WHEN: User updates only some fields
      const response = await request.patch('/api/tables/16/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Jane Doe',
        },
      })

      expect(response.status()).toBe(200)

      // THEN: Activity log captures only changed fields
      const logs = await executeQuery(`
        SELECT changes FROM system.activity_logs
        WHERE table_name = 'contacts' AND action = 'update' AND record_id = '1'
        ORDER BY created_at DESC
        LIMIT 1
      `)

      const changes = JSON.parse(logs.rows[0].changes)
      expect(changes.before.name).toBe('John Doe')
      expect(changes.after.name).toBe('Jane Doe')

      // Unchanged fields should still be logged for context
      expect(changes.after.email).toBe('john@example.com')
      expect(changes.after.phone).toBe('555-1234')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-015: should capture user_id who made the update',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Two different users in the system
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 17,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'autonumber', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
            ],
          },
        ],
      })

      const { user: user1 } = await createAuthenticatedUser({
        email: 'user1@example.com',
      })

      await executeQuery(`
        INSERT INTO items (id, name) VALUES (1, 'Item A')
      `)

      // WHEN: User1 updates the record
      const response = await request.patch('/api/tables/17/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Item B',
        },
      })

      expect(response.status()).toBe(200)

      // THEN: Activity log correctly attributes update to user1
      const logs = await executeQuery(`
        SELECT user_id FROM system.activity_logs
        WHERE table_name = 'items' AND action = 'update' AND record_id = '1'
        ORDER BY created_at DESC
        LIMIT 1
      `)

      expect(logs.rows[0].user_id).toBe(user1.id)
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-UPDATE-REGRESSION: user can complete full record update workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Consolidated configuration from all @spec tests
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'created_at', type: 'created-at' },
            ],
          },
          {
            id: 3,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email', required: true },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
              { id: 4, name: 'phone', type: 'phone-number' },
            ],
          },
          {
            id: 4,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
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

      // Setup test data
      await executeQuery(`
        INSERT INTO users (id, email, name) VALUES (1, 'old@example.com', 'Old Name');
        INSERT INTO tasks (id, title) VALUES (1, 'Important Task'), (2, 'Original Title');
        INSERT INTO employees (id, name, email, salary, phone) VALUES
          (1, 'John Doe', 'john@example.com', 75000, '555-0100'),
          (2, 'Jane Smith', 'jane@example.com', 75000, NULL),
          (3, 'Alice Cooper', 'alice@example.com', 75000, NULL),
          (4, 'Bob Wilson', 'bob@example.com', 65000, NULL),
          (5, 'Carol Davis', 'carol@example.com', 70000, '555-0100'),
          (6, 'David Lee', 'david@example.com', 72000, NULL),
          (7, 'Alice B', 'alice.b@example.com', 60000, NULL);
        INSERT INTO projects (id, name) VALUES
          (1, 'Alpha'),
          (2, 'Alpha Project');
        INSERT INTO documents (id, title, content) VALUES (1, 'Doc 1', 'Content');
      `)

      await test.step('API-TABLES-RECORDS-UPDATE-001: should return 200 with updated record data', async () => {
        const response = await request.patch('/api/tables/1/records/1', {
          headers: { 'Content-Type': 'application/json' },
          data: { email: 'new@example.com', name: 'New Name' },
        })

        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data).toHaveProperty('id')
        expect(data.fields).toHaveProperty('email')
        expect(data.fields).toHaveProperty('name')
        expect(data.fields).toHaveProperty('updated_at')
        expect(data.id).toBe(1)
        expect(data.fields.email).toBe('new@example.com')
        expect(data.fields.name).toBe('New Name')

        const result = await executeQuery(`SELECT email, name FROM users WHERE id=1`)
        expect(result.rows[0].email).toBe('new@example.com')
        expect(result.rows[0].name).toBe('New Name')
      })

      await test.step('API-TABLES-RECORDS-UPDATE-002: should return 404 Not Found', async () => {
        const response = await request.patch('/api/tables/1/records/9999', {
          headers: { 'Content-Type': 'application/json' },
          data: { email: 'test@example.com' },
        })

        expect(response.status()).toBe(404)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toBe('Record not found')
      })

      await test.step('API-TABLES-RECORDS-UPDATE-003: should return 401 Unauthorized', async () => {
        // This test requires unauthenticated request - skip in regression
        // as regression uses authenticated context throughout
      })

      await test.step('API-TABLES-RECORDS-UPDATE-004: should return 403 for member without update permission', async () => {
        const response = await request.patch('/api/tables/4/records/2', {
          headers: { 'Content-Type': 'application/json' },
          data: { name: 'Beta Project' },
        })

        expect(response.status()).toBe(403)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data).toHaveProperty('message')
        expect(data.error).toBe('Forbidden')
        expect(data.message).toBe('You do not have permission to update records in this table')
      })

      await test.step('API-TABLES-RECORDS-UPDATE-005: should return 403 for viewer', async () => {
        const response = await request.patch('/api/tables/5/records/1', {
          headers: { 'Content-Type': 'application/json' },
          data: { title: 'Modified Title' },
        })

        expect(response.status()).toBe(403)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toBe('Forbidden')
      })

      await test.step('API-TABLES-RECORDS-UPDATE-006: should allow admin to update sensitive fields', async () => {
        const response = await request.patch('/api/tables/3/records/1', {
          headers: { 'Content-Type': 'application/json' },
          data: { salary: 85_000 },
        })

        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data).toHaveProperty('id')
        expect(data.fields).toHaveProperty('salary')
        expect(data.id).toBe(1)
        expect(data.fields.salary).toBe(85_000)

        const result = await executeQuery(`SELECT salary FROM employees WHERE id=1`)
        expect(result.rows[0].salary).toBe(85_000)
      })

      await test.step('API-TABLES-RECORDS-UPDATE-007: should return 403 when updating protected field', async () => {
        const response = await request.patch('/api/tables/3/records/2', {
          headers: { 'Content-Type': 'application/json' },
          data: { name: 'Jane Updated', salary: 95_000 },
        })

        expect(response.status()).toBe(403)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('field')
        expect(data.error).toBe('Forbidden')
        expect(data.message).toBe("Cannot write to field 'salary': insufficient permissions")
        expect(data.field).toBe('salary')

        const result = await executeQuery(`SELECT salary FROM employees WHERE id=2`)
        expect(result.rows[0].salary).toBe(75_000)
      })

      await test.step('API-TABLES-RECORDS-UPDATE-008: should return 403 for readonly fields', async () => {
        const response = await request.patch('/api/tables/2/records/1', {
          headers: { 'Content-Type': 'application/json' },
          data: { id: 999, title: 'Modified Task', created_at: '2025-01-01T00:00:00Z' },
        })

        expect(response.status()).toBe(403)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data).toHaveProperty('message')
        expect(data.error).toBe('Forbidden')
        expect(data.message).toBe("Cannot write to readonly field 'id'")
      })

      await test.step('API-TABLES-RECORDS-UPDATE-009: should update only permitted fields', async () => {
        const response = await request.patch('/api/tables/3/records/3', {
          headers: { 'Content-Type': 'application/json' },
          data: { name: 'Alice Updated', email: 'alice.updated@example.com' },
        })

        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data).toHaveProperty('id')
        expect(data.fields).toHaveProperty('name')
        expect(data.fields).toHaveProperty('email')
        expect(data.id).toBe(3)
        expect(data.fields.name).toBe('Alice Updated')
        expect(data.fields.email).toBe('alice.updated@example.com')
        expect(data.fields).not.toHaveProperty('salary')

        const result = await executeQuery(`SELECT salary FROM employees WHERE id=3`)
        expect(result.rows[0].salary).toBe(75_000)
      })

      await test.step('API-TABLES-RECORDS-UPDATE-010: should enforce combined permissions', async () => {
        const response = await request.patch('/api/tables/3/records/4', {
          headers: { 'Content-Type': 'application/json' },
          data: { name: 'Bob Updated', email: 'bob.updated@example.com' },
        })

        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data).toHaveProperty('id')
        expect(data.fields).toHaveProperty('name')
        expect(data.fields).toHaveProperty('email')
        expect(data.id).toBe(4)
        expect(data.fields.name).toBe('Bob Updated')
        expect(data.fields.email).toBe('bob.updated@example.com')
        expect(data.fields).not.toHaveProperty('salary')
      })

      await test.step('API-TABLES-RECORDS-UPDATE-011: should return 403 for first forbidden field', async () => {
        const response = await request.patch('/api/tables/3/records/5', {
          headers: { 'Content-Type': 'application/json' },
          data: { name: 'Carol Updated', phone: '555-9999', salary: 80_000 },
        })

        expect(response.status()).toBe(403)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('field')

        const result = await executeQuery(`SELECT name, phone, salary FROM employees WHERE id=5`)
        expect(result.rows[0].name).toBe('Carol Davis')
        expect(result.rows[0].phone).toBe('555-0100')
        expect(result.rows[0].salary).toBe(70_000)
      })

      await test.step('API-TABLES-RECORDS-UPDATE-012: should exclude unreadable fields from response', async () => {
        const response = await request.patch('/api/tables/3/records/6', {
          headers: { 'Content-Type': 'application/json' },
          data: { name: 'David Updated' },
        })

        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data).toHaveProperty('id')
        expect(data.fields).toHaveProperty('name')
        expect(data.fields).toHaveProperty('email')
        expect(data.fields.name).toBe('David Updated')
        expect(data.fields).not.toHaveProperty('salary')

        const result = await executeQuery(`SELECT salary FROM employees WHERE id=6`)
        expect(result.rows[0].salary).toBe(72_000)
      })

      // Activity Log Tests (015-017) require authenticated user context
      const { user } = await createAuthenticatedUser({ email: 'logger@example.com' })

      await test.step('API-TABLES-RECORDS-UPDATE-013: should create activity log entry when record is updated', async () => {
        const response = await request.patch('/api/tables/2/records/2', {
          headers: { 'Content-Type': 'application/json' },
          data: { title: 'Updated Title' },
        })

        expect(response.status()).toBe(200)

        const logs = await executeQuery(`
          SELECT * FROM system.activity_logs
          WHERE table_name = 'tasks' AND action = 'update' AND record_id = '2'
          ORDER BY created_at DESC
          LIMIT 1
        `)

        expect(logs.rows).toHaveLength(1)
        const log = logs.rows[0]
        expect(log.action).toBe('update')
        expect(log.user_id).toBe(user.id)
        expect(log.table_id).toBe('2')
        expect(log.record_id).toBe('2')

        const changes = JSON.parse(log.changes)
        expect(changes.before.title).toBe('Original Title')
        expect(changes.after.title).toBe('Updated Title')
      })

      await test.step('API-TABLES-RECORDS-UPDATE-014: should only log changed fields in activity log', async () => {
        // Reset data for this test
        await executeQuery(`
          INSERT INTO employees (id, name, email, phone, salary)
          VALUES (100, 'John Doe', 'john.log@example.com', '555-1234', 50000)
          ON CONFLICT (id) DO UPDATE SET name = 'John Doe', email = 'john.log@example.com', phone = '555-1234'
        `)

        const response = await request.patch('/api/tables/3/records/100', {
          headers: { 'Content-Type': 'application/json' },
          data: { name: 'Jane Doe' },
        })

        expect(response.status()).toBe(200)

        const logs = await executeQuery(`
          SELECT changes FROM system.activity_logs
          WHERE table_name = 'employees' AND action = 'update' AND record_id = '100'
          ORDER BY created_at DESC
          LIMIT 1
        `)

        const changes = JSON.parse(logs.rows[0].changes)
        expect(changes.before.name).toBe('John Doe')
        expect(changes.after.name).toBe('Jane Doe')
        expect(changes.after.email).toBe('john.log@example.com')
        expect(changes.after.phone).toBe('555-1234')
      })

      await test.step('API-TABLES-RECORDS-UPDATE-015: should capture user_id who made the update', async () => {
        await executeQuery(`
          INSERT INTO tasks (id, title) VALUES (100, 'Item A')
          ON CONFLICT (id) DO UPDATE SET title = 'Item A'
        `)

        const response = await request.patch('/api/tables/2/records/100', {
          headers: { 'Content-Type': 'application/json' },
          data: { title: 'Item B' },
        })

        expect(response.status()).toBe(200)

        const logs = await executeQuery(`
          SELECT user_id FROM system.activity_logs
          WHERE table_name = 'tasks' AND action = 'update' AND record_id = '100'
          ORDER BY created_at DESC
          LIMIT 1
        `)

        expect(logs.rows[0].user_id).toBe(user.id)
      })
    }
  )
})
