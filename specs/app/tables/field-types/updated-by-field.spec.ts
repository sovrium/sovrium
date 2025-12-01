/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Updated By Field
 *
 * Source: src/domain/models/app/table/field-types/updated-by-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * NOTE: Updated-by fields reference Better Auth's users table which has TEXT ids (UUIDs).
 * Tests use createAuthenticatedUser fixture to create users with proper Better Auth structure.
 */

test.describe('Updated By Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-UPDATED-BY-001: should create PostgreSQL TEXT NOT NULL column with FOREIGN KEY and trigger',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: { authentication: ['email-and-password'] },
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'updated_by', type: 'updated-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='updated_by'"
      )
      // THEN: column should be TEXT (compatible with Better Auth TEXT id)
      expect(columnInfo.column_name).toBe('updated_by')
      expect(columnInfo.data_type).toBe('text')
      // THEN: should be NOT NULL
      expect(columnInfo.is_nullable).toBe('NO')

      // TODO: Re-enable FK checks once transaction visibility issue is resolved
      // See: https://github.com/sovrium/sovrium/issues/3980
      // Foreign key constraints temporarily disabled
      // const fkCount = await executeQuery(
      //   "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='products' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%updated_by%'"
      // )
      // expect(fkCount.count).toBe(1)

      const triggerCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.triggers WHERE event_object_table='products' AND trigger_name='set_updated_by'"
      )
      // THEN: trigger should exist
      expect(Number(triggerCount.count)).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-UPDATED-BY-002: should reflect the most recent editor user ID',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: { authentication: ['email-and-password'] },
        tables: [
          {
            id: 2,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'updated_by', type: 'updated-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: users created via Better Auth (TEXT id)
      const alice = await createAuthenticatedUser({ name: 'Alice', email: 'alice@example.com' })
      const bob = await createAuthenticatedUser({ name: 'Bob', email: 'bob@example.com' })
      const charlie = await createAuthenticatedUser({
        name: 'Charlie',
        email: 'charlie@example.com',
      })

      // WHEN: inserting initial document
      await executeQuery(
        `INSERT INTO documents (title, updated_by) VALUES ('Initial Doc', '${alice.user.id}')`
      )

      // WHEN: querying the database
      const initial = await executeQuery('SELECT updated_by FROM documents WHERE id = 1')
      // THEN: should have initial updater
      expect(initial.updated_by).toBe(alice.user.id)

      // WHEN: Bob updates the document
      const bobUpdate = await executeQuery(
        `UPDATE documents SET title = 'Updated by Bob', updated_by = '${bob.user.id}' WHERE id = 1 RETURNING updated_by`
      )
      // THEN: should reflect Bob as updater
      expect(bobUpdate.updated_by).toBe(bob.user.id)

      // WHEN: Charlie updates the document
      const charlieUpdate = await executeQuery(
        `UPDATE documents SET title = 'Updated by Charlie', updated_by = '${charlie.user.id}' WHERE id = 1 RETURNING updated_by`
      )
      // THEN: should reflect Charlie as updater
      expect(charlieUpdate.updated_by).toBe(charlie.user.id)

      // WHEN: querying with JOIN
      const lastEditor = await executeQuery(
        'SELECT d.title, u.name as last_editor FROM documents d JOIN users u ON d.updated_by = u.id WHERE d.id = 1'
      )
      // THEN: should return latest editor info
      expect(lastEditor.title).toBe('Updated by Charlie')
      expect(lastEditor.last_editor).toBe('Charlie')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-UPDATED-BY-003: should support efficient filtering by last editor',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: { authentication: ['email-and-password'] },
        tables: [
          {
            id: 3,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
              { id: 4, name: 'updated_by', type: 'updated-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: users created via Better Auth
      const alice = await createAuthenticatedUser({ name: 'Alice', email: 'alice@example.com' })
      const bob = await createAuthenticatedUser({ name: 'Bob', email: 'bob@example.com' })

      // WHEN: creating tasks and updating them
      await executeQuery([
        `INSERT INTO tasks (title, status, updated_by) VALUES ('Task 1', 'open', '${alice.user.id}'), ('Task 2', 'open', '${bob.user.id}'), ('Task 3', 'open', '${alice.user.id}')`,
        `UPDATE tasks SET status = 'closed', updated_by = '${bob.user.id}' WHERE id = 1`,
        `UPDATE tasks SET status = 'closed', updated_by = '${bob.user.id}' WHERE id = 3`,
      ])

      // WHEN: counting Bob's edits
      const bobEdits = await executeQuery(
        `SELECT COUNT(*) as count FROM tasks WHERE updated_by = '${bob.user.id}'`
      )
      // THEN: Bob should have edited 3 tasks
      expect(Number(bobEdits.count)).toBe(3)

      // WHEN: counting Alice's edits (she created but Bob updated)
      const aliceEdits = await executeQuery(
        `SELECT COUNT(*) as count FROM tasks WHERE updated_by = '${alice.user.id}'`
      )
      // THEN: Alice should have 0 edits (Bob updated all)
      expect(Number(aliceEdits.count)).toBe(0)

      // WHEN: querying closed tasks with JOIN
      const closedByBob = await executeQuery(
        "SELECT t.title, t.status, u.name as last_editor FROM tasks t JOIN users u ON t.updated_by = u.id WHERE t.status = 'closed' ORDER BY t.id"
      )
      // THEN: should return closed tasks with Bob as editor
      expect(closedByBob.rows).toEqual([
        { title: 'Task 1', status: 'closed', last_editor: 'Bob' },
        { title: 'Task 3', status: 'closed', last_editor: 'Bob' },
      ])
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-UPDATED-BY-004: should support dual audit trail with created_by',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: table configuration with both created_by and updated_by
      await startServerWithSchema({
        name: 'test-app',
        auth: { authentication: ['email-and-password'] },
        tables: [
          {
            id: 4,
            name: 'pages',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'created_by', type: 'created-by' },
              { id: 4, name: 'updated_by', type: 'updated-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: users created via Better Auth
      const alice = await createAuthenticatedUser({ name: 'Alice', email: 'alice@example.com' })
      const bob = await createAuthenticatedUser({ name: 'Bob', email: 'bob@example.com' })

      // WHEN: Alice creates a page
      await executeQuery(
        `INSERT INTO pages (title, created_by, updated_by) VALUES ('Page 1', '${alice.user.id}', '${alice.user.id}')`
      )

      // WHEN: Bob updates the page
      await executeQuery(
        `UPDATE pages SET title = 'Page 1 Edited', updated_by = '${bob.user.id}' WHERE id = 1`
      )

      // WHEN: querying the audit trail
      const auditTrail = await executeQuery(
        'SELECT p.title, uc.name as creator, ue.name as editor FROM pages p JOIN users uc ON p.created_by = uc.id JOIN users ue ON p.updated_by = ue.id WHERE p.id = 1'
      )
      // THEN: should show creator and editor
      expect(auditTrail.title).toBe('Page 1 Edited')
      expect(auditTrail.creator).toBe('Alice')
      expect(auditTrail.editor).toBe('Bob')

      // WHEN: checking created_by (should remain unchanged)
      const createdBy = await executeQuery('SELECT created_by FROM pages WHERE id = 1')
      // THEN: should still be Alice
      expect(createdBy.created_by).toBe(alice.user.id)

      // WHEN: checking updated_by
      const updatedBy = await executeQuery('SELECT updated_by FROM pages WHERE id = 1')
      // THEN: should be Bob
      expect(updatedBy.updated_by).toBe(bob.user.id)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-UPDATED-BY-005: should create btree index for fast editor filtering when indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with indexed updated_by field
      await startServerWithSchema({
        name: 'test-app',
        auth: { authentication: ['email-and-password'] },
        tables: [
          {
            id: 5,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'updated_by', type: 'updated-by', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying index information
      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_articles_updated_by'"
      )
      // THEN: index should exist
      expect(indexInfo.indexname).toBe('idx_articles_updated_by')
      expect(indexInfo.tablename).toBe('articles')

      // WHEN: querying index definition
      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_articles_updated_by'"
      )
      // THEN: should be btree index
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_articles_updated_by ON public.articles USING btree (updated_by)'
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-UPDATED-BY-006: user can complete full updated-by-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: { authentication: ['email-and-password'] },
        tables: [
          {
            id: 6,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'value', type: 'single-line-text' },
              { id: 3, name: 'updated_by', type: 'updated-by', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: users created via Better Auth
      const alice = await createAuthenticatedUser({ name: 'Alice', email: 'alice@example.com' })
      const bob = await createAuthenticatedUser({ name: 'Bob', email: 'bob@example.com' })

      // WHEN: inserting data
      await executeQuery(`INSERT INTO data (value, updated_by) VALUES ('v1', '${alice.user.id}')`)

      // WHEN: Bob updates the data
      await executeQuery(`UPDATE data SET value = 'v2', updated_by = '${bob.user.id}' WHERE id = 1`)

      // WHEN: querying the final state
      const final = await executeQuery('SELECT updated_by FROM data WHERE id = 1')
      // THEN: should be Bob
      expect(final.updated_by).toBe(bob.user.id)

      // WHEN: querying with JOIN
      const editor = await executeQuery(
        'SELECT d.value, u.name FROM data d JOIN users u ON d.updated_by = u.id WHERE d.id = 1'
      )
      // THEN: should return Bob's info
      expect(editor.name).toBe('Bob')
    }
  )
})
