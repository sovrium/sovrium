/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

 
/**
 * E2E Tests for Delete record (Soft Delete)
 *
 * Source: specs/api/paths/tables/{tableId}/records/{recordId}/delete.json
 * Domain: api
 * Spec Count: 19
 *
 * Soft Delete Behavior:
 * - DELETE sets deleted_at timestamp (soft delete by default)
 * - DELETE with ?permanent=true removes record permanently (admin/owner only)
 * - Soft-deleted records are excluded from normal queries
 * - Soft-deleted records can be restored via POST /restore endpoint
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (18 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Delete record', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test(
    'API-TABLES-RECORDS-DELETE-001: should return 204 No Content and soft delete record',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table 'contacts' with record ID=1 and deleted_at field for soft delete
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'contacts',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO contacts (id, email) VALUES (1, 'test@example.com')
      `)

      // WHEN: User deletes record by ID
      const response = await request.delete('/api/tables/1/records/1', {})

      // THEN: Returns 204 No Content
      expect(response.status()).toBe(204)

      // THEN: Record still exists but deleted_at is set (soft delete)
      const result = await executeQuery(`SELECT deleted_at FROM contacts WHERE id=1`)
      expect(result.deleted_at).toBeTruthy()
    }
  )

  test(
    'API-TABLES-RECORDS-DELETE-002: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table 'contacts' exists but record ID=9999 does not
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 2,
            name: 'contacts',
            fields: [
              { id: 1, name: 'email', type: 'email', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })
      await createAuthenticatedUser()

      // WHEN: User attempts to delete non-existent record
      const response = await request.delete('/api/tables/2/records/9999', {})

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Record not found')
    }
  )

  test(
    'API-TABLES-RECORDS-DELETE-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An unauthenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
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
        auth: {
          emailAndPassword: true,
        },
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
        auth: {
          emailAndPassword: true,
        },
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
        auth: {
          emailAndPassword: true,
        },
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
        auth: {
          emailAndPassword: true,
        },
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
        auth: {
          emailAndPassword: true,
        },
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
        auth: {
          emailAndPassword: true,
        },
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
        auth: {
          emailAndPassword: true,
        },
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
    'API-TABLES-RECORDS-DELETE-011: should return 404 when deleting already soft-deleted record',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A soft-deleted record exists
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
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
    'API-TABLES-RECORDS-DELETE-012: should set deleted_at to current timestamp',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An active record exists
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
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
    'API-TABLES-RECORDS-DELETE-013: should hard delete with permanent=true query param (admin only)',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: An admin user and an active record
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
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
    'API-TABLES-RECORDS-DELETE-014: should return 403 for member using permanent=true',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A member user (without permanent delete permission)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
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

  test.fixme(
    'API-TABLES-RECORDS-DELETE-015: should cascade soft delete to related records when configured',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Two tables with relationship (contacts → tasks) and cascade delete configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 16,
            name: 'contacts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 17,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
              {
                id: 3,
                name: 'contact_id',
                type: 'relationship',
                relatedTable: 'contacts',
                relationType: 'many-to-one',
                required: true,
                onDelete: 'cascade', // Cascade soft delete
              },
              { id: 4, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await executeQuery("INSERT INTO contacts (id, name) VALUES (1, 'Alice')")
      await executeQuery(`
        INSERT INTO tasks (id, title, contact_id) VALUES
        (1, 'Task 1', 1),
        (2, 'Task 2', 1)
      `)

      // WHEN: Contact is soft-deleted via DELETE endpoint
      const response = await request.delete('/api/tables/16/records/1', {})

      // THEN: Delete request succeeds
      expect(response.status()).toBe(204)

      // THEN: Contact is soft-deleted (deleted_at set)
      const contactResult = await executeQuery(`
        SELECT deleted_at FROM contacts WHERE id = 1
      `)
      expect(contactResult.deleted_at).toBeTruthy()

      // THEN: Related tasks are also soft-deleted (cascade)
      const tasksInTrash = await executeQuery(`
        SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NOT NULL
      `)
      expect(tasksInTrash.count).toBe(2)

      // THEN: Normal task queries return zero results
      const apiResponse = await request.get('/api/tables/17/records', {})
      const data = await apiResponse.json()

      expect(data.records).toHaveLength(0)

      // THEN: Trash endpoint shows all cascaded soft-deleted tasks
      const trashResponse = await request.get('/api/tables/17/trash', {})
      const trashData = await trashResponse.json()

      expect(trashData.records).toHaveLength(2)
      expect(
        trashData.records.every((r: { fields: { deleted_at: string } }) => r.fields.deleted_at)
      ).toBe(true)
    }
  )

  // ============================================================================
  // Activity Log Tests
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-DELETE-016: should create activity log entry when record is soft-deleted',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Application with auth and activity logging configured
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 18,
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
        INSERT INTO tasks (id, title, status)
        VALUES (1, 'Task to Delete', 'pending')
      `)

      // WHEN: User soft-deletes the record
      const response = await request.delete('/api/tables/1/records/1', {})

      expect(response.status()).toBe(204)

      // THEN: Activity log entry is created with before state
      const logs = await executeQuery(`
        SELECT * FROM _sovrium_activity_logs
        WHERE table_name = 'tasks' AND action = 'delete' AND record_id = '1'
        ORDER BY created_at DESC
        LIMIT 1
      `)

      expect(logs.rows).toHaveLength(1)
      const log = logs.rows[0]
      expect(log.action).toBe('delete')
      expect(log.user_id).toBe(user.id)
      expect(log.table_id).toBe('1')
      expect(log.record_id).toBe('1')

      // Parse and verify changes field
      const changes = JSON.parse(log.changes)
      expect(changes.before).toBeDefined()
      expect(changes.before.title).toBe('Task to Delete')
      expect(changes.before.status).toBe('pending')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-017: should create activity log entry when record is permanently deleted',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedAdmin }) => {
      // GIVEN: Admin user with permanent delete permission
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 19,
            name: 'logs',
            fields: [
              { id: 1, name: 'id', type: 'autonumber', required: true },
              { id: 2, name: 'message', type: 'single-line-text', required: true },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedAdmin({
        email: 'admin@example.com',
      })

      await executeQuery(`
        INSERT INTO logs (id, message) VALUES (1, 'Log entry')
      `)

      // WHEN: Admin permanently deletes the record
      const response = await request.delete('/api/tables/1/records/1?permanent=true', {})

      expect(response.status()).toBe(204)

      // THEN: Activity log entry is created for permanent delete
      const logs = await executeQuery(`
        SELECT * FROM _sovrium_activity_logs
        WHERE table_name = 'logs' AND action = 'delete' AND record_id = '1'
        ORDER BY created_at DESC
        LIMIT 1
      `)

      expect(logs.rows).toHaveLength(1)
      const log = logs.rows[0]
      expect(log.action).toBe('delete')
      expect(log.user_id).toBe(user.id)

      // Verify changes.before contains record state before deletion
      const changes = JSON.parse(log.changes)
      expect(changes.before.message).toBe('Log entry')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-DELETE-018: should capture user_id who deleted the record',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedAdmin }) => {
      // GIVEN: Two users with different permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 20,
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
        INSERT INTO items (id, name) VALUES (1, 'Item A')
      `)

      // WHEN: Admin deletes the record
      const response = await request.delete('/api/tables/1/records/1', {})

      expect(response.status()).toBe(204)

      // THEN: Activity log correctly attributes deletion to admin user
      const logs = await executeQuery(`
        SELECT user_id FROM _sovrium_activity_logs
        WHERE table_name = 'items' AND action = 'delete' AND record_id = '1'
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
    'API-TABLES-RECORDS-DELETE-019: user can complete full soft delete workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with contacts table', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
          },
          tables: [
            {
              id: 16,
              name: 'contacts',
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
          INSERT INTO contacts (id, email, organization_id) VALUES
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
        const result = await executeQuery(`SELECT deleted_at FROM contacts WHERE id=1`)
        expect(result.deleted_at).toBeTruthy()
      })

      await test.step('Verify soft-deleted record is not visible in queries', async () => {
        const activeUsers = await executeQuery(`
          SELECT COUNT(*) as count FROM contacts WHERE deleted_at IS NULL
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

        const verifyPermanent = await executeQuery(
          `SELECT COUNT(*) as count FROM contacts WHERE id=2`
        )
        expect(verifyPermanent.rows[0].count).toBe(0)
      })

      await test.step('Verify unauthenticated delete fails', async () => {
        const unauthorizedResponse = await request.delete('/api/tables/1/records/3')
        expect(unauthorizedResponse.status()).toBe(401)
      })
    }
  )
})
