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
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with multiple soft-deleted records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

  test.fixme(
    'API-TABLES-RECORDS-BATCH-RESTORE-002: should rollback on partial failure (404)',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with some soft-deleted records (but one ID doesn't exist)
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

  test.fixme(
    'API-TABLES-RECORDS-BATCH-RESTORE-003: should return 400 for non-deleted records in batch',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with mix of deleted and active records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
      // GIVEN: An unauthenticated user with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toBe('You do not have permission to restore records in this table')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-BATCH-RESTORE-REGRESSION: user can complete full batch restore workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      await test.step('Setup: Start server with tasks table', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: { emailAndPassword: true },
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
      })

      await test.step('Setup: Insert test records (mix of active and deleted)', async () => {
        await executeQuery(`
          INSERT INTO tasks (id, title, deleted_at) VALUES
            (1, 'Task 1', NOW()),
            (2, 'Task 2', NOW()),
            (3, 'Task 3', NOW()),
            (4, 'Active Task', NULL)
        `)
      })

      await test.step('API-TABLES-RECORDS-BATCH-RESTORE-001: returns 200 with restored count', async () => {
        // Verify records are soft-deleted
        const beforeRestore = await executeQuery(
          `SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NOT NULL`
        )
        expect(beforeRestore.count).toBe('3')

        // User batch restores the soft-deleted records
        const response = await request.post('/api/tables/1/records/batch/restore', {
          data: { ids: [1, 2, 3] },
        })

        // Returns 200 OK with restored count
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.restored).toBe(3)

        // All records are restored (deleted_at cleared)
        const afterRestore = await executeQuery(
          `SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL`
        )
        expect(afterRestore.count).toBe('4')
      })

      await test.step('API-TABLES-RECORDS-BATCH-RESTORE-002: rollback on partial failure (404)', async () => {
        // Soft-delete records again for this test
        await executeQuery(`UPDATE tasks SET deleted_at = NOW() WHERE id IN (1, 2)`)

        // User attempts to batch restore including non-existent record
        const response = await request.post('/api/tables/1/records/batch/restore', {
          data: { ids: [1, 2, 9999] },
        })

        // Returns 404 Not Found
        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
        expect(data.recordId).toBe(9999)

        // No records were restored (transaction rollback)
        const result = await executeQuery(
          `SELECT COUNT(*) as count FROM tasks WHERE id IN (1, 2) AND deleted_at IS NOT NULL`
        )
        expect(result.count).toBe('2')
      })

      await test.step('API-TABLES-RECORDS-BATCH-RESTORE-003: returns 400 for non-deleted records in batch', async () => {
        // User attempts to batch restore including an active record
        const response = await request.post('/api/tables/1/records/batch/restore', {
          data: { ids: [1, 4] },
        })

        // Returns 400 Bad Request
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data.error).toBe('Bad Request')
        expect(data.message).toContain('Record is not deleted')
        expect(data.recordId).toBe(4)

        // No records were restored (transaction rollback)
        const result = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
        expect(result.deleted_at).toBeTruthy()
      })

      await test.step('API-TABLES-RECORDS-BATCH-RESTORE-004: returns 401 Unauthorized', async () => {
        // User attempts to batch restore without auth token
        const response = await request.post('/api/tables/1/records/batch/restore')

        // Returns 401 Unauthorized
        expect(response.status()).toBe(401)

        const data = await response.json()
        expect(data.error).toBeDefined()
        expect(data.message).toBeDefined()

        // Records remain soft-deleted
        const result = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
        expect(result.deleted_at).toBeTruthy()
      })

      await test.step('API-TABLES-RECORDS-BATCH-RESTORE-005: returns 403 for viewer', async () => {
        // Create viewer user with read-only access
        const viewer = await createAuthenticatedUser()

        await executeQuery(`
          UPDATE auth.user
          SET role = 'viewer'
          WHERE id = '${viewer.user.id}'
        `)

        // Viewer attempts to batch restore records
        const response = await request.post('/api/tables/1/records/batch/restore', {
          data: { ids: [1, 2] },
        })

        // Returns 403 Forbidden
        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('You do not have permission to perform this action')
        expect(data.code).toBe('FORBIDDEN')
        expect(data.message).toBe('You do not have permission to restore records in this table')
      })
    }
  )
})
