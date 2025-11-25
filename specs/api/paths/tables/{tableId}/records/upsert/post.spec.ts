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
 * Spec Count: 15
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (15 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Upsert records (create or update)', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-RECORDS-UPSERT-001: should return 200 with created=1, updated=1',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Table 'users' with existing record (email='john@example.com', name='John')
      await executeQuery(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255),
          status VARCHAR(50)
        )
      `)
      await executeQuery(`
        INSERT INTO users (email, name, status)
        VALUES ('john@example.com', 'John', 'active')
      `)

      // WHEN: Upsert with fieldsToMergeOn=['email'] - 1 existing match, 1 new record
      const response = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer test_token',
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
      expect(data).toHaveProperty('created')
      expect(data).toHaveProperty('updated')
      expect(data).toHaveProperty('records')
      expect(data.created).toBe(1)
      expect(data.updated).toBe(1)
      expect(data.records).toHaveLength(2)

      // Verify database contains both records with correct data
      const result = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      expect(result.rows[0].count).toBe(2)
    }
  )

  test.fixme(
    'API-RECORDS-UPSERT-002: should return 200 with created=2, updated=0',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Table 'users' with 0 records
      await executeQuery(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255)
        )
      `)

      // WHEN: Upsert with fieldsToMergeOn=['email'] - both records are new
      const response = await request.post('/api/tables/1/records/upsert', {
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
          ],
          fieldsToMergeOn: ['email'],
          returnRecords: true,
        },
      })

      // THEN: Returns 200 with created=2, updated=0, and records array
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.created).toBe(2)
      expect(data.updated).toBe(0)
      expect(data.records).toHaveLength(2)

      // Verify database contains both new records
      const result = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      expect(result.rows[0].count).toBe(2)
    }
  )

  test.fixme(
    'API-RECORDS-UPSERT-003: should return 400 with rollback on validation error',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Table 'users' with email NOT NULL constraint
      await executeQuery(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255)
        )
      `)

      // WHEN: Upsert with 1 valid record and 1 missing email (validation error)
      const response = await request.post('/api/tables/1/records/upsert', {
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
          fieldsToMergeOn: ['email'],
        },
      })

      // THEN: Returns 400 BatchValidationError, no records created/updated (rollback)
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
    'API-RECORDS-UPSERT-PERMISSIONS-UNAUTHORIZED-001: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: An unauthenticated user
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          name VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (email, name, organization_id)
        VALUES ('alice@example.com', 'Alice Cooper', 'org_123')
      `)

      // WHEN: User attempts upsert without auth token
      const response = await request.post('/api/tables/1/records/upsert', {
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
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')

      // Verify no records created or updated in database
      const result = await executeQuery(`
        SELECT name FROM employees WHERE email='alice@example.com'
      `)
      expect(result.rows[0].name).toBe('Alice Cooper')
    }
  )

  test.fixme(
    'API-RECORDS-UPSERT-PERMISSIONS-FORBIDDEN-CREATE-001: should return 403 when member lacks create permission',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A member user without create permission
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          name VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)

      // WHEN: Member attempts upsert with new records
      const response = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer member_token',
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
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to create records in this table')
    }
  )

  test.fixme(
    'API-RECORDS-UPSERT-PERMISSIONS-FORBIDDEN-UPDATE-001: should return 403 when member lacks update permission',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A member user without update permission
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          name VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (email, name, organization_id)
        VALUES ('alice@example.com', 'Alice Cooper', 'org_123')
      `)

      // WHEN: Member attempts upsert with existing records
      const response = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer member_token',
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
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to update records in this table')
    }
  )

  test.fixme(
    'API-RECORDS-UPSERT-PERMISSIONS-FORBIDDEN-VIEWER-001: should return 403 for viewer',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A viewer user with read-only access
      await executeQuery(`
        CREATE TABLE projects (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE,
          organization_id VARCHAR(255)
        )
      `)

      // WHEN: Viewer attempts upsert
      const response = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer viewer_token',
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
      expect(data.error).toBe('Forbidden')
    }
  )

  test.fixme(
    'API-RECORDS-UPSERT-PERMISSIONS-ORG-AUTO-INJECT-001: should auto-inject organization_id',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: An admin user from org_123 upserting records
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          name VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (email, name, organization_id)
        VALUES ('alice@example.com', 'Alice', 'org_123')
      `)

      // WHEN: Admin upserts records without specifying organization_id
      const response = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { email: 'alice@example.com', name: 'Updated Alice' },
            { email: 'bob@example.com', name: 'Bob Smith' },
          ],
          fieldsToMergeOn: ['email'],
        },
      })

      // THEN: Returns 200 with organization_id auto-injected for all records
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.created).toBe(1)
      expect(data.updated).toBe(1)
      expect(data.records[0].organization_id).toBe('org_123')
      expect(data.records[1].organization_id).toBe('org_123')
    }
  )

  test.fixme(
    'API-RECORDS-UPSERT-PERMISSIONS-FIELD-WRITE-FORBIDDEN-CREATE-001: should return 403 when creating with protected field',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A member user with field-level write restrictions (salary protected)
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          name VARCHAR(255),
          salary DECIMAL(10,2),
          organization_id VARCHAR(255)
        )
      `)

      // WHEN: Member attempts upsert creating record with protected field
      const response = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer member_token',
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
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to write to field: salary')
    }
  )

  test.fixme(
    'API-RECORDS-UPSERT-PERMISSIONS-FIELD-WRITE-FORBIDDEN-UPDATE-001: should return 403 when updating with protected field',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A member user with field-level write restrictions (salary protected)
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          name VARCHAR(255),
          salary DECIMAL(10,2),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (email, name, salary, organization_id)
        VALUES ('alice@example.com', 'Alice Cooper', 75000, 'org_123')
      `)

      // WHEN: Member attempts upsert updating record with protected field
      const response = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer member_token',
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
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to write to field: salary')
    }
  )

  test.fixme(
    'API-RECORDS-UPSERT-PERMISSIONS-READONLY-FIELD-001: should return 403 for readonly fields',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: An admin user attempting to set readonly fields
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          name VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          organization_id VARCHAR(255)
        )
      `)

      // WHEN: Admin upserts with id or created_at in payload
      const response = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer admin_token',
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
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('Cannot set readonly field: id')
    }
  )

  test.fixme(
    'API-RECORDS-UPSERT-PERMISSIONS-ORG-OVERRIDE-PREVENTED-001: should return 403 when setting different organization_id',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A member user attempting to set different organization_id
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          name VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)

      // WHEN: Member upserts with organization_id='org_456' in payload
      const response = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer member_token',
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            {
              email: 'alice@example.com',
              name: 'Alice Cooper',
              organization_id: 'org_456',
            },
          ],
          fieldsToMergeOn: ['email'],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('Cannot create records for different organization')
    }
  )

  test.fixme(
    'API-RECORDS-UPSERT-PERMISSIONS-PARTIAL-FIELD-FILTERING-001: should filter protected fields from response',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A member user with field-level read restrictions
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          name VARCHAR(255),
          salary DECIMAL(10,2),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (email, name, salary, organization_id)
        VALUES ('alice@example.com', 'Alice', 75000, 'org_123')
      `)

      // WHEN: Member upserts records successfully
      const response = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer member_token',
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
      expect(data.created).toBe(1)
      expect(data.updated).toBe(1)
      expect(data.records[0].name).toBe('Updated Alice')
      expect(data.records[1].name).toBe('Bob Smith')

      // Salary field not in response
      expect(data.records[0]).not.toHaveProperty('salary')
      expect(data.records[1]).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-RECORDS-UPSERT-PERMISSIONS-ADMIN-FULL-ACCESS-001: should return 200 with all fields for admin',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: An admin user with full permissions
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          name VARCHAR(255),
          salary DECIMAL(10,2),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (email, name, salary, organization_id)
        VALUES ('charlie@example.com', 'Charlie', 120000, 'org_789')
      `)

      // WHEN: Admin upserts records with all fields
      const response = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer admin_token',
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
      expect(data.created).toBe(1)
      expect(data.updated).toBe(1)
      expect(data.records[0].name).toBe('Updated Charlie')
      expect(data.records[0].salary).toBe(130_000)
      expect(data.records[1].name).toBe('Diana Prince')
      expect(data.records[1].salary).toBe(95_000)
    }
  )

  test.fixme(
    'API-RECORDS-UPSERT-PERMISSIONS-COMBINED-SCENARIO-001: should enforce combined permissions',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A member with create/update permission but field restrictions
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          name VARCHAR(255),
          salary DECIMAL(10,2),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (email, name, salary, organization_id) VALUES
          ('alice@example.com', 'Alice', 75000, 'org_123'),
          ('bob@example.com', 'Bob', 85000, 'org_123')
      `)

      // WHEN: Member upserts mixed creates/updates with only permitted fields
      const response = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer member_token',
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
      expect(data.created).toBe(1)
      expect(data.updated).toBe(2)

      // Salary field not in response for all records
      expect(data.records[0]).not.toHaveProperty('salary')
      expect(data.records[1]).not.toHaveProperty('salary')
      expect(data.records[2]).not.toHaveProperty('salary')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'user can complete full upsert workflow',
    { tag: '@regression' },
    async ({ request, executeQuery }) => {
      // GIVEN: Application with representative table and permission configuration
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255),
          salary DECIMAL(10,2),
          organization_id VARCHAR(255)
        )
      `)

      // WHEN/THEN: Streamlined workflow testing integration points

      // Test successful upsert (admin with full access)
      const successResponse = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { email: 'john@example.com', name: 'John Doe' },
            { email: 'jane@example.com', name: 'Jane Smith' },
          ],
          fieldsToMergeOn: ['email'],
          returnRecords: true,
        },
      })
      expect(successResponse.status()).toBe(200)
      const result = await successResponse.json()
      expect(result).toHaveProperty('created')
      expect(result).toHaveProperty('updated')

      // Verify records in database
      const verifyRecords = await executeQuery(`SELECT COUNT(*) as count FROM employees`)
      expect(verifyRecords.rows[0].count).toBe(2)

      // Test validation error with rollback
      const validationResponse = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ email: 'valid@example.com', name: 'Valid' }, { name: 'Missing Email' }],
          fieldsToMergeOn: ['email'],
        },
      })
      expect(validationResponse.status()).toBe(400)

      // Test permission denied (member without create permission)
      const forbiddenResponse = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer member_token',
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ email: 'test@example.com', name: 'Test' }],
          fieldsToMergeOn: ['email'],
        },
      })
      expect(forbiddenResponse.status()).toBe(403)

      // Test unauthorized
      const unauthorizedResponse = await request.post('/api/tables/1/records/upsert', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ email: 'test@example.com', name: 'Test' }],
          fieldsToMergeOn: ['email'],
        },
      })
      expect(unauthorizedResponse.status()).toBe(401)

      // Test field-level write restriction
      const fieldForbiddenResponse = await request.post('/api/tables/1/records/upsert', {
        headers: {
          Authorization: 'Bearer member_token',
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ email: 'test@example.com', name: 'Test', salary: 99_999 }],
          fieldsToMergeOn: ['email'],
        },
      })
      expect(fieldForbiddenResponse.status()).toBe(403)
    }
  )
})
