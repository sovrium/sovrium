/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for User Field
 *
 * Source: src/domain/models/app/table/field-types/user-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * NOTE: User fields reference Better Auth's users table which has TEXT ids (UUIDs).
 * Tests use createAuthenticatedUser fixture to create users with proper Better Auth structure.
 */

test.describe('User Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-USER-001: should create PostgreSQL TEXT column with FOREIGN KEY to Better Auth users',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: table configuration with user field
      await startServerWithSchema({
        name: 'test-app',
        auth: { methods: ['email-and-password'] },
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

      // GIVEN: users created via Better Auth (TEXT id) - creating users populates the users table
      await createAuthenticatedUser({ name: 'Alice Johnson', email: 'alice@example.com' })
      await createAuthenticatedUser({ name: 'Bob Smith', email: 'bob@example.com' })

      // Verify users exist in Better Auth table
      const usersCount = await executeQuery('SELECT COUNT(*) as count FROM users')
      expect(Number(usersCount.count)).toBeGreaterThanOrEqual(2)

      // WHEN: querying the database schema
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tasks' AND column_name='assigned_to'"
      )
      // THEN: column should be TEXT (compatible with Better Auth TEXT id)
      expect(columnInfo.column_name).toBe('assigned_to')
      expect(columnInfo.data_type).toBe('text')

      // THEN: foreign key should reference Better Auth users table
      const fkCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='tasks' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%assigned_to%'"
      )
      expect(Number(fkCount.count)).toBe(1)

      const referencedTable = await executeQuery(
        "SELECT ccu.table_name as referenced_table FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.table_name='tasks' AND tc.constraint_type='FOREIGN KEY'"
      )
      expect(referencedTable.referenced_table).toBe('users')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-USER-002: should enforce valid user foreign key references',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: { methods: ['email-and-password'] },
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

      // GIVEN: user created via Better Auth
      const user = await createAuthenticatedUser({ name: 'John Doe', email: 'john@example.com' })

      // WHEN: inserting with valid user reference
      const validInsert = await executeQuery(
        `INSERT INTO issues (title, reporter) VALUES ('Bug report', '${user.user.id}') RETURNING reporter`
      )
      // THEN: should accept valid user id
      expect(validInsert.reporter).toBe(user.user.id)

      // THEN: should reject invalid user id (foreign key constraint)
      await expect(
        executeQuery(
          "INSERT INTO issues (title, reporter) VALUES ('Feature request', 'invalid-uuid-999')"
        )
      ).rejects.toThrow(/violates foreign key constraint/)

      // THEN: should allow NULL for optional user field
      const nullInsert = await executeQuery(
        "INSERT INTO issues (title, reporter) VALUES ('Unassigned issue', NULL) RETURNING reporter IS NULL as is_null"
      )
      expect(nullInsert.is_null).toBe(true)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-USER-003: should support multiple user assignments via junction table',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: users created via Better Auth
      await startServerWithSchema({
        name: 'test-app',
        auth: { methods: ['email-and-password'] },
        tables: [],
      })

      const alice = await createAuthenticatedUser({ name: 'Alice', email: 'alice@example.com' })
      const bob = await createAuthenticatedUser({ name: 'Bob', email: 'bob@example.com' })
      const charlie = await createAuthenticatedUser({
        name: 'Charlie',
        email: 'charlie@example.com',
      })

      // GIVEN: projects table and junction table
      await executeQuery([
        'CREATE TABLE projects (id SERIAL PRIMARY KEY, name VARCHAR(255))',
        "INSERT INTO projects (name) VALUES ('Website Redesign')",
        'CREATE TABLE project_collaborators (project_id INTEGER REFERENCES projects(id), user_id TEXT REFERENCES users(id), PRIMARY KEY (project_id, user_id))',
        `INSERT INTO project_collaborators (project_id, user_id) VALUES (1, '${alice.user.id}'), (1, '${bob.user.id}'), (1, '${charlie.user.id}')`,
      ])

      // WHEN: querying junction table
      const junctionTable = await executeQuery(
        "SELECT table_name FROM information_schema.tables WHERE table_name = 'project_collaborators'"
      )
      // THEN: junction table should exist
      expect(junctionTable.table_name).toBe('project_collaborators')

      // WHEN: counting collaborators
      const collaboratorCount = await executeQuery(
        'SELECT COUNT(*) as count FROM project_collaborators WHERE project_id = 1'
      )
      // THEN: should have 3 collaborators
      expect(Number(collaboratorCount.count)).toBe(3)

      // WHEN: joining to get names
      const collaborators = await executeQuery(
        'SELECT p.name as project_name, u.name as user_name FROM projects p JOIN project_collaborators pc ON p.id = pc.project_id JOIN users u ON pc.user_id = u.id WHERE p.id = 1 ORDER BY u.name'
      )
      // THEN: should return all collaborators
      expect(collaborators.rows).toEqual([
        { project_name: 'Website Redesign', user_name: 'Alice' },
        { project_name: 'Website Redesign', user_name: 'Bob' },
        { project_name: 'Website Redesign', user_name: 'Charlie' },
      ])
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-USER-004: should return user profile data via JOIN',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: user created via Better Auth
      await startServerWithSchema({
        name: 'test-app',
        auth: { methods: ['email-and-password'] },
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

      const sarah = await createAuthenticatedUser({
        name: 'Sarah Connor',
        email: 'sarah@example.com',
      })

      // WHEN: inserting documents with owner
      await executeQuery([
        `INSERT INTO documents (title, owner) VALUES ('Project Plan', '${sarah.user.id}'), ('Budget Report', '${sarah.user.id}')`,
      ])

      // WHEN: querying with JOIN
      const ownerInfo = await executeQuery(
        'SELECT d.id, d.title, u.name as owner_name, u.email as owner_email FROM documents d JOIN users u ON d.owner = u.id WHERE d.id = 1'
      )
      // THEN: should return owner profile data
      expect(ownerInfo.id).toBe(1)
      expect(ownerInfo.title).toBe('Project Plan')
      expect(ownerInfo.owner_name).toBe('Sarah Connor')
      expect(ownerInfo.owner_email).toBe('sarah@example.com')

      // WHEN: counting documents by user email
      const documentsByUser = await executeQuery(
        "SELECT COUNT(*) as count FROM documents d JOIN users u ON d.owner = u.id WHERE u.email = 'sarah@example.com'"
      )
      // THEN: should count documents
      expect(Number(documentsByUser.count)).toBe(2)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-USER-005: should create btree index for fast user filtering when indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with indexed user field
      await startServerWithSchema({
        name: 'test-app',
        auth: { methods: ['email-and-password'] },
        tables: [
          {
            id: 4,
            name: 'pull_requests',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'reviewer', type: 'user', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying index information
      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_pull_requests_reviewer'"
      )
      // THEN: index should exist
      expect(indexInfo.indexname).toBe('idx_pull_requests_reviewer')
      expect(indexInfo.tablename).toBe('pull_requests')

      // WHEN: querying index definition
      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_pull_requests_reviewer'"
      )
      // THEN: should be btree index
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_pull_requests_reviewer ON public.pull_requests USING btree (reviewer)'
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-USER-006: user can complete full user-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: users created via Better Auth
      await startServerWithSchema({
        name: 'test-app',
        auth: { methods: ['email-and-password'] },
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

      const alice = await createAuthenticatedUser({ name: 'Alice', email: 'alice@example.com' })
      // Create second user to ensure multiple users work in Better Auth context
      await createAuthenticatedUser({ name: 'Bob', email: 'bob@example.com' })

      // WHEN: inserting data with user reference
      await executeQuery(`INSERT INTO data (assignee) VALUES ('${alice.user.id}')`)

      // WHEN: querying assigned data
      const assigned = await executeQuery('SELECT assignee FROM data WHERE id = 1')
      // THEN: should return user id
      expect(assigned.assignee).toBe(alice.user.id)

      // WHEN: joining to get user info
      const userInfo = await executeQuery(
        'SELECT d.id, u.name, u.email FROM data d JOIN users u ON d.assignee = u.id WHERE d.id = 1'
      )
      // THEN: should return user profile
      expect(userInfo.name).toBe('Alice')
      expect(userInfo.email).toBe('alice@example.com')
    }
  )
})
