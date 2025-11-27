/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Row-Level Security Policies Migration
 *
 * Source: specs/migrations/schema-evolution/rls-policies/rls-policies.json
 * Domain: migrations
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Row-Level Security Policies Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'MIGRATION-RLS-001: should enable rls + create select policy',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'documents' exists without RLS
      await executeQuery([
        `CREATE TABLE documents (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, user_id INTEGER NOT NULL, content TEXT)`,
        `INSERT INTO documents (title, user_id, content) VALUES ('Doc 1', 1, 'Content 1'), ('Doc 2', 2, 'Content 2')`,
      ])

      // WHEN: RLS enabled with SELECT policy (user_id = current_user_id())
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
              { id: 3, name: 'user_id', type: 'integer', required: true },
              { id: 4, name: 'content', type: 'long-text' },
            ],
            // @ts-expect-error - rlsEnabled and rlsPolicies are future features
            rlsEnabled: true,
            rlsPolicies: [
              {
                name: 'documents_select_policy',
                command: 'SELECT',
                using: "user_id = current_setting('app.current_user_id')::integer",
              },
            ],
          },
        ],
      })

      // THEN: Enable RLS + CREATE SELECT policy

      // RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'documents'`
      )
      expect(rlsEnabled.relrowsecurity).toBe(true)

      // Policy exists
      const policyExists = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_policies WHERE tablename = 'documents' AND policyname = 'documents_select_policy'`
      )
      expect(policyExists.count).toBe(1)

      // Test policy enforcement (set user context)
      await executeQuery(`SET app.current_user_id = '1'`)
      const userDocs = await executeQuery(`SELECT COUNT(*) as count FROM documents`)
      expect(userDocs.count).toBe(1) // Only user 1's document visible
    }
  )

  test.fixme(
    'MIGRATION-RLS-002: should create insert policy',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'posts' with RLS enabled and SELECT policy
      await executeQuery([
        `CREATE TABLE posts (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, user_id INTEGER NOT NULL)`,
        `ALTER TABLE posts ENABLE ROW LEVEL SECURITY`,
        `CREATE POLICY posts_select_policy ON posts FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer)`,
        `INSERT INTO posts (title, user_id) VALUES ('Post 1', 1)`,
      ])

      // WHEN: INSERT policy added (user_id = current_user_id())
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
              { id: 3, name: 'user_id', type: 'integer', required: true },
            ],
            // @ts-expect-error - rlsEnabled and rlsPolicies are future features
            rlsEnabled: true,
            rlsPolicies: [
              {
                name: 'posts_select_policy',
                command: 'SELECT',
                using: "user_id = current_setting('app.current_user_id')::integer",
              },
              {
                name: 'posts_insert_policy',
                command: 'INSERT',
                withCheck: "user_id = current_setting('app.current_user_id')::integer",
              },
            ],
          },
        ],
      })

      // THEN: CREATE INSERT policy

      // INSERT policy exists
      const insertPolicyExists = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_policies WHERE tablename = 'posts' AND policyname = 'posts_insert_policy' AND cmd = 'INSERT'`
      )
      expect(insertPolicyExists.count).toBe(1)

      // Test INSERT policy - can insert for own user_id
      await executeQuery(`SET app.current_user_id = '2'`)
      const newPost = await executeQuery(
        `INSERT INTO posts (title, user_id) VALUES ('Post 2', 2) RETURNING title`
      )
      expect(newPost.title).toBe('Post 2')

      // Cannot insert for different user_id
      await expect(async () => {
        await executeQuery(`INSERT INTO posts (title, user_id) VALUES ('Invalid Post', 999)`)
      }).rejects.toThrow(/policy|permission denied/i)
    }
  )

  test.fixme(
    'MIGRATION-RLS-003: should create update policy',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'comments' with RLS and SELECT/INSERT policies
      await executeQuery([
        `CREATE TABLE comments (id SERIAL PRIMARY KEY, content TEXT NOT NULL, user_id INTEGER NOT NULL)`,
        `ALTER TABLE comments ENABLE ROW LEVEL SECURITY`,
        `CREATE POLICY comments_select_policy ON comments FOR SELECT USING (true)`,
        `CREATE POLICY comments_insert_policy ON comments FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id')::integer)`,
        `INSERT INTO comments (content, user_id) VALUES ('Comment 1', 1), ('Comment 2', 2)`,
      ])

      // WHEN: UPDATE policy added (user_id = current_user_id())
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'comments',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text', required: true },
              { id: 3, name: 'user_id', type: 'integer', required: true },
            ],
            // @ts-expect-error - rlsEnabled and rlsPolicies are future features
            rlsEnabled: true,
            rlsPolicies: [
              {
                name: 'comments_select_policy',
                command: 'SELECT',
                using: 'true',
              },
              {
                name: 'comments_insert_policy',
                command: 'INSERT',
                withCheck: "user_id = current_setting('app.current_user_id')::integer",
              },
              {
                name: 'comments_update_policy',
                command: 'UPDATE',
                using: "user_id = current_setting('app.current_user_id')::integer",
              },
            ],
          },
        ],
      })

      // THEN: CREATE UPDATE policy

      // UPDATE policy exists
      const updatePolicyExists = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_policies WHERE tablename = 'comments' AND policyname = 'comments_update_policy' AND cmd = 'UPDATE'`
      )
      expect(updatePolicyExists.count).toBe(1)

      // Test UPDATE policy - can update own comments
      await executeQuery(`SET app.current_user_id = '1'`)
      const updatedComment = await executeQuery(
        `UPDATE comments SET content = 'Updated Comment 1' WHERE id = 1 RETURNING content`
      )
      expect(updatedComment.content).toBe('Updated Comment 1')

      // Cannot update other user's comments (no rows affected)
      const result = await executeQuery(`UPDATE comments SET content = 'Hacked!' WHERE id = 2`)
      expect(result.rowCount || 0).toBe(0)
    }
  )

  test.fixme(
    'MIGRATION-RLS-004: should drop rls policy',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'tasks' with RLS and multiple policies
      await executeQuery([
        `CREATE TABLE tasks (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, user_id INTEGER NOT NULL)`,
        `ALTER TABLE tasks ENABLE ROW LEVEL SECURITY`,
        `CREATE POLICY tasks_select_policy ON tasks FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer)`,
        `CREATE POLICY tasks_insert_policy ON tasks FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id')::integer)`,
        `INSERT INTO tasks (title, user_id) VALUES ('Task 1', 1), ('Task 2', 2)`,
      ])

      // WHEN: SELECT policy removed from schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
              { id: 3, name: 'user_id', type: 'integer', required: true },
            ],
            // @ts-expect-error - rlsEnabled and rlsPolicies are future features
            rlsEnabled: true,
            rlsPolicies: [
              // SELECT policy removed, only INSERT remains
              {
                name: 'tasks_insert_policy',
                command: 'INSERT',
                withCheck: "user_id = current_setting('app.current_user_id')::integer",
              },
            ],
          },
        ],
      })

      // THEN: DROP RLS policy

      // SELECT policy no longer exists
      const selectPolicyExists = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'tasks_select_policy'`
      )
      expect(selectPolicyExists.count).toBe(0)

      // INSERT policy still exists
      const insertPolicyExists = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'tasks_insert_policy'`
      )
      expect(insertPolicyExists.count).toBe(1)

      // RLS still enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'tasks'`
      )
      expect(rlsEnabled.relrowsecurity).toBe(true)
    }
  )

  test.fixme(
    'MIGRATION-RLS-005: should alter policy via drop and create',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'projects' with RLS policy using old expression
      await executeQuery([
        `CREATE TABLE projects (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, owner_id INTEGER NOT NULL, team_id INTEGER)`,
        `ALTER TABLE projects ENABLE ROW LEVEL SECURITY`,
        `CREATE POLICY projects_select_policy ON projects FOR SELECT USING (owner_id = current_setting('app.current_user_id')::integer)`,
        `INSERT INTO projects (name, owner_id, team_id) VALUES ('Project 1', 1, 10), ('Project 2', 2, 10)`,
      ])

      // WHEN: policy expression modified (owner_id changed to team_id-based)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'owner_id', type: 'integer', required: true },
              { id: 4, name: 'team_id', type: 'integer' },
            ],
            // @ts-expect-error - rlsEnabled and rlsPolicies are future features
            rlsEnabled: true,
            rlsPolicies: [
              {
                name: 'projects_select_policy',
                command: 'SELECT',
                // Changed from owner_id to team_id check
                using: "team_id = current_setting('app.current_team_id')::integer",
              },
            ],
          },
        ],
      })

      // THEN: Alter policy via DROP and CREATE

      // Policy exists with new expression
      const policyExists = await executeQuery(
        `SELECT polqual::text as qual FROM pg_policies WHERE tablename = 'projects' AND policyname = 'projects_select_policy'`
      )
      expect(policyExists.qual).toMatch(/team_id/i)

      // Test new policy - both projects visible when on same team
      await executeQuery(`SET app.current_team_id = '10'`)
      const teamProjects = await executeQuery(`SELECT COUNT(*) as count FROM projects`)
      expect(teamProjects.count).toBe(2) // Both projects in team 10
    }
  )

  test.fixme(
    'MIGRATION-RLS-006: should disable rls on table',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'logs' with RLS enabled and policies
      await executeQuery([
        `CREATE TABLE logs (id SERIAL PRIMARY KEY, message TEXT NOT NULL, user_id INTEGER)`,
        `ALTER TABLE logs ENABLE ROW LEVEL SECURITY`,
        `CREATE POLICY logs_select_policy ON logs FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer)`,
        `INSERT INTO logs (message, user_id) VALUES ('Log 1', 1), ('Log 2', 2)`,
      ])

      // WHEN: RLS disabled in schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'logs',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'message', type: 'long-text', required: true },
              { id: 3, name: 'user_id', type: 'integer' },
            ],
            // @ts-expect-error - rlsEnabled is a future feature
            rlsEnabled: false, // RLS disabled
            // No policies
          },
        ],
      })

      // THEN: Disable RLS on table

      // RLS disabled
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'logs'`
      )
      expect(rlsEnabled.relrowsecurity).toBe(false)

      // Policies removed
      const policyCount = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_policies WHERE tablename = 'logs'`
      )
      expect(policyCount.count).toBe(0)

      // All rows now visible (no RLS filtering)
      const allLogs = await executeQuery(`SELECT COUNT(*) as count FROM logs`)
      expect(allLogs.count).toBe(2)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'MIGRATION-RLS-007: user can complete full rls-policies workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative rls-policies scenarios
      await executeQuery([
        `CREATE TABLE notes (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, content TEXT, user_id INTEGER NOT NULL)`,
        `INSERT INTO notes (title, content, user_id) VALUES ('Note 1', 'Content 1', 1), ('Note 2', 'Content 2', 2)`,
      ])

      // WHEN: Enable RLS with SELECT and INSERT policies
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
              { id: 3, name: 'content', type: 'long-text' },
              { id: 4, name: 'user_id', type: 'integer', required: true },
            ],
            // @ts-expect-error - rlsEnabled and rlsPolicies are future features
            rlsEnabled: true,
            rlsPolicies: [
              {
                name: 'notes_select_policy',
                command: 'SELECT',
                using: "user_id = current_setting('app.current_user_id')::integer",
              },
              {
                name: 'notes_insert_policy',
                command: 'INSERT',
                withCheck: "user_id = current_setting('app.current_user_id')::integer",
              },
            ],
          },
        ],
      })

      // THEN: RLS enabled, policies work

      // RLS enabled
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'notes'`
      )
      expect(rlsEnabled.relrowsecurity).toBe(true)

      // Set user context
      await executeQuery(`SET app.current_user_id = '1'`)

      // Can only see own notes
      const userNotes = await executeQuery(`SELECT COUNT(*) as count FROM notes`)
      expect(userNotes.count).toBe(1)

      // Can insert own notes
      const newNote = await executeQuery(
        `INSERT INTO notes (title, content, user_id) VALUES ('Note 3', 'New content', 1) RETURNING title`
      )
      expect(newNote.title).toBe('Note 3')
    }
  )
})
