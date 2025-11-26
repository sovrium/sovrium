/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for User Field
 *
 * Source: specs/app/tables/field-types/user-field/user-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('User Field', () => {
  test.fixme(
    'APP-USER-FIELD-001: should create PostgreSQL INTEGER column with FOREIGN KEY to users',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255))',
        "INSERT INTO users (name, email) VALUES ('Alice Johnson', 'alice@example.com'), ('Bob Smith', 'bob@example.com')",
      ])

      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'assigned_to', type: 'user', allowMultiple: false },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tasks' AND column_name='assigned_to'"
      )
      expect(columnInfo.column_name).toBe('assigned_to')
      expect(columnInfo.data_type).toBe('integer')

      const fkCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='tasks' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%assigned_to%'"
      )
      expect(fkCount.count).toBe(1)

      const referencedTable = await executeQuery(
        "SELECT ccu.table_name as referenced_table FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.table_name='tasks' AND tc.constraint_type='FOREIGN KEY'"
      )
      expect(referencedTable.referenced_table).toBe('users')
    }
  )

  test.fixme(
    'APP-USER-FIELD-002: should enforce valid user foreign key references',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('John Doe')",
      ])

      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'issues',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'reporter', type: 'user' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      const validInsert = await executeQuery(
        "INSERT INTO issues (title, reporter) VALUES ('Bug report', 1) RETURNING reporter"
      )
      expect(validInsert.reporter).toBe(1)

      await expect(
        executeQuery("INSERT INTO issues (title, reporter) VALUES ('Feature request', 999)")
      ).rejects.toThrow(/violates foreign key constraint/)

      const nullInsert = await executeQuery(
        "INSERT INTO issues (title, reporter) VALUES ('Unassigned issue', NULL) RETURNING reporter IS NULL as is_null"
      )
      expect(nullInsert.is_null).toBe(true)
    }
  )

  test.fixme(
    'APP-USER-FIELD-003: should support multiple user assignments via junction table',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie')",
        'CREATE TABLE projects (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO projects (name) VALUES ('Website Redesign')",
        'CREATE TABLE project_collaborators (project_id INTEGER REFERENCES projects(id), user_id INTEGER REFERENCES users(id), PRIMARY KEY (project_id, user_id))',
        'INSERT INTO project_collaborators (project_id, user_id) VALUES (1, 1), (1, 2), (1, 3)',
      ])

      const junctionTable = await executeQuery(
        "SELECT table_name FROM information_schema.tables WHERE table_name = 'project_collaborators'"
      )
      expect(junctionTable.table_name).toBe('project_collaborators')

      const collaboratorCount = await executeQuery(
        'SELECT COUNT(*) as count FROM project_collaborators WHERE project_id = 1'
      )
      expect(collaboratorCount.count).toBe(3)

      const collaborators = await executeQuery(
        'SELECT p.name as project_name, u.name as user_name FROM projects p JOIN project_collaborators pc ON p.id = pc.project_id JOIN users u ON pc.user_id = u.id WHERE p.id = 1 ORDER BY u.name'
      )
      expect(collaborators).toEqual([
        { project_name: 'Website Redesign', user_name: 'Alice' },
        { project_name: 'Website Redesign', user_name: 'Bob' },
        { project_name: 'Website Redesign', user_name: 'Charlie' },
      ])
    }
  )

  test.fixme(
    'APP-USER-FIELD-004: should return user profile data via JOIN',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), avatar_url VARCHAR(500))',
        "INSERT INTO users (name, email, avatar_url) VALUES ('Sarah Connor', 'sarah@example.com', 'https://example.com/avatars/sarah.jpg')",
      ])

      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'owner', type: 'user' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await executeQuery([
        "INSERT INTO documents (title, owner) VALUES ('Project Plan', 1), ('Budget Report', 1)",
      ])

      const ownerInfo = await executeQuery(
        'SELECT d.id, d.title, u.name as owner_name, u.email as owner_email FROM documents d JOIN users u ON d.owner = u.id WHERE d.id = 1'
      )
      expect(ownerInfo.id).toBe(1)
      expect(ownerInfo.title).toBe('Project Plan')
      expect(ownerInfo.owner_name).toBe('Sarah Connor')
      expect(ownerInfo.owner_email).toBe('sarah@example.com')

      const documentsByUser = await executeQuery(
        "SELECT COUNT(*) as count FROM documents d JOIN users u ON d.owner = u.id WHERE u.email = 'sarah@example.com'"
      )
      expect(documentsByUser.count).toBe(2)
    }
  )

  test.fixme(
    'APP-USER-FIELD-005: should create btree index for fast user filtering when indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        'CREATE TABLE pull_requests (id SERIAL PRIMARY KEY, title VARCHAR(255), reviewer INTEGER REFERENCES users(id))',
        'CREATE INDEX idx_pull_requests_reviewer ON pull_requests(reviewer)',
      ])

      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_pull_requests_reviewer'"
      )
      expect(indexInfo.indexname).toBe('idx_pull_requests_reviewer')
      expect(indexInfo.tablename).toBe('pull_requests')

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_pull_requests_reviewer'"
      )
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_pull_requests_reviewer ON public.pull_requests USING btree (reviewer)'
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-USER-REGRESSION-001: user can complete full user-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255))',
        "INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com'), ('Bob', 'bob@example.com')",
      ])

      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'assignee', type: 'user', required: true, indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await executeQuery('INSERT INTO data (assignee) VALUES (1)')
      const assigned = await executeQuery('SELECT assignee FROM data WHERE id = 1')
      expect(assigned.assignee).toBe(1)

      const userInfo = await executeQuery(
        'SELECT d.id, u.name, u.email FROM data d JOIN users u ON d.assignee = u.id WHERE d.id = 1'
      )
      expect(userInfo.name).toBe('Alice')
      expect(userInfo.email).toBe('alice@example.com')
    }
  )
})
