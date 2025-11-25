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
    'API-RECORDS-BATCH-001: should return 201 with created=3 and records array',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Table 'users' exists with 0 records
      await executeQuery(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `)

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
      expect(data).toHaveProperty('created')
      expect(data).toHaveProperty('records')
      expect(data.created).toBe(3)
      expect(data.records).toHaveLength(3)

      // Verify database contains all 3 records
      const result = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      expect(result.rows[0].count).toBe(3)
    }
  )

  test.fixme(
    'API-RECORDS-BATCH-002: should return 201 with created=2 and no records array',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Table 'users' exists
      await executeQuery(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          name VARCHAR(255)
        )
      `)

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
      expect(data).toHaveProperty('created')
      expect(data.created).toBe(2)
      expect(data).not.toHaveProperty('records')
    }
  )

  test.fixme(
    'API-RECORDS-BATCH-003: should return 400 with rollback on validation error',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Table 'users' with email NOT NULL constraint
      await executeQuery(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          name VARCHAR(255)
        )
      `)

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
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('details')

      // Verify no records created due to transaction rollback
      const result = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      expect(result.rows[0].count).toBe(0)
    }
  )

  test.fixme(
    'API-RECORDS-BATCH-PERMISSIONS-UNAUTHORIZED-001: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: An unauthenticated user
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)

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
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-RECORDS-BATCH-PERMISSIONS-FORBIDDEN-MEMBER-001: should return 403 for member without create permission',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A member user without create permission
      await executeQuery(`
        CREATE TABLE projects (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)

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
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to create records in this table')
    }
  )

  test.fixme(
    'API-RECORDS-BATCH-PERMISSIONS-FORBIDDEN-VIEWER-001: should return 403 for viewer',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A viewer user with read-only access
      await executeQuery(`
        CREATE TABLE documents (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)

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
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Forbidden')
    }
  )

  test.fixme(
    'API-RECORDS-BATCH-PERMISSIONS-ORG-AUTO-INJECT-001: should auto-inject organization_id for all records',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: An admin user from org_123
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)

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
      expect(data.created).toBe(2)
      expect(data.records[0].organization_id).toBe('org_123')
      expect(data.records[1].organization_id).toBe('org_123')
    }
  )

  test.fixme(
    'API-RECORDS-BATCH-PERMISSIONS-FIELD-WRITE-FORBIDDEN-001: should return 403 when creating with protected field',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A member user with field-level write restrictions (salary protected)
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          salary DECIMAL(10,2),
          organization_id VARCHAR(255)
        )
      `)

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
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to write to field: salary')
    }
  )

  test.fixme(
    'API-RECORDS-BATCH-PERMISSIONS-READONLY-FIELD-001: should return 403 for readonly fields',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: An admin user attempting to set readonly fields
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          organization_id VARCHAR(255)
        )
      `)

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
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('Cannot set readonly field: id')
    }
  )

  test.fixme(
    'API-RECORDS-BATCH-PERMISSIONS-ORG-OVERRIDE-PREVENTED-001: should return 403 when setting different organization_id',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A member user attempting to set different organization_id
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)

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
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('Cannot create records for different organization')
    }
  )

  test.fixme(
    'API-RECORDS-BATCH-PERMISSIONS-PARTIAL-FIELD-FILTERING-001: should filter protected fields from response',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A member user with field-level read restrictions
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255),
          salary DECIMAL(10,2),
          organization_id VARCHAR(255)
        )
      `)

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
      expect(data.created).toBe(2)
      expect(data.records[0].name).toBe('Alice Cooper')
      expect(data.records[1].name).toBe('Bob Smith')

      // Salary field not in response
      expect(data.records[0]).not.toHaveProperty('salary')
      expect(data.records[1]).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-RECORDS-BATCH-PERMISSIONS-ADMIN-FULL-ACCESS-001: should return 201 with all fields for admin',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: An admin user with full permissions
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          salary DECIMAL(10,2),
          organization_id VARCHAR(255)
        )
      `)

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
      expect(data.created).toBe(2)
      expect(data.records[0].name).toBe('Charlie Brown')
      expect(data.records[0].salary).toBe(130_000)
      expect(data.records[1].name).toBe('Diana Prince')
      expect(data.records[1].salary).toBe(95_000)
    }
  )

  test.fixme(
    'API-RECORDS-BATCH-PERMISSIONS-COMBINED-SCENARIO-001: should enforce combined permissions',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A member with create permission but field restrictions
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255),
          salary DECIMAL(10,2),
          organization_id VARCHAR(255)
        )
      `)

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
      expect(data.created).toBe(3)

      // Salary field not in response for all records
      expect(data.records[0]).not.toHaveProperty('salary')
      expect(data.records[1]).not.toHaveProperty('salary')
      expect(data.records[2]).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-RECORDS-BATCH-PERMISSIONS-DUPLICATE-PREVENTION-001: should return 400 for duplicate unique field values',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Table with unique email constraint
      await executeQuery(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255)
        )
      `)

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
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('details')

      // Verify no records created due to rollback
      const result = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      expect(result.rows[0].count).toBe(0)
    }
  )

  test.fixme(
    'API-RECORDS-BATCH-PERMISSIONS-PAYLOAD-LIMIT-001: should return 413 when exceeding 1000 record limit',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Table exists
      await executeQuery(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL
        )
      `)

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
    async ({ request, executeQuery }) => {
      // GIVEN: Application with representative table and permission configuration
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          salary DECIMAL(10,2),
          organization_id VARCHAR(255)
        )
      `)

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
      expect(successResponse.status()).toBe(201)
      const result = await successResponse.json()
      expect(result.created).toBe(3)
      expect(result.records).toHaveLength(3)

      // Verify records in database
      const verifyRecords = await executeQuery(`SELECT COUNT(*) as count FROM employees`)
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
      expect(validationResponse.status()).toBe(400)

      // Verify rollback (still 3 records, no new ones)
      const verifyRollback = await executeQuery(`SELECT COUNT(*) as count FROM employees`)
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
      expect(fieldForbiddenResponse.status()).toBe(403)
    }
  )
})
