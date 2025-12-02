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
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Table-Level Permissions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-TABLES-TABLE-PERMISSIONS-001: should grant SELECT access to user with member role when table has role-based read permission',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table with role-based read permission for 'member' role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'created_by', type: 'integer' },
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

      await executeQuery([
        'ALTER TABLE projects ENABLE ROW LEVEL SECURITY',
        "CREATE POLICY member_read ON projects FOR SELECT USING (auth.user_has_role('member'))",
        "INSERT INTO projects (title, created_by) VALUES ('Project 1', 1), ('Project 2', 2)",
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
      expect(policyDetails).toEqual({
        cmd: 'SELECT',
        qual: "auth.user_has_role('member'::text)",
      })

      // Member user can SELECT records
      const memberResult = await executeQuery(
        'SET ROLE member_user; SELECT COUNT(*) as count FROM projects'
      )
      // THEN: assertion
      expect(memberResult.count).toBe(2)

      // Non-member user cannot SELECT records
      // THEN: assertion
      await expect(async () => {
        await executeQuery('SET ROLE guest_user; SELECT COUNT(*) as count FROM projects')
      }).rejects.toThrow('permission denied for table projects')
    }
  )

  test.fixme(
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

      await executeQuery([
        'ALTER TABLE documents ENABLE ROW LEVEL SECURITY',
        "CREATE POLICY admin_create ON documents FOR INSERT WITH CHECK (auth.user_has_role('admin'))",
      ])

      // WHEN: user with 'member' role attempts to create record
      // THEN: PostgreSQL RLS policy denies INSERT access

      // RLS policy exists for admin create
      const policyCount = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='documents' AND policyname='admin_create'"
      )
      // THEN: assertion
      expect(policyCount.count).toBe(1)

      // Policy uses WITH CHECK clause for INSERT
      const policyDetails = await executeQuery(
        "SELECT cmd, with_check FROM pg_policies WHERE tablename='documents' AND policyname='admin_create'"
      )
      // THEN: assertion
      expect(policyDetails).toEqual({
        cmd: 'INSERT',
        with_check: "auth.user_has_role('admin'::text)",
      })

      // Admin user can INSERT records
      const adminInsert = await executeQuery(
        "SET ROLE admin_user; INSERT INTO documents (title) VALUES ('Doc 1') RETURNING id"
      )
      // THEN: assertion
      expect(adminInsert.id).toBe(1)

      // Member user cannot INSERT records
      // THEN: assertion
      await expect(async () => {
        await executeQuery("SET ROLE member_user; INSERT INTO documents (title) VALUES ('Doc 2')")
      }).rejects.toThrow('new row violates row-level security policy')
    }
  )

  test.fixme(
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

  test.fixme(
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

      await executeQuery([
        'ALTER TABLE profiles ENABLE ROW LEVEL SECURITY',
        'CREATE POLICY authenticated_update ON profiles FOR UPDATE USING (auth.is_authenticated()) WITH CHECK (auth.is_authenticated())',
        "INSERT INTO profiles (name, bio) VALUES ('Alice', 'Bio 1')",
      ])

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
      expect(policyDetails).toEqual({
        cmd: 'UPDATE',
        qual: 'auth.is_authenticated()',
        with_check: 'auth.is_authenticated()',
      })

      // Authenticated user can UPDATE records
      const authUpdate = await executeQuery(
        "SET ROLE authenticated_user; UPDATE profiles SET bio = 'Updated bio' WHERE id = 1 RETURNING bio"
      )
      // THEN: assertion
      expect(authUpdate.bio).toBe('Updated bio')

      // Unauthenticated user cannot UPDATE records
      // THEN: assertion
      await expect(async () => {
        await executeQuery("RESET ROLE; UPDATE profiles SET bio = 'Hacked' WHERE id = 1")
      }).rejects.toThrow('new row violates row-level security policy')
    }
  )

  test.fixme(
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
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-TABLE-PERMISSIONS-006: user can complete full table-permissions workflow',
    { tag: '@regression' },
    async ({ page: _page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative table-level permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
        tables: [
          {
            id: 6,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'single-line-text' },
              { id: 3, name: 'owner_id', type: 'integer' },
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

      await executeQuery([
        'ALTER TABLE data ENABLE ROW LEVEL SECURITY',
        'CREATE POLICY authenticated_read ON data FOR SELECT USING (auth.is_authenticated())',
        "CREATE POLICY admin_create ON data FOR INSERT WITH CHECK (auth.user_has_role('admin'))",
        "INSERT INTO data (content, owner_id) VALUES ('Data 1', 1)",
      ])

      // WHEN/THEN: Streamlined workflow testing integration points

      // Verify RLS policies exist
      const policies = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='data'"
      )
      // THEN: assertion
      expect(policies.count).toBe(2)

      // Authenticated user can read
      const readResult = await executeQuery(
        'SET ROLE authenticated_user; SELECT COUNT(*) as count FROM data'
      )
      // THEN: assertion
      expect(readResult.count).toBe(1)

      // Admin can create
      const createResult = await executeQuery(
        "SET ROLE admin_user; INSERT INTO data (content, owner_id) VALUES ('Data 2', 2) RETURNING id"
      )
      // THEN: assertion
      expect(createResult.id).toBe(2)

      // Non-admin cannot create
      // THEN: assertion
      await expect(async () => {
        await executeQuery(
          "SET ROLE member_user; INSERT INTO data (content, owner_id) VALUES ('Data 3', 3)"
        )
      }).rejects.toThrow()

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
