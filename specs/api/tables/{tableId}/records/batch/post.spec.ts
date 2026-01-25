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
        auth: { emailAndPassword: true },
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
              email: 'john@example.com',
              name: 'John Doe',
            },
            {
              email: 'jane@example.com',
              name: 'Jane Smith',
            },
            {
              email: 'bob@example.com',
              name: 'Bob Johnson',
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
        auth: { emailAndPassword: true },
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
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            {
              email: 'user1@example.com',
              name: 'User One',
            },
            {
              email: 'user2@example.com',
              name: 'User Two',
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
        auth: { emailAndPassword: true },
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
      const response = await request.post('/api/tables/1/records/batch', {
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
        },
      })

      // THEN: Returns 400 BatchValidationError, no records created (rollback)
      expect(response.status()).toBe(400)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
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
      // GIVEN: An unauthenticated user
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'employees',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
        ],
      })

      // WHEN: User attempts batch create without auth token
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ name: 'Alice Cooper' }],
        },
      })

      // THEN: Returns 401 Unauthorized error
      expect(response.status()).toBe(401)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
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
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 5,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
        ],
      })
      await createAuthenticatedMember()

      // WHEN: Member attempts batch create
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ name: 'Project Alpha' }, { name: 'Project Beta' }],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to create records in this table')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-POST-006: should return 403 for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedViewer }) => {
      // GIVEN: A viewer user with read-only access
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ title: 'Doc 1' }, { title: 'Doc 2' }],
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

  test(
    'API-TABLES-RECORDS-BATCH-POST-007: should return 403 when creating with protected field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember }) => {
      // GIVEN: A member user with field-level write restrictions (salary protected)
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { name: 'Alice Cooper', salary: 85_000 },
            { name: 'Bob Smith', salary: 90_000 },
          ],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
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
        auth: { emailAndPassword: true },
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
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ id: 999, name: 'Alice Cooper' }],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('Cannot set readonly field: id')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-POST-009: should filter protected fields from response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember }) => {
      // GIVEN: A member user with field-level read restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { name: 'Alice Cooper', email: 'alice@example.com', salary: 80_000 },
            { name: 'Bob Smith', email: 'bob@example.com', salary: 85_000 },
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

  test(
    'API-TABLES-RECORDS-BATCH-POST-010: should return 201 with all fields for admin',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedAdmin }) => {
      // GIVEN: An admin user with full permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { name: 'Charlie Brown', salary: 130_000 },
            { name: 'Diana Prince', salary: 95_000 },
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

  test(
    'API-TABLES-RECORDS-BATCH-POST-011: should enforce combined permissions',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember }) => {
      // GIVEN: A member with create permission but field restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { name: 'Alice Cooper', email: 'alice@example.com', salary: 80_000 },
            { name: 'Bob Smith', email: 'bob@example.com', salary: 85_000 },
            { name: 'Charlie Davis', email: 'charlie@example.com', salary: 70_000 },
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
      expect(data.records[0]).not.toHaveProperty('salary')
      expect(data.records[1]).not.toHaveProperty('salary')
      expect(data.records[2]).not.toHaveProperty('salary')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-POST-012: should return 400 for duplicate unique field values',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with unique email constraint
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { email: 'duplicate@example.com', name: 'User One' },
            { email: 'duplicate@example.com', name: 'User Two' },
          ],
        },
      })

      // THEN: Returns 400 validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('details')

      // Verify no records created due to rollback
      const result = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      // THEN: assertion
      expect(result.rows[0].count).toBe('0')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-POST-013: should return 413 when exceeding 1000 record limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table exists
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
        email: `user${i}@example.com`,
      }))

      const response = await request.post('/api/tables/1/records/batch', {
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
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('PayloadTooLarge')
      expect(data.message).toBe('Batch size exceeds maximum of 1000 records')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test(
    'API-TABLES-RECORDS-BATCH-POST-REGRESSION: user can complete full batch create workflow',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createAuthenticatedAdmin,
      createAuthenticatedMember,
      createAuthenticatedViewer,
    }) => {
      // GIVEN: Consolidated configuration for all @spec tests
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
              { id: 3, name: 'created_at', type: 'created-at' },
              { id: 4, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })

      await test.step('Authenticate as user for basic operations', async () => {
        await createAuthenticatedUser()
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-001: should return 201 with created=3 and records array', async () => {
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { email: 'john@example.com', name: 'John Doe' },
              { email: 'jane@example.com', name: 'Jane Smith' },
              { email: 'bob@example.com', name: 'Bob Johnson' },
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

      await test.step('API-TABLES-RECORDS-BATCH-POST-002: should return 201 with created=2 and no records array', async () => {
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { email: 'user1@example.com', name: 'User One' },
              { email: 'user2@example.com', name: 'User Two' },
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

      await test.step('API-TABLES-RECORDS-BATCH-POST-003: should return 400 with rollback on validation error', async () => {
        // Get current count before attempting invalid batch
        const beforeResult = await executeQuery(`SELECT COUNT(*) as count FROM users`)
        const countBefore = beforeResult.rows[0].count

        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { email: 'valid@example.com', name: 'Valid User' },
              { name: 'Invalid User' }, // Missing required email
            ],
          },
        })

        expect(response.status()).toBe(400)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data).toHaveProperty('details')

        // Verify no records created due to transaction rollback
        const afterResult = await executeQuery(`SELECT COUNT(*) as count FROM users`)
        expect(afterResult.rows[0].count).toBe(countBefore)
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-004: should return 401 Unauthorized', async () => {
        // Note: This test requires unauthenticated request context
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ email: 'test@example.com', name: 'Alice Cooper' }],
          },
        })

        expect(response.status()).toBe(401)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data).toHaveProperty('message')
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-005: should return 403 for member without create permission', async () => {
        // Note: Requires member user context without create permission
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { email: 'proj1@example.com', name: 'Project Alpha' },
              { email: 'proj2@example.com', name: 'Project Beta' },
            ],
          },
        })

        expect(response.status()).toBe(403)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data).toHaveProperty('message')
        expect(data.error).toBe('Forbidden')
        expect(data.message).toBe('You do not have permission to create records in this table')
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-006: should return 403 for viewer', async () => {
        // Note: Requires viewer user context
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { email: 'doc1@example.com', name: 'Doc 1' },
              { email: 'doc2@example.com', name: 'Doc 2' },
            ],
          },
        })

        expect(response.status()).toBe(403)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toBe('Forbidden')
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-007: should return 403 when creating with protected field', async () => {
        // Note: Requires member user with field-level write restrictions (salary protected)
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { name: 'Alice Cooper', email: 'alice_sal@example.com', salary: 85_000 },
              { name: 'Bob Smith', email: 'bob_sal@example.com', salary: 90_000 },
            ],
          },
        })

        expect(response.status()).toBe(403)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data).toHaveProperty('message')
        expect(data.error).toBe('Forbidden')
        expect(data.message).toBe('You do not have permission to write to field: salary')
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-008: should return 403 for readonly fields', async () => {
        // Note: Requires admin user attempting to set readonly fields
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ id: 999, name: 'Alice Cooper', email: 'alice_ro@example.com' }],
          },
        })

        expect(response.status()).toBe(403)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data).toHaveProperty('message')
        expect(data.error).toBe('Forbidden')
        expect(data.message).toBe('Cannot set readonly field: id')
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-009: should filter protected fields from response', async () => {
        // Note: Requires member user with field-level read restrictions
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { name: 'Alice Cooper', email: 'alice_filter@example.com', salary: 80_000 },
              { name: 'Bob Smith', email: 'bob_filter@example.com', salary: 85_000 },
            ],
            returnRecords: true,
          },
        })

        expect(response.status()).toBe(201)
        const data = await response.json()
        expect(data.created).toBe(2)
        expect(data.records[0].fields.name).toBe('Alice Cooper')
        expect(data.records[1].fields.name).toBe('Bob Smith')
        // Salary field not in response
        expect(data.records[0].fields).not.toHaveProperty('salary')
        expect(data.records[1].fields).not.toHaveProperty('salary')
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-010: should return 201 with all fields for admin', async () => {
        // Note: Requires admin user with full permissions
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { name: 'Charlie Brown', email: 'charlie@example.com', salary: 130_000 },
              { name: 'Diana Prince', email: 'diana@example.com', salary: 95_000 },
            ],
            returnRecords: true,
          },
        })

        expect(response.status()).toBe(201)
        const data = await response.json()
        expect(data.created).toBe(2)
        expect(data.records[0].fields.name).toBe('Charlie Brown')
        expect(data.records[0].fields.salary).toBe(130_000)
        expect(data.records[1].fields.name).toBe('Diana Prince')
        expect(data.records[1].fields.salary).toBe(95_000)
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-011: should enforce combined permissions', async () => {
        // Note: Requires member with create permission but field restrictions
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { name: 'Alice Cooper', email: 'alice_comb@example.com', salary: 80_000 },
              { name: 'Bob Smith', email: 'bob_comb@example.com', salary: 85_000 },
              { name: 'Charlie Davis', email: 'charlie_comb@example.com', salary: 70_000 },
            ],
            returnRecords: true,
          },
        })

        expect(response.status()).toBe(201)
        const data = await response.json()
        expect(data.created).toBe(3)
        // Salary field not in response for all records
        expect(data.records[0]).not.toHaveProperty('salary')
        expect(data.records[1]).not.toHaveProperty('salary')
        expect(data.records[2]).not.toHaveProperty('salary')
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-012: should return 400 for duplicate unique field values', async () => {
        // Get current count before attempting duplicate batch
        const beforeResult = await executeQuery(`SELECT COUNT(*) as count FROM users`)
        const countBefore = beforeResult.rows[0].count

        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { email: 'duplicate@example.com', name: 'User One' },
              { email: 'duplicate@example.com', name: 'User Two' },
            ],
          },
        })

        expect(response.status()).toBe(400)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data).toHaveProperty('details')

        // Verify no records created due to rollback
        const afterResult = await executeQuery(`SELECT COUNT(*) as count FROM users`)
        expect(afterResult.rows[0].count).toBe(countBefore)
      })

      await test.step('API-TABLES-RECORDS-BATCH-POST-013: should return 413 when exceeding 1000 record limit', async () => {
        const records = Array.from({ length: 1001 }, (_, i) => ({
          email: `user${i}@batch.com`,
        }))

        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: { records },
        })

        expect(response.status()).toBe(413)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data).toHaveProperty('message')
        expect(data.error).toBe('PayloadTooLarge')
        expect(data.message).toBe('Batch size exceeds maximum of 1000 records')
      })
    }
  )
})
