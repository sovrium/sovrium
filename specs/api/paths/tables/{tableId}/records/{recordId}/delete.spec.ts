/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures.ts'

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
    'API-TABLES-RECORDS-DELETE-001: should return 204 No Content and remove record',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Table 'users' with record ID=1
      await executeQuery(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL
        )
      `)
      await executeQuery(`
        INSERT INTO users (id, email) VALUES (1, 'test@example.com')
      `)

      // WHEN: User deletes record by ID
      const response = await request.delete('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })

      // THEN: Returns 204 No Content and record is removed from database
      expect(response.status()).toBe(204)

      // Verify record no longer exists in database
      const result = await executeQuery(`SELECT COUNT(*) as count FROM users WHERE id=1`)
      expect(result.rows[0].count).toBe(0)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-002: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: Table 'users' exists but record ID=9999 does not
      await executeQuery(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL
        )
      `)

      // WHEN: User attempts to delete non-existent record
      const response = await request.delete('/api/tables/1/records/9999', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Record not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-PERMISSIONS-UNAUTHORIZED-001: should return 401 Unauthorized',
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
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id)
        VALUES (1, 'Alice Cooper', 'org_123')
      `)

      // WHEN: User attempts to delete a record without auth token
      const response = await request.delete('/api/tables/1/records/1')

      // THEN: Returns 401 Unauthorized error
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')

      // Verify record remains in database (not deleted)
      const result = await executeQuery(`SELECT COUNT(*) as count FROM employees WHERE id=1`)
      expect(result.rows[0].count).toBe(1)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-PERMISSIONS-FORBIDDEN-MEMBER-001: should return 403 for member without delete permission',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A member user without delete permission
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id)
        VALUES (1, 'Alice Cooper', 'org_123')
      `)

      // WHEN: Member attempts to delete a record
      const response = await request.delete('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer member_token',
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to delete records in this table')

      // Verify record remains in database
      const result = await executeQuery(`SELECT COUNT(*) as count FROM employees WHERE id=1`)
      expect(result.rows[0].count).toBe(1)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-PERMISSIONS-FORBIDDEN-VIEWER-001: should return 403 for viewer with read-only access',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A viewer user with read-only access
      await executeQuery(`
        CREATE TABLE projects (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO projects (id, name, organization_id)
        VALUES (1, 'Project Alpha', 'org_456')
      `)

      // WHEN: Viewer attempts to delete a record
      const response = await request.delete('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer viewer_token',
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to delete records in this table')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-PERMISSIONS-ORG-ISOLATION-001: should return 404 for cross-org access',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: An admin user from organization org_123
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id)
        VALUES (1, 'Alice Cooper', 'org_456')
      `)

      // WHEN: Admin attempts to delete record from organization org_456
      const response = await request.delete('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
      })

      // THEN: Returns 404 Not Found (organization isolation)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Record not found')

      // Verify record remains in database (not deleted)
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM employees
        WHERE id=1 AND organization_id='org_456'
      `)
      expect(result.rows[0].count).toBe(1)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-PERMISSIONS-ADMIN-FULL-ACCESS-001: should return 204 for admin with full access',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: An admin user with full delete permissions
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id)
        VALUES (1, 'Alice Cooper', 'org_123')
      `)

      // WHEN: Admin deletes a record from their organization
      const response = await request.delete('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
      })

      // THEN: Returns 204 No Content and record is deleted
      expect(response.status()).toBe(204)

      // Verify record is deleted from database
      const result = await executeQuery(`SELECT COUNT(*) as count FROM employees WHERE id=1`)
      expect(result.rows[0].count).toBe(0)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-PERMISSIONS-OWNER-FULL-ACCESS-001: should return 204 for owner with full access',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: An owner user with full delete permissions
      await executeQuery(`
        CREATE TABLE projects (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          status VARCHAR(50),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO projects (id, name, status, organization_id)
        VALUES (1, 'Project Alpha', 'active', 'org_789')
      `)

      // WHEN: Owner deletes a record from their organization
      const response = await request.delete('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer owner_token',
        },
      })

      // THEN: Returns 204 No Content and record is deleted
      expect(response.status()).toBe(204)

      // Verify record is deleted from database
      const result = await executeQuery(`SELECT COUNT(*) as count FROM projects WHERE id=1`)
      expect(result.rows[0].count).toBe(0)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-PERMISSIONS-CROSS-ORG-PREVENTION-001: should return 404 to prevent org enumeration',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A record with organization_id='org_456' and admin from org_123
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (id, name, email, organization_id)
        VALUES (1, 'Bob Smith', 'bob@example.com', 'org_456')
      `)

      // WHEN: Admin attempts to delete record from different organization
      const response = await request.delete('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
      })

      // THEN: Returns 404 Not Found (not 403 - prevents org enumeration)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Record not found')

      // Verify record remains in database (not deleted)
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM employees
        WHERE id=1 AND organization_id='org_456'
      `)
      expect(result.rows[0].count).toBe(1)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-PERMISSIONS-COMBINED-SCENARIO-001: should return 404 when both org and permission violations exist',
    { tag: '@spec' },
    async ({ request, executeQuery }) => {
      // GIVEN: A member without delete permission tries to delete record from different org
      await executeQuery(`
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id)
        VALUES (1, 'Alice Cooper', 'org_456')
      `)

      // WHEN: Member attempts delete with both permission and org violations
      const response = await request.delete('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer member_token',
        },
      })

      // THEN: Returns 404 Not Found (org isolation checked first)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Record not found')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'user can complete full record deletion workflow',
    { tag: '@regression' },
    async ({ request, executeQuery }) => {
      // GIVEN: Application with representative table and permission configuration
      await executeQuery(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          organization_id VARCHAR(255)
        )
      `)
      await executeQuery(`
        INSERT INTO users (id, email, organization_id) VALUES
          (1, 'admin@example.com', 'org_123'),
          (2, 'member@example.com', 'org_123')
      `)

      // WHEN/THEN: Streamlined workflow testing integration points

      // Test successful deletion (admin with permission)
      const successResponse = await request.delete('/api/tables/1/records/1', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
      })
      expect(successResponse.status()).toBe(204)

      // Verify deletion
      const verifyDelete = await executeQuery(`SELECT COUNT(*) as count FROM users WHERE id=1`)
      expect(verifyDelete.rows[0].count).toBe(0)

      // Test record not found
      const notFoundResponse = await request.delete('/api/tables/1/records/9999', {
        headers: {
          Authorization: 'Bearer admin_token',
        },
      })
      expect(notFoundResponse.status()).toBe(404)

      // Test permission denied
      const forbiddenResponse = await request.delete('/api/tables/1/records/2', {
        headers: {
          Authorization: 'Bearer member_token',
        },
      })
      expect(forbiddenResponse.status()).toBe(403)

      // Test unauthorized
      const unauthorizedResponse = await request.delete('/api/tables/1/records/2')
      expect(unauthorizedResponse.status()).toBe(401)
    }
  )
})
