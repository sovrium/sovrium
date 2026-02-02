/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Restore record endpoint
 *
 * Source: specs/api/paths/tables/{tableId}/records/{recordId}/restore/post.json
 * Domain: api
 * Spec Count: 8
 *
 * Restore Behavior:
 * - POST /restore clears deleted_at timestamp on soft-deleted records
 * - Returns 400 if record is not soft-deleted (already active)
 * - Returns 404 if record doesn't exist
 * - Permissions: Same as delete (member+ can restore)
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (9 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Restore record', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test(
    'API-TABLES-RECORDS-RESTORE-001: should return 200 OK and clear deleted_at',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with a soft-deleted record
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
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
        INSERT INTO tasks (id, title, deleted_at) VALUES (1, 'Deleted Task', NOW())
      `)

      // Verify record is soft-deleted
      const beforeRestore = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
      expect(beforeRestore.deleted_at).toBeTruthy()

      // WHEN: User restores the soft-deleted record
      const response = await request.post('/api/tables/1/records/1/restore', {})

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.record).toBeDefined()
      expect(data.record.id).toBe('1')

      // THEN: deleted_at is cleared (record is active again)
      const afterRestore = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
      expect(afterRestore.deleted_at).toBeNull()
    }
  )

  test(
    'API-TABLES-RECORDS-RESTORE-002: should return 404 for non-existent record',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table exists but record ID=9999 does not
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
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

      // WHEN: User attempts to restore non-existent record
      const response = await request.post('/api/tables/2/records/9999/restore', {})

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('Resource not found')
      expect(data.code).toBe('NOT_FOUND')
    }
  )

  test(
    'API-TABLES-RECORDS-RESTORE-003: should return 400 for non-deleted record',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with an active (non-deleted) record
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
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
        INSERT INTO tasks (id, title) VALUES (1, 'Active Task')
      `)

      // WHEN: User attempts to restore an already-active record
      const response = await request.post('/api/tables/3/records/1/restore', {})

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('Record is not deleted')
      expect(data.code).toBe('VALIDATION_ERROR')
    }
  )

  test(
    'API-TABLES-RECORDS-RESTORE-004: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An unauthenticated user with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
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

      // WHEN: User attempts to restore without auth token
      const response = await request.post('/api/tables/4/records/1/restore')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data.error).toBeDefined()
      expect(data.message).toBeDefined()

      // THEN: Record remains soft-deleted
      const result = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
      expect(result.deleted_at).toBeTruthy()
    }
  )

  test(
    'API-TABLES-RECORDS-RESTORE-005: should return 403 for viewer (read-only)',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedViewer }) => {
      // GIVEN: A viewer user with read-only access
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 5,
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
        INSERT INTO projects (id, name, deleted_at) VALUES (1, 'Deleted Project', NOW())
      `)

      // WHEN: Viewer attempts to restore a record
      const response = await request.post('/api/tables/5/records/1/restore', {})

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toBe('You do not have permission to restore records in this table')
    }
  )

  test(
    'API-TABLES-RECORDS-RESTORE-006: should return 200 for member with delete permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: A member user with delete permission (same permissions as delete)
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 6,
            name: 'items',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })

      await createAuthenticatedMember()
      await executeQuery(`
        INSERT INTO items (id, name, deleted_at)
        VALUES (1, 'Deleted Item', NOW())
      `)

      // WHEN: Member restores a record
      const response = await request.post('/api/tables/6/records/1/restore', {})

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)

      // THEN: Record is restored (deleted_at cleared)
      const result = await executeQuery(`SELECT deleted_at FROM items WHERE id=1`)
      expect(result.deleted_at).toBeNull()
    }
  )

  // ============================================================================
  // Activity Log Tests
  // ============================================================================

  test(
    'API-TABLES-RECORDS-RESTORE-007: should create activity log entry when record is restored',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Application with auth and activity logging configured
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 8,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'autonumber', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
              { id: 3, name: 'status', type: 'single-line-text' },
              { id: 4, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({ email: 'user@example.com' })

      await executeQuery(`
        INSERT INTO tasks (id, title, status, deleted_at)
        VALUES (1, 'Deleted Task', 'completed', NOW())
      `)

      // WHEN: User restores the soft-deleted record
      const response = await request.post('/api/tables/8/records/1/restore', {})

      expect(response.status()).toBe(200)

      // THEN: Activity log entry is created for restore action
      const logs = await executeQuery(`
        SELECT * FROM system.activity_logs
        WHERE table_name = 'tasks' AND action = 'restore' AND record_id = '1'
        ORDER BY created_at DESC
        LIMIT 1
      `)

      expect(logs.rows).toHaveLength(1)
      const log = logs.rows[0]
      expect(log.action).toBe('restore')
      expect(log.user_id).toBe(user.id)
      expect(log.table_id).toBe('1')
      expect(log.record_id).toBe('1')

      // Parse and verify changes field contains restored state
      const changes = JSON.parse(log.changes)
      expect(changes.after).toBeDefined()
      expect(changes.after.title).toBe('Deleted Task')
      expect(changes.after.status).toBe('completed')
      expect(changes.after.deleted_at).toBeNull()
    }
  )

  test(
    'API-TABLES-RECORDS-RESTORE-008: should capture user_id who restored the record',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: A user who will restore records
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 9,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'autonumber', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })

      const { user: authenticatedUser } = await createAuthenticatedUser({
        email: 'user@example.com',
      })

      await executeQuery(`
        INSERT INTO items (id, name, deleted_at)
        VALUES (1, 'Item A', NOW())
      `)

      // WHEN: User restores the record
      const response = await request.post('/api/tables/9/records/1/restore', {})

      expect(response.status()).toBe(200)

      // THEN: Activity log correctly attributes restore to the authenticated user
      const logs = await executeQuery(`
        SELECT user_id FROM system.activity_logs
        WHERE table_name = 'items' AND action = 'restore' AND record_id = '1'
        ORDER BY created_at DESC
        LIMIT 1
      `)

      expect(logs.rows[0].user_id).toBe(authenticatedUser.id)
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 8 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'API-TABLES-RECORDS-RESTORE-REGRESSION: user can complete full record restore workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // Setup: Create schema with tasks table supporting soft delete
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'status', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })

      // Insert test data for all scenarios
      await executeQuery(`
        INSERT INTO tasks (id, title, status, deleted_at)
        VALUES
          (1, 'Deleted Task 1', 'completed', NOW()),
          (3, 'Deleted Task 3', 'pending', NOW())
      `)
      await executeQuery(`
        INSERT INTO tasks (id, title, status)
        VALUES (2, 'Active Task', 'active')
      `)

      // Step 004: Test 401 BEFORE authenticating (request has no cookies yet)
      await test.step('API-TABLES-RECORDS-RESTORE-004: Return 401 Unauthorized', async () => {
        const response = await request.post('/api/tables/1/records/1/restore')

        expect(response.status()).toBe(401)

        // Verify record remains soft-deleted
        const result = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
        expect(result.deleted_at).toBeTruthy()
      })

      // Authenticate user for remaining tests (member role by default)
      const { user } = await createAuthenticatedUser()

      await test.step('API-TABLES-RECORDS-RESTORE-001: Return 200 OK and clear deleted_at', async () => {
        // Verify record is soft-deleted before restore
        const beforeRestore = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
        expect(beforeRestore.deleted_at).toBeTruthy()

        const response = await request.post('/api/tables/1/records/1/restore', {})

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.record).toBeDefined()
        expect(data.record.id).toBe('1')

        // Verify deleted_at is cleared
        const afterRestore = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
        expect(afterRestore.deleted_at).toBeNull()
      })

      await test.step('API-TABLES-RECORDS-RESTORE-002: Return 404 for non-existent record', async () => {
        const response = await request.post('/api/tables/1/records/9999/restore', {})

        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-RECORDS-RESTORE-003: Return 400 for non-deleted record', async () => {
        // Record 2 is active (not soft-deleted)
        const response = await request.post('/api/tables/1/records/2/restore', {})

        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Record is not deleted')
        expect(data.code).toBe('VALIDATION_ERROR')
      })

      // Step 005 skipped: requires viewer auth context
      // See individual @spec test for viewer permission coverage

      await test.step('API-TABLES-RECORDS-RESTORE-006: Member can restore soft-deleted record', async () => {
        // Record 3 is still soft-deleted
        const response = await request.post('/api/tables/1/records/3/restore', {})

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.success).toBe(true)

        // Verify record is restored
        const result = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=3`)
        expect(result.deleted_at).toBeNull()
      })

      await test.step('API-TABLES-RECORDS-RESTORE-007: Create activity log entry on restore', async () => {
        // Soft-delete record 1 again so we can restore it and check activity log
        await executeQuery(`UPDATE tasks SET deleted_at = NOW() WHERE id = 1`)

        const response = await request.post('/api/tables/1/records/1/restore', {})
        expect(response.status()).toBe(200)

        // Verify activity log entry is created
        const logs = await executeQuery(`
          SELECT * FROM system.activity_logs
          WHERE table_name = 'tasks' AND action = 'restore' AND record_id = '1'
          ORDER BY created_at DESC
          LIMIT 1
        `)

        expect(logs.rows).toHaveLength(1)
        const log = logs.rows[0]
        expect(log.action).toBe('restore')
        expect(log.user_id).toBe(user.id)
        expect(log.table_id).toBe('1')
        expect(log.record_id).toBe('1')

        // Verify changes field contains restored state
        const changes = JSON.parse(log.changes)
        expect(changes.after).toBeDefined()
        expect(changes.after.deleted_at).toBeNull()
      })

      // Step 008 skipped: requires admin auth context
      // See individual @spec test for admin user_id attribution
    }
  )
})
