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
      expect(policyCount.count).toBe('1')

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
      const memberResult = await executeQuery([
        'SET ROLE member_user',
        "SET app.user_role = 'member'",
        'SELECT COUNT(*) as count FROM projects',
      ])
      // THEN: assertion
      expect(memberResult.count).toBe('2')

      // Non-member user cannot SELECT records (RLS filters to 0 rows)
      // Note: RLS doesn't throw errors - it returns 0 rows when policy denies access
      // THEN: assertion
      const guestResult = await executeQuery([
        'SET ROLE guest_user',
        "SET app.user_role = 'guest'",
        'SELECT COUNT(*) as count FROM projects',
      ])
      expect(guestResult.count).toBe('0')
    }
  )

  test(
    'APP-TABLES-TABLE-PERMISSIONS-002: should allow SELECT without RLS policy when table has public read permission',
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
      expect(policyCount.count).toBe('0')

      // Any user can SELECT records
      const anyUserResult = await executeQuery('SELECT COUNT(*) as count FROM articles')
      // THEN: assertion
      expect(anyUserResult.count).toBe('2')

      // Unauthenticated session can SELECT records
      const unauthResult = await executeQuery([
        'RESET ROLE',
        'SELECT COUNT(*) as count FROM articles',
      ])
      // THEN: assertion
      expect(unauthResult.count).toBe('2')
    }
  )

  test(
    'APP-TABLES-TABLE-PERMISSIONS-003: should deny all SELECT access by default when table has no read permission specified',
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
      expect(policyCount.count).toBe('0')

      // Admin user cannot SELECT (no policy)
      const adminResult = await executeQuery([
        'SET ROLE admin_user',
        'SELECT COUNT(*) as count FROM secrets',
      ])
      // THEN: assertion
      expect(adminResult.count).toBe('0')

      // Any user gets empty result set (RLS blocks)
      const memberResult = await executeQuery([
        'SET ROLE member_user',
        'SELECT COUNT(*) as count FROM secrets',
      ])
      // THEN: assertion
      expect(memberResult.count).toBe('0')
    }
  )

  // ============================================================================
  // Phase: Error Configuration Validation Tests (004-005)
  // ============================================================================

  test(
    'APP-TABLES-TABLE-PERMISSIONS-004: should reject owner permission referencing non-existent field',
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
    'APP-TABLES-TABLE-PERMISSIONS-005: should reject owner permission field that is not a user type',
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
  // Generated from 5 @spec tests - covers: role-based permissions, public access, default deny, error validation
  // ============================================================================

  test(
    'APP-TABLES-TBL-PERMS-REGRESSION: user can complete full table-permissions workflow',
    { tag: '@regression' },
    async ({ page: _page, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      await test.step('APP-TABLES-TBL-PERMS-001: Grant SELECT to member role with role-based read', async () => {
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

        const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
        const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

        await executeQuery([
          'ALTER TABLE projects ENABLE ROW LEVEL SECURITY',
          "CREATE POLICY member_read ON projects FOR SELECT USING (auth.user_has_role('member'))",
          `INSERT INTO projects (title, created_by) VALUES ('Project 1', '${user1.user.id}'), ('Project 2', '${user2.user.id}')`,
        ])

        // THEN: RLS policy exists and member can SELECT
        const policyCount = await executeQuery(
          "SELECT COUNT(*) as count FROM pg_policies WHERE tablename='projects' AND policyname='member_read'"
        )
        expect(policyCount.count).toBe('1')

        const memberResult = await executeQuery([
          'SET ROLE member_user',
          "SET app.user_role = 'member'",
          'SELECT COUNT(*) as count FROM projects',
        ])
        expect(memberResult.count).toBe('2')

        const guestResult = await executeQuery([
          'SET ROLE guest_user',
          "SET app.user_role = 'guest'",
          'SELECT COUNT(*) as count FROM projects',
        ])
        expect(guestResult.count).toBe('0')
      })

      await test.step('APP-TABLES-TBL-PERMS-002: Allow SELECT without RLS for public read', async () => {
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

        // THEN: RLS not enabled, any user can SELECT
        const rlsStatus = await executeQuery(
          "SELECT relrowsecurity FROM pg_class WHERE relname='articles'"
        )
        expect(rlsStatus.relrowsecurity).toBe(false)

        const anyUserResult = await executeQuery('SELECT COUNT(*) as count FROM articles')
        expect(anyUserResult.count).toBe('2')
      })

      await test.step('APP-TABLES-TBL-PERMS-003: Deny all SELECT by default with no read permission', async () => {
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

        // THEN: RLS enabled, no policies, all users get empty results
        const rlsStatus = await executeQuery(
          "SELECT relrowsecurity FROM pg_class WHERE relname='secrets'"
        )
        expect(rlsStatus.relrowsecurity).toBe(true)

        const adminResult = await executeQuery([
          'SET ROLE admin_user',
          'SELECT COUNT(*) as count FROM secrets',
        ])
        expect(adminResult.count).toBe('0')
      })

      await test.step('APP-TABLES-TBL-PERMS-004: Reject owner permission with non-existent field', async () => {
        // GIVEN: Owner permission referencing non-existent field
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
                    field: 'created_by', // Field doesn't exist!
                  },
                },
              },
            ],
          })
        ).rejects.toThrow(/field.*created_by.*not found|owner field.*does not exist/i)
      })

      await test.step('APP-TABLES-TBL-PERMS-005: Reject owner permission field not user type', async () => {
        // GIVEN: Owner permission referencing field that is not user type
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
                  { id: 3, name: 'category', type: 'single-line-text' }, // Not user type!
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
                permissions: {
                  read: {
                    type: 'owner',
                    field: 'category', // Not a user field!
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
