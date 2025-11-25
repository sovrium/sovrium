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
    'APP-UPDATED-BY-FIELD-001: should create PostgreSQL INTEGER NOT NULL column with FOREIGN KEY and trigger',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob')",
        'CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(255), updated_by INTEGER NOT NULL REFERENCES users(id))',
        'CREATE OR REPLACE FUNCTION update_updated_by_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_by = NEW.updated_by; RETURN NEW; END; $$ LANGUAGE plpgsql',
        'CREATE TRIGGER set_updated_by BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_by_column()',
      ])

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='updated_by'"
      )
      expect(columnInfo.column_name).toBe('updated_by')
      expect(columnInfo.data_type).toBe('integer')
      expect(columnInfo.is_nullable).toBe('NO')

      const fkCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='products' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%updated_by%'"
      )
      expect(fkCount.count).toBe(1)

      const triggerCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.triggers WHERE event_object_table='products' AND trigger_name='set_updated_by'"
      )
      expect(triggerCount.count).toBe(1)
    }
  )

  test.fixme(
    'APP-UPDATED-BY-FIELD-002: should reflect the most recent editor user ID',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie')",
      ])

      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_documents',
            name: 'documents',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'title', type: 'text' },
              { name: 'updated_by', type: 'updated-by' },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO documents (title, updated_by) VALUES ('Initial Doc', 1)")

      const initial = await executeQuery('SELECT updated_by FROM documents WHERE id = 1')
      expect(initial.updated_by).toBe(1)

      const bobUpdate = await executeQuery(
        "UPDATE documents SET title = 'Updated by Bob', updated_by = 2 WHERE id = 1 RETURNING updated_by"
      )
      expect(bobUpdate.updated_by).toBe(2)

      const charlieUpdate = await executeQuery(
        "UPDATE documents SET title = 'Updated by Charlie', updated_by = 3 WHERE id = 1 RETURNING updated_by"
      )
      expect(charlieUpdate.updated_by).toBe(3)

      const lastEditor = await executeQuery(
        'SELECT d.title, u.name as last_editor FROM documents d JOIN users u ON d.updated_by = u.id WHERE d.id = 1'
      )
      expect(lastEditor.title).toBe('Updated by Charlie')
      expect(lastEditor.last_editor).toBe('Charlie')
    }
  )

  test.fixme(
    'APP-UPDATED-BY-FIELD-003: should support efficient filtering by last editor',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob')",
      ])

      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_tasks',
            name: 'tasks',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'title', type: 'text' },
              { name: 'status', type: 'text' },
              { name: 'updated_by', type: 'updated-by' },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO tasks (title, status, updated_by) VALUES ('Task 1', 'open', 1), ('Task 2', 'open', 2), ('Task 3', 'open', 1)",
        "UPDATE tasks SET status = 'closed', updated_by = 2 WHERE id = 1",
        "UPDATE tasks SET status = 'closed', updated_by = 2 WHERE id = 3",
      ])

      const bobEdits = await executeQuery(
        'SELECT COUNT(*) as count FROM tasks WHERE updated_by = 2'
      )
      expect(bobEdits.count).toBe(3)

      const aliceEdits = await executeQuery(
        'SELECT COUNT(*) as count FROM tasks WHERE updated_by = 1'
      )
      expect(aliceEdits.count).toBe(0)

      const closedByBob = await executeQuery(
        "SELECT t.title, t.status, u.name as last_editor FROM tasks t JOIN users u ON t.updated_by = u.id WHERE t.status = 'closed' ORDER BY t.id"
      )
      expect(closedByBob).toEqual([
        { title: 'Task 1', status: 'closed', last_editor: 'Bob' },
        { title: 'Task 3', status: 'closed', last_editor: 'Bob' },
      ])
    }
  )

  test.fixme(
    'APP-UPDATED-BY-FIELD-004: should support dual audit trail with created_by',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob')",
      ])

      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_pages',
            name: 'pages',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'title', type: 'text' },
              { name: 'created_by', type: 'created-by' },
              { name: 'updated_by', type: 'updated-by' },
            ],
          },
        ],
      })

      await executeQuery(
        "INSERT INTO pages (title, created_by, updated_by) VALUES ('Page 1', 1, 1)"
      )
      await executeQuery("UPDATE pages SET title = 'Page 1 Edited', updated_by = 2 WHERE id = 1")

      const auditTrail = await executeQuery(
        'SELECT p.title, uc.name as creator, ue.name as editor FROM pages p JOIN users uc ON p.created_by = uc.id JOIN users ue ON p.updated_by = ue.id WHERE p.id = 1'
      )
      expect(auditTrail.title).toBe('Page 1 Edited')
      expect(auditTrail.creator).toBe('Alice')
      expect(auditTrail.editor).toBe('Bob')

      const createdBy = await executeQuery('SELECT created_by FROM pages WHERE id = 1')
      expect(createdBy.created_by).toBe(1)

      const updatedBy = await executeQuery('SELECT updated_by FROM pages WHERE id = 1')
      expect(updatedBy.updated_by).toBe(2)
    }
  )

  test.fixme(
    'APP-UPDATED-BY-FIELD-005: should create btree index for fast editor filtering when indexed=true',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        'CREATE TABLE articles (id SERIAL PRIMARY KEY, content TEXT, updated_by INTEGER NOT NULL REFERENCES users(id))',
        'CREATE INDEX idx_articles_updated_by ON articles(updated_by)',
      ])

      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_articles_updated_by'"
      )
      expect(indexInfo.indexname).toBe('idx_articles_updated_by')
      expect(indexInfo.tablename).toBe('articles')

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_articles_updated_by'"
      )
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_articles_updated_by ON public.articles USING btree (updated_by)'
      )
    }
  )

  test.fixme(
    'user can complete full updated-by-field workflow',
    { tag: '@regression' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob')",
      ])

      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'value', type: 'text' },
              { name: 'updated_by', type: 'updated-by', indexed: true },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO data (value, updated_by) VALUES ('v1', 1)")
      await executeQuery("UPDATE data SET value = 'v2', updated_by = 2 WHERE id = 1")

      const final = await executeQuery('SELECT updated_by FROM data WHERE id = 1')
      expect(final.updated_by).toBe(2)

      const editor = await executeQuery(
        'SELECT d.value, u.name FROM data d JOIN users u ON d.updated_by = u.id WHERE d.id = 1'
      )
      expect(editor.name).toBe('Bob')
    }
  )
})
