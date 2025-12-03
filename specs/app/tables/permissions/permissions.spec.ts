/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Table Permissions
 *
 * Source: src/domain/models/app/table/permissions/index.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Table Permissions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-PERMISSIONS-001: should deny access before field/record checks when user lacks table-level read permission',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: user without table-level read permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'admin_data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'secret', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: {
                type: 'roles',
                roles: ['admin'],
              },
            },
          },
        ],
      })

      await executeQuery([
        'ALTER TABLE admin_data ENABLE ROW LEVEL SECURITY',
        'ALTER TABLE admin_data FORCE ROW LEVEL SECURITY',
        "CREATE POLICY admin_only_select ON admin_data FOR SELECT USING (auth.user_has_role('admin'))",
        "CREATE POLICY admin_only_insert ON admin_data FOR INSERT WITH CHECK (auth.user_has_role('admin'))",
        'BEGIN',
        "SET LOCAL app.user_role = 'admin'",
        "INSERT INTO admin_data (secret) VALUES ('Secret 1')",
        'COMMIT',
      ])

      // WHEN: user attempts to list records
      // THEN: PostgreSQL RLS denies access before field/record checks
      const policyCount = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='admin_data'"
      )
      // THEN: assertion
      expect(policyCount.count).toBe(2)

      // Grant permissions to test roles
      // IMPORTANT: PostgreSQL superusers ALWAYS bypass RLS (even with FORCE ROW LEVEL SECURITY).
      // Must use non-superuser roles (admin_user, member_user) to properly test RLS policies.
      await executeQuery([
        'GRANT USAGE ON SCHEMA auth TO admin_user, member_user',
        'GRANT SELECT ON admin_data TO admin_user, member_user',
      ])

      // Admin user can SELECT records (switch to non-superuser role)
      const adminResult = await executeQuery([
        'BEGIN',
        'SET ROLE admin_user',
        "SET LOCAL app.user_role = 'admin'",
        'SELECT COUNT(*) as count FROM admin_data',
      ])
      // THEN: assertion
      expect(adminResult.count).toBe(1)

      // Member user cannot SELECT records (table-level denied)
      const memberResult = await executeQuery([
        'BEGIN',
        'SET ROLE member_user',
        "SET LOCAL app.user_role = 'member'",
        'SELECT COUNT(*) as count FROM admin_data',
      ])
      // THEN: assertion
      expect(memberResult.count).toBe(0)

      // Field/record permissions not evaluated when table-level denies
      const fieldPolicies = await executeQuery(
        "SELECT COUNT(*) as field_policies FROM pg_policies WHERE tablename='admin_data' AND policyname LIKE '%field%'"
      )
      // THEN: assertion
      expect(fieldPolicies.field_policies).toBe(0)
    }
  )

  test(
    'APP-TABLES-PERMISSIONS-002: should filter sensitive fields when user has table read permission but restricted field access',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: user with table read permission but restricted field access
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'single-line-text' },
              { id: 4, name: 'salary', type: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: {
                type: 'authenticated',
              },
              fields: [
                {
                  field: 'salary',
                  read: {
                    type: 'roles',
                    roles: ['admin'],
                  },
                },
              ],
            },
          },
        ],
      })

      await executeQuery([
        "INSERT INTO users (name, email, salary) VALUES ('Alice', 'alice@example.com', 75000.00)",
      ])

      // WHEN: user queries records
      // THEN: PostgreSQL allows table access but filters sensitive fields
      const authCount = await executeQuery([
        'SET ROLE authenticated_user',
        'SELECT COUNT(*) as count FROM users',
      ])
      // THEN: assertion
      expect(authCount.count).toBe(1)

      // Authenticated user can SELECT allowed fields
      const authFields = await executeQuery([
        'SET ROLE authenticated_user',
        'SELECT name, email FROM users WHERE id = 1',
      ])
      // THEN: assertion
      expect(authFields.name).toBe('Alice')
      expect(authFields.email).toBe('alice@example.com')

      // Authenticated user cannot SELECT salary field
      // THEN: assertion
      // Note: PostgreSQL's column-level GRANT restrictions return "permission denied for table"
      // error message, not "permission denied for column", when a restricted column is queried
      try {
        await executeQuery(['SET ROLE authenticated_user', 'SELECT salary FROM users WHERE id = 1'])
        throw new Error('Expected query to fail but it succeeded')
      } catch (error: any) {
        expect(error.message).toContain('permission denied for table users')
      }

      // Admin user can SELECT all fields including salary
      const adminFields = await executeQuery([
        'SET ROLE admin_user',
        'SELECT name, email, salary FROM users WHERE id = 1',
      ])
      // THEN: assertion
      expect(adminFields.name).toBe('Alice')
      expect(adminFields.email).toBe('alice@example.com')
      expect(adminFields.salary).toBe(75_000.0)
    }
  )

  test(
    'APP-TABLES-PERMISSIONS-003: should apply hierarchical checks (table → field → record filtering) when permissions configured at all three levels',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: permissions configured at all three levels (table + field + record)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 3,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'notes', type: 'single-line-text' },
              { id: 4, name: 'owner_id', type: 'user' },
              { id: 5, name: 'status', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: {
                type: 'authenticated',
              },
              fields: [
                {
                  field: 'notes',
                  read: {
                    type: 'custom',
                    condition: '{userId} = owner_id',
                  },
                },
              ],
              records: [
                {
                  action: 'read',
                  condition: '{userId} = owner_id',
                },
              ],
            },
          },
        ],
      })

      await executeQuery([
        'ALTER TABLE tasks ENABLE ROW LEVEL SECURITY',
        'CREATE POLICY authenticated_read ON tasks FOR SELECT USING (auth.is_authenticated())',
        "CREATE POLICY owner_records ON tasks FOR SELECT USING (owner_id = current_setting('app.user_id')::TEXT)",
        "INSERT INTO tasks (title, notes, owner_id, status) VALUES ('Task 1', 'Private notes 1', '1', 'open'), ('Task 2', 'Private notes 2', '2', 'open')",
      ])

      // WHEN: user accesses table
      // THEN: PostgreSQL applies hierarchical checks: table → field → record filtering

      // Unauthenticated user denied at table level
      await expect(async () => {
        await executeQuery('RESET ROLE; SELECT COUNT(*) as count FROM tasks')
      }).rejects.toThrow('permission denied for table tasks')

      // Authenticated user passes table level, filtered by record level
      const userCount = await executeQuery(
        'SET LOCAL app.user_id = 1; SELECT COUNT(*) as count FROM tasks'
      )
      // THEN: assertion
      expect(userCount.count).toBe(1)

      // User 1 sees only their task (record-level filter)
      const userTask = await executeQuery('SET LOCAL app.user_id = 1; SELECT title FROM tasks')
      // THEN: assertion
      expect(userTask.title).toBe('Task 1')

      // User 1 can read notes on their own task (field-level allows)
      const userNotes = await executeQuery(
        'SET LOCAL app.user_id = 1; SELECT title, notes FROM tasks WHERE id = 1'
      )
      // THEN: assertion
      expect(userNotes).toEqual({
        title: 'Task 1',
        notes: 'Private notes 1',
      })
    }
  )

  test(
    'APP-TABLES-PERMISSIONS-004: should block all access by default when table has no permissions configured',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with no permissions configured (default deny)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'confidential',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'data', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await executeQuery([
        'ALTER TABLE confidential ENABLE ROW LEVEL SECURITY',
        "INSERT INTO confidential (data) VALUES ('Confidential 1')",
      ])

      // WHEN: any user attempts to access table
      // THEN: PostgreSQL RLS blocks all access by default

      // RLS is enabled
      const rlsEnabled = await executeQuery(
        "SELECT relrowsecurity FROM pg_class WHERE relname='confidential'"
      )
      // THEN: assertion
      expect(rlsEnabled.relrowsecurity).toBe(true)

      // No policies exist (default deny)
      const policyCount = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='confidential'"
      )
      // THEN: assertion
      expect(policyCount.count).toBe(0)

      // Admin user gets empty result (RLS blocks)
      const adminResult = await executeQuery([
        'SET ROLE admin_user',
        'SELECT COUNT(*) as count FROM confidential',
      ])
      // THEN: assertion
      expect(adminResult.count).toBe(0)

      // Any user gets empty result (default deny)
      const userResult = await executeQuery([
        'SET ROLE authenticated_user',
        'SELECT COUNT(*) as count FROM confidential',
      ])
      // THEN: assertion
      expect(userResult.count).toBe(0)
    }
  )

  test(
    'APP-TABLES-PERMISSIONS-005: should enforce all layers (public access, field filtering, record filtering) with complete permission hierarchy',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: complete permission hierarchy with table=public, field=restricted, record=owner-only
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 5,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'body', type: 'single-line-text' },
              { id: 4, name: 'draft', type: 'checkbox' },
              { id: 5, name: 'author_id', type: 'user' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: {
                type: 'public',
              },
              fields: [
                {
                  field: 'body',
                  read: {
                    type: 'authenticated',
                  },
                },
              ],
              records: [
                {
                  action: 'read',
                  condition: 'draft = false OR {userId} = author_id',
                },
              ],
            },
          },
        ],
      })

      await executeQuery([
        'ALTER TABLE posts ENABLE ROW LEVEL SECURITY',
        "CREATE POLICY published_or_owner ON posts FOR SELECT USING (draft = false OR author_id = current_setting('app.user_id')::INTEGER)",
        "INSERT INTO posts (title, body, draft, author_id) VALUES ('Published Post', 'Public content', false, 1), ('Draft Post', 'Private draft', true, 1), ('Other Draft', 'Other private', true, 2)",
      ])

      // WHEN: different users access table
      // THEN: PostgreSQL enforces all layers: public access, field filtering, record filtering

      // Unauthenticated user sees published posts only (record filter)
      const publicCount = await executeQuery('RESET ROLE; SELECT COUNT(*) as count FROM posts')
      // THEN: assertion
      expect(publicCount.count).toBe(1)

      // Unauthenticated user can see title but not body (field filter)
      const publicTitle = await executeQuery('RESET ROLE; SELECT title FROM posts')
      // THEN: assertion
      expect(publicTitle.title).toBe('Published Post')

      // Author sees published + their own drafts (2 records)
      const authorCount = await executeQuery(
        'SET LOCAL app.user_id = 1; SELECT COUNT(*) as count FROM posts'
      )
      // THEN: assertion
      expect(authorCount.count).toBe(2)

      // Author can read body field on their posts
      const authorPost = await executeQuery(
        'SET LOCAL app.user_id = 1; SELECT title, body FROM posts WHERE id = 2'
      )
      // THEN: assertion
      expect(authorPost).toEqual({
        title: 'Draft Post',
        body: 'Private draft',
      })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-PERMISSIONS-006: user can complete full permissions workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      await test.step('Setup: Start server with hierarchical permissions', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
          },
          tables: [
            {
              id: 6,
              name: 'documents',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
                { id: 3, name: 'content', type: 'single-line-text' },
                { id: 4, name: 'salary_info', type: 'single-line-text' },
                { id: 5, name: 'author_id', type: 'user' },
                { id: 6, name: 'status', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                read: {
                  type: 'authenticated',
                },
                fields: [
                  {
                    field: 'salary_info',
                    read: {
                      type: 'roles',
                      roles: ['admin'],
                    },
                  },
                ],
                records: [
                  {
                    action: 'read',
                    condition: "{userId} = author_id OR status = 'published'",
                  },
                ],
              },
            },
          ],
        })
      })

      let user1: Awaited<ReturnType<typeof createAuthenticatedUser>>
      let user2: Awaited<ReturnType<typeof createAuthenticatedUser>>
      let user3: Awaited<ReturnType<typeof createAuthenticatedUser>>

      await test.step('Create RLS policies and insert test data', async () => {
        user1 = await createAuthenticatedUser({ name: 'User 1', email: 'user1@example.com' })
        user2 = await createAuthenticatedUser({ name: 'User 2', email: 'user2@example.com' })
        user3 = await createAuthenticatedUser({ name: 'User 3', email: 'user3@example.com' })

        await executeQuery([
          'ALTER TABLE documents ENABLE ROW LEVEL SECURITY',
          'CREATE POLICY authenticated_read ON documents FOR SELECT USING (auth.is_authenticated())',
          "CREATE POLICY owner_or_published ON documents FOR SELECT USING (author_id = current_setting('app.user_id')::TEXT OR status = 'published')",
          `INSERT INTO documents (title, content, salary_info, author_id, status) VALUES ('Public Doc', 'Content', 'Confidential', '${user1.user.id}', 'published'), ('Private Doc', 'Private', 'Secret', '${user2.user.id}', 'draft')`,
        ])
      })

      await test.step('Verify hierarchical permission structure exists', async () => {
        const policies = await executeQuery(
          "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='documents'"
        )
        expect(policies.count).toBeGreaterThan(0)
      })

      await test.step('Verify authenticated user can access published documents', async () => {
        const userDocs = await executeQuery([
          `SET LOCAL app.user_id = '${user3.user.id}'`,
          "SELECT COUNT(*) as count FROM documents WHERE status = 'published'",
        ])
        expect(userDocs.count).toBe(1)
      })

      await test.step('Verify field-level restriction for non-admin users', async () => {
        await expect(async () => {
          await executeQuery([
            'SET ROLE member_user',
            `SET LOCAL app.user_id = '${user1.user.id}'`,
            'SELECT salary_info FROM documents WHERE id = 1',
          ])
        }).rejects.toThrow('permission denied')
      })

      await test.step('Verify admin can see restricted fields', async () => {
        const adminFields = await executeQuery([
          'SET ROLE admin_user',
          `SET LOCAL app.user_id = '${user1.user.id}'`,
          'SELECT title, salary_info FROM documents WHERE id = 1',
        ])
        expect(adminFields.title).toBe('Public Doc')
        expect(adminFields.salary_info).toBe('Confidential')
      })
    }
  )
})
