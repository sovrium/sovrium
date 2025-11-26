/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/* eslint-disable drizzle/enforce-delete-with-where */
/**
 * E2E Tests for Batch delete records
 *
 * Source: specs/api/paths/tables/{tableId}/records/batch/delete.json
 * Domain: api
 * Spec Count: 11
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (11 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Batch delete records', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-RECORDS-001: should return 200 with deleted count',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table 'users' with 3 records (ID=1, ID=2, ID=3)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO users (id, email, name) VALUES
          (1, 'user1@example.com', 'User One'),
          (2, 'user2@example.com', 'User Two'),
          (3, 'user3@example.com', 'User Three')
      `)

      // WHEN: Batch delete IDs [1, 2]
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer test_token',
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 200 with deleted=2, records removed from database
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.deleted).toBe(2)

      // Verify deleted records no longer exist
      const deletedCheck = await executeQuery(`
        SELECT COUNT(*) as count FROM users WHERE id IN (1, 2)
      `)
      // THEN: assertion
      expect(deletedCheck.rows[0].count).toBe(0)

      // Verify remaining record still exists
      const remainingCheck = await executeQuery(`
        SELECT COUNT(*) as count FROM users WHERE id=3
      `)
      // THEN: assertion
      expect(remainingCheck.rows[0].count).toBe(1)
    }
  )

  test.fixme(
    'API-RECORDS-002: should return 404 and rollback transaction',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table 'users' with record ID=1 only
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
      await executeQuery(`
        INSERT INTO users (id, email, name) VALUES (1, 'john@example.com', 'John')
      `)

      // WHEN: Batch delete includes ID=1 (exists) and ID=9999 (not found)
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer test_token',
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 9999],
        },
      })

      // THEN: Returns 404 NotFound, no records deleted (rollback)
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBeDefined()

      // Verify no records deleted due to transaction rollback
      const rollbackCheck = await executeQuery(`
        SELECT COUNT(*) as count FROM users WHERE id=1
      `)
      // THEN: assertion
      expect(rollbackCheck.rows[0].count).toBe(1)
    }
  )

  test.fixme(
    'API-RECORDS-003: should return 413 Payload Too Large',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Table 'users' exists
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'users',
            fields: [{ id: 1, name: 'email', type: 'email', required: true }],
          },
        ],
      })

      // WHEN: Batch delete request exceeds 1000 ID limit
      const ids = Array.from({ length: 1001 }, (_, i) => i + 1)
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer test_token',
          'Content-Type': 'application/json',
        },
        data: {
          ids,
        },
      })

      // THEN: Returns 413 PayloadTooLarge
      expect(response.status()).toBe(413)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('PayloadTooLarge')
    }
  )

  test.fixme(
    'API-RECORDS-004: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
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
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id) VALUES
          (1, 'Alice Cooper', 'org_123'),
          (2, 'Bob Smith', 'org_123')
      `)

      // WHEN: User attempts batch delete without auth token
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 401 Unauthorized error
      expect(response.status()).toBe(401)

      // Verify no records deleted in database
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM employees
      `)
      // THEN: assertion
      expect(result.rows[0].count).toBe(2)
    }
  )

  test.fixme(
    'API-RECORDS-005: should return 403 for member without delete permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A member user without delete permission
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id) VALUES
          (1, 'Alice Cooper', 'org_123'),
          (2, 'Bob Smith', 'org_123')
      `)

      // WHEN: Member attempts batch delete
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer member_token',
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to delete records in this table')

      // Verify no records deleted
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM employees
      `)
      // THEN: assertion
      expect(result.rows[0].count).toBe(2)
    }
  )

  test.fixme(
    'API-RECORDS-006: should return 403 for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A viewer user with read-only access
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (id, name, organization_id) VALUES
          (1, 'Project Alpha', 'org_456'),
          (2, 'Project Beta', 'org_456')
      `)

      // WHEN: Viewer attempts batch delete
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer viewer_token',
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to delete records in this table')
    }
  )

  test.fixme(
    'API-RECORDS-007: should return 404 for cross-org records',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An admin user from org_123 with records from org_456
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
        INSERT INTO employees (id, name, organization_id) VALUES
          (1, 'Alice Cooper', 'org_456'),
          (2, 'Bob Smith', 'org_456')
      `)

      // WHEN: Admin attempts to batch delete records from different organization
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 404 Not Found (organization isolation)
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Record not found')

      // Verify no records deleted (original values preserved)
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM employees WHERE organization_id='org_456'
      `)
      // THEN: assertion
      expect(result.rows[0].count).toBe(2)
    }
  )

  test.fixme(
    'API-RECORDS-008: should return 200 for admin with full access',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An admin user with full delete permissions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
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
        INSERT INTO employees (id, name, email, organization_id) VALUES
          (1, 'Alice Cooper', 'alice@example.com', 'org_123'),
          (2, 'Bob Smith', 'bob@example.com', 'org_123'),
          (3, 'Charlie Davis', 'charlie@example.com', 'org_123')
      `)

      // WHEN: Admin batch deletes records from their organization
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 200 with deleted count and records are removed
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.deleted).toBe(2)

      // Verify records are deleted from database
      const deletedCheck = await executeQuery(`
        SELECT COUNT(*) as count FROM employees WHERE id IN (1, 2)
      `)
      // THEN: assertion
      expect(deletedCheck.rows[0].count).toBe(0)

      // Verify remaining record still exists
      const remainingCheck = await executeQuery(`
        SELECT COUNT(*) as count FROM employees WHERE id=3
      `)
      // THEN: assertion
      expect(remainingCheck.rows[0].count).toBe(1)
    }
  )

  test.fixme(
    'API-RECORDS-009: should return 200 for owner',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An owner user with full delete permissions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 9,
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
        INSERT INTO projects (id, name, status, organization_id) VALUES
          (1, 'Project Alpha', 'active', 'org_789'),
          (2, 'Project Beta', 'active', 'org_789'),
          (3, 'Project Gamma', 'active', 'org_789')
      `)

      // WHEN: Owner batch deletes records from their organization
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer owner_token',
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 200 with deleted count and records are removed
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.deleted).toBe(2)

      // Verify records are deleted from database
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM projects WHERE id IN (1, 2)
      `)
      // THEN: assertion
      expect(result.rows[0].count).toBe(0)
    }
  )

  test.fixme(
    'API-RECORDS-010: should return 404 to prevent cross-org deletes',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A member from org_123 with records from different org
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
        INSERT INTO employees (id, name, organization_id) VALUES
          (1, 'Alice Cooper', 'org_456'),
          (2, 'Bob Smith', 'org_456')
      `)

      // WHEN: Member attempts to batch delete records from org_456
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer member_token',
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 404 Not Found (prevents cross-org deletes)
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Record not found')
    }
  )

  test.fixme(
    'API-RECORDS-011: should return 404 when both org and permission violations exist',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A member without delete permission tries to delete records from different org
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 11,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name, organization_id) VALUES
          (1, 'Alice Cooper', 'org_456'),
          (2, 'Bob Smith', 'org_456')
      `)

      // WHEN: Member attempts batch delete with both permission and org violations
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer member_token',
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 404 Not Found (org isolation checked first)
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data.error).toBe('Record not found')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'user can complete full batch delete workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with multiple records
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 12,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'status', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title, status) VALUES
          (1, 'Task 1', 'pending'),
          (2, 'Task 2', 'pending'),
          (3, 'Task 3', 'pending'),
          (4, 'Task 4', 'pending'),
          (5, 'Task 5', 'pending')
      `)

      // WHEN/THEN: Execute representative batch delete workflow

      // 1. Successful batch delete
      const successResponse = await request.delete('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2, 3],
        },
      })
      // THEN: assertion
      expect(successResponse.status()).toBe(200)
      const result = await successResponse.json()
      // THEN: assertion
      expect(result.deleted).toBe(3)

      // Verify deletion
      const afterDelete = await executeQuery(`
        SELECT COUNT(*) as count FROM tasks WHERE id IN (1, 2, 3)
      `)
      // THEN: assertion
      expect(afterDelete.rows[0].count).toBe(0)

      // 2. Transaction rollback on partial failure
      const rollbackResponse = await request.delete('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          ids: [4, 9999],
        },
      })
      // THEN: assertion
      expect(rollbackResponse.status()).toBe(404)

      // Verify rollback - record 4 should still exist
      const afterRollback = await executeQuery(`
        SELECT COUNT(*) as count FROM tasks WHERE id=4
      `)
      // THEN: assertion
      expect(afterRollback.rows[0].count).toBe(1)

      // 3. Test payload size limit
      const tooLargeResponse = await request.delete('/api/tables/1/records/batch', {
        headers: {
          Authorization: 'Bearer admin_token',
          'Content-Type': 'application/json',
        },
        data: {
          ids: Array.from({ length: 1001 }, (_, i) => i + 1),
        },
      })
      // THEN: assertion
      expect(tooLargeResponse.status()).toBe(413)

      // Workflow completes successfully
    }
  )
})
