/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Create new record
 *
 * Source: specs/api/paths/tables/{tableId}/records/post.json
 * Domain: api
 * Spec Count: 17
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (17 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Create new record', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-CREATE-001: should return 201 Created with record data',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A running server with valid table
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true, unique: true },
              { id: 2, name: 'first_name', type: 'single-line-text' },
              { id: 3, name: 'last_name', type: 'single-line-text' },
            ],
          },
        ],
      })

      // WHEN: User creates record with valid data
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
          'Content-Type': 'application/json',
        },
        data: {
          email: 'john.doe@example.com',
          first_name: 'John',
          last_name: 'Doe',
        },
      })

      // THEN: Response should be 201 Created with record data
      expect(response.status()).toBe(201)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data.email).toBe('john.doe@example.com')
      expect(data.first_name).toBe('John')
      expect(data.last_name).toBe('Doe')

      // Verify record exists in database
      const result = await executeQuery(`
        SELECT * FROM users WHERE email = 'john.doe@example.com'
      `)
      // THEN: assertion
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].first_name).toBe('John')
      expect(result.rows[0].last_name).toBe('Doe')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-002: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A running server with no table ID 9999

      // WHEN: User attempts to create record in non-existent table
      const response = await request.post('/api/tables/9999/records', {
        headers: {
          Authorization: 'Bearer test_token',
          'Content-Type': 'application/json',
        },
        data: {
          email: 'user@example.com',
        },
      })

      // THEN: Response should be 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Table not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-003: should return 400 Bad Request with validation error',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A table with required email field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true, unique: true },
              { id: 2, name: 'first_name', type: 'single-line-text' },
            ],
          },
        ],
      })

      // WHEN: User creates record without required field
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
          'Content-Type': 'application/json',
        },
        data: {
          first_name: 'John',
        },
      })

      // THEN: Response should be 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Validation error')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-004: should return 409 Conflict',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A table with unique email constraint and existing record
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true, unique: true },
              { id: 2, name: 'first_name', type: 'single-line-text' },
            ],
          },
        ],
      })

      // Seed test data
      await executeQuery(`
        INSERT INTO users (email, first_name)
        VALUES ('existing@example.com', 'Jane')
      `)

      // WHEN: User attempts to create record with duplicate email
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
          'Content-Type': 'application/json',
        },
        data: {
          email: 'existing@example.com',
          first_name: 'John',
        },
      })

      // THEN: Response should be 409 Conflict
      expect(response.status()).toBe(409)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Unique constraint violation')

      // Verify database still contains only original record
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM users WHERE email = 'existing@example.com'
      `)
      // THEN: assertion
      expect(result.rows[0].count).toBe('1')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-005: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A valid table
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'users',
            fields: [{ id: 1, name: 'email', type: 'email', required: true }],
          },
        ],
      })

      // WHEN: Unauthenticated user attempts to create record
      const response = await request.post('/api/tables/1/records', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          email: 'test@example.com',
        },
      })

      // THEN: Response should be 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-PERMISSIONS-FORBIDDEN-MEMBER-001: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A member user without create permission for the table
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          { id: 5, name: 'projects', fields: [{ id: 1, name: 'name', type: 'single-line-text' }] },
        ],
      })

      // WHEN: Member attempts to create a record
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_token',
          'Content-Type': 'application/json',
        },
        data: {
          name: 'New Project',
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Forbidden')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-PERMISSIONS-FORBIDDEN-VIEWER-001: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A viewer user without create permission
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          { id: 6, name: 'tasks', fields: [{ id: 1, name: 'title', type: 'single-line-text' }] },
        ],
      })

      // WHEN: Viewer attempts to create a record
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer viewer_token',
          'Content-Type': 'application/json',
        },
        data: {
          title: 'New Task',
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to create records in this table')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-PERMISSIONS-ORG-ISOLATION-001: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A user from organization A attempting to create in organization B's table
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          { id: 7, name: 'employees', fields: [{ id: 1, name: 'name', type: 'single-line-text' }] },
        ],
      })

      // WHEN: User attempts to create record in different organization's table
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          name: 'John Doe',
        },
      })

      // THEN: Returns 404 Not Found (don't leak existence)
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Table not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-PERMISSIONS-FIELD-WRITE-ADMIN-001: should return 201 Created with all fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: An admin user with write access to all fields including sensitive
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'salary', type: 'decimal' },
            ],
          },
        ],
      })

      // WHEN: Admin creates record with sensitive field (salary)
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          salary: 75_000,
        },
      })

      // THEN: Returns 201 Created with all fields
      expect(response.status()).toBe(201)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data.name).toBe('John Doe')
      expect(data.email).toBe('john@example.com')
      expect(data.salary).toBe(75_000)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-PERMISSIONS-FIELD-WRITE-FORBIDDEN-001: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A member user attempting to create with write-protected field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 9,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'salary', type: 'decimal' },
            ],
          },
        ],
      })

      // WHEN: Member includes salary field in create request
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_token',
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Jane Smith',
          email: 'jane@example.com',
          salary: 85_000,
        },
      })

      // THEN: Returns 403 Forbidden (cannot write to protected field)
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe("Cannot write to field 'salary': insufficient permissions")
      expect(data.field).toBe('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-PERMISSIONS-FIELD-WRITE-VIEWER-001: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A viewer user with very limited write permissions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 10,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
            ],
          },
        ],
      })

      // WHEN: Viewer attempts to create with write-protected fields
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer viewer_token',
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Bob Wilson',
          email: 'bob@example.com',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Forbidden')
      expect(data.field).toBe('email')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-PERMISSIONS-READONLY-FIELD-001: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: User attempts to set system-managed readonly fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 11,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'created_at', type: 'datetime', default: 'NOW()' },
            ],
          },
        ],
      })

      // WHEN: Create request includes id or created_at fields
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          id: 999,
          title: 'Important Task',
          created_at: '2025-01-01T00:00:00Z',
        },
      })

      // THEN: Returns 403 Forbidden (cannot write to readonly fields)
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe("Cannot write to readonly field 'id'")
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-PERMISSIONS-FIELD-WRITE-MULTIPLE-001: should return 403 for first forbidden field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Multiple fields with different write permission levels
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 12,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'phone', type: 'phone-number' },
              { id: 4, name: 'salary', type: 'decimal' },
              { id: 5, name: 'ssn', type: 'single-line-text' },
            ],
          },
        ],
      })

      // WHEN: User creates with mix of permitted and forbidden fields
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_token',
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Alice Cooper',
          email: 'alice@example.com',
          phone: '555-0100',
          salary: 95_000,
          ssn: '123-45-6789',
        },
      })

      // THEN: Returns 403 for first forbidden field encountered
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Forbidden')
      expect(data).toHaveProperty('field')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-PERMISSIONS-ORG-AUTO-INJECT-001: should auto-inject organization_id',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: User creates record in multi-tenant table
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 13,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text', required: true },
            ],
          },
        ],
      })

      // WHEN: Organization ID field exists in table
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Alpha Project',
        },
      })

      // THEN: Organization ID is automatically injected from user's session
      expect(response.status()).toBe(201)

      const data = await response.json()
      // THEN: assertion
      expect(data.name).toBe('Alpha Project')
      expect(data.organization_id).toBe('org_123')

      // Verify database record has correct organization_id
      const result = await executeQuery(`
        SELECT organization_id FROM projects WHERE name = 'Alpha Project'
      `)
      // THEN: assertion
      expect(result.rows[0].organization_id).toBe('org_123')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-PERMISSIONS-ORG-OVERRIDE-PREVENTED-001: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: User attempts to create record with different organization_id
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 14,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })

      // WHEN: Request body includes organization_id different from user's org
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Malicious Project',
          organization_id: 'org_456',
        },
      })

      // THEN: Returns 403 Forbidden (cannot set org_id to different org)
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('Cannot create record for a different organization')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-PERMISSIONS-COMBINED-001: should return 201 with filtered fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Organization isolation, field write restrictions, and table permission all apply
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 15,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'salary', type: 'decimal' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })

      // WHEN: Member creates record with only permitted fields
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_token',
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Carol Davis',
          email: 'carol@example.com',
        },
      })

      // THEN: Returns 201 Created with auto-injected org_id and filtered fields
      expect(response.status()).toBe(201)

      const data = await response.json()
      // THEN: assertion
      expect(data.name).toBe('Carol Davis')
      expect(data.email).toBe('carol@example.com')
      expect(data.organization_id).toBe('org_123')
      expect(data).not.toHaveProperty('salary')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-CREATE-PERMISSIONS-PARTIAL-DATA-001: should use database defaults',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: User creates record with only permitted fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 16,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'salary', type: 'decimal', default: 50_000 },
            ],
          },
        ],
      })

      // WHEN: Some fields are omitted due to write restrictions
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer member_token',
          'Content-Type': 'application/json',
        },
        data: {
          name: 'David Lee',
          email: 'david@example.com',
        },
      })

      // THEN: Returns 201 Created with defaults/nulls for omitted fields
      expect(response.status()).toBe(201)

      const data = await response.json()
      // THEN: assertion
      expect(data.name).toBe('David Lee')
      expect(data.email).toBe('david@example.com')

      // Verify database has default salary value
      const result = await executeQuery(`
        SELECT salary FROM employees WHERE name = 'David Lee'
      `)
      // THEN: assertion
      expect(result.rows[0].salary).toBe('50000')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'user can complete full record creation workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with permissions and validation
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 17,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true, unique: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })

      // WHEN/THEN: Create valid record
      const response = await request.post('/api/tables/1/records', {
        headers: {
          Authorization: 'Bearer test_token',
          'Content-Type': 'application/json',
        },
        data: {
          email: 'user@example.com',
          name: 'Test User',
        },
      })

      // THEN: assertion
      expect(response.status()).toBe(201)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data.email).toBe('user@example.com')
      expect(data.name).toBe('Test User')

      // Verify database state
      const result = await executeQuery(`
        SELECT * FROM users WHERE email = 'user@example.com'
      `)
      // THEN: assertion
      expect(result.rows).toHaveLength(1)
    }
  )
})
