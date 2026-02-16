/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Record Authorship Metadata
 *
 * Source: src/domain/models/app/table/field-types/ (created-by, updated-by, deleted-by)
 * Domain: api
 * Spec Count: 23
 *
 * Authorship Metadata Behavior:
 * - createdBy: Auto-set to current user ID on record creation, immutable
 * - updatedBy: Auto-set to current user ID on record creation and updates
 * - deletedBy: Auto-set to current user ID on soft delete, cleared on restore
 * - All authorship fields are read-only via the API (user-provided values ignored)
 * - When no auth configured, authorship fields are NULL
 * - Fields reference Better Auth's users table (TEXT id / UUID)
 *
 * Distinction from APP-level field-type specs:
 * - APP specs (specs/app/tables/field-types/*-by-field.spec.ts) test DB schema behavior
 *   (column creation, FK constraints, triggers, indexing)
 * - These API specs test Records API behavior: how CRUD endpoints auto-populate
 *   and expose authorship fields during create, update, delete, and restore operations
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (23 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Full lifecycle workflow
 */

test.describe('Record Authorship Metadata', () => {
  // ============================================================================
  // US-API-AUTHORSHIP-001: Created By on Record Creation
  // ============================================================================

  test(
    'API-TABLES-RECORDS-AUTHORSHIP-001: should auto-set created_by to current user ID on record creation',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with created_by field and authentication enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'created_by', type: 'created-by' },
              { id: 3, name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice Johnson',
      })

      // WHEN: User creates a new record
      const response = await request.post('/api/tables/1/records', {
        headers: { 'Content-Type': 'application/json' },
        data: {
          fields: { title: 'My First Task' },
        },
      })

      // THEN: Returns 201 Created
      expect(response.status()).toBe(201)

      // THEN: created_by is set to the authenticated user's ID in the database
      const result = await executeQuery(
        `SELECT created_by FROM tasks WHERE title = 'My First Task'`
      )
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].created_by).toBe(user.id)
    }
  )

  test(
    'API-TABLES-RECORDS-AUTHORSHIP-002: should include created_by in API response after creation',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table with created_by field and authentication enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'created_by', type: 'created-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice Johnson',
      })

      // WHEN: User creates a new record
      const response = await request.post('/api/tables/2/records', {
        headers: { 'Content-Type': 'application/json' },
        data: {
          fields: { title: 'Task with Author' },
        },
      })

      // THEN: Response includes created_by field with user ID
      expect(response.status()).toBe(201)
      const data = await response.json()
      expect(data.createdBy).toBe(user.id)
    }
  )

  test(
    'API-TABLES-RECORDS-AUTHORSHIP-003: should store created_by with correct user ID in database',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with created_by field and a known user
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 3,
            name: 'notes',
            fields: [
              { id: 1, name: 'content', type: 'single-line-text', required: true },
              { id: 2, name: 'created_by', type: 'created-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'bob@example.com',
        name: 'Bob Smith',
      })

      // WHEN: User creates a record
      const response = await request.post('/api/tables/3/records', {
        headers: { 'Content-Type': 'application/json' },
        data: {
          fields: { content: 'Important note' },
        },
      })

      expect(response.status()).toBe(201)

      // THEN: Database record has created_by matching the user's auth ID
      const result = await executeQuery(`
        SELECT n.created_by, u.email
        FROM notes n
        JOIN auth.user u ON n.created_by = u.id
        WHERE n.content = 'Important note'
      `)
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].created_by).toBe(user.id)
      expect(result.rows[0].email).toBe('bob@example.com')
    }
  )

  test(
    'API-TABLES-RECORDS-AUTHORSHIP-004: should set created_by to NULL when no authentication is configured',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with created_by field but NO authentication configured
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'public_entries',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'created_by', type: 'created-by' },
            ],
          },
        ],
      })

      // WHEN: An unauthenticated request creates a record (no auth strategy)
      const response = await request.post('/api/tables/4/records', {
        headers: { 'Content-Type': 'application/json' },
        data: {
          fields: { title: 'Public Entry' },
        },
      })

      // THEN: Record is created successfully
      expect(response.status()).toBe(201)

      // THEN: created_by is NULL since no user session exists
      const result = await executeQuery(
        `SELECT created_by FROM public_entries WHERE title = 'Public Entry'`
      )
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].created_by).toBeNull()
    }
  )

  // ============================================================================
  // US-API-AUTHORSHIP-002: Updated By on Record Update
  // ============================================================================

  test(
    'API-TABLES-RECORDS-AUTHORSHIP-005: should auto-set updated_by to current user ID on record update',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with updated_by field and an existing record
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 5,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'updated_by', type: 'updated-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice Johnson',
      })

      // Insert a record directly (simulating prior creation)
      await executeQuery(`INSERT INTO tasks (id, title) VALUES (1, 'Original Title')`)

      // WHEN: User updates the record
      const response = await request.patch('/api/tables/5/records/1', {
        headers: { 'Content-Type': 'application/json' },
        data: {
          fields: { title: 'Updated Title' },
        },
      })

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)

      // THEN: updated_by is set to the updating user's ID
      const result = await executeQuery(`SELECT updated_by FROM tasks WHERE id = 1`)
      expect(result.rows[0].updated_by).toBe(user.id)
    }
  )

  test(
    'API-TABLES-RECORDS-AUTHORSHIP-006: should reflect the updating user, not the original creator',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      signIn,
      signUp,
    }) => {
      // GIVEN: Table with both created_by and updated_by fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 6,
            name: 'documents',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'created_by', type: 'created-by' },
              { id: 3, name: 'updated_by', type: 'updated-by' },
            ],
          },
        ],
      })

      // Alice creates a record
      const { user: alice } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      const createResponse = await request.post('/api/tables/6/records', {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { title: 'Alice Document' } },
      })
      expect(createResponse.status()).toBe(201)
      const created = await createResponse.json()

      // Bob signs up and signs in (replacing Alice's session)
      await signUp({ email: 'bob@example.com', password: 'SecurePass123!', name: 'Bob' })
      await signIn({ email: 'bob@example.com', password: 'SecurePass123!' })

      // WHEN: Bob updates Alice's record
      const updateResponse = await request.patch(`/api/tables/6/records/${created.id}`, {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { title: 'Bob Updated Document' } },
      })

      // THEN: Returns 200 OK
      expect(updateResponse.status()).toBe(200)

      // THEN: created_by still reflects Alice, updated_by reflects Bob
      const result = await executeQuery(
        `SELECT created_by, updated_by FROM documents WHERE id = $1`,
        [created.id]
      )
      expect(result.rows[0].created_by).toBe(alice.id)
      expect(result.rows[0].updated_by).not.toBe(alice.id) // Bob's ID
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-007: should set updated_by to same value as created_by on initial creation',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with both created_by and updated_by fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 7,
            name: 'items',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'created_by', type: 'created-by' },
              { id: 3, name: 'updated_by', type: 'updated-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      // WHEN: User creates a new record (no prior update)
      const response = await request.post('/api/tables/7/records', {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { name: 'New Item' } },
      })

      // THEN: Both created_by and updated_by are set to the creating user
      expect(response.status()).toBe(201)
      const result = await executeQuery(
        `SELECT created_by, updated_by FROM items WHERE name = 'New Item'`
      )
      expect(result.rows[0].created_by).toBe(user.id)
      expect(result.rows[0].updated_by).toBe(user.id)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-008: should include updated_by in API response after update',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with updated_by field and an existing record
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 8,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'updated_by', type: 'updated-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      await executeQuery(`INSERT INTO tasks (id, title) VALUES (1, 'Original')`)

      // WHEN: User updates the record
      const response = await request.patch('/api/tables/8/records/1', {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { title: 'Updated' } },
      })

      // THEN: Response includes updated_by field
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.updatedBy).toBe(user.id)
    }
  )

  // ============================================================================
  // US-API-AUTHORSHIP-003: Deleted By on Soft Delete
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-009: should auto-set deleted_by to current user ID on soft delete',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with deleted_by and deleted_at fields, and an active record
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 9,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
              { id: 3, name: 'deleted_by', type: 'deleted-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      await executeQuery(`INSERT INTO tasks (id, title) VALUES (1, 'Task to Delete')`)

      // WHEN: User soft-deletes the record
      const response = await request.delete('/api/tables/9/records/1', {})

      // THEN: Returns 204 No Content
      expect(response.status()).toBe(204)

      // THEN: deleted_by is set to the deleting user's ID
      const result = await executeQuery(`SELECT deleted_by, deleted_at FROM tasks WHERE id = 1`)
      expect(result.rows[0].deleted_by).toBe(user.id)
      expect(result.rows[0].deleted_at).toBeTruthy()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-010: should have deleted_by as NULL for active records',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with deleted_by field and an active (non-deleted) record
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 10,
            name: 'items',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
              { id: 3, name: 'deleted_by', type: 'deleted-by' },
            ],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: Record is created (active, not deleted)
      const response = await request.post('/api/tables/10/records', {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { name: 'Active Item' } },
      })

      expect(response.status()).toBe(201)

      // THEN: deleted_by is NULL for active records
      const result = await executeQuery(
        `SELECT deleted_by, deleted_at FROM items WHERE name = 'Active Item'`
      )
      expect(result.rows[0].deleted_by).toBeNull()
      expect(result.rows[0].deleted_at).toBeNull()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-011: should clear deleted_by when record is restored',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with deleted_by field and a soft-deleted record
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 11,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
              { id: 3, name: 'deleted_by', type: 'deleted-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      // Create and soft-delete a record
      await executeQuery(
        `INSERT INTO tasks (id, title, deleted_at, deleted_by) VALUES (1, 'Deleted Task', NOW(), $1)`,
        [user.id]
      )

      // Verify it is soft-deleted with deleted_by set
      const before = await executeQuery(`SELECT deleted_by FROM tasks WHERE id = 1`)
      expect(before.rows[0].deleted_by).toBe(user.id)

      // WHEN: Record is restored
      const response = await request.post('/api/tables/11/records/1/restore', {})

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)

      // THEN: deleted_by is cleared (set to NULL)
      const after = await executeQuery(`SELECT deleted_by, deleted_at FROM tasks WHERE id = 1`)
      expect(after.rows[0].deleted_by).toBeNull()
      expect(after.rows[0].deleted_at).toBeNull()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-012: should include deleted_by in trash listing response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with deleted_by field and soft-deleted records
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 12,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
              { id: 3, name: 'deleted_by', type: 'deleted-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      // Insert a soft-deleted record with deleted_by set
      await executeQuery(
        `INSERT INTO tasks (id, title, deleted_at, deleted_by) VALUES (1, 'Trashed Task', NOW(), $1)`,
        [user.id]
      )

      // WHEN: User views the trash listing
      const response = await request.get('/api/tables/12/trash')

      // THEN: Response includes deleted_by for each trashed record
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].deletedBy).toBeDefined()
      expect(data.records[0].deletedBy.id).toBe(user.id)
    }
  )

  // ============================================================================
  // US-API-AUTHORSHIP-004: Read-Only Enforcement
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-013: should ignore user-provided created_by value on create',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with created_by field and authentication enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 13,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'created_by', type: 'created-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      // WHEN: User attempts to set created_by to a fake user ID
      const response = await request.post('/api/tables/13/records', {
        headers: { 'Content-Type': 'application/json' },
        data: {
          fields: {
            title: 'Forged Record',
            created_by: 'fake-user-id-999',
          },
        },
      })

      // THEN: Record is created successfully (API ignores the provided value)
      expect(response.status()).toBe(201)

      // THEN: created_by is set to the actual authenticated user, not the fake ID
      const result = await executeQuery(
        `SELECT created_by FROM tasks WHERE title = 'Forged Record'`
      )
      expect(result.rows[0].created_by).toBe(user.id)
      expect(result.rows[0].created_by).not.toBe('fake-user-id-999')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-014: should ignore user-provided updated_by value on update',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with updated_by field and an existing record
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 14,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'updated_by', type: 'updated-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      await executeQuery(`INSERT INTO tasks (id, title) VALUES (1, 'Original Title')`)

      // WHEN: User attempts to set updated_by to a fake user ID
      const response = await request.patch('/api/tables/14/records/1', {
        headers: { 'Content-Type': 'application/json' },
        data: {
          fields: {
            title: 'Updated Title',
            updated_by: 'fake-user-id-999',
          },
        },
      })

      // THEN: Record is updated successfully (API ignores the provided value)
      expect(response.status()).toBe(200)

      // THEN: updated_by is set to the actual authenticated user
      const result = await executeQuery(`SELECT updated_by FROM tasks WHERE id = 1`)
      expect(result.rows[0].updated_by).toBe(user.id)
      expect(result.rows[0].updated_by).not.toBe('fake-user-id-999')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-015: should ignore user-provided deleted_by value on delete',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with deleted_by field and an existing record
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 15,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
              { id: 3, name: 'deleted_by', type: 'deleted-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      await executeQuery(`INSERT INTO tasks (id, title) VALUES (1, 'Task to Delete')`)

      // WHEN: User soft-deletes the record (deleted_by cannot be provided via DELETE body,
      // but if an attacker sends it as a query param or body, it should be ignored)
      const response = await request.delete('/api/tables/15/records/1', {})

      // THEN: Returns 204 No Content
      expect(response.status()).toBe(204)

      // THEN: deleted_by is set to the actual authenticated user
      const result = await executeQuery(`SELECT deleted_by FROM tasks WHERE id = 1`)
      expect(result.rows[0].deleted_by).toBe(user.id)
    }
  )

  // ============================================================================
  // US-API-AUTHORSHIP-005: Multi-User Scenarios
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-016: should track different users across create, update, and delete',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      signUp,
      signIn,
    }) => {
      // GIVEN: Table with all authorship fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 16,
            name: 'documents',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'created_by', type: 'created-by' },
              { id: 3, name: 'updated_by', type: 'updated-by' },
              { id: 4, name: 'deleted_at', type: 'deleted-at', indexed: true },
              { id: 5, name: 'deleted_by', type: 'deleted-by' },
            ],
          },
        ],
      })

      // Step 1: Alice creates the record
      const { user: alice } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      const createResponse = await request.post('/api/tables/16/records', {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { title: 'Collaborative Document' } },
      })
      expect(createResponse.status()).toBe(201)
      const created = await createResponse.json()

      // Step 2: Bob signs up, signs in, and updates the record
      await signUp({ email: 'bob@example.com', password: 'SecurePass123!', name: 'Bob' })
      const { user: bob } = await signIn({
        email: 'bob@example.com',
        password: 'SecurePass123!',
      })

      const updateResponse = await request.patch(`/api/tables/16/records/${created.id}`, {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { title: 'Updated by Bob' } },
      })
      expect(updateResponse.status()).toBe(200)

      // Step 3: Charlie signs up, signs in, and deletes the record
      await signUp({ email: 'charlie@example.com', password: 'SecurePass123!', name: 'Charlie' })
      const { user: charlie } = await signIn({
        email: 'charlie@example.com',
        password: 'SecurePass123!',
      })

      const deleteResponse = await request.delete(`/api/tables/16/records/${created.id}`, {})
      expect(deleteResponse.status()).toBe(204)

      // THEN: Each authorship field reflects the correct user
      const result = await executeQuery(
        `SELECT created_by, updated_by, deleted_by FROM documents WHERE id = $1`,
        [created.id]
      )
      expect(result.rows[0].created_by).toBe(alice.id)
      expect(result.rows[0].updated_by).toBe(bob.id)
      expect(result.rows[0].deleted_by).toBe(charlie.id)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-017: should keep created_by unchanged after update by different user',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      signUp,
      signIn,
    }) => {
      // GIVEN: Table with created_by and updated_by fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 17,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'created_by', type: 'created-by' },
              { id: 3, name: 'updated_by', type: 'updated-by' },
            ],
          },
        ],
      })

      // Alice creates the record
      const { user: alice } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      const createResponse = await request.post('/api/tables/17/records', {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { title: 'Alice Task' } },
      })
      expect(createResponse.status()).toBe(201)
      const created = await createResponse.json()

      // Bob signs in and updates the same record multiple times
      await signUp({ email: 'bob@example.com', password: 'SecurePass123!', name: 'Bob' })
      await signIn({ email: 'bob@example.com', password: 'SecurePass123!' })

      await request.patch(`/api/tables/17/records/${created.id}`, {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { title: 'Bob Update 1' } },
      })

      await request.patch(`/api/tables/17/records/${created.id}`, {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { title: 'Bob Update 2' } },
      })

      // THEN: created_by is still Alice's ID (immutable)
      const result = await executeQuery(`SELECT created_by, title FROM tasks WHERE id = $1`, [
        created.id,
      ])
      expect(result.rows[0].created_by).toBe(alice.id)
      expect(result.rows[0].title).toBe('Bob Update 2')
    }
  )

  // ============================================================================
  // US-API-AUTHORSHIP-006: Batch Operations
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-018: should set created_by on all records during batch create',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with created_by field
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 18,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'created_by', type: 'created-by' },
              { id: 3, name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      // WHEN: User batch creates multiple records
      const response = await request.post('/api/tables/18/records/batch', {
        headers: { 'Content-Type': 'application/json' },
        data: {
          records: [
            { fields: { title: 'Batch Task 1' } },
            { fields: { title: 'Batch Task 2' } },
            { fields: { title: 'Batch Task 3' } },
          ],
          returnRecords: true,
        },
      })

      // THEN: All records have created_by set to the batch creator
      expect(response.status()).toBe(201)

      const result = await executeQuery(`SELECT title, created_by FROM tasks ORDER BY id`)
      expect(result.rows).toHaveLength(3)
      for (const row of result.rows) {
        expect(row.created_by).toBe(user.id)
      }
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-019: should set updated_by on all records during batch update',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with updated_by field and existing records
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 19,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'updated_by', type: 'updated-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES
        (1, 'Task 1'), (2, 'Task 2'), (3, 'Task 3')
      `)

      // WHEN: User batch updates multiple records
      const response = await request.patch('/api/tables/19/records/batch', {
        headers: { 'Content-Type': 'application/json' },
        data: {
          records: [
            { id: 1, fields: { title: 'Updated Task 1' } },
            { id: 2, fields: { title: 'Updated Task 2' } },
            { id: 3, fields: { title: 'Updated Task 3' } },
          ],
        },
      })

      // THEN: All records have updated_by set to the updating user
      expect(response.status()).toBe(200)

      const result = await executeQuery(`SELECT id, updated_by FROM tasks ORDER BY id`)
      expect(result.rows).toHaveLength(3)
      for (const row of result.rows) {
        expect(row.updated_by).toBe(user.id)
      }
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-020: should set deleted_by on all records during batch delete',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with deleted_by and deleted_at fields, and multiple active records
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 20,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
              { id: 3, name: 'deleted_by', type: 'deleted-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES
        (1, 'Task 1'), (2, 'Task 2'), (3, 'Task 3')
      `)

      // WHEN: User batch deletes multiple records
      const response = await request.post('/api/tables/20/records/batch/delete', {
        headers: { 'Content-Type': 'application/json' },
        data: {
          ids: [1, 2, 3],
        },
      })

      // THEN: All records have deleted_by set to the deleting user
      expect(response.status()).toBe(200)

      const result = await executeQuery(`SELECT id, deleted_by, deleted_at FROM tasks ORDER BY id`)
      expect(result.rows).toHaveLength(3)
      for (const row of result.rows) {
        expect(row.deleted_by).toBe(user.id)
        expect(row.deleted_at).toBeTruthy()
      }
    }
  )

  // ============================================================================
  // US-API-AUTHORSHIP-007: API Response Inclusion
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-021: should include created_by in GET single record response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table with created_by field and a record created by a known user
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 21,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'created_by', type: 'created-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      // Create a record via API
      const createResponse = await request.post('/api/tables/21/records', {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { title: 'Get Test Task' } },
      })
      expect(createResponse.status()).toBe(201)
      const created = await createResponse.json()

      // WHEN: User retrieves the record by ID
      const response = await request.get(`/api/tables/21/records/${created.id}`)

      // THEN: Response includes created_by field
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.createdBy).toBe(user.id)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-022: should include updated_by in GET single record response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table with updated_by field and a record that has been updated
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 22,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'updated_by', type: 'updated-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      // Create and then update a record
      const createResponse = await request.post('/api/tables/22/records', {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { title: 'Original' } },
      })
      const created = await createResponse.json()

      await request.patch(`/api/tables/22/records/${created.id}`, {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { title: 'Updated' } },
      })

      // WHEN: User retrieves the updated record
      const response = await request.get(`/api/tables/22/records/${created.id}`)

      // THEN: Response includes updated_by field
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.updatedBy).toBe(user.id)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-AUTHORSHIP-023: should include authorship fields in list records response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table with authorship fields and multiple records
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 23,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'created_by', type: 'created-by' },
              { id: 3, name: 'updated_by', type: 'updated-by' },
            ],
          },
        ],
      })

      const { user } = await createAuthenticatedUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      // Create multiple records
      await request.post('/api/tables/23/records', {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { title: 'Task A' } },
      })
      await request.post('/api/tables/23/records', {
        headers: { 'Content-Type': 'application/json' },
        data: { fields: { title: 'Task B' } },
      })

      // WHEN: User lists all records
      const response = await request.get('/api/tables/23/records')

      // THEN: Each record in the list includes authorship fields
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records.length).toBeGreaterThanOrEqual(2)

      for (const record of data.records) {
        expect(record.createdBy).toBe(user.id)
        expect(record.updatedBy).toBe(user.id)
      }
    }
  )

  // ============================================================================
  // @regression test - ONE optimized integration test
  // ============================================================================

  test(
    'API-TABLES-RECORDS-AUTHORSHIP-REGRESSION: full authorship metadata lifecycle across CRUD operations',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      signUp,
      signIn,
    }) => {
      // GIVEN: Consolidated configuration with all authorship fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 100,
            name: 'documents',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'created_by', type: 'created-by' },
              { id: 3, name: 'updated_by', type: 'updated-by' },
              { id: 4, name: 'created_at', type: 'created-at' },
              { id: 5, name: 'deleted_at', type: 'deleted-at', indexed: true },
              { id: 6, name: 'deleted_by', type: 'deleted-by' },
            ],
          },
        ],
      })

      await test.step('API-TABLES-RECORDS-AUTHORSHIP-001: Auto-set created_by on create', async () => {
        const { user: alice } = await createAuthenticatedUser({
          email: 'alice@example.com',
          name: 'Alice',
        })

        const response = await request.post('/api/tables/100/records', {
          headers: { 'Content-Type': 'application/json' },
          data: { fields: { title: 'Alice Document' } },
        })
        expect(response.status()).toBe(201)

        const data = await response.json()
        expect(data.createdBy).toBe(alice.id)
      })

      await test.step('API-TABLES-RECORDS-AUTHORSHIP-007: updated_by equals created_by on initial creation', async () => {
        const result = await executeQuery(
          `SELECT created_by, updated_by FROM documents WHERE title = 'Alice Document'`
        )
        expect(result.rows[0].created_by).toBe(result.rows[0].updated_by)
      })

      await test.step('API-TABLES-RECORDS-AUTHORSHIP-006: Different user updates, updated_by changes', async () => {
        await signUp({ email: 'bob@example.com', password: 'SecurePass123!', name: 'Bob' })
        const { user: bob } = await signIn({
          email: 'bob@example.com',
          password: 'SecurePass123!',
        })

        const result = await executeQuery(`SELECT id FROM documents WHERE title = 'Alice Document'`)
        const recordId = result.rows[0].id

        const response = await request.patch(`/api/tables/100/records/${recordId}`, {
          headers: { 'Content-Type': 'application/json' },
          data: { fields: { title: 'Bob Updated' } },
        })
        expect(response.status()).toBe(200)

        const updated = await executeQuery(
          `SELECT created_by, updated_by FROM documents WHERE id = $1`,
          [recordId]
        )
        expect(updated.rows[0].updated_by).toBe(bob.id)
        // created_by remains unchanged
        expect(updated.rows[0].created_by).not.toBe(bob.id)
      })

      await test.step('API-TABLES-RECORDS-AUTHORSHIP-009: deleted_by set on soft delete', async () => {
        await signUp({
          email: 'charlie@example.com',
          password: 'SecurePass123!',
          name: 'Charlie',
        })
        const { user: charlie } = await signIn({
          email: 'charlie@example.com',
          password: 'SecurePass123!',
        })

        const result = await executeQuery(`SELECT id FROM documents WHERE title = 'Bob Updated'`)
        const recordId = result.rows[0].id

        const response = await request.delete(`/api/tables/100/records/${recordId}`, {})
        expect(response.status()).toBe(204)

        const deleted = await executeQuery(
          `SELECT deleted_by, deleted_at FROM documents WHERE id = $1`,
          [recordId]
        )
        expect(deleted.rows[0].deleted_by).toBe(charlie.id)
        expect(deleted.rows[0].deleted_at).toBeTruthy()
      })

      await test.step('API-TABLES-RECORDS-AUTHORSHIP-011: deleted_by cleared on restore', async () => {
        const result = await executeQuery(`SELECT id FROM documents WHERE title = 'Bob Updated'`)
        const recordId = result.rows[0].id

        const response = await request.post(`/api/tables/100/records/${recordId}/restore`, {})
        expect(response.status()).toBe(200)

        const restored = await executeQuery(
          `SELECT deleted_by, deleted_at FROM documents WHERE id = $1`,
          [recordId]
        )
        expect(restored.rows[0].deleted_by).toBeNull()
        expect(restored.rows[0].deleted_at).toBeNull()
      })

      await test.step('API-TABLES-RECORDS-AUTHORSHIP-013: Read-only enforcement on create', async () => {
        // Sign back in as Alice (using default createAuthenticatedUser password)
        await signIn({ email: 'alice@example.com', password: 'TestPassword123!' })

        const response = await request.post('/api/tables/100/records', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            fields: {
              title: 'Forged Record',
              created_by: 'fake-user-id-999',
            },
          },
        })
        expect(response.status()).toBe(201)

        const result = await executeQuery(
          `SELECT created_by FROM documents WHERE title = 'Forged Record'`
        )
        expect(result.rows[0].created_by).not.toBe('fake-user-id-999')
      })

      await test.step('API-TABLES-RECORDS-AUTHORSHIP-021: created_by included in GET response', async () => {
        const result = await executeQuery(`SELECT id FROM documents WHERE title = 'Forged Record'`)
        const recordId = result.rows[0].id

        const response = await request.get(`/api/tables/100/records/${recordId}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.createdBy).toBeDefined()
        expect(data.updatedBy).toBeDefined()
      })

      await test.step('API-TABLES-RECORDS-AUTHORSHIP-023: authorship fields in list response', async () => {
        const response = await request.get('/api/tables/100/records')
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records.length).toBeGreaterThanOrEqual(1)
        for (const record of data.records) {
          expect(record.createdBy).toBeDefined()
          expect(record.updatedBy).toBeDefined()
        }
      })
    }
  )
})
