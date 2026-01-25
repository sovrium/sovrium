/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Batch delete records (Soft Delete)
 *
 * Source: specs/api/paths/tables/{tableId}/records/batch/delete.json
 * Domain: api
 * Spec Count: 10
 *
 * Soft Delete Behavior:
 * - DELETE sets deleted_at timestamp for all records in batch
 * - DELETE with ?permanent=true removes records permanently (admin/owner only)
 * - Soft-deleted records are excluded from normal queries
 * - Already soft-deleted records are skipped in batch operations
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (13 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Batch delete records', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-BATCH-DELETE-001: should return 200 with soft deleted count',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table 'users' with 3 records (ID=1, ID=2, ID=3)
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO users (id, email, name) VALUES
          (1, 'user1@example.com', 'User One'),
          (2, 'user2@example.com', 'User Two'),
          (3, 'user3@example.com', 'User Three')
      `)

      // WHEN: Batch delete IDs [1, 2]
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 200 with deleted=2
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.deleted).toBe(2)

      // THEN: Records are soft deleted (deleted_at is set)
      const deletedCheck = await executeQuery(`
        SELECT COUNT(*) as count FROM users WHERE id IN (1, 2) AND deleted_at IS NOT NULL
      `)
      expect(deletedCheck.rows[0].count).toBe('2')

      // THEN: Remaining record is still active (deleted_at is NULL)
      const remainingCheck = await executeQuery(`
        SELECT deleted_at FROM users WHERE id=3
      `)
      expect(remainingCheck.deleted_at).toBeNull()
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-DELETE-002: should return 404 and rollback transaction',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table 'users' with record ID=1 only
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
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO users (id, email, name) VALUES (1, 'john@example.com', 'John')
      `)

      // WHEN: Batch delete includes ID=1 (exists) and ID=9999 (not found)
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 9999],
        },
      })

      // THEN: Returns 404 NotFound, no records soft deleted (rollback)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBeDefined()

      // THEN: Record remains active due to transaction rollback
      const rollbackCheck = await executeQuery(`
        SELECT deleted_at FROM users WHERE id=1
      `)
      expect(rollbackCheck.deleted_at).toBeNull()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-DELETE-003: should return 413 Payload Too Large',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table 'users' exists
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 3,
            name: 'users',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await createAuthenticatedUser()

      // WHEN: Batch delete request exceeds 1000 ID limit
      const ids = Array.from({ length: 1001 }, (_, i) => i + 1)
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          ids,
        },
      })

      // THEN: Returns 413 PayloadTooLarge
      expect(response.status()).toBe(413)

      const data = await response.json()
      expect(data.error).toBe('PayloadTooLarge')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-DELETE-004: should return 401 Unauthorized',
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
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO employees (id, name) VALUES
          (1, 'Alice Cooper'),
          (2, 'Bob Smith')
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

      // THEN: Records remain active (not soft deleted)
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM employees WHERE deleted_at IS NULL
      `)
      expect(result.rows[0].count).toBe('2')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-DELETE-005: should return 403 for member without delete permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: A member user without delete permission
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 5,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await createAuthenticatedMember()
      await executeQuery(`
        INSERT INTO employees (id, name) VALUES
          (1, 'Alice Cooper'),
          (2, 'Bob Smith')
      `)

      // WHEN: Member attempts batch delete
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to delete records in this table')

      // THEN: Records remain active
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM employees WHERE deleted_at IS NULL
      `)
      expect(result.rows[0].count).toBe('2')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-DELETE-006: should return 403 for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedViewer }) => {
      // GIVEN: A viewer user with read-only access
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 6,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await createAuthenticatedViewer()
      await executeQuery(`
        INSERT INTO projects (id, name) VALUES
          (1, 'Project Alpha'),
          (2, 'Project Beta')
      `)

      // WHEN: Viewer attempts batch delete
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 403 Forbidden error
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to delete records in this table')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-DELETE-007: should return 200 for admin with full access',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedAdmin }) => {
      // GIVEN: An admin user with full delete permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 8,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email', required: true },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await createAuthenticatedAdmin()
      await executeQuery(`
        INSERT INTO employees (id, name, email) VALUES
          (1, 'Alice Cooper', 'alice@example.com'),
          (2, 'Bob Smith', 'bob@example.com'),
          (3, 'Charlie Davis', 'charlie@example.com')
      `)

      // WHEN: Admin batch deletes records
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 200 with deleted count
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.deleted).toBe(2)

      // THEN: Records are soft deleted (deleted_at is set)
      const deletedCheck = await executeQuery(`
        SELECT COUNT(*) as count FROM employees WHERE id IN (1, 2) AND deleted_at IS NOT NULL
      `)
      expect(deletedCheck.rows[0].count).toBe('2')

      // THEN: Remaining record is still active
      const remainingCheck = await executeQuery(`
        SELECT deleted_at FROM employees WHERE id=3
      `)
      expect(remainingCheck.deleted_at).toBeNull()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-DELETE-008: should return 200 for owner',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: An owner user with full delete permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 9,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'status', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO projects (id, name, status) VALUES
          (1, 'Project Alpha', 'active'),
          (2, 'Project Beta', 'active'),
          (3, 'Project Gamma', 'active')
      `)

      // WHEN: Owner batch deletes records
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 200 with deleted count
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.deleted).toBe(2)

      // THEN: Records are soft deleted
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM projects WHERE id IN (1, 2) AND deleted_at IS NOT NULL
      `)
      expect(result.rows[0].count).toBe('2')
    }
  )

  // ============================================================================
  // Soft Delete Specific Tests
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-BATCH-DELETE-009: should skip already soft-deleted records in batch',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Mix of active and soft-deleted records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO tasks (id, title, deleted_at) VALUES
          (1, 'Active Task', NULL),
          (2, 'Already Deleted', NOW()),
          (3, 'Another Active', NULL)
      `)

      // WHEN: Batch delete includes both active and already-deleted records
      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2, 3],
        },
      })

      // THEN: Returns 200 with count of newly deleted records only
      expect(response.status()).toBe(200)

      const data = await response.json()
      // Only 2 records were active and got soft-deleted
      expect(data.deleted).toBe(2)

      // THEN: All 3 records now have deleted_at set
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NOT NULL
      `)
      expect(result.rows[0].count).toBe('3')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-DELETE-010: should hard delete batch with permanent=true (admin only)',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedAdmin }) => {
      // GIVEN: An admin user and active records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 13,
            name: 'logs',
            fields: [
              { id: 1, name: 'message', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await createAuthenticatedAdmin()
      await executeQuery(`
        INSERT INTO logs (id, message) VALUES
          (1, 'Log entry 1'),
          (2, 'Log entry 2'),
          (3, 'Log entry 3')
      `)

      // WHEN: Admin batch deletes with permanent=true
      const response = await request.delete('/api/tables/1/records/batch?permanent=true', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 200 with deleted count
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.deleted).toBe(2)

      // THEN: Records are permanently removed from database
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM logs WHERE id IN (1, 2)
      `)
      expect(result.rows[0].count).toBe('0')

      // THEN: Remaining record still exists
      const remaining = await executeQuery(`SELECT COUNT(*) as count FROM logs WHERE id=3`)
      expect(remaining.rows[0].count).toBe('1')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-BATCH-DELETE-REGRESSION: user can complete full batch soft delete workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      await test.step('Setup: Start server with users table and test records', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: { emailAndPassword: true },
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 1, name: 'email', type: 'email', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
              ],
            },
          ],
        })
        await createAuthenticatedUser()
        await executeQuery(`
          INSERT INTO users (id, email, name, deleted_at) VALUES
            (1, 'user1@example.com', 'User One', NULL),
            (2, 'user2@example.com', 'User Two', NULL),
            (3, 'user3@example.com', 'User Three', NULL),
            (4, 'user4@example.com', 'User Four', NULL),
            (5, 'user5@example.com', 'Already Deleted', NOW()),
            (6, 'user6@example.com', 'User Six', NULL)
        `)
      })

      await test.step('API-TABLES-RECORDS-BATCH-DELETE-001: Batch deletes IDs [1, 2] and returns 200 with deleted=2', async () => {
        const response = await request.delete('/api/tables/1/records/batch', {
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            ids: [1, 2],
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.deleted).toBe(2)

        const deletedCheck = await executeQuery(`
          SELECT COUNT(*) as count FROM users WHERE id IN (1, 2) AND deleted_at IS NOT NULL
        `)
        expect(deletedCheck.rows[0].count).toBe('2')

        const remainingCheck = await executeQuery(`
          SELECT deleted_at FROM users WHERE id=3
        `)
        expect(remainingCheck.deleted_at).toBeNull()
      })

      await test.step('API-TABLES-RECORDS-BATCH-DELETE-002: Batch delete with non-existent ID returns 404 and rolls back transaction', async () => {
        const response = await request.delete('/api/tables/1/records/batch', {
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            ids: [3, 9999],
          },
        })

        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.error).toBeDefined()

        const rollbackCheck = await executeQuery(`
          SELECT deleted_at FROM users WHERE id=3
        `)
        expect(rollbackCheck.deleted_at).toBeNull()
      })

      await test.step('API-TABLES-RECORDS-BATCH-DELETE-003: Batch delete request exceeding 1000 ID limit returns 413', async () => {
        const ids = Array.from({ length: 1001 }, (_, i) => i + 1)
        const response = await request.delete('/api/tables/1/records/batch', {
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            ids,
          },
        })

        expect(response.status()).toBe(413)

        const data = await response.json()
        expect(data.error).toBe('PayloadTooLarge')
      })

      await test.step('API-TABLES-RECORDS-BATCH-DELETE-012: Batch delete including already soft-deleted records skips them and returns count of newly deleted only', async () => {
        const response = await request.delete('/api/tables/1/records/batch', {
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            ids: [3, 4, 5],
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.deleted).toBe(2)

        const result = await executeQuery(`
          SELECT COUNT(*) as count FROM users WHERE id IN (3, 4, 5) AND deleted_at IS NOT NULL
        `)
        expect(result.rows[0].count).toBe('3')
      })

      await test.step('API-TABLES-RECORDS-BATCH-DELETE-013: Admin batch deletes with permanent=true and hard deletes records', async () => {
        await executeQuery(`
          INSERT INTO users (id, email, name) VALUES
            (7, 'user7@example.com', 'User Seven'),
            (8, 'user8@example.com', 'User Eight')
        `)

        const response = await request.delete('/api/tables/1/records/batch?permanent=true', {
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            ids: [7, 8],
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.deleted).toBe(2)

        const result = await executeQuery(`
          SELECT COUNT(*) as count FROM users WHERE id IN (7, 8)
        `)
        expect(result.rows[0].count).toBe('0')
      })
    }
  )
})
