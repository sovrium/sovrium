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
    async ({ startServerWithSchema, executeQuery }) => {
      // Create external users table for foreign key reference
      await executeQuery('CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))')

      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'created_by', type: 'created-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='posts' AND column_name='created_by'"
      )
      // THEN: assertion
      expect(columnInfo.column_name).toBe('created_by')
      // THEN: assertion
      expect(columnInfo.data_type).toBe('integer')
      // THEN: assertion
      expect(columnInfo.is_nullable).toBe('NO')

      const fkCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='posts' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%created_by%'"
      )
      // THEN: assertion
      expect(fkCount.count).toBe(1)

      const referencedTable = await executeQuery(
        "SELECT ccu.table_name as referenced_table FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.table_name='posts' AND tc.constraint_type='FOREIGN KEY' AND tc.constraint_name LIKE '%created_by%'"
      )
      // THEN: assertion
      expect(referencedTable.referenced_table).toBe('users')
    }
  )

  test.fixme(
    'APP-CREATED-BY-FIELD-002: should store the creator user reference permanently',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Create external users table and seed data
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob')",
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
              { id: 3, name: 'created_by', type: 'created-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const firstInsert = await executeQuery(
        "INSERT INTO documents (title, created_by) VALUES ('First Doc', 1) RETURNING created_by"
      )
      // THEN: assertion
      expect(firstInsert.created_by).toBe(1)

      const multipleInserts = await executeQuery(
        "INSERT INTO documents (title, created_by) VALUES ('Second Doc', 1), ('Third Doc', 1) RETURNING (SELECT COUNT(*) FROM documents WHERE created_by = 1) as count"
      )
      // THEN: assertion
      expect(multipleInserts.count).toBe(3)

      const creatorInfo = await executeQuery(
        'SELECT d.title, u.name as creator_name FROM documents d JOIN users u ON d.created_by = u.id WHERE d.id = 1'
      )
      // THEN: assertion
      expect(creatorInfo.title).toBe('First Doc')
      // THEN: assertion
      expect(creatorInfo.creator_name).toBe('Alice')
    }
  )

  test.fixme(
    'APP-CREATED-BY-FIELD-003: should enforce immutability via application (no UPDATE trigger)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Create external users table and seed data
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('John'), ('Jane')",
      ])

      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'issues',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'created_by', type: 'created-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      await executeQuery("INSERT INTO issues (title, created_by) VALUES ('Bug #1', 1)")

      // WHEN: querying the database
      const originalCreator = await executeQuery('SELECT created_by FROM issues WHERE id = 1')
      // THEN: assertion
      expect(originalCreator.created_by).toBe(1)

      const updateResult = await executeQuery(
        'UPDATE issues SET created_by = 2 WHERE id = 1 RETURNING created_by'
      )
      // THEN: assertion
      expect(updateResult.created_by).toBe(2)

      const noTrigger = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.triggers WHERE event_object_table='issues' AND trigger_name LIKE '%created_by%'"
      )
      // THEN: assertion
      expect(noTrigger.count).toBe(0)
    }
  )

  test.fixme(
    'APP-CREATED-BY-FIELD-004: should support efficient filtering by creator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Create external users table and seed data
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie')",
      ])

      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'created_by', type: 'created-by' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      await executeQuery(
        "INSERT INTO tasks (title, created_by) VALUES ('Task 1', 1), ('Task 2', 2), ('Task 3', 1), ('Task 4', 3), ('Task 5', 1)"
      )

      const aliceTasks = await executeQuery(
        'SELECT COUNT(*) as count FROM tasks WHERE created_by = 1'
      )
      // THEN: assertion
      expect(aliceTasks.count).toBe(3)

      const bobTasks = await executeQuery(
        'SELECT COUNT(*) as count FROM tasks WHERE created_by = 2'
      )
      // THEN: assertion
      expect(bobTasks.count).toBe(1)

      const creatorNames = await executeQuery(
        'SELECT t.title, u.name as creator FROM tasks t JOIN users u ON t.created_by = u.id WHERE t.created_by IN (1, 3) ORDER BY t.id'
      )
      // THEN: assertion
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
    async ({ startServerWithSchema, executeQuery }) => {
      // Create external users table
      await executeQuery('CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))')

      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'comments',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'single-line-text' },
              { id: 3, name: 'created_by', type: 'created-by', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_comments_created_by'"
      )
      // THEN: assertion
      expect(indexInfo.indexname).toBe('idx_comments_created_by')
      // THEN: assertion
      expect(indexInfo.tablename).toBe('comments')

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_comments_created_by'"
      )
      // THEN: assertion
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_comments_created_by ON public.comments USING btree (created_by)'
      )
    }
  )

  test.fixme(
    'APP-CREATED-BY-FIELD-006: user can complete full created-by-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Create external users table and seed data
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice', 'alice@example.com')",
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
              { id: 2, name: 'content', type: 'single-line-text' },
              { id: 3, name: 'created_by', type: 'created-by', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      await executeQuery("INSERT INTO data (content, created_by) VALUES ('Test content', 1)")
      // WHEN: querying the database
      const record = await executeQuery('SELECT created_by FROM data WHERE id = 1')
      // THEN: assertion
      expect(record.created_by).toBe(1)

      const creator = await executeQuery(
        'SELECT d.content, u.name FROM data d JOIN users u ON d.created_by = u.id WHERE d.id = 1'
      )
      // THEN: assertion
      expect(creator.name).toBe('Alice')
    }
  )
})
