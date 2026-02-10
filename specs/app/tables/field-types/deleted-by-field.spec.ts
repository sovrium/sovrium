/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Deleted By Field
 *
 * Source: src/domain/models/app/table/field-types/deleted-by-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * NOTE: Deleted-by fields reference Better Auth's users table which has TEXT ids (UUIDs).
 * Tests use createAuthenticatedUser fixture to create users with proper Better Auth structure.
 * The deleted_by field is populated when a record is soft-deleted (deleted_at is set).
 */

test.describe('Deleted By Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-DELETED-BY-001: should create PostgreSQL TEXT NULL column with FOREIGN KEY to Better Auth users',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with deleted_by field
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 1,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at' },
              { id: 4, name: 'deleted_by', type: 'deleted-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='posts' AND column_name='deleted_by'"
      )

      // THEN: column should be TEXT (compatible with Better Auth TEXT id)
      expect(columnInfo.column_name).toBe('deleted_by')
      expect(columnInfo.data_type).toBe('text')

      // THEN: should be NULLABLE (NULL when record is active or deleted by system)
      expect(columnInfo.is_nullable).toBe('YES')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DELETED-BY-002: should store the deleting user reference when record is soft-deleted',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: table configuration with soft-delete fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 2,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at' },
              { id: 4, name: 'deleted_by', type: 'deleted-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: user who will delete the record
      const alice = await createAuthenticatedUser({ name: 'Alice', email: 'alice@example.com' })

      // GIVEN: an active record (deleted_by is NULL)
      await executeQuery("INSERT INTO documents (title) VALUES ('Important Doc')")

      const beforeDelete = await executeQuery(
        'SELECT deleted_at, deleted_by FROM documents WHERE id = 1'
      )
      expect(beforeDelete.deleted_at).toBeNull()
      expect(beforeDelete.deleted_by).toBeNull()

      // WHEN: record is soft-deleted with user reference
      await executeQuery(
        `UPDATE documents SET deleted_at = NOW(), deleted_by = '${alice.user.id}' WHERE id = 1`
      )

      // THEN: deleted_by should contain the user who deleted
      const afterDelete = await executeQuery(
        'SELECT deleted_at, deleted_by FROM documents WHERE id = 1'
      )
      expect(afterDelete.deleted_at).not.toBeNull()
      expect(afterDelete.deleted_by).toBe(alice.user.id)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DELETED-BY-003: should clear deleted_by when record is restored',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: table configuration with soft-delete fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 3,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at' },
              { id: 4, name: 'deleted_by', type: 'deleted-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: user and soft-deleted record
      const bob = await createAuthenticatedUser({ name: 'Bob', email: 'bob@example.com' })
      await executeQuery("INSERT INTO tasks (title) VALUES ('Deleted Task')")
      await executeQuery(
        `UPDATE tasks SET deleted_at = NOW(), deleted_by = '${bob.user.id}' WHERE id = 1`
      )

      // WHEN: record is restored (deleted_at and deleted_by cleared)
      await executeQuery('UPDATE tasks SET deleted_at = NULL, deleted_by = NULL WHERE id = 1')

      // THEN: both deleted_at and deleted_by should be NULL
      const restored = await executeQuery('SELECT deleted_at, deleted_by FROM tasks WHERE id = 1')
      expect(restored.deleted_at).toBeNull()
      expect(restored.deleted_by).toBeNull()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DELETED-BY-004: should support querying who deleted records via JOIN',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: table configuration with soft-delete fields
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 4,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at' },
              { id: 4, name: 'deleted_by', type: 'deleted-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: multiple users who delete records
      const alice = await createAuthenticatedUser({ name: 'Alice', email: 'alice@example.com' })
      const bob = await createAuthenticatedUser({ name: 'Bob', email: 'bob@example.com' })

      // GIVEN: items deleted by different users
      await executeQuery(`
        INSERT INTO items (name) VALUES ('Item 1'), ('Item 2'), ('Item 3')
      `)
      await executeQuery(
        `UPDATE items SET deleted_at = NOW(), deleted_by = '${alice.user.id}' WHERE id = 1`
      )
      await executeQuery(
        `UPDATE items SET deleted_at = NOW(), deleted_by = '${bob.user.id}' WHERE id = 2`
      )

      // WHEN: querying deleted items with deleter info via JOIN
      const deletedItems = await executeQuery(`
        SELECT i.name, u.name as deleted_by_name
        FROM items i
        JOIN auth.user u ON i.deleted_by = u.id
        WHERE i.deleted_at IS NOT NULL
        ORDER BY i.id
      `)

      // THEN: should return deleter information
      expect(deletedItems.rows).toEqual([
        { name: 'Item 1', deleted_by_name: 'Alice' },
        { name: 'Item 2', deleted_by_name: 'Bob' },
      ])

      // WHEN: counting deletions by user
      const aliceDeletions = await executeQuery(
        `SELECT COUNT(*) as count FROM items WHERE deleted_by = '${alice.user.id}'`
      )
      expect(Number(aliceDeletions.count)).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DELETED-BY-005: should create btree index for fast deletion audit when indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with indexed deleted_by field
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 5,
            name: 'audit_records',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at' },
              { id: 4, name: 'deleted_by', type: 'deleted-by', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying index information
      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_audit_records_deleted_by'"
      )

      // THEN: index should exist
      expect(indexInfo.indexname).toBe('idx_audit_records_deleted_by')
      expect(indexInfo.tablename).toBe('audit_records')

      // WHEN: querying index definition
      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_audit_records_deleted_by'"
      )

      // THEN: should be btree index
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_audit_records_deleted_by ON public.audit_records USING btree (deleted_by)'
      )
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-DELETED-BY-REGRESSION: user can complete full deleted-by-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // Setup: Start server with comprehensive schema covering ALL test scenarios
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 1,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at' },
              { id: 4, name: 'deleted_by', type: 'deleted-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 2,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at' },
              { id: 4, name: 'deleted_by', type: 'deleted-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 3,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at' },
              { id: 4, name: 'deleted_by', type: 'deleted-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 4,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at' },
              { id: 4, name: 'deleted_by', type: 'deleted-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 5,
            name: 'audit_records',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at' },
              { id: 4, name: 'deleted_by', type: 'deleted-by', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await test.step('APP-TABLES-FIELD-TYPES-DELETED-BY-001: Creates PostgreSQL TEXT NULL column with FOREIGN KEY', async () => {
        const columnInfo = await executeQuery(
          "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='posts' AND column_name='deleted_by'"
        )
        expect(columnInfo.column_name).toBe('deleted_by')
        expect(columnInfo.data_type).toBe('text')
        expect(columnInfo.is_nullable).toBe('YES')
      })

      await test.step('APP-TABLES-FIELD-TYPES-DELETED-BY-002: Stores the deleting user reference when soft-deleted', async () => {
        const alice = await createAuthenticatedUser({
          name: 'Alice',
          email: 'alice-step2@example.com',
        })
        await executeQuery("INSERT INTO documents (title) VALUES ('Important Doc')")
        const beforeDelete = await executeQuery(
          'SELECT deleted_at, deleted_by FROM documents WHERE id = 1'
        )
        expect(beforeDelete.deleted_at).toBeNull()
        expect(beforeDelete.deleted_by).toBeNull()
        await executeQuery(
          `UPDATE documents SET deleted_at = NOW(), deleted_by = '${alice.user.id}' WHERE id = 1`
        )
        const afterDelete = await executeQuery(
          'SELECT deleted_at, deleted_by FROM documents WHERE id = 1'
        )
        expect(afterDelete.deleted_at).not.toBeNull()
        expect(afterDelete.deleted_by).toBe(alice.user.id)
      })

      await test.step('APP-TABLES-FIELD-TYPES-DELETED-BY-003: Clears deleted_by when record is restored', async () => {
        const bob = await createAuthenticatedUser({ name: 'Bob', email: 'bob-step3@example.com' })
        await executeQuery("INSERT INTO tasks (title) VALUES ('Deleted Task')")
        await executeQuery(
          `UPDATE tasks SET deleted_at = NOW(), deleted_by = '${bob.user.id}' WHERE id = 1`
        )
        await executeQuery('UPDATE tasks SET deleted_at = NULL, deleted_by = NULL WHERE id = 1')
        const restored = await executeQuery('SELECT deleted_at, deleted_by FROM tasks WHERE id = 1')
        expect(restored.deleted_at).toBeNull()
        expect(restored.deleted_by).toBeNull()
      })

      await test.step('APP-TABLES-FIELD-TYPES-DELETED-BY-004: Supports querying who deleted records via JOIN', async () => {
        const alice = await createAuthenticatedUser({
          name: 'Alice',
          email: 'alice-step4@example.com',
        })
        const bob = await createAuthenticatedUser({ name: 'Bob', email: 'bob-step4@example.com' })
        await executeQuery(`
          INSERT INTO items (name) VALUES ('Item 1'), ('Item 2'), ('Item 3')
        `)
        await executeQuery(
          `UPDATE items SET deleted_at = NOW(), deleted_by = '${alice.user.id}' WHERE id = 1`
        )
        await executeQuery(
          `UPDATE items SET deleted_at = NOW(), deleted_by = '${bob.user.id}' WHERE id = 2`
        )
        const deletedItems = await executeQuery(`
          SELECT i.name, u.name as deleted_by_name
          FROM items i
          JOIN auth.user u ON i.deleted_by = u.id
          WHERE i.deleted_at IS NOT NULL
          ORDER BY i.id
        `)
        expect(deletedItems.rows).toEqual([
          { name: 'Item 1', deleted_by_name: 'Alice' },
          { name: 'Item 2', deleted_by_name: 'Bob' },
        ])
        const aliceDeletions = await executeQuery(
          `SELECT COUNT(*) as count FROM items WHERE deleted_by = '${alice.user.id}'`
        )
        expect(Number(aliceDeletions.count)).toBe(1)
      })

      await test.step('APP-TABLES-FIELD-TYPES-DELETED-BY-005: Creates btree index when indexed=true', async () => {
        const indexInfo = await executeQuery(
          "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_audit_records_deleted_by'"
        )
        expect(indexInfo.indexname).toBe('idx_audit_records_deleted_by')
        expect(indexInfo.tablename).toBe('audit_records')
        const indexDef = await executeQuery(
          "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_audit_records_deleted_by'"
        )
        expect(indexDef.indexdef).toBe(
          'CREATE INDEX idx_audit_records_deleted_by ON public.audit_records USING btree (deleted_by)'
        )
      })
    }
  )
})
