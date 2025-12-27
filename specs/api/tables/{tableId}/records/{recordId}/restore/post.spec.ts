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
 * Spec Count: 9
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

  test.fixme(
    'API-TABLES-RECORDS-RESTORE-001: should return 200 OK and clear deleted_at',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with a soft-deleted record
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
      expect(data.record.id).toBe(1)

      // THEN: deleted_at is cleared (record is active again)
      const afterRestore = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
      expect(afterRestore.deleted_at).toBeNull()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-RESTORE-002: should return 404 for non-existent record',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Table exists but record ID=9999 does not
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

      // WHEN: User attempts to restore non-existent record
      const response = await request.post('/api/tables/1/records/9999/restore', {})

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Record not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-RESTORE-003: should return 400 for non-deleted record',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with an active (non-deleted) record
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
        INSERT INTO tasks (id, title) VALUES (1, 'Active Task')
      `)

      // WHEN: User attempts to restore an already-active record
      const response = await request.post('/api/tables/1/records/1/restore', {})

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data.error).toBe('Bad Request')
      expect(data.message).toBe('Record is not deleted')
    }
  )

  test(
    'API-TABLES-RECORDS-RESTORE-004: should return 401 Unauthorized',
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

      // WHEN: User attempts to restore without auth token
      const response = await request.post('/api/tables/1/records/1/restore')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data.error).toBeDefined()

      // THEN: Record remains soft-deleted
      const result = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=1`)
      expect(result.deleted_at).toBeTruthy()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-RESTORE-005: should return 403 for viewer (read-only)',
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
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO projects (id, name, deleted_at) VALUES (1, 'Deleted Project', NOW())
      `)

      // WHEN: Viewer attempts to restore a record
      const response = await request.post('/api/tables/1/records/1/restore', {})

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to restore records in this table')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-RESTORE-006: should return 200 for member with delete permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A member user with delete permission (same permissions as delete)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'items',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO items (id, name, organization_id, deleted_at)
        VALUES (1, 'Deleted Item', 'org_123', NOW())
      `)

      // WHEN: Member restores a record in their organization
      const response = await request.post('/api/tables/1/records/1/restore', {})

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)

      // THEN: Record is restored (deleted_at cleared)
      const result = await executeQuery(`SELECT deleted_at FROM items WHERE id=1`)
      expect(result.deleted_at).toBeNull()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-RESTORE-007: should return 404 for cross-org access',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Two users in different organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'items',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })

      // Create User A with Organization A (creates organization automatically)
      const userA = await createAuthenticatedUser({ createOrganization: true })

      // Create a record in User A's organization and soft-delete it
      await executeQuery(`
        INSERT INTO items (id, name, organization_id, deleted_at)
        VALUES (1, 'User A Item', '${userA.organizationId}', NOW())
      `)

      // Create User B with Organization B - sets up isolation context for the test
      await createAuthenticatedUser({ createOrganization: true })

      // WHEN: User B attempts to restore User A's soft-deleted record
      const response = await request.post('/api/tables/1/records/1/restore', {})

      // THEN: Returns 404 Not Found (organization isolation prevents access)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Record not found')

      // THEN: Record remains soft-deleted in User A's organization
      const result = await executeQuery(`SELECT deleted_at FROM items WHERE id=1`)
      expect(result.deleted_at).toBeTruthy()
    }
  )

  // ============================================================================
  // Activity Log Tests
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-RESTORE-008: should create activity log entry when record is restored',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Application with auth and activity logging configured
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
      const response = await request.post('/api/tables/1/records/1/restore', {})

      expect(response.status()).toBe(200)

      // THEN: Activity log entry is created for restore action
      const logs = await executeQuery(`
        SELECT * FROM _sovrium_activity_logs
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

  test.fixme(
    'API-TABLES-RECORDS-RESTORE-009: should capture user_id who restored the record',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedAdmin }) => {
      // GIVEN: Two users with different roles
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      const { user: adminUser } = await createAuthenticatedAdmin({
        email: 'admin@example.com',
      })

      await executeQuery(`
        INSERT INTO items (id, name, deleted_at)
        VALUES (1, 'Item A', NOW())
      `)

      // WHEN: Admin restores the record
      const response = await request.post('/api/tables/1/records/1/restore', {})

      expect(response.status()).toBe(200)

      // THEN: Activity log correctly attributes restore to admin user
      const logs = await executeQuery(`
        SELECT user_id FROM _sovrium_activity_logs
        WHERE table_name = 'items' AND action = 'restore' AND record_id = '1'
        ORDER BY created_at DESC
        LIMIT 1
      `)

      expect(logs.rows[0].user_id).toBe(adminUser.id)
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-RESTORE-010: user can complete full record restore workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with tasks table', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 8,
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
            (2, 'Deleted Task', 'completed', NOW()),
            (3, 'Another Deleted', 'pending', NOW())
        `)
      })

      await test.step('Restore soft-deleted record successfully', async () => {
        const restoreResponse = await request.post('/api/tables/1/records/2/restore', {})
        expect(restoreResponse.status()).toBe(200)

        const data = await restoreResponse.json()
        expect(data.success).toBe(true)
        expect(data.record.id).toBe(2)
      })

      await test.step('Verify record is restored in database', async () => {
        const restoredRecord = await executeQuery(`SELECT deleted_at FROM tasks WHERE id=2`)
        expect(restoredRecord.deleted_at).toBeNull()
      })

      await test.step('Verify restoring active record fails', async () => {
        const badRequestResponse = await request.post('/api/tables/1/records/1/restore', {})
        expect(badRequestResponse.status()).toBe(400)

        const errorData = await badRequestResponse.json()
        expect(errorData.message).toBe('Record is not deleted')
      })

      await test.step('Verify restoring non-existent record fails', async () => {
        const notFoundResponse = await request.post('/api/tables/1/records/9999/restore', {})
        expect(notFoundResponse.status()).toBe(404)
      })

      await test.step('Verify unauthenticated restore fails', async () => {
        const unauthorizedResponse = await request.post('/api/tables/1/records/3/restore')
        expect(unauthorizedResponse.status()).toBe(401)
      })

      await test.step('Verify restored record is accessible via GET', async () => {
        const getResponse = await request.get('/api/tables/1/records/2', {})
        expect(getResponse.status()).toBe(200)

        const recordData = await getResponse.json()
        expect(recordData.record.id).toBe(2)
        expect(recordData.record.fields.title).toBe('Deleted Task')
      })
    }
  )
})
