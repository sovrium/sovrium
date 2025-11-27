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
 * Source: specs/app/tables/field-types/updated-by-field/updated-by-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Updated By Field', () => {
  test.fixme(
    'APP-TABLES-FIELD-TYPES-UPDATED-BY-001: should create PostgreSQL INTEGER NOT NULL column with FOREIGN KEY and trigger',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Create external users table
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob')",
      ])

      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
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
      // THEN: assertion
      expect(columnInfo.column_name).toBe('updated_by')
      // THEN: assertion
      expect(columnInfo.data_type).toBe('integer')
      // THEN: assertion
      expect(columnInfo.is_nullable).toBe('NO')

      const fkCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='products' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%updated_by%'"
      )
      // THEN: assertion
      expect(fkCount.count).toBe(1)

      const triggerCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.triggers WHERE event_object_table='products' AND trigger_name='set_updated_by'"
      )
      // THEN: assertion
      expect(triggerCount.count).toBe(1)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-UPDATED-BY-002: should reflect the most recent editor user ID',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie')",
      ])

      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: executing query
      await executeQuery("INSERT INTO documents (title, updated_by) VALUES ('Initial Doc', 1)")

      // WHEN: querying the database
      const initial = await executeQuery('SELECT updated_by FROM documents WHERE id = 1')
      // THEN: assertion
      expect(initial.updated_by).toBe(1)

      const bobUpdate = await executeQuery(
        "UPDATE documents SET title = 'Updated by Bob', updated_by = 2 WHERE id = 1 RETURNING updated_by"
      )
      // THEN: assertion
      expect(bobUpdate.updated_by).toBe(2)

      const charlieUpdate = await executeQuery(
        "UPDATE documents SET title = 'Updated by Charlie', updated_by = 3 WHERE id = 1 RETURNING updated_by"
      )
      // THEN: assertion
      expect(charlieUpdate.updated_by).toBe(3)

      const lastEditor = await executeQuery(
        'SELECT d.title, u.name as last_editor FROM documents d JOIN users u ON d.updated_by = u.id WHERE d.id = 1'
      )
      // THEN: assertion
      expect(lastEditor.title).toBe('Updated by Charlie')
      // THEN: assertion
      expect(lastEditor.last_editor).toBe('Charlie')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-UPDATED-BY-003: should support efficient filtering by last editor',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob')",
      ])

      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: querying the database
      await executeQuery([
        "INSERT INTO tasks (title, status, updated_by) VALUES ('Task 1', 'open', 1), ('Task 2', 'open', 2), ('Task 3', 'open', 1)",
        "UPDATE tasks SET status = 'closed', updated_by = 2 WHERE id = 1",
        "UPDATE tasks SET status = 'closed', updated_by = 2 WHERE id = 3",
      ])

      const bobEdits = await executeQuery(
        'SELECT COUNT(*) as count FROM tasks WHERE updated_by = 2'
      )
      // THEN: assertion
      expect(bobEdits.count).toBe(3)

      const aliceEdits = await executeQuery(
        'SELECT COUNT(*) as count FROM tasks WHERE updated_by = 1'
      )
      // THEN: assertion
      expect(aliceEdits.count).toBe(0)

      const closedByBob = await executeQuery(
        "SELECT t.title, t.status, u.name as last_editor FROM tasks t JOIN users u ON t.updated_by = u.id WHERE t.status = 'closed' ORDER BY t.id"
      )
      // THEN: assertion
      expect(closedByBob).toEqual([
        { title: 'Task 1', status: 'closed', last_editor: 'Bob' },
        { title: 'Task 3', status: 'closed', last_editor: 'Bob' },
      ])
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-UPDATED-BY-004: should support dual audit trail with created_by',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob')",
      ])

      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: querying the database
      await executeQuery(
        "INSERT INTO pages (title, created_by, updated_by) VALUES ('Page 1', 1, 1)"
      )
      await executeQuery("UPDATE pages SET title = 'Page 1 Edited', updated_by = 2 WHERE id = 1")

      const auditTrail = await executeQuery(
        'SELECT p.title, uc.name as creator, ue.name as editor FROM pages p JOIN users uc ON p.created_by = uc.id JOIN users ue ON p.updated_by = ue.id WHERE p.id = 1'
      )
      // THEN: assertion
      expect(auditTrail.title).toBe('Page 1 Edited')
      // THEN: assertion
      expect(auditTrail.creator).toBe('Alice')
      // THEN: assertion
      expect(auditTrail.editor).toBe('Bob')

      const createdBy = await executeQuery('SELECT created_by FROM pages WHERE id = 1')
      // THEN: assertion
      expect(createdBy.created_by).toBe(1)

      const updatedBy = await executeQuery('SELECT updated_by FROM pages WHERE id = 1')
      // THEN: assertion
      expect(updatedBy.updated_by).toBe(2)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-UPDATED-BY-005: should create btree index for fast editor filtering when indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Create external users table
      await executeQuery('CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))')

      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: querying the database
      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_articles_updated_by'"
      )
      // THEN: assertion
      expect(indexInfo.indexname).toBe('idx_articles_updated_by')
      // THEN: assertion
      expect(indexInfo.tablename).toBe('articles')

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_articles_updated_by'"
      )
      // THEN: assertion
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_articles_updated_by ON public.articles USING btree (updated_by)'
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-UPDATED-BY-006: user can complete full updated-by-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob')",
      ])

      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: executing query
      await executeQuery("INSERT INTO data (value, updated_by) VALUES ('v1', 1)")
      // WHEN: querying the database
      await executeQuery("UPDATE data SET value = 'v2', updated_by = 2 WHERE id = 1")

      // WHEN: querying the database
      const final = await executeQuery('SELECT updated_by FROM data WHERE id = 1')
      // THEN: assertion
      expect(final.updated_by).toBe(2)

      const editor = await executeQuery(
        'SELECT d.value, u.name FROM data d JOIN users u ON d.updated_by = u.id WHERE d.id = 1'
      )
      // THEN: assertion
      expect(editor.name).toBe('Bob')
    }
  )
})
