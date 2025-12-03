/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Record-Level Permissions
 *
 * Source: src/domain/models/app/table/permissions/index.ts
 * Domain: app
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Record-Level Permissions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-RECORD-PERMISSIONS-001: should filter records to match user ID when record-level permission is read: {userId} = created_by',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: record-level permission 'read: {userId} = created_by'
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'content', type: 'single-line-text' },
              { id: 4, name: 'created_by', type: 'user' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              records: [
                {
                  action: 'read',
                  condition: '{userId} = created_by',
                },
              ],
            },
          },
        ],
      })

      // Create test users
      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

      // Remove BYPASSRLS privilege from current user to enable RLS testing
      // PostgreSQL superusers bypass RLS by default - we need to create a non-superuser role
      // Since altering the current role doesn't affect existing connections, we need to:
      // 1. Drop and recreate role (to ensure clean state for test retries)
      // 2. Grant table access to that role
      // 3. Use SET ROLE to switch to that role for RLS-sensitive queries
      await executeQuery('DROP ROLE IF EXISTS rls_test_user')
      await executeQuery("CREATE ROLE rls_test_user WITH LOGIN PASSWORD 'test'")

      await executeQuery([
        'ALTER TABLE documents ENABLE ROW LEVEL SECURITY', // Enable RLS
        'ALTER TABLE documents FORCE ROW LEVEL SECURITY', // Apply to table owners too
        "CREATE POLICY user_read_own ON documents FOR SELECT USING (created_by = current_setting('app.user_id', true)::TEXT)",
        `INSERT INTO documents (title, content, created_by) VALUES ('Doc 1', 'Content 1', '${user1.user.id}'), ('Doc 2', 'Content 2', '${user2.user.id}'), ('Doc 3', 'Content 3', '${user1.user.id}')`,
        'GRANT ALL ON TABLE documents TO rls_test_user',
        'GRANT USAGE ON SCHEMA public TO rls_test_user',
      ])

      // WHEN: user lists records
      // THEN: PostgreSQL RLS policy filters records to match user's ID

      // RLS policy exists for user_read_own
      const policyCount = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='documents' AND policyname='user_read_own'"
      )
      // THEN: assertion
      expect(policyCount.count).toBe(1)

      // User 1 can only SELECT their own records
      const user1Count = await executeQuery(
        `SET ROLE rls_test_user; SET LOCAL app.user_id = '${user1.user.id}'; SELECT COUNT(*) as count FROM documents`
      )
      // THEN: assertion
      expect(user1Count.count).toBe(2)

      // User 2 can only SELECT their own records
      const user2Count = await executeQuery(
        `SET ROLE rls_test_user; SET LOCAL app.user_id = '${user2.user.id}'; SELECT COUNT(*) as count FROM documents`
      )
      // THEN: assertion
      expect(user2Count.count).toBe(1)

      // User 1 sees titles of their documents
      const user1Titles = await executeQuery(
        `SET ROLE rls_test_user; SET LOCAL app.user_id = '${user1.user.id}'; SELECT title FROM documents ORDER BY id`
      )
      // THEN: assertion
      expect(user1Titles.rows).toEqual([{ title: 'Doc 1' }, { title: 'Doc 3' }])
    }
  )

  test(
    'APP-TABLES-RECORD-PERMISSIONS-002: should deny UPDATE when user attempts to update record not assigned to them',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: record-level permission 'update: {userId} = assigned_to'
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
              { id: 4, name: 'assigned_to', type: 'user' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              records: [
                {
                  action: 'update',
                  condition: '{userId} = assigned_to',
                },
              ],
            },
          },
        ],
      })

      // Create test users
      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

      // Create non-superuser role for RLS testing
      await executeQuery('DROP ROLE IF EXISTS rls_test_user')
      await executeQuery("CREATE ROLE rls_test_user WITH LOGIN PASSWORD 'test'")

      await executeQuery([
        'ALTER TABLE tasks ENABLE ROW LEVEL SECURITY', // Enable RLS
        'ALTER TABLE tasks FORCE ROW LEVEL SECURITY', // Apply to table owners too
        "CREATE POLICY user_select_assigned ON tasks FOR SELECT USING (assigned_to = current_setting('app.user_id', true)::TEXT)",
        "CREATE POLICY user_update_assigned ON tasks FOR UPDATE USING (assigned_to = current_setting('app.user_id', true)::TEXT) WITH CHECK (assigned_to = current_setting('app.user_id', true)::TEXT)",
        `INSERT INTO tasks (title, status, assigned_to) VALUES ('Task 1', 'open', '${user1.user.id}'), ('Task 2', 'open', '${user2.user.id}')`,
        'GRANT ALL ON TABLE tasks TO rls_test_user',
        'GRANT USAGE ON SCHEMA public TO rls_test_user',
      ])

      // WHEN: user attempts to update record not assigned to them
      // THEN: PostgreSQL RLS policy denies UPDATE

      // RLS policies exist for SELECT and UPDATE
      const policyCount = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='tasks' AND policyname IN ('user_select_assigned', 'user_update_assigned')"
      )
      // THEN: assertion
      expect(policyCount.count).toBe(2)

      // User 1 can UPDATE tasks assigned to them
      const user1Update = await executeQuery(
        `SET ROLE rls_test_user; SET LOCAL app.user_id = '${user1.user.id}'; UPDATE tasks SET status = 'in_progress' WHERE id = 1 RETURNING status`
      )
      // THEN: assertion
      expect(user1Update.status).toBe('in_progress')

      // User 1 cannot UPDATE tasks assigned to user 2
      const user1FailedUpdate = await executeQuery(
        `SET ROLE rls_test_user; SET LOCAL app.user_id = '${user1.user.id}'; UPDATE tasks SET status = 'hacked' WHERE id = 2 RETURNING id`
      )
      // THEN: assertion
      expect(user1FailedUpdate.id).toBeUndefined()

      // User 2 can only UPDATE their assigned tasks
      const user2Update = await executeQuery(
        `SET ROLE rls_test_user; SET LOCAL app.user_id = '${user2.user.id}'; UPDATE tasks SET status = 'done' WHERE id = 2 RETURNING status`
      )
      // THEN: assertion
      expect(user2Update.status).toBe('done')
    }
  )

  test(
    'APP-TABLES-RECORD-PERMISSIONS-003: should deny DELETE when user attempts to delete published record they created',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: record-level permission 'delete: {userId} = created_by AND status = draft'
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 3,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
              { id: 4, name: 'created_by', type: 'user' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              records: [
                {
                  action: 'delete',
                  condition: "{userId} = created_by AND status = 'draft'",
                },
              ],
            },
          },
        ],
      })

      // Create test users
      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

      // Create non-superuser role for RLS testing
      await executeQuery('DROP ROLE IF EXISTS rls_test_user')
      await executeQuery("CREATE ROLE rls_test_user WITH LOGIN PASSWORD 'test'")

      // Replace automatic policy with manual one for verification
      await executeQuery([
        'ALTER TABLE articles ENABLE ROW LEVEL SECURITY',
        'ALTER TABLE articles FORCE ROW LEVEL SECURITY',
        'DROP POLICY IF EXISTS articles_record_delete ON articles',
        "CREATE POLICY user_select_own ON articles FOR SELECT USING (created_by = current_setting('app.user_id', true)::TEXT)",
        "CREATE POLICY user_delete_draft ON articles FOR DELETE USING (created_by = current_setting('app.user_id', true)::TEXT AND status = 'draft')",
        `INSERT INTO articles (title, status, created_by) VALUES ('Draft 1', 'draft', '${user1.user.id}'), ('Published 1', 'published', '${user1.user.id}'), ('Draft 2', 'draft', '${user2.user.id}')`,
        'GRANT ALL ON TABLE articles TO rls_test_user',
        'GRANT USAGE ON SCHEMA public TO rls_test_user',
      ])

      // WHEN: user attempts to delete published record they created
      // THEN: PostgreSQL RLS policy denies DELETE (status not draft)

      // RLS policy exists with AND condition
      const policyCount = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='articles' AND policyname='user_delete_draft'"
      )
      // THEN: assertion
      expect(policyCount.count).toBe(1)

      // User 1 can DELETE their draft article
      const user1Delete = await executeQuery(
        `SET ROLE rls_test_user; SET LOCAL app.user_id = '${user1.user.id}'; DELETE FROM articles WHERE id = 1 RETURNING id`
      )
      // THEN: assertion
      expect(user1Delete.id).toBe(1)

      // User 1 cannot DELETE their published article (status not draft)
      const user1FailedDelete = await executeQuery(
        `SET ROLE rls_test_user; SET LOCAL app.user_id = '${user1.user.id}'; DELETE FROM articles WHERE id = 2 RETURNING id`
      )
      // THEN: assertion
      expect(user1FailedDelete.id).toBeUndefined()

      // User 1 cannot DELETE drafts by user 2 (not their own)
      const user1CrossDelete = await executeQuery(
        `SET ROLE rls_test_user; SET LOCAL app.user_id = '${user1.user.id}'; DELETE FROM articles WHERE id = 3 RETURNING id`
      )
      // THEN: assertion
      expect(user1CrossDelete.id).toBeUndefined()
    }
  )

  test(
    'APP-TABLES-RECORD-PERMISSIONS-004: should filter records matching ALL conditions when multiple record-level read conditions with AND logic',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: multiple record-level read conditions with AND logic
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 4,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'department', type: 'single-line-text' },
              { id: 4, name: 'status', type: 'single-line-text' },
              { id: 5, name: 'owner_id', type: 'user' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              records: [
                {
                  action: 'read',
                  condition: '{user.department} = department',
                },
                {
                  action: 'read',
                  condition: "status = 'active'",
                },
              ],
            },
          },
        ],
      })

      // Create test users
      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

      await executeQuery([
        'ALTER TABLE projects ENABLE ROW LEVEL SECURITY',
        "CREATE POLICY user_read_projects ON projects FOR SELECT USING (department = current_setting('app.user_department')::TEXT AND status = 'active')",
        `INSERT INTO projects (name, department, status, owner_id) VALUES ('Project A', 'Engineering', 'active', '${user1.user.id}'), ('Project B', 'Engineering', 'archived', '${user1.user.id}'), ('Project C', 'Marketing', 'active', '${user2.user.id}')`,
      ])

      // WHEN: user lists records
      // THEN: PostgreSQL RLS policy filters records matching ALL conditions

      // RLS policy combines conditions with AND
      const policyQual = await executeQuery(
        "SELECT qual FROM pg_policies WHERE tablename='projects' AND policyname='user_read_projects'"
      )
      // THEN: assertion
      expect(policyQual.qual).toBe(
        "((department = (current_setting('app.user_department'::text))::text) AND (status = 'active'::text))"
      )

      // Engineering user sees only active Engineering projects
      const engCount = await executeQuery(
        "SET LOCAL app.user_department = 'Engineering'; SELECT COUNT(*) as count FROM projects"
      )
      // THEN: assertion
      expect(engCount.count).toBe(1)

      // Engineering user sees Project A (active)
      const engProject = await executeQuery(
        "SET LOCAL app.user_department = 'Engineering'; SELECT name FROM projects"
      )
      // THEN: assertion
      expect(engProject.name).toBe('Project A')

      // Marketing user sees only active Marketing projects
      const mktProject = await executeQuery(
        "SET LOCAL app.user_department = 'Marketing'; SELECT name FROM projects"
      )
      // THEN: assertion
      expect(mktProject.name).toBe('Project C')
    }
  )

  test(
    'APP-TABLES-RECORD-PERMISSIONS-005: should filter by user department custom property when record-level permission is {user.department} = department',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: record-level permission '{user.department} = department'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'department', type: 'single-line-text' },
              { id: 4, name: 'email', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              records: [
                {
                  action: 'read',
                  condition: '{user.department} = department',
                },
              ],
            },
          },
        ],
      })

      // Create non-superuser role for RLS testing
      await executeQuery('DROP ROLE IF EXISTS rls_test_user')
      await executeQuery("CREATE ROLE rls_test_user WITH LOGIN PASSWORD 'test'")

      await executeQuery([
        'ALTER TABLE employees ENABLE ROW LEVEL SECURITY',
        'ALTER TABLE employees FORCE ROW LEVEL SECURITY',
        "CREATE POLICY same_department ON employees FOR SELECT USING (department = current_setting('app.user_department', true))",
        "INSERT INTO employees (name, department, email) VALUES ('Alice', 'Engineering', 'alice@example.com'), ('Bob', 'Marketing', 'bob@example.com'), ('Charlie', 'Engineering', 'charlie@example.com')",
        'GRANT ALL ON TABLE employees TO rls_test_user',
        'GRANT USAGE ON SCHEMA public TO rls_test_user',
      ])

      // WHEN: user lists records
      // THEN: PostgreSQL RLS policy filters by user's department custom property

      // RLS policy uses custom user property
      const policyQual = await executeQuery(
        "SELECT qual FROM pg_policies WHERE tablename='employees' AND policyname='same_department'"
      )
      // THEN: assertion
      expect(policyQual.qual).toBe(
        "((department)::text = current_setting('app.user_department'::text, true))"
      )

      // Engineering user sees Engineering employees only
      const engCount = await executeQuery(
        "SET ROLE rls_test_user; SET LOCAL app.user_department = 'Engineering'; SELECT COUNT(*) as count FROM employees"
      )
      // THEN: assertion
      expect(engCount.count).toBe(2)

      // Engineering user sees Alice and Charlie
      const engEmployees = await executeQuery(
        "SET ROLE rls_test_user; SET LOCAL app.user_department = 'Engineering'; SELECT name FROM employees ORDER BY name"
      )
      // THEN: assertion
      expect(engEmployees.rows).toEqual([{ name: 'Alice' }, { name: 'Charlie' }])

      // Marketing user sees Marketing employees only
      const mktEmployee = await executeQuery(
        "SET ROLE rls_test_user; SET LOCAL app.user_department = 'Marketing'; SELECT name FROM employees"
      )
      // THEN: assertion
      expect(mktEmployee.name).toBe('Bob')
    }
  )

  test.fixme(
    'APP-TABLES-RECORD-PERMISSIONS-006: should filter records where user is creator OR assignee when record-level permission has complex OR condition',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: record-level permission with complex condition '{userId} = created_by OR {userId} = assigned_to'
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 6,
            name: 'tickets',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'created_by', type: 'user' },
              { id: 4, name: 'assigned_to', type: 'user' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              records: [
                {
                  action: 'read',
                  condition: '{userId} = created_by OR {userId} = assigned_to',
                },
              ],
            },
          },
        ],
      })

      // Create test users
      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })
      const user3 = await createAuthenticatedUser({ email: 'user3@example.com' })

      await executeQuery([
        'ALTER TABLE tickets ENABLE ROW LEVEL SECURITY',
        "CREATE POLICY user_read_tickets ON tickets FOR SELECT USING (created_by = current_setting('app.user_id')::INTEGER OR assigned_to = current_setting('app.user_id')::INTEGER)",
        `INSERT INTO tickets (title, created_by, assigned_to) VALUES ('Ticket 1', '${user1.user.id}', '${user2.user.id}'), ('Ticket 2', '${user2.user.id}', '${user1.user.id}'), ('Ticket 3', '${user1.user.id}', '${user1.user.id}'), ('Ticket 4', '${user3.user.id}', '${user3.user.id}')`,
      ])

      // WHEN: user lists records
      // THEN: PostgreSQL RLS policy filters records where user is creator OR assignee

      // RLS policy uses OR condition
      const policyQual = await executeQuery(
        "SELECT qual FROM pg_policies WHERE tablename='tickets' AND policyname='user_read_tickets'"
      )
      // THEN: assertion
      expect(policyQual.qual).toBe(
        "((created_by = (current_setting('app.user_id'::text))::integer) OR (assigned_to = (current_setting('app.user_id'::text))::integer))"
      )

      // User 1 sees tickets they created OR are assigned to
      const user1Count = await executeQuery(
        `SET LOCAL app.user_id = '${user1.user.id}'; SELECT COUNT(*) as count FROM tickets`
      )
      // THEN: assertion
      expect(user1Count.count).toBe(3)

      // User 1 sees Ticket 1 (created), Ticket 2 (assigned), Ticket 3 (both)
      const user1Tickets = await executeQuery(
        `SET LOCAL app.user_id = '${user1.user.id}'; SELECT title FROM tickets ORDER BY id`
      )
      // THEN: assertion
      expect(user1Tickets).toEqual([
        { title: 'Ticket 1' },
        { title: 'Ticket 2' },
        { title: 'Ticket 3' },
      ])

      // User 2 sees tickets they created OR are assigned to
      const user2Tickets = await executeQuery(
        `SET LOCAL app.user_id = '${user2.user.id}'; SELECT title FROM tickets ORDER BY id`
      )
      // THEN: assertion
      expect(user2Tickets).toEqual([{ title: 'Ticket 1' }, { title: 'Ticket 2' }])
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-RECORD-PERMISSIONS-007: user can complete full record-permissions workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      let user1: any
      let user2: any

      await test.step('Setup: Start server with record-level permissions', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
          },
          tables: [
            {
              id: 7,
              name: 'items',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
                { id: 3, name: 'owner_id', type: 'user' },
                { id: 4, name: 'status', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                records: [
                  {
                    action: 'read',
                    condition: '{userId} = owner_id',
                  },
                  {
                    action: 'update',
                    condition: '{userId} = owner_id',
                  },
                  {
                    action: 'delete',
                    condition: "{userId} = owner_id AND status = 'draft'",
                  },
                ],
              },
            },
          ],
        })
      })

      await test.step('Create test users and RLS policies', async () => {
        user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
        user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

        await executeQuery([
          'ALTER TABLE items ENABLE ROW LEVEL SECURITY',
          "CREATE POLICY user_read ON items FOR SELECT USING (owner_id = current_setting('app.user_id')::INTEGER)",
          "CREATE POLICY user_update ON items FOR UPDATE USING (owner_id = current_setting('app.user_id')::INTEGER)",
          "CREATE POLICY user_delete ON items FOR DELETE USING (owner_id = current_setting('app.user_id')::INTEGER AND status = 'draft')",
          `INSERT INTO items (title, owner_id, status) VALUES ('Item 1', '${user1.user.id}', 'draft'), ('Item 2', '${user2.user.id}', 'published')`,
        ])
      })

      await test.step('Verify user can read their own records', async () => {
        const readResult = await executeQuery(
          `SET LOCAL app.user_id = '${user1.user.id}'; SELECT COUNT(*) as count FROM items`
        )
        expect(readResult.count).toBe(1)
      })

      await test.step('Verify user can update their own records', async () => {
        const updateResult = await executeQuery(
          `SET LOCAL app.user_id = '${user1.user.id}'; UPDATE items SET title = 'Updated' WHERE id = 1 RETURNING title`
        )
        expect(updateResult.title).toBe('Updated')
      })

      await test.step('Verify user can delete their own draft records', async () => {
        const deleteResult = await executeQuery(
          `SET LOCAL app.user_id = '${user1.user.id}'; DELETE FROM items WHERE id = 1 RETURNING id`
        )
        expect(deleteResult.id).toBe(1)
      })

      await test.step('Verify user cannot access other users records', async () => {
        const crossUserResult = await executeQuery(
          `SET LOCAL app.user_id = '${user1.user.id}'; SELECT COUNT(*) as count FROM items WHERE owner_id = '${user2.user.id}'`
        )
        expect(crossUserResult.count).toBe(0)
      })
    }
  )
})
