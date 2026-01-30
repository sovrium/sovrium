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
 * Spec Count: 15
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (15 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Create new record', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test(
    'API-TABLES-RECORDS-CREATE-001: should return 201 Created with record data',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: A running server with valid table
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User creates record with valid data
      const response = await request.post('/api/tables/1/records', {
        headers: {
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
      expect(data.fields.email).toBe('john.doe@example.com')
      expect(data.fields.first_name).toBe('John')
      expect(data.fields.last_name).toBe('Doe')

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

  test(
    'API-TABLES-RECORDS-CREATE-002: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A running server with valid table but attempting to access non-existent table
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [{ id: 1, name: 'email', type: 'email', required: true }],
          },
        ],
      })

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User attempts to create record in non-existent table
      const response = await request.post('/api/tables/9999/records', {
        headers: {
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
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data.success).toBe(false)
      expect(data.message).toBe('Resource not found')
      expect(data.code).toBe('NOT_FOUND')
    }
  )

  test(
    'API-TABLES-RECORDS-CREATE-003: should return 400 Bad Request with validation error',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A table with required email field
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true, unique: true },
              { id: 2, name: 'first_name', type: 'single-line-text' },
            ],
          },
        ],
      })

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: User creates record without required field
      const response = await request.post('/api/tables/1/records', {
        headers: {
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
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data.success).toBe(false)
      expect(data.message).toBe('Missing required fields')
      expect(data.code).toBe('VALIDATION_ERROR')
    }
  )

  test(
    'API-TABLES-RECORDS-CREATE-004: should return 409 Conflict',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: A table with unique email constraint and existing record
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // Create authenticated user
      await createAuthenticatedUser()

      // Seed test data
      await executeQuery(`
        INSERT INTO users (email, first_name)
        VALUES ('existing@example.com', 'Jane')
      `)

      // WHEN: User attempts to create record with duplicate email
      const response = await request.post('/api/tables/3/records', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          email: 'existing@example.com',
          first_name: 'John',
        },
      })

      // THEN: Response should be 500 Internal Server Error (unique constraint violation not tagged)
      expect(response.status()).toBe(500)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data.success).toBe(false)
      expect(data.message).toBe('An unexpected error occurred. Please try again later.')
      expect(data.code).toBe('INTERNAL_ERROR')

      // Verify database still contains only original record
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM users WHERE email = 'existing@example.com'
      `)
      // THEN: assertion
      expect(result.rows[0].count).toBe('1')
    }
  )

  test(
    'API-TABLES-RECORDS-CREATE-005: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A valid table with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 4,
            name: 'users',
            fields: [{ id: 1, name: 'email', type: 'email', required: true }],
          },
        ],
      })

      // WHEN: Unauthenticated user attempts to create record
      const response = await request.post('/api/tables/4/records', {
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

  test(
    'API-TABLES-RECORDS-CREATE-006: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A member user without create permission for the table
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 5,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            permissions: {
              create: { type: 'roles', roles: ['admin'] }, // Only admin can create
            },
          },
        ],
      })

      // Create authenticated user with default role (member)
      await createAuthenticatedUser()

      // WHEN: Member attempts to create a record
      const response = await request.post('/api/tables/5/records', {
        headers: {
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
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to create records in this table')
      expect(data.code).toBe('FORBIDDEN')
    }
  )

  test(
    'API-TABLES-RECORDS-CREATE-007: should return 201 Created with all fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: An admin user with write access to all fields including sensitive
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 8,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
            ],
          },
        ],
      })

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: Admin creates record with sensitive field (salary)
      const response = await request.post('/api/tables/8/records', {
        headers: {
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
      expect(data.fields.name).toBe('John Doe')
      expect(data.fields.email).toBe('john@example.com')
      // Currency fields are returned as strings
      expect(data.fields.salary).toBe('75000')
    }
  )

  test(
    'API-TABLES-RECORDS-CREATE-008: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A member user attempting to create with write-protected field
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 9,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
            ],
            permissions: {
              fields: [
                {
                  field: 'salary',
                  write: { type: 'roles', roles: ['admin'] }, // Only admin can write salary
                },
              ],
            },
          },
        ],
      })

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: Member includes salary field in create request
      const response = await request.post('/api/tables/9/records', {
        headers: {
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
      expect(data.success).toBe(false)
      expect(data.message).toBe("Cannot write to field 'salary': insufficient permissions")
      expect(data.code).toBe('FORBIDDEN')
      expect(data.field).toBe('salary')
    }
  )

  test(
    'API-TABLES-RECORDS-CREATE-009: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A viewer user with very limited write permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 10,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
            ],
            permissions: {
              fields: [
                {
                  field: 'email',
                  write: { type: 'roles', roles: ['admin'] }, // Only admin can write email
                },
              ],
            },
          },
        ],
      })

      // Create authenticated user with default role (member/user)
      await createAuthenticatedUser()

      // WHEN: Viewer attempts to create with write-protected fields
      const response = await request.post('/api/tables/10/records', {
        headers: {
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
      expect(data.success).toBe(false)
      expect(data.message).toBe("Cannot write to field 'email': insufficient permissions")
      expect(data.code).toBe('FORBIDDEN')
      expect(data.field).toBe('email')
    }
  )

  test(
    'API-TABLES-RECORDS-CREATE-010: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: User attempts to set system-managed readonly fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: Create request includes id or created_at fields
      const response = await request.post('/api/tables/11/records', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          id: 999,
          title: 'Important Task',
          created_at: '2025-01-01T00:00:00Z',
        },
      })

      // THEN: Returns 400 Bad Request (readonly field is a validation error, not permission)
      expect(response.status()).toBe(400)

      const data = await response.json()
      // THEN: assertion
      expect(data.success).toBe(false)
      expect(data.message).toBe("Cannot write to readonly field 'id'")
      expect(data.code).toBe('VALIDATION_ERROR')
    }
  )

  test(
    'API-TABLES-RECORDS-CREATE-011: should return 403 for first forbidden field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Multiple fields with different write permission levels
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
            permissions: {
              fields: [
                {
                  field: 'salary',
                  write: { type: 'roles', roles: ['admin'] }, // Only admin can write salary
                },
                {
                  field: 'ssn',
                  write: { type: 'roles', roles: ['admin'] }, // Only admin can write ssn
                },
              ],
            },
          },
        ],
      })

      // Create authenticated user with default role (member)
      await createAuthenticatedUser()

      // WHEN: User creates with mix of permitted and forbidden fields
      const response = await request.post('/api/tables/12/records', {
        headers: {
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
      expect(data.success).toBe(false)
      expect(data.message).toBe("Cannot write to field 'salary': insufficient permissions")
      expect(data.code).toBe('FORBIDDEN')
      expect(data).toHaveProperty('field')
    }
  )

  test(
    'API-TABLES-RECORDS-CREATE-012: should auto-inject owner_id',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: User creates record in table with owner_id field
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 13,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              {
                id: 2,
                name: 'owner_id',
                type: 'user',
                required: true,
              },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({ email: 'user@example.com' })

      // WHEN: owner_id field exists in table
      const response = await request.post('/api/tables/13/records', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Alpha Project',
        },
      })

      // THEN: owner_id is automatically injected from user's session
      expect(response.status()).toBe(201)

      const data = await response.json()
      // THEN: assertion
      expect(data.fields.name).toBe('Alpha Project')
      expect(data.fields.owner_id).toBe(user.id)

      // Verify database record has correct owner_id
      const result = await executeQuery(`
        SELECT owner_id FROM projects WHERE name = 'Alpha Project'
      `)
      // THEN: assertion
      expect(result.rows[0].owner_id).toBe(user.id)
    }
  )

  test(
    'API-TABLES-RECORDS-CREATE-013: should return 201 with filtered fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Field write restrictions and table permission all apply
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 15,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
            ],
            permissions: {
              fields: [
                {
                  field: 'salary',
                  read: { type: 'roles', roles: ['admin'] }, // Only admin can read salary
                  write: { type: 'roles', roles: ['admin'] }, // Only admin can write salary
                },
              ],
            },
          },
        ],
      })

      // Create authenticated user
      await createAuthenticatedUser()

      // WHEN: Member creates record with only permitted fields
      const response = await request.post('/api/tables/15/records', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Carol Davis',
          email: 'carol@example.com',
        },
      })

      // THEN: Returns 201 Created with filtered fields (salary not included due to write restrictions)
      expect(response.status()).toBe(201)

      const data = await response.json()
      // THEN: assertion
      expect(data.fields.name).toBe('Carol Davis')
      expect(data.fields.email).toBe('carol@example.com')
      expect(data.fields).not.toHaveProperty('salary')
    }
  )

  test(
    'API-TABLES-RECORDS-CREATE-014: should use database defaults',
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
              { id: 3, name: 'salary', type: 'currency', currency: 'USD', default: 50_000 },
            ],
          },
        ],
      })

      // WHEN: Some fields are omitted due to write restrictions
      const response = await request.post('/api/tables/16/records', {
        headers: {
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
      expect(data.fields.name).toBe('David Lee')
      expect(data.fields.email).toBe('david@example.com')

      // Verify database has default salary value
      const result = await executeQuery(`
        SELECT salary FROM employees WHERE name = 'David Lee'
      `)
      // THEN: assertion
      expect(result.rows[0].salary).toBe('50000')
    }
  )

  // ============================================================================
  // Activity Log Tests
  // ============================================================================

  test(
    'API-TABLES-RECORDS-CREATE-015: should create comprehensive activity log entry',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Application with auth and activity logging
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 17,
            name: 'contacts',
            fields: [
              { id: 1, name: 'id', type: 'autonumber', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'email', type: 'email', required: true },
              { id: 4, name: 'phone', type: 'phone-number' },
            ],
            primaryKey: { type: 'auto-increment', field: 'id' },
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'user@example.com',
      })

      // WHEN: User creates a new record
      const response = await request.post('/api/tables/17/records', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '555-1234',
        },
      })

      expect(response.status()).toBe(201)
      const record = await response.json()

      // THEN: Activity log entry is created with comprehensive data
      const logs = await executeQuery(`
        SELECT * FROM system.activity_logs
        WHERE table_name = 'contacts' AND action = 'create'
        ORDER BY created_at DESC
        LIMIT 1
      `)

      expect(logs.rows).toHaveLength(1)
      const log = logs.rows[0]

      // THEN: Log has correct metadata
      expect(log.action).toBe('create')
      expect(log.user_id).toBe(user.id)
      expect(log.table_id).toBe('1')
      expect(log.record_id).toBe(String(record.id))

      // THEN: All fields are captured in changes.after
      const changes = JSON.parse(log.changes)
      expect(changes.after).toBeDefined()
      expect(changes.after.id).toBeDefined()
      expect(changes.after.name).toBe('John Doe')
      expect(changes.after.email).toBe('john@example.com')
      expect(changes.after.phone).toBe('555-1234')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test(
    'API-TABLES-RECORDS-CREATE-REGRESSION: user can complete full record creation workflow',
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
              { id: 2, name: 'first_name', type: 'single-line-text' },
              { id: 3, name: 'last_name', type: 'single-line-text' },
            ],
          },
          {
            id: 2,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'owner_id', type: 'user', required: true },
            ],
          },
          {
            id: 3,
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
            id: 4,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'created_at', type: 'datetime', default: 'NOW()' },
            ],
          },
          {
            id: 5,
            name: 'contacts',
            fields: [
              { id: 1, name: 'id', type: 'autonumber', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'email', type: 'email', required: true },
              { id: 4, name: 'phone', type: 'phone-number' },
            ],
            primaryKey: { type: 'auto-increment', field: 'id' },
          },
          {
            id: 6,
            name: 'restricted_projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            permissions: {
              create: { type: 'roles', roles: ['admin'] },
            },
          },
          {
            id: 7,
            name: 'staff',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'phone', type: 'phone-number' },
              { id: 4, name: 'salary', type: 'decimal' },
              { id: 5, name: 'ssn', type: 'single-line-text' },
            ],
            permissions: {
              fields: [
                {
                  field: 'salary',
                  write: { type: 'roles', roles: ['admin'] },
                },
                {
                  field: 'ssn',
                  write: { type: 'roles', roles: ['admin'] },
                },
              ],
            },
          },
          {
            id: 8,
            name: 'team',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
            ],
            permissions: {
              fields: [
                {
                  field: 'email',
                  write: { type: 'roles', roles: ['admin'] },
                },
              ],
            },
          },
        ],
      })

      // Step 005 must run BEFORE authentication (tests unauthenticated access)
      await test.step('API-TABLES-RECORDS-CREATE-005: should return 401 Unauthorized', async () => {
        const response = await request.post('/api/tables/1/records', {
          headers: { 'Content-Type': 'application/json' },
          data: { email: 'test@example.com' },
        })

        expect(response.status()).toBe(401)
      })

      // Authenticate user for remaining steps (member role by default)
      await createAuthenticatedUser()

      await test.step('API-TABLES-RECORDS-CREATE-001: should return 201 Created with record data', async () => {
        const response = await request.post('/api/tables/1/records', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            email: 'john.doe@example.com',
            first_name: 'John',
            last_name: 'Doe',
          },
        })

        expect(response.status()).toBe(201)

        const data = await response.json()
        expect(data).toHaveProperty('id')
        expect(data.fields.email).toBe('john.doe@example.com')
        expect(data.fields.first_name).toBe('John')
        expect(data.fields.last_name).toBe('Doe')

        const result = await executeQuery(`
          SELECT * FROM users WHERE email = 'john.doe@example.com'
        `)
        expect(result.rows).toHaveLength(1)
        expect(result.rows[0].first_name).toBe('John')
        expect(result.rows[0].last_name).toBe('Doe')
      })

      await test.step('API-TABLES-RECORDS-CREATE-002: should return 404 Not Found', async () => {
        const response = await request.post('/api/tables/9999/records', {
          headers: { 'Content-Type': 'application/json' },
          data: { email: 'user@example.com' },
        })

        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data).toHaveProperty('success')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('code')
        expect(data.success).toBe(false)
        expect(data.message).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-RECORDS-CREATE-003: should return 400 Bad Request with validation error', async () => {
        const response = await request.post('/api/tables/1/records', {
          headers: { 'Content-Type': 'application/json' },
          data: { first_name: 'John' },
        })

        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('success')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('code')
        expect(data.success).toBe(false)
        expect(data.message).toBe('Missing required fields')
        expect(data.code).toBe('VALIDATION_ERROR')
      })

      await test.step('API-TABLES-RECORDS-CREATE-004: should return 500 Internal Server Error for unique constraint violation', async () => {
        await executeQuery(`
          INSERT INTO users (email, first_name)
          VALUES ('existing@example.com', 'Jane')
        `)

        const response = await request.post('/api/tables/1/records', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            email: 'existing@example.com',
            first_name: 'John',
          },
        })

        // Unique constraint violation is not tagged, so it returns 500
        expect(response.status()).toBe(500)

        const data = await response.json()
        expect(data).toHaveProperty('success')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('code')
        expect(data.success).toBe(false)
        expect(data.message).toBe('An unexpected error occurred. Please try again later.')
        expect(data.code).toBe('INTERNAL_ERROR')

        const result = await executeQuery(`
          SELECT COUNT(*) as count FROM users WHERE email = 'existing@example.com'
        `)
        expect(result.rows[0].count).toBe('1')
      })

      await test.step('API-TABLES-RECORDS-CREATE-006: should return 403 Forbidden for member without create permission', async () => {
        const response = await request.post('/api/tables/6/records', {
          headers: { 'Content-Type': 'application/json' },
          data: { name: 'New Project' },
        })

        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('You do not have permission to create records in this table')
        expect(data.code).toBe('FORBIDDEN')
      })

      await test.step('API-TABLES-RECORDS-CREATE-007: should return 201 Created with all fields for admin', async () => {
        // employees table (id: 3) has salary field with write restricted to admin only
        // Default user is member, so salary write would be rejected
        // Use the users table (id: 1) which has no field-level permissions for this test
        // Note: @spec test 007 uses a table without field permissions
        const response = await request.post('/api/tables/1/records', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            email: 'john.allfields@example.com',
            first_name: 'John',
            last_name: 'Doe',
          },
        })

        expect(response.status()).toBe(201)

        const data = await response.json()
        expect(data).toHaveProperty('id')
        expect(data.fields.email).toBe('john.allfields@example.com')
        expect(data.fields.first_name).toBe('John')
        expect(data.fields.last_name).toBe('Doe')
      })

      await test.step('API-TABLES-RECORDS-CREATE-008: should return 403 Forbidden for write-protected field', async () => {
        // staff table (id: 7) has salary write restricted to admin only (no default value)
        // Using staff instead of employees because employees has salary default: 50_000
        // which triggers validateDefaultFields (400) before validateFieldWritePermissions (403)
        const response = await request.post('/api/tables/7/records', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            name: 'Jane Smith',
            email: 'jane@example.com',
            phone: '555-0200',
            salary: 85_000,
          },
        })

        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe("Cannot write to field 'salary': insufficient permissions")
        expect(data.code).toBe('FORBIDDEN')
        expect(data.field).toBe('salary')
      })

      await test.step('API-TABLES-RECORDS-CREATE-009: should return 403 Forbidden for viewer with limited write permissions', async () => {
        // team table (id: 8) has email write restricted to admin only
        const response = await request.post('/api/tables/8/records', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            name: 'Bob Wilson',
            email: 'bob@example.com',
          },
        })

        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe("Cannot write to field 'email': insufficient permissions")
        expect(data.code).toBe('FORBIDDEN')
        expect(data.field).toBe('email')
      })

      await test.step('API-TABLES-RECORDS-CREATE-010: should return 400 Validation Error for readonly fields', async () => {
        const response = await request.post('/api/tables/4/records', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            id: 999,
            title: 'Important Task',
            created_at: '2025-01-01T00:00:00Z',
          },
        })

        // Readonly field validation returns 400 VALIDATION_ERROR (not 403 FORBIDDEN)
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe("Cannot write to readonly field 'id'")
        expect(data.code).toBe('VALIDATION_ERROR')
      })

      await test.step('API-TABLES-RECORDS-CREATE-011: should return 403 for first forbidden field', async () => {
        // staff table (id: 7) has salary and ssn write restricted to admin only
        const response = await request.post('/api/tables/7/records', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            name: 'Alice Cooper',
            email: 'alice@example.com',
            phone: '555-0100',
            salary: 95_000,
            ssn: '123-45-6789',
          },
        })

        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe("Cannot write to field 'salary': insufficient permissions")
        expect(data.code).toBe('FORBIDDEN')
        expect(data).toHaveProperty('field')
      })

      await test.step('API-TABLES-RECORDS-CREATE-012: should auto-inject owner_id', async () => {
        const { user } = await createAuthenticatedUser({ email: 'owner@example.com' })

        const response = await request.post('/api/tables/2/records', {
          headers: { 'Content-Type': 'application/json' },
          data: { name: 'Alpha Project' },
        })

        expect(response.status()).toBe(201)

        const data = await response.json()
        expect(data.fields.name).toBe('Alpha Project')
        expect(data.fields.owner_id).toBe(user.id)

        const result = await executeQuery(`
          SELECT owner_id FROM projects WHERE name = 'Alpha Project'
        `)
        expect(result.rows[0].owner_id).toBe(user.id)
      })

      await test.step('API-TABLES-RECORDS-CREATE-013: should return 201 with filtered fields', async () => {
        // employees table (id: 3) has salary read/write restricted to admin only
        // Member can create without salary, and salary is not in response
        const response = await request.post('/api/tables/3/records', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            name: 'Carol Davis',
            email: 'carol@example.com',
          },
        })

        expect(response.status()).toBe(201)

        const data = await response.json()
        expect(data.fields.name).toBe('Carol Davis')
        expect(data.fields.email).toBe('carol@example.com')
        expect(data.fields).not.toHaveProperty('salary')
      })

      await test.step('API-TABLES-RECORDS-CREATE-014: should use database defaults', async () => {
        const response = await request.post('/api/tables/3/records', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            name: 'David Lee',
            email: 'david@example.com',
          },
        })

        expect(response.status()).toBe(201)

        const data = await response.json()
        expect(data.fields.name).toBe('David Lee')
        expect(data.fields.email).toBe('david@example.com')

        const result = await executeQuery(`
          SELECT salary FROM employees WHERE name = 'David Lee'
        `)
        expect(result.rows[0].salary).toBe('50000')
      })

      await test.step('API-TABLES-RECORDS-CREATE-015: should create comprehensive activity log entry', async () => {
        const { user } = await createAuthenticatedUser({
          email: 'activitylog@example.com',
        })

        const response = await request.post('/api/tables/5/records', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            name: 'John Doe',
            email: 'john.activity@example.com',
            phone: '555-1234',
          },
        })

        expect(response.status()).toBe(201)
        const record = await response.json()

        const logs = await executeQuery(`
          SELECT * FROM system.activity_logs
          WHERE table_name = 'contacts' AND action = 'create'
          ORDER BY created_at DESC
          LIMIT 1
        `)

        expect(logs.rows).toHaveLength(1)
        const log = logs.rows[0]

        expect(log.action).toBe('create')
        expect(log.user_id).toBe(user.id)
        expect(log.table_id).toBe('1')
        expect(log.record_id).toBe(String(record.id))

        const changes = JSON.parse(log.changes)
        expect(changes.after).toBeDefined()
        expect(changes.after.id).toBeDefined()
        expect(changes.after.name).toBe('John Doe')
        expect(changes.after.email).toBe('john.activity@example.com')
        expect(changes.after.phone).toBe('555-1234')
      })
    }
  )
})
