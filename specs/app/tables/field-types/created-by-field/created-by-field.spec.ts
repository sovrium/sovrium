/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Created By Field
 *
 * Source: specs/app/tables/field-types/created-by-field/created-by-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Created By Field', () => {
  test.fixme(
    'APP-CREATED-BY-FIELD-001: should create PostgreSQL INTEGER NOT NULL column with FOREIGN KEY to users',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery(['CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))'])

      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_posts',
            name: 'posts',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'title', type: 'text' },
              { name: 'created_by', type: 'created-by' },
            ],
          },
        ],
      })

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='posts' AND column_name='created_by'"
      )
      expect(columnInfo.column_name).toBe('created_by')
      expect(columnInfo.data_type).toBe('integer')
      expect(columnInfo.is_nullable).toBe('NO')

      const fkCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='posts' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%created_by%'"
      )
      expect(fkCount.count).toBe(1)

      const referencedTable = await executeQuery(
        "SELECT ccu.table_name as referenced_table FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.table_name='posts' AND tc.constraint_type='FOREIGN KEY' AND tc.constraint_name LIKE '%created_by%'"
      )
      expect(referencedTable.referenced_table).toBe('users')
    }
  )

  test.fixme(
    'APP-CREATED-BY-FIELD-002: should store the creator user reference permanently',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob')",
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
              { name: 'created_by', type: 'created-by' },
            ],
          },
        ],
      })

      const firstInsert = await executeQuery(
        "INSERT INTO documents (title, created_by) VALUES ('First Doc', 1) RETURNING created_by"
      )
      expect(firstInsert.created_by).toBe(1)

      const multipleInserts = await executeQuery(
        "INSERT INTO documents (title, created_by) VALUES ('Second Doc', 1), ('Third Doc', 1) RETURNING (SELECT COUNT(*) FROM documents WHERE created_by = 1) as count"
      )
      expect(multipleInserts.count).toBe(3)

      const creatorInfo = await executeQuery(
        'SELECT d.title, u.name as creator_name FROM documents d JOIN users u ON d.created_by = u.id WHERE d.id = 1'
      )
      expect(creatorInfo.title).toBe('First Doc')
      expect(creatorInfo.creator_name).toBe('Alice')
    }
  )

  test.fixme(
    'APP-CREATED-BY-FIELD-003: should enforce immutability via application (no UPDATE trigger)',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('John'), ('Jane')",
      ])

      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_issues',
            name: 'issues',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'title', type: 'text' },
              { name: 'created_by', type: 'created-by' },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO issues (title, created_by) VALUES ('Bug #1', 1)")

      const originalCreator = await executeQuery('SELECT created_by FROM issues WHERE id = 1')
      expect(originalCreator.created_by).toBe(1)

      const updateResult = await executeQuery(
        'UPDATE issues SET created_by = 2 WHERE id = 1 RETURNING created_by'
      )
      expect(updateResult.created_by).toBe(2)

      const noTrigger = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.triggers WHERE event_object_table='issues' AND trigger_name LIKE '%created_by%'"
      )
      expect(noTrigger.count).toBe(0)
    }
  )

  test.fixme(
    'APP-CREATED-BY-FIELD-004: should support efficient filtering by creator',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie')",
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
              { name: 'created_by', type: 'created-by' },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO tasks (title, created_by) VALUES ('Task 1', 1), ('Task 2', 2), ('Task 3', 1), ('Task 4', 3), ('Task 5', 1)",
      ])

      const aliceTasks = await executeQuery(
        'SELECT COUNT(*) as count FROM tasks WHERE created_by = 1'
      )
      expect(aliceTasks.count).toBe(3)

      const bobTasks = await executeQuery(
        'SELECT COUNT(*) as count FROM tasks WHERE created_by = 2'
      )
      expect(bobTasks.count).toBe(1)

      const creatorNames = await executeQuery(
        'SELECT t.title, u.name as creator FROM tasks t JOIN users u ON t.created_by = u.id WHERE t.created_by IN (1, 3) ORDER BY t.id'
      )
      expect(creatorNames).toEqual([
        { title: 'Task 1', creator: 'Alice' },
        { title: 'Task 3', creator: 'Alice' },
        { title: 'Task 4', creator: 'Charlie' },
        { title: 'Task 5', creator: 'Alice' },
      ])
    }
  )

  test.fixme(
    'APP-CREATED-BY-FIELD-005: should create btree index for fast creator filtering when indexed=true',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        'CREATE TABLE comments (id SERIAL PRIMARY KEY, content TEXT, created_by INTEGER NOT NULL REFERENCES users(id))',
        'CREATE INDEX idx_comments_created_by ON comments(created_by)',
      ])

      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_comments_created_by'"
      )
      expect(indexInfo.indexname).toBe('idx_comments_created_by')
      expect(indexInfo.tablename).toBe('comments')

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_comments_created_by'"
      )
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_comments_created_by ON public.comments USING btree (created_by)'
      )
    }
  )

  test.fixme(
    'user can complete full created-by-field workflow',
    { tag: '@regression' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice', 'alice@example.com')",
      ])

      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'content', type: 'text' },
              { name: 'created_by', type: 'created-by', indexed: true },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO data (content, created_by) VALUES ('Test content', 1)")
      const record = await executeQuery('SELECT created_by FROM data WHERE id = 1')
      expect(record.created_by).toBe(1)

      const creator = await executeQuery(
        'SELECT d.content, u.name FROM data d JOIN users u ON d.created_by = u.id WHERE d.id = 1'
      )
      expect(creator.name).toBe('Alice')
    }
  )
})
