/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/* eslint-disable drizzle/enforce-delete-with-where */
/**
 * E2E Tests for Delete record
 *
 * Source: specs/api/paths/tables/{tableId}/records/{recordId}/delete.json
 * Domain: api
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Delete record', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-001: should return 204 No Content and remove record',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table 'users' with record ID=1
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [{ id: 1, name: 'email', type: 'email', required: true }],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO users (id, email) VALUES (1, 'test@example.com')
      `)

      // WHEN: User deletes record by ID
      const response = await request.delete('/api/tables/1/records/1', {})

      // THEN: Returns 204 No Content and record is removed from database
      expect(response.status()).toBe(204)

      // Verify record no longer exists in database
      const result = await executeQuery(`SELECT COUNT(*) as count FROM users WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].count).toBe(0)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-002: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Table 'users' exists but record ID=9999 does not
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'users',
            fields: [{ id: 1, name: 'email', type: 'email', required: true }],
          },
        ],
      })

      // WHEN: User attempts to delete non-existent record
      const response = await request.delete('/api/tables/1/records/9999', {})

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Record not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An unauthenticated user
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id)
        VALUES (1, 'Alice Cooper', 'org_123')
      `)

      // WHEN: User attempts to delete a record without auth token
      const response = await request.delete('/api/tables/1/records/1')

      // THEN: Returns 401 Unauthorized error
      expect(response.status()).toBe(401)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')

      // Verify record remains in database (not deleted)
      const result = await executeQuery(`SELECT COUNT(*) as count FROM employees WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].count).toBe(1)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-004: should return 403 for member without delete permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A member user without delete permission
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
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id)
        VALUES (1, 'Alice Cooper', 'org_123')
      `)

      // WHEN: Member attempts to delete a record
      const response = await request.delete('/api/tables/1/records/1', {})

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to delete records in this table')

      // Verify record remains in database
      const result = await executeQuery(`SELECT COUNT(*) as count FROM employees WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].count).toBe(1)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-005: should return 403 for viewer with read-only access',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A viewer user with read-only access
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
      await executeQuery(`
        INSERT INTO projects (id, name, organization_id)
        VALUES (1, 'Project Alpha', 'org_456')
      `)

      // WHEN: Viewer attempts to delete a record
      const response = await request.delete('/api/tables/1/records/1', {})

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to delete records in this table')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-006: should return 404 for cross-org access',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An admin user from organization org_123
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id)
        VALUES (1, 'Alice Cooper', 'org_456')
      `)

      // WHEN: Admin attempts to delete record from organization org_456
      const response = await request.delete('/api/tables/1/records/1', {})

      // THEN: Returns 404 Not Found (organization isolation)
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Record not found')

      // Verify record remains in database (not deleted)
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM employees
        WHERE id=1 AND organization_id='org_456'
      `)
      // THEN: assertion
      expect(result.rows[0].count).toBe(1)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-007: should return 204 for admin with full access',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An admin user with full delete permissions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id)
        VALUES (1, 'Alice Cooper', 'org_123')
      `)

      // WHEN: Admin deletes a record from their organization
      const response = await request.delete('/api/tables/1/records/1', {})

      // THEN: Returns 204 No Content and record is deleted
      expect(response.status()).toBe(204)

      // Verify record is deleted from database
      const result = await executeQuery(`SELECT COUNT(*) as count FROM employees WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].count).toBe(0)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-008: should return 204 for owner with full access',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An owner user with full delete permissions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'status', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (id, name, status, organization_id)
        VALUES (1, 'Project Alpha', 'active', 'org_789')
      `)

      // WHEN: Owner deletes a record from their organization
      const response = await request.delete('/api/tables/1/records/1', {})

      // THEN: Returns 204 No Content and record is deleted
      expect(response.status()).toBe(204)

      // Verify record is deleted from database
      const result = await executeQuery(`SELECT COUNT(*) as count FROM projects WHERE id=1`)
      // THEN: assertion
      expect(result.rows[0].count).toBe(0)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-009: should return 404 to prevent org enumeration',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A record with organization_id='org_456' and admin from org_123
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 9,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email', required: true },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, email, organization_id)
        VALUES (1, 'Bob Smith', 'bob@example.com', 'org_456')
      `)

      // WHEN: Admin attempts to delete record from different organization
      const response = await request.delete('/api/tables/1/records/1', {})

      // THEN: Returns 404 Not Found (not 403 - prevents org enumeration)
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Record not found')

      // Verify record remains in database (not deleted)
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM employees
        WHERE id=1 AND organization_id='org_456'
      `)
      // THEN: assertion
      expect(result.rows[0].count).toBe(1)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-010: should return 404 when both org and permission violations exist',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A member without delete permission tries to delete record from different org
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
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id)
        VALUES (1, 'Alice Cooper', 'org_456')
      `)

      // WHEN: Member attempts delete with both permission and org violations
      const response = await request.delete('/api/tables/1/records/1', {})

      // THEN: Returns 404 Not Found (org isolation checked first)
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Record not found')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-011: user can complete full record deletion workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application with representative table and permission configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 11,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO users (id, email, organization_id) VALUES
          (1, 'admin@example.com', 'org_123'),
          (2, 'member@example.com', 'org_123')
      `)

      // WHEN/THEN: Streamlined workflow testing integration points

      // Test successful deletion (admin with permission)
      const successResponse = await request.delete('/api/tables/1/records/1', {})
      // THEN: assertion
      expect(successResponse.status()).toBe(204)

      // Verify deletion
      const verifyDelete = await executeQuery(`SELECT COUNT(*) as count FROM users WHERE id=1`)
      // THEN: assertion
      expect(verifyDelete.rows[0].count).toBe(0)

      // Test record not found
      const notFoundResponse = await request.delete('/api/tables/1/records/9999', {})
      // THEN: assertion
      expect(notFoundResponse.status()).toBe(404)

      // Test permission denied
      const forbiddenResponse = await request.delete('/api/tables/1/records/2', {})
      // THEN: assertion
      expect(forbiddenResponse.status()).toBe(403)

      // Test unauthorized
      const unauthorizedResponse = await request.delete('/api/tables/1/records/2')
      // THEN: assertion
      expect(unauthorizedResponse.status()).toBe(401)
    }
  )
})
