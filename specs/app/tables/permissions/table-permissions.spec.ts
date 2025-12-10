/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Table-Level Permissions
 *
 * Source: src/domain/models/app/table/permissions/index.ts
 * Domain: app
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Table-Level Permissions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-TABLE-PERMISSIONS-001: should grant SELECT access to user with member role when table has role-based read permission',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: table with role-based read permission for 'member' role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'created_by', type: 'user' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: {
                type: 'roles',
                roles: ['member'],
              },
            },
          },
        ],
      })

      // Create test users
      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

      await executeQuery([
        'ALTER TABLE projects ENABLE ROW LEVEL SECURITY',
        "CREATE POLICY member_read ON projects FOR SELECT USING (auth.user_has_role('member'))",
        `INSERT INTO projects (title, created_by) VALUES ('Project 1', '${user1.user.id}'), ('Project 2', '${user2.user.id}')`,
      ])

      // WHEN: user with 'member' role requests records
      // THEN: PostgreSQL RLS policy grants SELECT access

      // RLS policy exists for member role
      const policyCount = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='projects' AND policyname='member_read'"
      )
      // THEN: assertion
      expect(policyCount.count).toBe(1)

      // Policy uses USING clause for SELECT
      const policyDetails = await executeQuery(
        "SELECT cmd, qual FROM pg_policies WHERE tablename='projects' AND policyname='member_read'"
      )
      // THEN: assertion
      expect(policyDetails).toMatchObject({
        cmd: 'SELECT',
        qual: "auth.user_has_role('member'::text)",
      })

      // Member user can SELECT records
      const memberResult = await executeQuery(
        "SET ROLE member_user; SET app.user_role = 'member'; SELECT COUNT(*) as count FROM projects"
      )
      // THEN: assertion
      expect(memberResult.count).toBe(2)

      // Non-member user cannot SELECT records
      // THEN: assertion
      await expect(async () => {
        await executeQuery(
          "SET ROLE guest_user; SET app.user_role = 'guest'; SELECT COUNT(*) as count FROM projects"
        )
      }).rejects.toThrow('permission denied for table projects')
    }
  )

  test(
    'APP-TABLES-TABLE-PERMISSIONS-002: should deny INSERT access when user with member role attempts to create record with admin-only create permission',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table with role-based create permission for 'admin' role only
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              create: {
                type: 'roles',
                roles: ['admin'],
              },
            },
          },
        ],
      })

      // RLS policies are auto-created by the server based on permissions config
      // Grant privileges to test users for execution
      await executeQuery([
        'GRANT ALL PRIVILEGES ON documents TO admin_user, member_user',
        'GRANT ALL PRIVILEGES ON SEQUENCE documents_id_seq TO admin_user, member_user',
      ])

      // WHEN: user with 'member' role attempts to create record
      // THEN: PostgreSQL RLS policy denies INSERT access

      // RLS policy exists for role-based create (auto-generated as documents_role_create)
      const policyCount = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='documents' AND policyname='documents_role_create'"
      )
      // THEN: assertion
      expect(policyCount.count).toBe(1)

      // Policy uses WITH CHECK clause for INSERT
      const policyDetails = await executeQuery(
        "SELECT cmd, with_check FROM pg_policies WHERE tablename='documents' AND policyname='documents_role_create'"
      )
      // THEN: assertion
      expect(policyDetails).toMatchObject({
        cmd: 'INSERT',
        with_check: "auth.user_has_role('admin'::text)",
      })

      // Admin user can INSERT records
      const adminInsert = await executeQuery(
        "SET ROLE admin_user; SET app.user_role = 'admin'; INSERT INTO documents (title) VALUES ('Doc 1') RETURNING id"
      )
      // THEN: assertion
      expect(adminInsert.id).toBe(1)

      // Member user cannot INSERT records
      // THEN: assertion
      let memberInsertFailed = false
      let errorMessage = ''
      try {
        await executeQuery(
          "SET ROLE member_user; SET app.user_role = 'member'; INSERT INTO documents (title) VALUES ('Doc 2')"
        )
      } catch (error) {
        memberInsertFailed = true
        errorMessage = error instanceof Error ? error.message : String(error)
        expect(errorMessage).toContain('new row violates row-level security policy')
      }
      expect(memberInsertFailed).toBe(true)
    }
  )

  test(
    'APP-TABLES-TABLE-PERMISSIONS-003: should allow SELECT without RLS policy when table has public read permission',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table with public read permission
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'content', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: {
                type: 'public',
              },
            },
          },
        ],
      })

      await executeQuery([
        "INSERT INTO articles (title, content) VALUES ('Article 1', 'Content 1'), ('Article 2', 'Content 2')",
      ])

      // WHEN: unauthenticated user requests records
      // THEN: PostgreSQL allows SELECT without RLS policy (public access)

      // RLS is not enabled for public tables
      const rlsStatus = await executeQuery(
        "SELECT relrowsecurity FROM pg_class WHERE relname='articles'"
      )
      // THEN: assertion
      expect(rlsStatus.relrowsecurity).toBe(false)

      // No RLS policies exist
      const policyCount = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='articles'"
      )
      // THEN: assertion
      expect(policyCount.count).toBe(0)

      // Any user can SELECT records
      const anyUserResult = await executeQuery('SELECT COUNT(*) as count FROM articles')
      // THEN: assertion
      expect(anyUserResult.count).toBe(2)

      // Unauthenticated session can SELECT records
      const unauthResult = await executeQuery('RESET ROLE; SELECT COUNT(*) as count FROM articles')
      // THEN: assertion
      expect(unauthResult.count).toBe(2)
    }
  )

  test(
    'APP-TABLES-TABLE-PERMISSIONS-004: should grant UPDATE access to authenticated users when table has authenticated-only update permission',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table with authenticated-only update permission
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'profiles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'bio', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              update: {
                type: 'authenticated',
              },
            },
          },
        ],
      })

      // Insert test data (RLS policies are auto-generated from permissions config)
      await executeQuery(["INSERT INTO profiles (id, name, bio) VALUES (1, 'Alice', 'Bio 1')"])

      // WHEN: authenticated user attempts to update record
      // THEN: PostgreSQL RLS policy grants UPDATE access to authenticated users

      // RLS policy exists for authenticated update
      const policyCount = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='profiles' AND policyname='authenticated_update'"
      )
      // THEN: assertion
      expect(policyCount.count).toBe(1)

      // Policy uses both USING and WITH CHECK
      const policyDetails = await executeQuery(
        "SELECT cmd, qual, with_check FROM pg_policies WHERE tablename='profiles' AND policyname='authenticated_update'"
      )
      // THEN: assertion
      expect(policyDetails).toMatchObject({
        cmd: 'UPDATE',
        qual: 'auth.is_authenticated()',
        with_check: 'auth.is_authenticated()',
      })

      // Authenticated user can UPDATE records
      const authUpdate = await executeQuery([
        "SET LOCAL app.user_id = 'test-user-123'",
        "UPDATE profiles SET bio = 'Updated bio' WHERE id = 1 RETURNING bio",
      ])
      // THEN: assertion
      expect(authUpdate.bio).toBe('Updated bio')

      // Unauthenticated user cannot UPDATE records
      // THEN: assertion
      try {
        // Switch to non-superuser role without setting app.user_id (unauthenticated)
        await executeQuery("SET ROLE authenticated_user; UPDATE profiles SET bio = 'Hacked' WHERE id = 1")
        throw new Error('Expected UPDATE to fail for unauthenticated user')
      } catch (error: any) {
        expect(error.message).toContain('new row violates row-level security policy')
      }
    }
  )

  test(
    'APP-TABLES-TABLE-PERMISSIONS-005: should deny all SELECT access by default when table has no read permission specified',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table with no read permission specified (default deny)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'secrets',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'data', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {},
          },
        ],
      })

      await executeQuery([
        'ALTER TABLE secrets ENABLE ROW LEVEL SECURITY',
        "INSERT INTO secrets (data) VALUES ('Secret 1')",
      ])

      // WHEN: any user attempts to read records
      // THEN: PostgreSQL RLS policy denies all SELECT access by default

      // RLS is enabled
      const rlsStatus = await executeQuery(
        "SELECT relrowsecurity FROM pg_class WHERE relname='secrets'"
      )
      // THEN: assertion
      expect(rlsStatus.relrowsecurity).toBe(true)

      // No SELECT policies exist (default deny)
      const policyCount = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='secrets' AND cmd='SELECT'"
      )
      // THEN: assertion
      expect(policyCount.count).toBe(0)

      // Admin user cannot SELECT (no policy)
      const adminResult = await executeQuery(
        'SET ROLE admin_user; SELECT COUNT(*) as count FROM secrets'
      )
      // THEN: assertion
      expect(adminResult.count).toBe(0)

      // Any user gets empty result set (RLS blocks)
      const memberResult = await executeQuery(
        'SET ROLE member_user; SELECT COUNT(*) as count FROM secrets'
      )
      // THEN: assertion
      expect(memberResult.count).toBe(0)
    }
  )

  // ============================================================================
  // Phase: Error Configuration Validation Tests (006-007)
  // ============================================================================

  test(
    'APP-TABLES-TABLE-PERMISSIONS-006: should reject owner permission referencing non-existent field',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Owner permission referencing non-existent field
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'documents',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                read: {
                  type: 'owner',
                  field: 'created_by', // 'created_by' field doesn't exist!
                },
              },
            },
          ],
        })
      ).rejects.toThrow(/field.*created_by.*not found|owner field.*does not exist/i)
    }
  )

  test(
    'APP-TABLES-TABLE-PERMISSIONS-007: should reject owner permission field that is not a user type',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Owner permission referencing field that is not user type
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'documents',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
                { id: 3, name: 'category', type: 'single-line-text' }, // text field, not user!
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                read: {
                  type: 'owner',
                  field: 'category', // not a user field!
                },
              },
            },
          ],
        })
      ).rejects.toThrow(/owner.*field.*must be.*user|field.*category.*not.*user type/i)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-TABLE-PERMISSIONS-008: user can complete full table-permissions workflow',
    { tag: '@regression' },
    async ({ page: _page, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      let user1: any

      await test.step('Setup: Start server with table-level permissions', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
          },
          tables: [
            {
              id: 6,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'content', type: 'single-line-text' },
                { id: 3, name: 'owner_id', type: 'user' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                read: {
                  type: 'authenticated',
                },
                create: {
                  type: 'roles',
                  roles: ['admin'],
                },
              },
            },
          ],
        })
      })

      await test.step('Create test user and verify RLS policies were auto-created', async () => {
        user1 = await createAuthenticatedUser({ email: 'user1@example.com' })

        // Insert test data (RLS policies are auto-created by the server based on permissions config)
        await executeQuery(`INSERT INTO data (content, owner_id) VALUES ('Data 1', '${user1.user.id}')`)
      })

      await test.step('Verify RLS policies exist', async () => {
        const policies = await executeQuery(
          "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='data'"
        )
        expect(policies.count).toBe(2)
      })

      await test.step('Verify authenticated user can read', async () => {
        // Set session context to simulate authenticated user, then switch role
        const readResult = await executeQuery(
          `SET app.user_id = '${user1.user.id}'; SET ROLE authenticated_user; SELECT COUNT(*) as count FROM data`
        )
        expect(readResult.count).toBe(1)
      })

      await test.step('Verify admin can create', async () => {
        // Set user context and role for admin user, then switch database role
        const createResult = await executeQuery(
          `SET app.user_id = '${user1.user.id}'; SET app.user_role = 'admin'; SET ROLE admin_user; INSERT INTO data (content, owner_id) VALUES ('Data 2', '${user1.user.id}') RETURNING id`
        )
        expect(createResult.id).toBe(2)
      })

      await test.step('Verify non-admin cannot create', async () => {
        await expect(async () => {
          await executeQuery(
            "SET ROLE member_user; INSERT INTO data (content, owner_id) VALUES ('Data 3', 3)"
          )
        }).rejects.toThrow()
      })

      await test.step('Error handling: owner permission referencing non-existent field', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error',
            tables: [
              {
                id: 99,
                name: 'invalid',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'title', type: 'single-line-text' },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
                permissions: {
                  read: {
                    type: 'owner',
                    field: 'created_by', // 'created_by' field doesn't exist!
                  },
                },
              },
            ],
          })
        ).rejects.toThrow(/field.*created_by.*not found|owner field.*does not exist/i)
      })

      await test.step('Error handling: owner permission field that is not a user type', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error2',
            tables: [
              {
                id: 98,
                name: 'invalid2',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'title', type: 'single-line-text' },
                  { id: 3, name: 'category', type: 'single-line-text' }, // text field, not user!
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
                permissions: {
                  read: {
                    type: 'owner',
                    field: 'category', // not a user field!
                  },
                },
              },
            ],
          })
        ).rejects.toThrow(/owner.*field.*must be.*user|field.*category.*not.*user type/i)
      })
    }
  )
})
