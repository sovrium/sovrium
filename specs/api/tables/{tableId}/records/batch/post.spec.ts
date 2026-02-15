/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Batch create records
 *
 * Source: specs/api/paths/tables/{tableId}/records/batch/post.json
 * Domain: api
 * Spec Count: 13
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (13 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Batch create records', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test(
    'API-TABLES-RECORDS-BATCH-POST-001: should return 201 with created=3 and records array',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table 'users' exists with 0 records
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true, unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })
      await createAuthenticatedUser()

      // WHEN: Batch create 3 valid records with returnRecords=true
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            {
              fields: {
                email: 'john@example.com',
                name: 'John Doe',
              },
            },
            {
              fields: {
                email: 'jane@example.com',
                name: 'Jane Smith',
              },
            },
            {
              fields: {
                email: 'bob@example.com',
                name: 'Bob Johnson',
              },
            },
          ],
          returnRecords: true,
        },
      })

      // THEN: Returns 201 with created=3 and records array
      expect(response.status()).toBe(201)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('created')
      expect(data).toHaveProperty('records')
      expect(data.created).toBe(3)
      expect(data.records).toHaveLength(3)

      // Verify database contains all 3 records
      const result = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      // THEN: assertion
      expect(result.rows[0].count).toBe('3')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-POST-002: should return 201 with created=2 and no records array',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table 'users' exists
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 2,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })
      await createAuthenticatedUser()

      // WHEN: Batch create 2 records with returnRecords=false
      const response = await request.post('/api/tables/2/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            {
              fields: {
                email: 'user1@example.com',
                name: 'User One',
              },
            },
            {
              fields: {
                email: 'user2@example.com',
                name: 'User Two',
              },
            },
          ],
          returnRecords: false,
        },
      })

      // THEN: Returns 201 with created=2 and no records array
      expect(response.status()).toBe(201)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('created')
      expect(data.created).toBe(2)
      expect(data).not.toHaveProperty('records')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-POST-003: should return 400 with rollback on validation error',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table 'users' with email NOT NULL constraint
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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
      await createAuthenticatedUser()

      // WHEN: Batch create with 1 valid record and 1 missing email
      const response = await request.post('/api/tables/3/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            {
              fields: {
                email: 'valid@example.com',
                name: 'Valid User',
              },
            },
            {
              fields: {
                name: 'Invalid User',
              },
            },
          ],
        },
      })

      // THEN: Returns 400 BatchValidationError, no records created (rollback)
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
    'API-TABLES-RECORDS-BATCH-POST-004: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: An unauthenticated user with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 4,
            name: 'employees',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
        ],
      })

      // WHEN: User attempts batch create without auth token
      const response = await request.post('/api/tables/4/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ fields: { name: 'Alice Cooper' } }],
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
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-POST-005: should return 403 for member without create permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember }) => {
      // GIVEN: A member user without create permission
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 5,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            permissions: {
              create: ['admin'],
            },
          },
        ],
      })
      await createAuthenticatedMember()

      // WHEN: Member attempts batch create
      const response = await request.post('/api/tables/5/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ fields: { name: 'Project Alpha' } }, { fields: { name: 'Project Beta' } }],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to create records in this table')
      expect(data.code).toBe('FORBIDDEN')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-POST-006: should return 403 for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedViewer }) => {
      // GIVEN: A viewer user with read-only access
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 6,
            name: 'documents',
            fields: [{ id: 1, name: 'title', type: 'single-line-text' }],
          },
        ],
      })
      await createAuthenticatedViewer()

      // WHEN: Viewer attempts batch create
      const response = await request.post('/api/tables/6/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ fields: { title: 'Doc 1' } }, { fields: { title: 'Doc 2' } }],
        },
      })

      // THEN: Returns 403 Forbidden error
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
    'API-TABLES-RECORDS-BATCH-POST-007: should return 403 when creating with protected field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember }) => {
      // GIVEN: A member user with field-level write restrictions (salary protected)
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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
      await createAuthenticatedMember()

      // WHEN: Member attempts batch create with protected field
      const response = await request.post('/api/tables/8/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { fields: { name: 'Alice Cooper', salary: 85_000 } },
            { fields: { name: 'Bob Smith', salary: 90_000 } },
          ],
        },
      })

      // THEN: Returns 403 Forbidden error
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

  test(
    'API-TABLES-RECORDS-BATCH-POST-008: should return 403 for readonly fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedAdmin }) => {
      // GIVEN: An admin user attempting to set readonly fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 9,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })
      await createAuthenticatedAdmin()

      // WHEN: Admin batch creates with id in payload
      const response = await request.post('/api/tables/9/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ fields: { id: 999, name: 'Alice Cooper' } }],
        },
      })

      // THEN: Returns 403 Forbidden error
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
      expect(data.message).toBe('Cannot set readonly field: id')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-POST-009: should filter protected fields from response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember }) => {
      // GIVEN: A member user with field-level read restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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
      await createAuthenticatedMember()

      // WHEN: Member batch creates records successfully
      const response = await request.post('/api/tables/11/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { fields: { name: 'Alice Cooper', email: 'alice@example.com', salary: 80_000 } },
            { fields: { name: 'Bob Smith', email: 'bob@example.com', salary: 85_000 } },
          ],
          returnRecords: true,
        },
      })

      // THEN: Returns 201 with protected fields filtered from response
      expect(response.status()).toBe(201)

      const data = await response.json()
      // THEN: assertion
      expect(data.created).toBe(2)
      expect(data.records[0].fields.name).toBe('Alice Cooper')
      expect(data.records[1].fields.name).toBe('Bob Smith')

      // Salary field not in response
      // THEN: assertion
      expect(data.records[0].fields).not.toHaveProperty('salary')
      expect(data.records[1].fields).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-POST-010: should return 201 with all fields for admin',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedAdmin }) => {
      // GIVEN: An admin user with full permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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
      await createAuthenticatedAdmin()

      // WHEN: Admin batch creates records with all fields
      const response = await request.post('/api/tables/12/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { fields: { name: 'Charlie Brown', salary: 130_000 } },
            { fields: { name: 'Diana Prince', salary: 95_000 } },
          ],
          returnRecords: true,
        },
      })

      // THEN: Returns 201 with all fields visible in response
      expect(response.status()).toBe(201)

      const data = await response.json()
      // THEN: assertion
      expect(data.created).toBe(2)
      expect(data.records[0].fields.name).toBe('Charlie Brown')
      expect(data.records[0].fields.salary).toBe(130_000)
      expect(data.records[1].fields.name).toBe('Diana Prince')
      expect(data.records[1].fields.salary).toBe(95_000)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-POST-011: should enforce combined permissions',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember }) => {
      // GIVEN: A member with create permission but field restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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
      await createAuthenticatedMember()

      // WHEN: Member batch creates with only permitted fields
      const response = await request.post('/api/tables/13/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { fields: { name: 'Alice Cooper', email: 'alice@example.com', salary: 80_000 } },
            { fields: { name: 'Bob Smith', email: 'bob@example.com', salary: 85_000 } },
            { fields: { name: 'Charlie Davis', email: 'charlie@example.com', salary: 70_000 } },
          ],
          returnRecords: true,
        },
      })

      // THEN: Returns 201 with field filtering applied across all records
      expect(response.status()).toBe(201)

      const data = await response.json()
      // THEN: assertion
      expect(data.created).toBe(3)

      // Salary field not in response for all records
      // THEN: assertion
      expect(data.records[0].fields).not.toHaveProperty('salary')
      expect(data.records[1].fields).not.toHaveProperty('salary')
      expect(data.records[2].fields).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-POST-012: should return 400 for duplicate unique field values',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with unique email constraint
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 14,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true, unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })
      await createAuthenticatedUser()

      // WHEN: Batch create with duplicate email values
      const response = await request.post('/api/tables/14/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { fields: { email: 'duplicate@example.com', name: 'User One' } },
            { fields: { email: 'duplicate@example.com', name: 'User Two' } },
          ],
        },
      })

      // THEN: Returns 400 validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data).toHaveProperty('details')

      // Verify no records created due to rollback
      const result = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      // THEN: assertion
      expect(result.rows[0].count).toBe('0')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-POST-013: should return 413 when exceeding 1000 record limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table exists
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 15,
            name: 'users',
            fields: [{ id: 1, name: 'email', type: 'email', required: true }],
          },
        ],
      })
      await createAuthenticatedUser()

      // WHEN: Batch create with 1001 records
      const records = Array.from({ length: 1001 }, (_, i) => ({
        fields: { email: `user${i}@example.com` },
      }))

      const response = await request.post('/api/tables/15/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records,
        },
      })

      // THEN: Returns 413 Payload Too Large
      expect(response.status()).toBe(413)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('PayloadTooLarge')
      expect(data.message).toBe('Batch size exceeds maximum of 1000 records')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying batch create workflow end-to-end
  // Generated from 13 @spec tests - covers: basic CRUD, validation, permissions, limits
  // Skipped: 006 (viewer role), 010 (admin role) - require different auth contexts
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-BATCH-POST-REGRESSION: user can complete full batch create workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Consolidated configuration with proper permission schemas
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true, unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'created_at', type: 'created-at' },
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
                  read: ['admin'],
                  write: ['admin'],
                },
              ],
            },
          },
          {
            id: 3,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            permissions: {
              create: ['admin'],
            },
          },
          {
            id: 4,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'created_at', type: 'datetime', default: 'NOW()' },
            ],
          },
        ],
      })

      // Step 004: 401 Unauthorized — MUST run BEFORE authentication
      await test.step('API-TABLES-RECORDS-BATCH-POST-004: Return 401 Unauthorized', async () => {
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ fields: { email: 'test@example.com', name: 'Alice Cooper' } }],
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

      await test.step('API-TABLES-RECORDS-BATCH-POST-001: Return 201 with created=3 and records array', async () => {
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { fields: { email: 'john@example.com', name: 'John Doe' } },
              { fields: { email: 'jane@example.com', name: 'Jane Smith' } },
              { fields: { email: 'bob@example.com', name: 'Bob Johnson' } },
            ],
            returnRecords: true,
          },
        })

        expect(response.status()).toBe(201)

        const data = await response.json()
        expect(data).toHaveProperty('created')
        expect(data).toHaveProperty('records')
        expect(data.created).toBe(3)
        expect(data.records).toHaveLength(3)

        const result = await executeQuery(`SELECT COUNT(*) as count FROM users`)
        expect(result.rows[0].count).toBe('3')
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-002: Return 201 with created=2 and no records array', async () => {
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { fields: { email: 'user1@example.com', name: 'User One' } },
              { fields: { email: 'user2@example.com', name: 'User Two' } },
            ],
            returnRecords: false,
          },
        })

        expect(response.status()).toBe(201)

        const data = await response.json()
        expect(data).toHaveProperty('created')
        expect(data.created).toBe(2)
        expect(data).not.toHaveProperty('records')
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-003: Return 400 with rollback on validation error', async () => {
        const beforeResult = await executeQuery(`SELECT COUNT(*) as count FROM users`)
        const countBefore = beforeResult.rows[0].count

        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { fields: { email: 'valid@example.com', name: 'Valid User' } },
              { fields: { name: 'Invalid User' } }, // Missing required email
            ],
          },
        })

        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('success')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('code')
        expect(data).toHaveProperty('details')

        // Verify no records created due to transaction rollback
        const afterResult = await executeQuery(`SELECT COUNT(*) as count FROM users`)
        expect(afterResult.rows[0].count).toBe(countBefore)
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-005: Return 403 for member without create permission', async () => {
        // projects table (id: 3) has create restricted to admin only
        const response = await request.post('/api/tables/3/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ fields: { name: 'Project Alpha' } }, { fields: { name: 'Project Beta' } }],
          },
        })

        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('You do not have permission to create records in this table')
        expect(data.code).toBe('FORBIDDEN')
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-007: Return 403 when creating with write-protected field', async () => {
        // employees table (id: 2) has salary write restricted to admin only
        const response = await request.post('/api/tables/2/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { fields: { name: 'Alice Cooper', email: 'alice_sal@example.com', salary: 85_000 } },
              { fields: { name: 'Bob Smith', email: 'bob_sal@example.com', salary: 90_000 } },
            ],
          },
        })

        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe("Cannot write to field 'salary': insufficient permissions")
        expect(data.code).toBe('FORBIDDEN')
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-008: Return 400 for readonly fields', async () => {
        // Readonly field validation returns 400 VALIDATION_ERROR (not 403 FORBIDDEN)
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ fields: { id: 999, name: 'Alice Cooper', email: 'alice_ro@example.com' } }],
          },
        })

        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe("Cannot write to readonly field 'id'")
        expect(data.code).toBe('VALIDATION_ERROR')
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-009: Filter protected fields from response', async () => {
        // employees table (id: 2) — member creates without salary (write restricted)
        // salary has default: 50_000, but read is also restricted to admin
        const response = await request.post('/api/tables/2/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { fields: { name: 'Alice Cooper', email: 'alice_filter@example.com' } },
              { fields: { name: 'Bob Smith', email: 'bob_filter@example.com' } },
            ],
            returnRecords: true,
          },
        })

        expect(response.status()).toBe(201)

        const data = await response.json()
        expect(data.created).toBe(2)
        expect(data.records[0].fields.name).toBe('Alice Cooper')
        expect(data.records[1].fields.name).toBe('Bob Smith')
        // Salary field not in response (read restricted to admin)
        expect(data.records[0].fields).not.toHaveProperty('salary')
        expect(data.records[1].fields).not.toHaveProperty('salary')
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-011: Enforce combined permissions across records', async () => {
        // employees table (id: 2) — member creates 3 records without salary
        const response = await request.post('/api/tables/2/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { fields: { name: 'Eve Adams', email: 'eve@example.com' } },
              { fields: { name: 'Frank Brown', email: 'frank@example.com' } },
              { fields: { name: 'Grace Lee', email: 'grace@example.com' } },
            ],
            returnRecords: true,
          },
        })

        expect(response.status()).toBe(201)

        const data = await response.json()
        expect(data.created).toBe(3)
        // Salary field not in response for all records
        expect(data.records[0].fields).not.toHaveProperty('salary')
        expect(data.records[1].fields).not.toHaveProperty('salary')
        expect(data.records[2].fields).not.toHaveProperty('salary')
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-012: Return 400 for duplicate unique field values', async () => {
        const beforeResult = await executeQuery(`SELECT COUNT(*) as count FROM users`)
        const countBefore = beforeResult.rows[0].count

        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { fields: { email: 'duplicate@example.com', name: 'User One' } },
              { fields: { email: 'duplicate@example.com', name: 'User Two' } },
            ],
          },
        })

        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('success')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('code')
        expect(data).toHaveProperty('details')

        // Verify no records created due to rollback
        const afterResult = await executeQuery(`SELECT COUNT(*) as count FROM users`)
        expect(afterResult.rows[0].count).toBe(countBefore)
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-013: Return 413 when exceeding 1000 record limit', async () => {
        const records = Array.from({ length: 1001 }, (_, i) => ({
          fields: { email: `user${i}@batch.com` },
        }))

        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: { records },
        })

        expect(response.status()).toBe(413)

        const data = await response.json()
        expect(data).toHaveProperty('success')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('code')
      })
    }
  )
})
