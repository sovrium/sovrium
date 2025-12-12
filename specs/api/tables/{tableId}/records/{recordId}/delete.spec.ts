/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/* eslint-disable drizzle/enforce-delete-with-where */
/**
 * E2E Tests for Delete record (Soft Delete)
 *
 * Source: specs/api/paths/tables/{tableId}/records/{recordId}/delete.json
 * Domain: api
 * Spec Count: 15
 *
 * Soft Delete Behavior:
 * - DELETE sets deleted_at timestamp (soft delete by default)
 * - DELETE with ?permanent=true removes record permanently (admin/owner only)
 * - Soft-deleted records are excluded from normal queries
 * - Soft-deleted records can be restored via POST /restore endpoint
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (14 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Delete record', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-DELETE-001: should return 204 No Content and soft delete record',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table 'users' with record ID=1 and deleted_at field for soft delete
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO users (id, email) VALUES (1, 'test@example.com')
      `)

      // WHEN: User deletes record by ID
      const response = await request.delete('/api/tables/1/records/1', {})

      // THEN: Returns 204 No Content
      expect(response.status()).toBe(204)

      // THEN: Record still exists but deleted_at is set (soft delete)
      const result = await executeQuery(`SELECT deleted_at FROM users WHERE id=1`)
      expect(result.deleted_at).toBeTruthy()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-002: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Table 'users' exists but record ID=9999 does not
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
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
    'API-TABLES-RECORDS-DELETE-003: should return 401 Unauthorized',
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
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
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

      // Verify record remains active (deleted_at is NULL)
      const result = await executeQuery(`SELECT deleted_at FROM employees WHERE id=1`)
      expect(result.deleted_at).toBeNull()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-004: should return 403 for member without delete permission',
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
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
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

      // Verify record remains active (deleted_at is NULL)
      const result = await executeQuery(`SELECT deleted_at FROM employees WHERE id=1`)
      expect(result.deleted_at).toBeNull()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-005: should return 403 for viewer with read-only access',
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
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
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
    'API-TABLES-RECORDS-DELETE-006: should return 404 for cross-org access',
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
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
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

      // Verify record remains active (deleted_at is NULL)
      const result = await executeQuery(`SELECT deleted_at FROM employees WHERE id=1`)
      expect(result.deleted_at).toBeNull()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-007: should return 204 for admin with full access',
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
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
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

      // THEN: Returns 204 No Content
      expect(response.status()).toBe(204)

      // THEN: Record is soft deleted (deleted_at is set)
      const result = await executeQuery(`SELECT deleted_at FROM employees WHERE id=1`)
      expect(result.deleted_at).toBeTruthy()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-008: should return 204 for owner with full access',
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
              { id: 4, name: 'deleted_at', type: 'deleted-at', indexed: true },
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

      // THEN: Returns 204 No Content
      expect(response.status()).toBe(204)

      // THEN: Record is soft deleted (deleted_at is set)
      const result = await executeQuery(`SELECT deleted_at FROM projects WHERE id=1`)
      expect(result.deleted_at).toBeTruthy()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-009: should return 404 to prevent org enumeration',
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
              { id: 4, name: 'deleted_at', type: 'deleted-at', indexed: true },
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

      // Verify record remains active (deleted_at is NULL)
      const result = await executeQuery(`SELECT deleted_at FROM employees WHERE id=1`)
      expect(result.deleted_at).toBeNull()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-010: should return 404 when both org and permission violations exist',
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
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
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
  // Soft Delete Specific Tests
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-DELETE-012: should return 404 when deleting already soft-deleted record',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A soft-deleted record exists
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 12,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title, deleted_at) VALUES (1, 'Completed Task', NOW())
      `)

      // WHEN: User attempts to delete an already soft-deleted record
      const response = await request.delete('/api/tables/1/records/1', {})

      // THEN: Returns 404 Not Found (soft-deleted records are not visible)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Record not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-013: should set deleted_at to current timestamp',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An active record exists
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 13,
            name: 'items',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      const beforeDelete = new Date()
      await executeQuery(`INSERT INTO items (id, name) VALUES (1, 'Test Item')`)

      // WHEN: User deletes the record
      const response = await request.delete('/api/tables/1/records/1', {})

      // THEN: Returns 204 No Content
      expect(response.status()).toBe(204)

      // THEN: deleted_at is set to approximately current time
      const result = await executeQuery(`SELECT deleted_at FROM items WHERE id=1`)
      const deletedAt = new Date(result.deleted_at)
      const afterDelete = new Date()

      expect(deletedAt.getTime()).toBeGreaterThanOrEqual(beforeDelete.getTime())
      expect(deletedAt.getTime()).toBeLessThanOrEqual(afterDelete.getTime())
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-014: should hard delete with permanent=true query param (admin only)',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An admin user and an active record
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 14,
            name: 'logs',
            fields: [
              { id: 1, name: 'message', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await executeQuery(`INSERT INTO logs (id, message) VALUES (1, 'Important log')`)

      // WHEN: Admin deletes with permanent=true
      const response = await request.delete('/api/tables/1/records/1?permanent=true', {})

      // THEN: Returns 204 No Content
      expect(response.status()).toBe(204)

      // THEN: Record is permanently removed from database
      const result = await executeQuery(`SELECT COUNT(*) as count FROM logs WHERE id=1`)
      expect(result.rows[0].count).toBe(0)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-015: should return 403 for member using permanent=true',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A member user (without permanent delete permission)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 15,
            name: 'data',
            fields: [
              { id: 1, name: 'value', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await executeQuery(`INSERT INTO data (id, value) VALUES (1, 'Sensitive data')`)

      // WHEN: Member attempts to permanently delete
      const response = await request.delete('/api/tables/1/records/1?permanent=true', {})

      // THEN: Returns 403 Forbidden (only admin/owner can hard delete)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('Only admins and owners can permanently delete records')

      // THEN: Record remains in database
      const result = await executeQuery(`SELECT COUNT(*) as count FROM data WHERE id=1`)
      expect(result.rows[0].count).toBe(1)
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-DELETE-016: user can complete full soft delete workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with users table', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 16,
              name: 'users',
              fields: [
                { id: 1, name: 'email', type: 'email', required: true },
                { id: 2, name: 'organization_id', type: 'single-line-text' },
                { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
              ],
            },
          ],
        })
      })

      await test.step('Setup: Insert test records', async () => {
        await executeQuery(`
          INSERT INTO users (id, email, organization_id) VALUES
            (1, 'admin@example.com', 'org_123'),
            (2, 'member@example.com', 'org_123'),
            (3, 'viewer@example.com', 'org_123')
        `)
      })

      await test.step('Soft delete record successfully', async () => {
        const successResponse = await request.delete('/api/tables/1/records/1', {})
        expect(successResponse.status()).toBe(204)
      })

      await test.step('Verify soft deletion in database', async () => {
        const result = await executeQuery(`SELECT deleted_at FROM users WHERE id=1`)
        expect(result.deleted_at).toBeTruthy()
      })

      await test.step('Verify soft-deleted record is not visible in queries', async () => {
        const activeUsers = await executeQuery(`
          SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL
        `)
        expect(activeUsers.rows[0].count).toBe(2)
      })

      await test.step('Verify deleting already-deleted record fails', async () => {
        const deleteAgainResponse = await request.delete('/api/tables/1/records/1', {})
        expect(deleteAgainResponse.status()).toBe(404)
      })

      await test.step('Verify permanent delete (admin)', async () => {
        const permanentResponse = await request.delete('/api/tables/1/records/2?permanent=true', {})
        expect(permanentResponse.status()).toBe(204)

        const verifyPermanent = await executeQuery(`SELECT COUNT(*) as count FROM users WHERE id=2`)
        expect(verifyPermanent.rows[0].count).toBe(0)
      })

      await test.step('Verify unauthenticated delete fails', async () => {
        const unauthorizedResponse = await request.delete('/api/tables/1/records/3')
        expect(unauthorizedResponse.status()).toBe(401)
      })
    }
  )
})
