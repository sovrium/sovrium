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
 * Spec Count: 5
 *
 * Batch Restore Behavior:
 * - POST /batch/restore clears deleted_at timestamp on multiple soft-deleted records
 * - Returns count of restored records
 * - Rollback on partial failure (404 for any record in batch)
 * - Returns 400 if any record in batch is not soft-deleted
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

  test.fixme(
    'API-TABLES-RECORDS-BATCH-RESTORE-001: should return 200 with restored count',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with multiple soft-deleted records
      await startServerWithSchema({
        name: 'test-app',
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

  test.fixme(
    'API-TABLES-RECORDS-BATCH-RESTORE-002: should rollback on partial failure (404)',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with some soft-deleted records (but one ID doesn't exist)
      await startServerWithSchema({
        name: 'test-app',
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
      await executeQuery(`
        INSERT INTO tasks (id, title, deleted_at) VALUES
          (1, 'Task 1', NOW()),
          (2, 'Task 2', NOW())
      `)

      // WHEN: User attempts to batch restore including non-existent record
      const response = await request.post('/api/tables/1/records/batch/restore', {
        data: { ids: [1, 2, 9999] },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Record not found')
      expect(data.recordId).toBe(9999)

      // THEN: No records were restored (transaction rollback)
      const result = await executeQuery(
        `SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NOT NULL`
      )
      expect(result.count).toBe('2')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-BATCH-RESTORE-003: should return 400 for non-deleted records in batch',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with mix of deleted and active records
      await startServerWithSchema({
        name: 'test-app',
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
      await executeQuery(`
        INSERT INTO tasks (id, title, deleted_at) VALUES
          (1, 'Deleted Task', NOW()),
          (2, 'Active Task', NULL)
      `)

      // WHEN: User attempts to batch restore including an active record
      const response = await request.post('/api/tables/1/records/batch/restore', {
        data: { ids: [1, 2] },
      })

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data.error).toBe('Bad Request')
      expect(data.message).toContain('Record is not deleted')
      expect(data.recordId).toBe(2)

      // THEN: No records were restored (transaction rollback)
      const result = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
      expect(result.deleted_at).toBeTruthy()
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-RESTORE-004: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An unauthenticated user
      await startServerWithSchema({
        name: 'test-app',
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

      // THEN: Records remain soft-deleted
      const result = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
      expect(result.deleted_at).toBeTruthy()
    }
  )

  test(
    'API-TABLES-RECORDS-BATCH-RESTORE-005: should return 403 for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedViewer }) => {
      // GIVEN: A viewer user with read-only access
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
      await createAuthenticatedViewer()
      await executeQuery(`
        INSERT INTO projects (id, name, deleted_at) VALUES
          (1, 'Project 1', NOW()),
          (2, 'Project 2', NOW())
      `)

      // WHEN: Viewer attempts to batch restore records
      const response = await request.post('/api/tables/1/records/batch/restore', {
        data: { ids: [1, 2] },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to restore records in this table')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-BATCH-RESTORE-006: user can complete full batch restore workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with tasks table', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'tasks',
              fields: [
                { id: 1, name: 'title', type: 'single-line-text', required: true },
                { id: 2, name: 'status', type: 'single-line-text' },
                { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
              ],
            },
          ],
        })
      })

      await test.step('Setup: Insert test records (mix of active and deleted)', async () => {
        await executeQuery(`
          INSERT INTO tasks (id, title, status, deleted_at) VALUES
            (1, 'Active Task', 'pending', NULL),
            (2, 'Deleted Task 1', 'completed', NOW()),
            (3, 'Deleted Task 2', 'pending', NOW()),
            (4, 'Deleted Task 3', 'in_progress', NOW())
        `)
      })

      await test.step('Batch restore soft-deleted records successfully', async () => {
        const restoreResponse = await request.post('/api/tables/1/records/batch/restore', {
          data: { ids: [2, 3, 4] },
        })
        expect(restoreResponse.status()).toBe(200)

        const data = await restoreResponse.json()
        expect(data.success).toBe(true)
        expect(data.restored).toBe(3)
      })

      await test.step('Verify all records are restored in database', async () => {
        const activeCount = await executeQuery(
          `SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL`
        )
        expect(activeCount.count).toBe('4')
      })

      await test.step('Verify batch restoring active records fails', async () => {
        const badRequestResponse = await request.post('/api/tables/1/records/batch/restore', {
          data: { ids: [1, 2] },
        })
        expect(badRequestResponse.status()).toBe(400)

        const errorData = await badRequestResponse.json()
        expect(errorData.message).toContain('Record is not deleted')
      })

      await test.step('Verify batch restoring non-existent records fails with rollback', async () => {
        // First soft-delete record 2 again
        await executeQuery(`UPDATE tasks SET deleted_at = NOW() WHERE id = 2`)

        const notFoundResponse = await request.post('/api/tables/1/records/batch/restore', {
          data: { ids: [2, 9999] },
        })
        expect(notFoundResponse.status()).toBe(404)

        // Verify record 2 was not restored (rollback)
        const record2 = await executeQuery(`SELECT deleted_at FROM tasks WHERE id = 2`)
        expect(record2.deleted_at).toBeTruthy()
      })

      await test.step('Verify unauthenticated batch restore fails', async () => {
        const unauthorizedResponse = await request.post('/api/tables/1/records/batch/restore')
        expect(unauthorizedResponse.status()).toBe(401)
      })

      await test.step('Verify restored records are accessible via GET', async () => {
        // Restore record 2 for this test
        await executeQuery(`UPDATE tasks SET deleted_at = NULL WHERE id = 2`)

        const getResponse = await request.get('/api/tables/1/records/2', {})
        expect(getResponse.status()).toBe(200)

        const recordData = await getResponse.json()
        expect(recordData.record.id).toBe(2)
        expect(recordData.record.fields.title).toBe('Deleted Task 1')
      })
    }
  )
})
