/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Batch Restore records endpoint
 *
 * Source: specs/api/paths/tables/{tableId}/records/batch/restore/post.json
 * Domain: api
 * Spec Count: 9
 *
 * Batch Restore Behavior:
 * - POST /batch/restore clears deleted_at timestamp on multiple soft-deleted records
 * - Returns count of restored records
 * - Rollback on partial failure (404 for any record in batch)
 * - Skips records that are not soft-deleted (lenient mode)
 * - Permissions: Same as delete (member+ can restore)
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Batch Restore records', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test(
    'API-TABLES-RECORDS-BATCH-RESTORE-001: should return 200 with restored count',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with multiple soft-deleted records
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 1,
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
          (1, 'Task 1', NOW()),
          (2, 'Task 2', NOW()),
          (3, 'Task 3', NOW())
      `)

      // Verify records are soft-deleted
      const beforeRestore = await executeQuery(
        `SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NOT NULL`
      )
      expect(beforeRestore.count).toBe('3')

      // WHEN: User batch restores the soft-deleted records
      const response = await request.post('/api/tables/1/records/batch/restore', {
        data: { ids: [1, 2, 3] },
      })

      // THEN: Returns 200 OK with restored count
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.restored).toBe(3)

      // THEN: All records are restored (deleted_at cleared)
      const afterRestore = await executeQuery(
        `SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL`
      )
      expect(afterRestore.count).toBe('3')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-RESTORE-002: should rollback on partial failure (404)',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with some soft-deleted records (but one ID doesn't exist)
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 2,
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
          (1, 'Task 1', NOW()),
          (2, 'Task 2', NOW())
      `)

      // WHEN: User attempts to batch restore including non-existent record
      const response = await request.post('/api/tables/2/records/batch/restore', {
        data: { ids: [1, 2, 9999] },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('Resource not found')
      expect(data.code).toBe('NOT_FOUND')
      expect(data.recordId).toBe(9999)

      // THEN: No records were restored (transaction rollback)
      const result = await executeQuery(
        `SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NOT NULL`
      )
      expect(result.count).toBe('2')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-RESTORE-003: should skip non-deleted records in batch',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with mix of deleted and active records
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 3,
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
          (1, 'Deleted Task', NOW()),
          (2, 'Active Task', NULL)
      `)

      // WHEN: User attempts to batch restore including an active record
      const response = await request.post('/api/tables/3/records/batch/restore', {
        data: { ids: [1, 2] },
      })

      // THEN: Returns 200 with restored count = 1 (only the deleted record)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.restored).toBe(1)

      // THEN: Only the deleted record was restored
      const result1 = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
      expect(result1.deleted_at).toBeNull()
      const result2 = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=2`)
      expect(result2.deleted_at).toBeNull()
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-RESTORE-004: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An unauthenticated user with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 4,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title, deleted_at) VALUES (1, 'Deleted Task', NOW())
      `)

      // WHEN: User attempts to batch restore without auth token
      const response = await request.post('/api/tables/1/records/batch/restore')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data.error).toBeDefined()
      expect(data.message).toBeDefined()

      // THEN: Records remain soft-deleted
      const result = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
      expect(result.deleted_at).toBeTruthy()
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-RESTORE-005: should return 403 for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: A viewer user with read-only access
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      const viewer = await createAuthenticatedUser()

      // Set viewer role manually (admin plugin not enabled in this test)
      await executeQuery(`
        UPDATE auth.user
        SET role = 'viewer'
        WHERE id = '${viewer.user.id}'
      `)

      await executeQuery(`
        INSERT INTO projects (id, name, deleted_at) VALUES
          (1, 'Project 1', NOW()),
          (2, 'Project 2', NOW())
      `)

      // WHEN: Viewer attempts to batch restore records
      const response = await request.post('/api/tables/1/records/batch/restore', {
        data: { ids: ['1', '2'] },
      })

      // THEN: Returns 403 Forbidden (authorization checked before validation)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to restore records in this table')
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-RESTORE-006: should clear deleted_at timestamp for restored records',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request, createAuthenticatedMember }) => {
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'member',
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'authenticated',
              create: 'authenticated',
              delete: 'authenticated',
            },
          },
        ],
      })

      // GIVEN: 2 soft-deleted records
      await executeQuery(
        `INSERT INTO tasks (title, deleted_at) VALUES ('Task 1', NOW()), ('Task 2', NOW())`
      )
      const deleted = await executeQuery(`SELECT id FROM tasks WHERE deleted_at IS NOT NULL`)
      expect(deleted.rows).toHaveLength(2)

      // WHEN: Batch restore both records
      await createAuthenticatedMember({ email: 'member@example.com' })
      const response = await request.post('/api/tables/1/records/batch/restore', {
        data: { ids: deleted.rows.map((r: any) => String(r.id)) },
      })

      // THEN: deleted_at is cleared
      expect(response.status()).toBe(200)
      const restored = await executeQuery(
        `SELECT id, deleted_at FROM tasks WHERE id IN (${deleted.rows.map((r: any) => r.id).join(',')})`
      )
      for (const record of restored.rows) {
        expect(record.deleted_at).toBeNull()
      }
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-RESTORE-007: should skip records that are not soft-deleted',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request, createAuthenticatedMember }) => {
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'member',
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'authenticated',
              create: 'authenticated',
              delete: 'authenticated',
            },
          },
        ],
      })

      // GIVEN: 1 deleted + 1 active record
      await executeQuery(`INSERT INTO tasks (title, deleted_at) VALUES ('Deleted', NOW())`)
      await executeQuery(`INSERT INTO tasks (title) VALUES ('Active')`)
      const all = await executeQuery(`SELECT id, deleted_at FROM tasks ORDER BY id`)
      const deletedId = all.rows.find((r: any) => r.deleted_at !== null).id
      const activeId = all.rows.find((r: any) => r.deleted_at === null).id

      // WHEN: Batch restore both IDs
      await createAuthenticatedMember({ email: 'member@example.com' })
      const response = await request.post('/api/tables/1/records/batch/restore', {
        data: { ids: [String(deletedId), String(activeId)] },
      })

      // THEN: 200 with restored count = 1 (only the deleted one)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.restored).toBe(1)
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-RESTORE-008: should enforce maximum batch size of 100 records',
    { tag: '@spec' },
    async ({ startServerWithSchema, request, createAuthenticatedMember }) => {
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'member',
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: { read: 'authenticated', delete: 'authenticated' },
          },
        ],
      })

      // WHEN: Attempt to restore 101 record IDs
      await createAuthenticatedMember({ email: 'member@example.com' })
      const ids = Array.from({ length: 101 }, (_, i) => String(i + 1))
      const response = await request.post('/api/tables/1/records/batch/restore', {
        data: { ids },
      })

      // THEN: Returns 400 for exceeding batch size
      expect(response.status()).toBe(400)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-RESTORE-009: should log batch restore operation to activity history',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request, createAuthenticatedMember }) => {
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'member',
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'authenticated',
              create: 'authenticated',
              delete: 'authenticated',
            },
          },
        ],
      })

      // GIVEN: 2 soft-deleted records
      await executeQuery(
        `INSERT INTO tasks (title, deleted_at) VALUES ('Task 1', NOW()), ('Task 2', NOW())`
      )
      const deleted = await executeQuery(`SELECT id FROM tasks WHERE deleted_at IS NOT NULL`)

      // WHEN: Batch restore
      await createAuthenticatedMember({ email: 'member@example.com' })
      const response = await request.post('/api/tables/1/records/batch/restore', {
        data: { ids: deleted.map((r: any) => String(r.id)) },
      })
      expect(response.status()).toBe(200)

      // THEN: Activity log contains restore operation
      // (Verify via activity API or direct DB query)
      // Implementation-dependent: check activity_log table or API endpoint
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-BATCH-RESTORE-REGRESSION: user can complete full batch restore workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // Setup: Start server with tasks table
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })

      // Setup: Insert test records (mix of active and deleted)
      await executeQuery(`
        INSERT INTO tasks (id, title, deleted_at) VALUES
          (1, 'Task 1', NOW()),
          (2, 'Task 2', NOW()),
          (3, 'Task 3', NOW())
      `)
      await executeQuery(`INSERT INTO tasks (id, title) VALUES (4, 'Active Task')`)

      // --- Step 004: 401 Unauthorized (BEFORE authentication) ---
      await test.step('API-TABLES-RECORDS-BATCH-RESTORE-004: Return 401 Unauthorized', async () => {
        const response = await request.post('/api/tables/1/records/batch/restore', {
          data: { ids: [1, 2] },
        })
        expect(response.status()).toBe(401)

        const data = await response.json()
        expect(data.error).toBeDefined()
        expect(data.message).toBeDefined()

        // Records remain soft-deleted
        const result = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
        expect(result.deleted_at).toBeTruthy()
      })

      // --- Authenticate as member ---
      await createAuthenticatedUser()

      // --- Step 001: Batch restore success ---
      await test.step('API-TABLES-RECORDS-BATCH-RESTORE-001: Return 200 with restored count', async () => {
        // Verify records are soft-deleted
        const beforeRestore = await executeQuery(
          `SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NOT NULL`
        )
        expect(beforeRestore.count).toBe('3')

        const response = await request.post('/api/tables/1/records/batch/restore', {
          data: { ids: [1, 2, 3] },
        })
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.restored).toBe(3)

        // All records restored (deleted_at cleared)
        const afterRestore = await executeQuery(
          `SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL`
        )
        expect(afterRestore.count).toBe('4')
      })

      // --- Step 002: Rollback on partial failure (404) ---
      await test.step('API-TABLES-RECORDS-BATCH-RESTORE-002: Rollback on partial failure (404)', async () => {
        // Soft-delete records 1,2 again for this test
        await executeQuery(`UPDATE tasks SET deleted_at = NOW() WHERE id IN (1, 2)`)

        const response = await request.post('/api/tables/1/records/batch/restore', {
          data: { ids: [1, 2, 9999] },
        })
        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
        expect(data.recordId).toBe(9999)

        // No records restored (transaction rollback)
        const result = await executeQuery(
          `SELECT COUNT(*) as count FROM tasks WHERE id IN (1, 2) AND deleted_at IS NOT NULL`
        )
        expect(result.count).toBe('2')
      })

      // --- Step 003: Skip non-deleted records in batch ---
      await test.step('API-TABLES-RECORDS-BATCH-RESTORE-003: Skip non-deleted records in batch', async () => {
        // Record 1 still deleted from step 002 rollback, record 4 is active
        const response = await request.post('/api/tables/1/records/batch/restore', {
          data: { ids: [1, 4] },
        })
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.restored).toBe(1)

        // Only the deleted record was restored
        const result = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
        expect(result.deleted_at).toBeNull()
      })

      // --- Step 005 skipped: requires viewer auth context ---
      // API-TABLES-RECORDS-BATCH-RESTORE-005 tests viewer role (403).
      // This needs a different auth context (viewer role) which would
      // invalidate the current member session for subsequent tests.
      // Covered by @spec test API-TABLES-RECORDS-BATCH-RESTORE-005.
    }
  )
})
