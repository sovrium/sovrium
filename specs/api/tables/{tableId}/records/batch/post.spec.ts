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
 * Spec Count: 16
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (16 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Batch create records', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-RECORDS-001: should return 201 with created=3 and records array',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table 'users' exists with 0 records
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: Batch create 3 valid records with returnRecords=true
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer test_token',
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
      expect(result.rows[0].count).toBe(3)
    }
  )

  test.fixme(
    'API-RECORDS-002: should return 201 with created=2 and no records array',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Table 'users' exists
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: Batch create 2 records with returnRecords=false
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer test_token',
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

  test.fixme(
    'API-RECORDS-003: should return 400 with rollback on validation error',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table 'users' with email NOT NULL constraint
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

      // WHEN: Batch create with 1 valid record and 1 missing email
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer test_token',
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
      expect(result.rows[0].count).toBe(0)
    }
  )

  test.fixme(
    'API-RECORDS-004: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
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

  test.fixme(
    'API-RECORDS-005: should return 403 for member without create permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A member user without create permission
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

      // WHEN: Member attempts batch create
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer member_token',
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

  test.fixme(
    'API-RECORDS-006: should return 403 for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
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

      // WHEN: Viewer attempts batch create
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer viewer_token',
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

  test.fixme(
    'API-RECORDS-007: should auto-inject organization_id for all records',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: An admin user from org_123
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })

      // WHEN: Admin batch creates records without specifying organization_id
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { name: 'Alice Cooper', email: 'alice@example.com' },
            { name: 'Bob Smith', email: 'bob@example.com' },
          ],
          returnRecords: true,
        },
      })

      // THEN: Returns 201 with organization_id auto-injected for all records
      expect(response.status()).toBe(201)

      const data = await response.json()
      // THEN: assertion
      expect(data.created).toBe(2)
      expect(data.records[0].organization_id).toBe('org_123')
      expect(data.records[1].organization_id).toBe('org_123')
    }
  )

  test.fixme(
    'API-RECORDS-008: should return 403 when creating with protected field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A member user with field-level write restrictions (salary protected)
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

      // WHEN: Member attempts batch create with protected field
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer member_token',
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

  test.fixme(
    'API-RECORDS-009: should return 403 for readonly fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: An admin user attempting to set readonly fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 9,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'created_at', type: 'created-at' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })

      // WHEN: Admin batch creates with id in payload
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer admin_token',
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

  test.fixme(
    'API-RECORDS-010: should return 403 when setting different organization_id',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A member user attempting to set different organization_id
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

      // WHEN: Member batch creates with organization_id='org_456' in payload
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer member_token',
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ name: 'Alice Cooper', organization_id: 'org_456' }],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('Cannot create records for different organization')
    }
  )

  test.fixme(
    'API-RECORDS-011: should filter protected fields from response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
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

      // WHEN: Member batch creates records successfully
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer member_token',
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
      expect(data.records[0].name).toBe('Alice Cooper')
      expect(data.records[1].name).toBe('Bob Smith')

      // Salary field not in response
      // THEN: assertion
      expect(data.records[0]).not.toHaveProperty('salary')
      expect(data.records[1]).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-RECORDS-012: should return 201 with all fields for admin',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
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

      // WHEN: Admin batch creates records with all fields
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer admin_token',
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
      expect(data.records[0].name).toBe('Charlie Brown')
      expect(data.records[0].salary).toBe(130_000)
      expect(data.records[1].name).toBe('Diana Prince')
      expect(data.records[1].salary).toBe(95_000)
    }
  )

  test.fixme(
    'API-RECORDS-013: should enforce combined permissions',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A member with create permission but field restrictions
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

      // WHEN: Member batch creates with only permitted fields
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer member_token',
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

  test.fixme(
    'API-RECORDS-014: should return 400 for duplicate unique field values',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with unique email constraint
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: Batch create with duplicate email values
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer test_token',
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
      expect(result.rows[0].count).toBe(0)
    }
  )

  test.fixme(
    'API-RECORDS-015: should return 413 when exceeding 1000 record limit',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Table exists
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 15,
            name: 'users',
            fields: [{ id: 1, name: 'email', type: 'email', required: true }],
          },
        ],
      })

      // WHEN: Batch create with 1001 records
      const records = Array.from({ length: 1001 }, (_, i) => ({
        email: `user${i}@example.com`,
      }))

      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer test_token',
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

  test.fixme(
    'user can complete full batch create workflow',
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

      // WHEN/THEN: Streamlined workflow testing integration points

      // Test successful batch create (admin with full access)
      const successResponse = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { name: 'John Doe', email: 'john@example.com' },
            { name: 'Jane Smith', email: 'jane@example.com' },
            { name: 'Bob Johnson', email: 'bob@example.com' },
          ],
          returnRecords: true,
        },
      })
      // THEN: assertion
      expect(successResponse.status()).toBe(201)
      const result = await successResponse.json()
      // THEN: assertion
      expect(result.created).toBe(3)
      expect(result.records).toHaveLength(3)

      // Verify records in database
      const verifyRecords = await executeQuery(`SELECT COUNT(*) as count FROM employees`)
      // THEN: assertion
      expect(verifyRecords.rows[0].count).toBe(3)

      // Test validation error with rollback
      const validationResponse = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { name: 'Valid', email: 'valid@example.com' },
            { name: 'Invalid' }, // Missing email
          ],
        },
      })
      // THEN: assertion
      expect(validationResponse.status()).toBe(400)

      // Verify rollback (still 3 records, no new ones)
      const verifyRollback = await executeQuery(`SELECT COUNT(*) as count FROM employees`)
      // THEN: assertion
      expect(verifyRollback.rows[0].count).toBe(3)

      // Test permission denied (member without create permission)
      const forbiddenResponse = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer member_token',
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ name: 'Test', email: 'test@example.com' }],
        },
      })
      // THEN: assertion
      expect(forbiddenResponse.status()).toBe(403)

      // Test unauthorized
      const unauthorizedResponse = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ name: 'Test', email: 'test@example.com' }],
        },
      })
      // THEN: assertion
      expect(unauthorizedResponse.status()).toBe(401)

      // Test field-level write restriction
      const fieldForbiddenResponse = await request.post('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer member_token',
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ name: 'Test', email: 'test2@example.com', salary: 99_999 }],
        },
      })
      // THEN: assertion
      expect(fieldForbiddenResponse.status()).toBe(403)
    }
  )
})
