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
 * Spec Count: 13
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
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
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

  test.fixme(
    'API-TABLES-RECORDS-BATCH-DELETE-002: should return 404 and rollback transaction',
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
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
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
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Table 'users' exists
      await startServerWithSchema({
        name: 'test-app',
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

  test.fixme(
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
              { id: 2, name: 'organization_id', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
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
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
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
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
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
    'API-TABLES-RECORDS-BATCH-DELETE-007: should return 404 for cross-org records',
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
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
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
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 404 Not Found (organization isolation)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Record not found')

      // THEN: Records remain active (not soft deleted)
      const result = await executeQuery(`
        SELECT COUNT(*) as count FROM employees WHERE deleted_at IS NULL
      `)
      expect(result.rows[0].count).toBe('2')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-DELETE-008: should return 200 for admin with full access',
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
              { id: 4, name: 'deleted_at', type: 'deleted-at', indexed: true },
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
    'API-TABLES-RECORDS-BATCH-DELETE-009: should return 200 for owner',
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
              { id: 4, name: 'deleted_at', type: 'deleted-at', indexed: true },
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

  test.fixme(
    'API-TABLES-RECORDS-BATCH-DELETE-010: should return 404 to prevent cross-org deletes',
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
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
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
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 404 Not Found (prevents cross-org deletes)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Record not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-DELETE-011: should return 404 when both org and permission violations exist',
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
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
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
          'Content-Type': 'application/json',
        },
        data: {
          ids: [1, 2],
        },
      })

      // THEN: Returns 404 Not Found (org isolation checked first)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Record not found')
    }
  )

  // ============================================================================
  // Soft Delete Specific Tests
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-BATCH-DELETE-012: should skip already soft-deleted records in batch',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Mix of active and soft-deleted records
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
    'API-TABLES-RECORDS-BATCH-DELETE-013: should hard delete batch with permanent=true (admin only)',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An admin user and active records
      await startServerWithSchema({
        name: 'test-app',
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
    async ({ request, startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with users table and test records', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 1, name: 'email', type: 'email', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'organization_id', type: 'single-line-text' },
                { id: 4, name: 'deleted_at', type: 'deleted-at', indexed: true },
              ],
            },
          ],
        })
        await executeQuery(`
          INSERT INTO users (id, email, name, organization_id, deleted_at) VALUES
            (1, 'user1@example.com', 'User One', 'org_123', NULL),
            (2, 'user2@example.com', 'User Two', 'org_123', NULL),
            (3, 'user3@example.com', 'User Three', 'org_123', NULL),
            (4, 'user4@example.com', 'User Four', 'org_123', NULL),
            (5, 'user5@example.com', 'Already Deleted', 'org_123', NOW()),
            (6, 'user6@example.com', 'User Six', 'org_456', NULL)
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
          INSERT INTO users (id, email, name, organization_id) VALUES
            (7, 'user7@example.com', 'User Seven', 'org_123'),
            (8, 'user8@example.com', 'User Eight', 'org_123')
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
