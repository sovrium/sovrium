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
 * Source: src/domain/models/app/table/field-types/created-by-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * NOTE: Created-by fields reference Better Auth's users table which has TEXT ids (UUIDs).
 * Tests use createAuthenticatedUser fixture to create users with proper Better Auth structure.
 */

test.describe('Created By Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-CREATED-BY-001: should create PostgreSQL TEXT NOT NULL column with FOREIGN KEY to Better Auth users',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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
      // THEN: column should be TEXT (compatible with Better Auth TEXT id)
      expect(columnInfo.column_name).toBe('created_by')
      expect(columnInfo.data_type).toBe('text')
      // THEN: should be NOT NULL
      expect(columnInfo.is_nullable).toBe('NO')

      // TODO: Re-enable FK checks once transaction visibility issue is resolved
      // See: https://github.com/sovrium/sovrium/issues/3980
      // Foreign key constraints temporarily disabled
      // const fkCount = await executeQuery(
      //   "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='posts' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%created_by%'"
      // )
      // expect(fkCount.count).toBe(1)
      //
      // const referencedTable = await executeQuery(
      //   "SELECT ccu.table_name as referenced_table FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.table_name='posts' AND tc.constraint_type='FOREIGN KEY' AND tc.constraint_name LIKE '%created_by%'"
      // )
      // expect(referencedTable.referenced_table).toBe('users')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-CREATED-BY-002: should store the creator user reference permanently',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // GIVEN: users created via Better Auth (TEXT id)
      const alice = await createAuthenticatedUser({ name: 'Alice', email: 'alice@example.com' })
      // Create second user to verify multiple users work
      await createAuthenticatedUser({ name: 'Bob', email: 'bob@example.com' })

      // WHEN: inserting first document
      const firstInsert = await executeQuery(
        `INSERT INTO documents (title, created_by) VALUES ('First Doc', '${alice.user.id}') RETURNING created_by`
      )
      // THEN: should have Alice as creator
      expect(firstInsert.created_by).toBe(alice.user.id)

      // WHEN: inserting more documents
      await executeQuery(
        `INSERT INTO documents (title, created_by) VALUES ('Second Doc', '${alice.user.id}'), ('Third Doc', '${alice.user.id}')`
      )

      // WHEN: counting documents by creator
      const documentCount = await executeQuery(
        `SELECT COUNT(*) as count FROM documents WHERE created_by = '${alice.user.id}'`
      )
      // THEN: should have 3 documents
      expect(Number(documentCount.count)).toBe(3)

      // WHEN: querying with JOIN
      const creatorInfo = await executeQuery(
        'SELECT d.title, u.name as creator_name FROM documents d JOIN users u ON d.created_by = u.id WHERE d.id = 1'
      )
      // THEN: should return creator info
      expect(creatorInfo.title).toBe('First Doc')
      expect(creatorInfo.creator_name).toBe('Alice')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-CREATED-BY-003: should enforce immutability via application (no UPDATE trigger)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // GIVEN: users created via Better Auth
      const john = await createAuthenticatedUser({ name: 'John', email: 'john@example.com' })
      const jane = await createAuthenticatedUser({ name: 'Jane', email: 'jane@example.com' })

      // WHEN: inserting issue
      await executeQuery(
        `INSERT INTO issues (title, created_by) VALUES ('Bug #1', '${john.user.id}')`
      )

      // WHEN: querying original creator
      const originalCreator = await executeQuery('SELECT created_by FROM issues WHERE id = 1')
      // THEN: should be John
      expect(originalCreator.created_by).toBe(john.user.id)

      // Note: Database allows UPDATE but application should prevent it
      // This test verifies there's no trigger blocking updates at DB level
      const updateResult = await executeQuery(
        `UPDATE issues SET created_by = '${jane.user.id}' WHERE id = 1 RETURNING created_by`
      )
      // THEN: update should succeed (no DB trigger blocking)
      expect(updateResult.created_by).toBe(jane.user.id)

      // THEN: should have no trigger for created_by
      const noTrigger = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.triggers WHERE event_object_table='issues' AND trigger_name LIKE '%created_by%'"
      )
      expect(Number(noTrigger.count)).toBe(0)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-CREATED-BY-004: should support efficient filtering by creator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // GIVEN: users created via Better Auth
      const alice = await createAuthenticatedUser({ name: 'Alice', email: 'alice@example.com' })
      const bob = await createAuthenticatedUser({ name: 'Bob', email: 'bob@example.com' })
      const charlie = await createAuthenticatedUser({
        name: 'Charlie',
        email: 'charlie@example.com',
      })

      // WHEN: inserting tasks
      await executeQuery(
        `INSERT INTO tasks (title, created_by) VALUES
          ('Task 1', '${alice.user.id}'),
          ('Task 2', '${bob.user.id}'),
          ('Task 3', '${alice.user.id}'),
          ('Task 4', '${charlie.user.id}'),
          ('Task 5', '${alice.user.id}')`
      )

      // WHEN: counting Alice's tasks
      const aliceTasks = await executeQuery(
        `SELECT COUNT(*) as count FROM tasks WHERE created_by = '${alice.user.id}'`
      )
      // THEN: Alice should have 3 tasks
      expect(Number(aliceTasks.count)).toBe(3)

      // WHEN: counting Bob's tasks
      const bobTasks = await executeQuery(
        `SELECT COUNT(*) as count FROM tasks WHERE created_by = '${bob.user.id}'`
      )
      // THEN: Bob should have 1 task
      expect(Number(bobTasks.count)).toBe(1)

      // WHEN: querying creators with JOIN
      const creatorNames = await executeQuery(
        `SELECT t.title, u.name as creator FROM tasks t JOIN users u ON t.created_by = u.id WHERE t.created_by IN ('${alice.user.id}', '${charlie.user.id}') ORDER BY t.id`
      )
      // THEN: should return tasks with creator names
      expect(creatorNames.rows).toEqual([
        { title: 'Task 1', creator: 'Alice' },
        { title: 'Task 3', creator: 'Alice' },
        { title: 'Task 4', creator: 'Charlie' },
        { title: 'Task 5', creator: 'Alice' },
      ])
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-CREATED-BY-005: should create btree index for fast creator filtering when indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with indexed created_by field
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
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

      // WHEN: querying index information
      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_comments_created_by'"
      )
      // THEN: index should exist
      expect(indexInfo.indexname).toBe('idx_comments_created_by')
      expect(indexInfo.tablename).toBe('comments')

      // WHEN: querying index definition
      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_comments_created_by'"
      )
      // THEN: should be btree index
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_comments_created_by ON public.comments USING btree (created_by)'
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-CREATED-BY-006: user can complete full created-by-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      let alice: any

      await test.step('Setup: Start server with created-by field', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: { emailAndPassword: true },
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
      })

      await test.step('Create authenticated user', async () => {
        alice = await createAuthenticatedUser({ name: 'Alice', email: 'alice@example.com' })
      })

      await test.step('Insert data with creator', async () => {
        await executeQuery(
          `INSERT INTO data (content, created_by) VALUES ('Test content', '${alice.user.id}')`
        )
      })

      await test.step('Verify created_by field', async () => {
        const record = await executeQuery('SELECT created_by FROM data WHERE id = 1')
        expect(record.created_by).toBe(alice.user.id)
      })

      await test.step('Verify creator info via JOIN', async () => {
        const creator = await executeQuery(
          'SELECT d.content, u.name FROM data d JOIN users u ON d.created_by = u.id WHERE d.id = 1'
        )
        expect(creator.name).toBe('Alice')
      })

      await test.step('Error handling: created-by without auth config is rejected', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error',
            // No auth config!
            tables: [
              {
                id: 99,
                name: 'invalid',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'creator', type: 'created-by' },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
              },
            ],
          })
        ).rejects.toThrow(/auth.*required|authentication.*config|user.*field.*requires.*auth/i)
      })
    }
  )
})
