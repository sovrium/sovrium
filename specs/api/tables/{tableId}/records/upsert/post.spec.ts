/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Upsert records (create or update)
 *
 * Source: specs/api/paths/tables/{tableId}/records/upsert/post.json
 * Domain: api
 * Spec Count: 13
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (13 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Upsert records (create or update)', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test(
    'API-TABLES-RECORDS-UPSERT-001: should return 200 with created=1, updated=1',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table 'users' with existing record (email='john@example.com', name='John')
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
            ],
          },
        ],
      })

      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO users (email, name, status)
        VALUES ('john@example.com', 'John', 'active')
      `)

      // WHEN: Upsert with fieldsToMergeOn=['email'] - 1 existing match, 1 new record
      const response = await request.post('/api/tables/1/records/upsert', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            {
              email: 'john@example.com',
              name: 'John Updated',
              status: 'active',
            },
            {
              email: 'jane@example.com',
              name: 'Jane Smith',
              status: 'active',
            },
          ],
          fieldsToMergeOn: ['email'],
          returnRecords: true,
        },
      })

      // THEN: Returns 200 with created=1, updated=1, and records array
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('created')
      expect(data).toHaveProperty('updated')
      expect(data).toHaveProperty('records')
      expect(data.created).toBe(1)
      expect(data.updated).toBe(1)
      expect(data.records).toHaveLength(2)

      // Verify database contains both records with correct data
      const result = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      // THEN: assertion
      expect(result.rows[0].count).toBe('2')
    }
  )

  test(
    'API-TABLES-RECORDS-UPSERT-002: should return 200 with created=2, updated=0',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table 'users' with 0 records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 2,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true, unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: Upsert with fieldsToMergeOn=['email'] - both records are new
      const response = await request.post('/api/tables/2/records/upsert', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            {
              email: 'john@example.com',
              name: 'John Doe',
            },
            {
              email: 'jane@example.com',
              name: 'Jane Smith',
            },
          ],
          fieldsToMergeOn: ['email'],
          returnRecords: true,
        },
      })

      // THEN: Returns 200 with created=2, updated=0, and records array
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.created).toBe(2)
      expect(data.updated).toBe(0)
      expect(data.records).toHaveLength(2)

      // Verify database contains both new records
      const result = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      // THEN: assertion
      expect(result.rows[0].count).toBe('2')
    }
  )

  test(
    'API-TABLES-RECORDS-UPSERT-003: should return 400 with rollback on validation error',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table 'users' with email NOT NULL constraint
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 3,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true, unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: Upsert with 1 valid record and 1 missing email (validation error)
      const response = await request.post('/api/tables/3/records/upsert', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            {
              email: 'valid@example.com',
              name: 'Valid User',
            },
            {
              name: 'Invalid User',
            },
          ],
          fieldsToMergeOn: ['email'],
        },
      })

      // THEN: Returns 400 BatchValidationError, no records created/updated (rollback)
      expect(response.status()).toBe(400)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data).toHaveProperty('details')

      // Verify no records created due to transaction rollback
      const result = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      // THEN: assertion
      expect(result.rows[0].count).toBe('0')
    }
  )

  test(
    'API-TABLES-RECORDS-UPSERT-004: should return 401 Unauthorized',
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
            fields: [
              { id: 1, name: 'email', type: 'email', unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (email, name)
        VALUES ('alice@example.com', 'Alice Cooper')
      `)

      // WHEN: User attempts upsert without auth token
      const response = await request.post('/api/tables/4/records/upsert', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ email: 'alice@example.com', name: 'Updated Alice' }],
          fieldsToMergeOn: ['email'],
        },
      })

      // THEN: Returns 401 Unauthorized error
      expect(response.status()).toBe(401)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data).toHaveProperty('message')

      // Verify no records created or updated in database
      const result = await executeQuery(`
        SELECT name FROM employees WHERE email='alice@example.com'
      `)
      // THEN: assertion
      expect(result.rows[0].name).toBe('Alice Cooper')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPSERT-005: should return 403 when member lacks create permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedViewer }) => {
      // GIVEN: A member user without create permission
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 5,
            name: 'employees',
            fields: [
              { id: 1, name: 'email', type: 'email', unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })

      await createAuthenticatedViewer()

      // WHEN: Member attempts upsert with new records
      const response = await request.post('/api/tables/5/records/upsert', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ email: 'alice@example.com', name: 'Alice Cooper' }],
          fieldsToMergeOn: ['email'],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toBe('You do not have permission to create records in this table')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPSERT-006: should return 403 when member lacks update permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedViewer }) => {
      // GIVEN: A member user without update permission
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 6,
            name: 'employees',
            fields: [
              { id: 1, name: 'email', type: 'email', unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })

      await createAuthenticatedViewer()
      await executeQuery(`
        INSERT INTO employees (email, name)
        VALUES ('alice@example.com', 'Alice Cooper')
      `)

      // WHEN: Member attempts upsert with existing records
      const response = await request.post('/api/tables/6/records/upsert', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ email: 'alice@example.com', name: 'Updated Alice' }],
          fieldsToMergeOn: ['email'],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toBe('You do not have permission to update records in this table')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPSERT-007: should return 403 for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedViewer }) => {
      // GIVEN: A viewer user with read-only access
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 7,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text', unique: true }],
          },
        ],
      })

      await createAuthenticatedViewer()

      // WHEN: Viewer attempts upsert
      const response = await request.post('/api/tables/7/records/upsert', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ name: 'Project Alpha' }],
          fieldsToMergeOn: ['name'],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPSERT-008: should return 403 when creating with protected field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember }) => {
      // GIVEN: A member user with field-level write restrictions (salary protected)
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 9,
            name: 'employees',
            fields: [
              { id: 1, name: 'email', type: 'email', unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })

      await createAuthenticatedMember()

      // WHEN: Member attempts upsert creating record with protected field
      const response = await request.post('/api/tables/9/records/upsert', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ email: 'alice@example.com', name: 'Alice Cooper', salary: 85_000 }],
          fieldsToMergeOn: ['email'],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toBe('You do not have permission to write to field: salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPSERT-009: should return 403 when updating with protected field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: A member user with field-level write restrictions (salary protected)
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 10,
            name: 'employees',
            fields: [
              { id: 1, name: 'email', type: 'email', unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })

      await createAuthenticatedMember()
      await executeQuery(`
        INSERT INTO employees (email, name, salary)
        VALUES ('alice@example.com', 'Alice Cooper', 75000)
      `)

      // WHEN: Member attempts upsert updating record with protected field
      const response = await request.post('/api/tables/10/records/upsert', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ email: 'alice@example.com', name: 'Updated Alice', salary: 90_000 }],
          fieldsToMergeOn: ['email'],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toBe('You do not have permission to write to field: salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPSERT-010: should return 403 for readonly fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedAdmin }) => {
      // GIVEN: An admin user attempting to set readonly fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 11,
            name: 'employees',
            fields: [
              { id: 1, name: 'email', type: 'email', unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })

      await createAuthenticatedAdmin()

      // WHEN: Admin upserts with id or created_at in payload
      const response = await request.post('/api/tables/11/records/upsert', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 999, email: 'alice@example.com', name: 'Alice Cooper' }],
          fieldsToMergeOn: ['email'],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toBe('Cannot set readonly field: id')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPSERT-011: should filter protected fields from response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: A member user with field-level read restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 13,
            name: 'employees',
            fields: [
              { id: 1, name: 'email', type: 'email', unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })

      await createAuthenticatedMember()
      await executeQuery(`
        INSERT INTO employees (email, name, salary)
        VALUES ('alice@example.com', 'Alice', 75000)
      `)

      // WHEN: Member upserts records successfully
      const response = await request.post('/api/tables/13/records/upsert', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { email: 'alice@example.com', name: 'Updated Alice', salary: 80_000 },
            { email: 'bob@example.com', name: 'Bob Smith', salary: 85_000 },
          ],
          fieldsToMergeOn: ['email'],
        },
      })

      // THEN: Returns 200 with protected fields filtered from response
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.created).toBe(1)
      expect(data.updated).toBe(1)
      expect(data.records[0].fields.name).toBe('Updated Alice')
      expect(data.records[1].fields.name).toBe('Bob Smith')

      // Salary field not in response
      // THEN: assertion
      expect(data.records[0].fields).not.toHaveProperty('salary')
      expect(data.records[1].fields).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPSERT-012: should return 200 with all fields for admin',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedAdmin }) => {
      // GIVEN: An admin user with full permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 14,
            name: 'employees',
            fields: [
              { id: 1, name: 'email', type: 'email', unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })

      await createAuthenticatedAdmin()
      await executeQuery(`
        INSERT INTO employees (email, name, salary)
        VALUES ('charlie@example.com', 'Charlie', 120000)
      `)

      // WHEN: Admin upserts records with all fields
      const response = await request.post('/api/tables/14/records/upsert', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { email: 'charlie@example.com', name: 'Updated Charlie', salary: 130_000 },
            { email: 'diana@example.com', name: 'Diana Prince', salary: 95_000 },
          ],
          fieldsToMergeOn: ['email'],
        },
      })

      // THEN: Returns 200 with all fields visible in response
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.created).toBe(1)
      expect(data.updated).toBe(1)
      expect(data.records[0].fields.name).toBe('Updated Charlie')
      expect(data.records[0].fields.salary).toBe(130_000)
      expect(data.records[1].fields.name).toBe('Diana Prince')
      expect(data.records[1].fields.salary).toBe(95_000)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-UPSERT-013: should enforce combined permissions',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: A member with create/update permission but field restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 15,
            name: 'employees',
            fields: [
              { id: 1, name: 'email', type: 'email', unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })

      await createAuthenticatedMember()
      await executeQuery(`
        INSERT INTO employees (email, name, salary) VALUES
          ('alice@example.com', 'Alice', 75000),
          ('bob@example.com', 'Bob', 85000)
      `)

      // WHEN: Member upserts mixed creates/updates with only permitted fields
      const response = await request.post('/api/tables/15/records/upsert', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { email: 'alice@example.com', name: 'Updated Alice', salary: 80_000 },
            { email: 'bob@example.com', name: 'Updated Bob', salary: 90_000 },
            { email: 'charlie@example.com', name: 'Charlie Davis', salary: 70_000 },
          ],
          fieldsToMergeOn: ['email'],
        },
      })

      // THEN: Returns 200 with field filtering applied across all records
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.created).toBe(1)
      expect(data.updated).toBe(2)

      // Salary field not in response for all records
      // THEN: assertion
      expect(data.records[0].fields).not.toHaveProperty('salary')
      expect(data.records[1].fields).not.toHaveProperty('salary')
      expect(data.records[2].fields).not.toHaveProperty('salary')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // Generated from 13 @spec tests - covers: upsert create/update, validation,
  // auth, permissions, field-level restrictions, response filtering
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-UPSERT-REGRESSION: user can complete full upsert workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Consolidated configuration from all @spec tests
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
            ],
          },
          {
            id: 2,
            name: 'employees',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true, unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
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
            fields: [{ id: 1, name: 'name', type: 'single-line-text', unique: true }],
            permissions: {
              create: { type: 'roles', roles: ['admin'] },
            },
          },
          {
            id: 4,
            name: 'tasks',
            fields: [
              { id: 1, name: 'email', type: 'email', unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })

      // Step 004 must run BEFORE authentication (tests unauthenticated access)
      await test.step('API-TABLES-RECORDS-UPSERT-004: should return 401 Unauthorized', async () => {
        const response = await request.post('/api/tables/1/records/upsert', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ email: 'test@example.com', name: 'Test User' }],
            fieldsToMergeOn: ['email'],
          },
        })

        expect(response.status()).toBe(401)

        const data = await response.json()
        expect(data).toHaveProperty('success')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('code')
      })

      // Authenticate user for remaining steps (member role by default)
      await createAuthenticatedUser()

      // Seed data for upsert tests
      await executeQuery(`
        INSERT INTO users (email, name, status)
        VALUES ('existing@example.com', 'Existing User', 'active')
      `)
      await executeQuery(`
        INSERT INTO employees (email, name, salary)
        VALUES ('alice@example.com', 'Alice Cooper', 75000)
      `)

      await test.step('API-TABLES-RECORDS-UPSERT-001: should return 200 with created=1, updated=1', async () => {
        const response = await request.post('/api/tables/1/records/upsert', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { email: 'existing@example.com', name: 'Updated Existing', status: 'active' },
              { email: 'new@example.com', name: 'New User', status: 'active' },
            ],
            fieldsToMergeOn: ['email'],
            returnRecords: true,
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('created')
        expect(data).toHaveProperty('updated')
        expect(data).toHaveProperty('records')
        expect(data.created).toBe(1)
        expect(data.updated).toBe(1)
        expect(data.records).toHaveLength(2)

        const result = await executeQuery(`SELECT COUNT(*) as count FROM users`)
        expect(result.rows[0].count).toBe('2')
      })

      await test.step('API-TABLES-RECORDS-UPSERT-002: should return 200 with created=2, updated=0', async () => {
        const response = await request.post('/api/tables/1/records/upsert', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { email: 'john@example.com', name: 'John Doe' },
              { email: 'jane@example.com', name: 'Jane Smith' },
            ],
            fieldsToMergeOn: ['email'],
            returnRecords: true,
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.created).toBe(2)
        expect(data.updated).toBe(0)
        expect(data.records).toHaveLength(2)
      })

      await test.step('API-TABLES-RECORDS-UPSERT-003: should return 400 with rollback on validation error', async () => {
        const countBefore = await executeQuery(`SELECT COUNT(*) as count FROM users`)

        const response = await request.post('/api/tables/1/records/upsert', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { email: 'valid@example.com', name: 'Valid User' },
              { name: 'Invalid - Missing Email' },
            ],
            fieldsToMergeOn: ['email'],
          },
        })

        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('success')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('code')
        expect(data).toHaveProperty('details')

        // Verify rollback - no records created
        const countAfter = await executeQuery(`SELECT COUNT(*) as count FROM users`)
        expect(countAfter.rows[0].count).toBe(countBefore.rows[0].count)
      })

      await test.step('API-TABLES-RECORDS-UPSERT-005: should return 403 when viewer lacks create permission', async () => {
        // projects table (id: 3) has create restricted to admin only
        // Default user is member, so create would be rejected
        const response = await request.post('/api/tables/3/records/upsert', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ name: 'New Project' }],
            fieldsToMergeOn: ['name'],
          },
        })

        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('FORBIDDEN')
      })

      await test.step('API-TABLES-RECORDS-UPSERT-007: should return 403 for viewer with read-only access', async () => {
        // projects table (id: 3) has create restricted to admin only
        const response = await request.post('/api/tables/3/records/upsert', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ name: 'Viewer Project' }],
            fieldsToMergeOn: ['name'],
          },
        })

        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('FORBIDDEN')
      })

      await test.step('API-TABLES-RECORDS-UPSERT-008: should return 403 when creating record with protected field', async () => {
        // employees table (id: 2) has salary write restricted to admin only
        const response = await request.post('/api/tables/2/records/upsert', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ email: 'newperson@example.com', name: 'New Person', salary: 100_000 }],
            fieldsToMergeOn: ['email'],
          },
        })

        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('FORBIDDEN')
      })

      await test.step('API-TABLES-RECORDS-UPSERT-009: should return 403 when updating record with protected field', async () => {
        // employees table (id: 2) has salary write restricted to admin only
        const response = await request.post('/api/tables/2/records/upsert', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ email: 'alice@example.com', name: 'Updated Alice', salary: 90_000 }],
            fieldsToMergeOn: ['email'],
          },
        })

        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('FORBIDDEN')
      })

      await test.step('API-TABLES-RECORDS-UPSERT-010: should return 400 for readonly fields', async () => {
        // tasks table (id: 4) has created_at as readonly (created-at type)
        // Readonly field validation returns 400 VALIDATION_ERROR (not 403 FORBIDDEN)
        const response = await request.post('/api/tables/4/records/upsert', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ id: 999, email: 'test@example.com', name: 'Test' }],
            fieldsToMergeOn: ['email'],
          },
        })

        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('VALIDATION_ERROR')
      })

      await test.step('API-TABLES-RECORDS-UPSERT-011: should filter protected fields from response for member', async () => {
        // employees table (id: 2) - member cannot read salary
        const response = await request.post('/api/tables/2/records/upsert', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { email: 'alice@example.com', name: 'Updated Alice' },
              { email: 'bob@example.com', name: 'Bob Smith' },
            ],
            fieldsToMergeOn: ['email'],
            returnRecords: true,
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.created).toBe(1)
        expect(data.updated).toBe(1)
        expect(data.records[0].fields.name).toBe('Updated Alice')
        expect(data.records[1].fields.name).toBe('Bob Smith')
        // Salary field not in response for member
        expect(data.records[0].fields).not.toHaveProperty('salary')
        expect(data.records[1].fields).not.toHaveProperty('salary')
      })

      await test.step('API-TABLES-RECORDS-UPSERT-013: should enforce combined permissions across create/update', async () => {
        // employees table (id: 2) - member can create/update but salary is filtered
        const response = await request.post('/api/tables/2/records/upsert', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { email: 'alice@example.com', name: 'Combined Update' },
              { email: 'bob@example.com', name: 'Combined Bob' },
              { email: 'charlie@example.com', name: 'Charlie New' },
            ],
            fieldsToMergeOn: ['email'],
            returnRecords: true,
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.created).toBe(1)
        expect(data.updated).toBe(2)
        // Verify field filtering applied across all records
        expect(data.records[0].fields).not.toHaveProperty('salary')
        expect(data.records[1].fields).not.toHaveProperty('salary')
        expect(data.records[2].fields).not.toHaveProperty('salary')
      })
    }
  )
})
