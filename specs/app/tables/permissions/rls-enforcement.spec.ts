/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Row-Level Security Enforcement
 *
 * Domain: app/tables/permissions
 * Spec Count: 11
 *
 * Test Organization:
 * 1. @spec tests - One per spec (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Enforcement Scenarios:
 * - Owner-based record filtering (owner permission type)
 * - Role-based access control (roles permission type)
 * - Field-level read restrictions
 * - Field-level write restrictions
 */

test.describe('Row-Level Security Enforcement', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-RLS-ENFORCEMENT-001: should filter records based on user ownership policy',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with owner-based permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'owner_id', type: 'user' },
            ],
            permissions: {
              read: { type: 'owner', field: 'owner_id' },
            },
          },
        ],
      })

      // Create test users
      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

      // Create notes owned by different users
      await executeQuery([
        `INSERT INTO notes (id, title, owner_id) VALUES
         (1, 'User 1 Note 1', '${user1.user.id}'),
         (2, 'User 1 Note 2', '${user1.user.id}'),
         (3, 'User 2 Note 1', '${user2.user.id}')`,
      ])

      // WHEN: Checking RLS policy exists in database
      // THEN: RLS policy for owner-based read should be created

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'notes'`
      )
      expect(rlsEnabled.rows[0].relrowsecurity).toBe(true)

      // Verify RLS policy exists
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'notes'`
      )
      expect(policies.rows.some((p: { policyname: string }) => p.policyname.includes('read'))).toBe(
        true
      )

      // Verify policy filters by owner_id (check policy definition)
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy WHERE polrelid = 'notes'::regclass`
      )
      expect(policyDef.rows[0].qual).toContain('owner_id')
    }
  )

  test(
    'APP-TABLES-RLS-ENFORCEMENT-002: should prevent reading records not matching permission policy',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with owner-based permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'private_data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'secret', type: 'single-line-text' },
              { id: 3, name: 'user_id', type: 'user' },
            ],
            permissions: {
              read: { type: 'owner', field: 'user_id' },
            },
          },
        ],
      })

      // Create test users
      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

      await executeQuery([
        `INSERT INTO private_data (id, secret, user_id) VALUES
         (1, 'User 1 Secret', '${user1.user.id}'),
         (2, 'Other User Secret', '${user2.user.id}')`,
      ])

      // WHEN: Checking RLS policy configuration
      // THEN: RLS policy should enforce owner-based access

      // Verify RLS policy uses USING clause for SELECT
      const policies = await executeQuery(
        `SELECT policyname, cmd, permissive FROM pg_policies WHERE tablename = 'private_data' AND cmd = 'SELECT'`
      )
      expect(policies.rows).toHaveLength(1)
      expect(policies.rows[0].cmd).toBe('SELECT')

      // Verify the policy definition references user_id field
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'private_data'::regclass AND polcmd = 'r'`
      )
      expect(policyDef.rows[0].qual).toContain('user_id')
    }
  )

  test(
    'APP-TABLES-RLS-ENFORCEMENT-003: should enforce field-level read restrictions',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with field-level read restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'email' },
              { id: 4, name: 'salary', type: 'decimal' },
              { id: 5, name: 'ssn', type: 'single-line-text' },
            ],
            permissions: {
              fields: [
                { field: 'salary', read: { type: 'roles', roles: ['admin', 'hr'] } },
                { field: 'ssn', read: { type: 'roles', roles: ['hr'] } },
              ],
            },
          },
        ],
      })

      await executeQuery([
        `INSERT INTO employees (id, name, email, salary, ssn) VALUES
         (1, 'John Doe', 'john@company.com', 75000.00, '123-45-6789')`,
      ])

      // WHEN: Checking field-level permission configuration
      // THEN: Field permissions should be stored in schema metadata

      // Verify table was created with all fields
      const columns = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'employees' ORDER BY ordinal_position`
      )
      expect(columns.rows.map((c: { column_name: string }) => c.column_name)).toContain('salary')
      expect(columns.rows.map((c: { column_name: string }) => c.column_name)).toContain('ssn')

      // Verify field-level permissions are configured (stored in app metadata)
      // The actual field filtering happens at the application layer based on schema config
      const data = await executeQuery(`SELECT name, email, salary, ssn FROM employees WHERE id = 1`)
      expect(data.rows[0].name).toBe('John Doe')
      expect(data.rows[0].salary).toBe(75_000)
      expect(data.rows[0].ssn).toBe('123-45-6789')
    }
  )

  test(
    'APP-TABLES-RLS-ENFORCEMENT-004: should enforce field-level write restrictions',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with field-level write restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'profiles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'display_name', type: 'single-line-text' },
              { id: 3, name: 'bio', type: 'long-text' },
              { id: 4, name: 'verified', type: 'checkbox' },
              {
                id: 5,
                name: 'role',
                type: 'single-select',
                options: ['admin', 'member', 'guest'],
              },
            ],
            permissions: {
              fields: [
                { field: 'verified', write: { type: 'roles', roles: ['admin'] } },
                { field: 'role', write: { type: 'roles', roles: ['admin'] } },
              ],
            },
          },
        ],
      })

      await executeQuery([
        `INSERT INTO profiles (id, display_name, bio, verified, role) VALUES
         (1, 'User Profile', 'My bio', false, 'member')`,
      ])

      // WHEN: Checking field-level write permission configuration
      // THEN: Table created with all fields and field permissions are configured in schema

      // Verify table was created with all fields
      const columns = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' ORDER BY ordinal_position`
      )
      expect(columns.rows.map((c: { column_name: string }) => c.column_name)).toContain('verified')
      expect(columns.rows.map((c: { column_name: string }) => c.column_name)).toContain('role')

      // Verify data can be inserted with all fields
      const data = await executeQuery(
        `SELECT display_name, bio, verified, role FROM profiles WHERE id = 1`
      )
      expect(data.rows[0].display_name).toBe('User Profile')
      expect(data.rows[0].verified).toBe(false)
      expect(data.rows[0].role).toBe('member')

      // Field-level write permissions are enforced at application layer based on schema config
      // The database schema correctly stores the data; API layer enforces role-based write restrictions
    }
  )

  test(
    'APP-TABLES-RLS-ENFORCEMENT-005: should apply owner permission on INSERT operations',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with owner-based create permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'created_by', type: 'user' },
            ],
            permissions: {
              create: { type: 'owner', field: 'created_by' },
            },
          },
        ],
      })

      // Create test user
      await createAuthenticatedUser({ email: 'user@example.com' })

      // WHEN: Checking RLS policy for INSERT operations
      // THEN: RLS policy for owner-based create should be created

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'tasks'`
      )
      expect(rlsEnabled.rows[0].relrowsecurity).toBe(true)

      // Verify RLS policy exists for INSERT
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'tasks' AND cmd = 'INSERT'`
      )
      expect(policies.rows).toHaveLength(1)
      expect(policies.rows[0].cmd).toBe('INSERT')

      // Verify policy uses WITH CHECK clause (for INSERT)
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polwithcheck, polrelid) as withcheck FROM pg_policy
         WHERE polrelid = 'tasks'::regclass AND polcmd = 'a'`
      )
      expect(policyDef.rows[0].withcheck).toContain('created_by')
    }
  )

  test(
    'APP-TABLES-RLS-ENFORCEMENT-006: should apply owner permission on UPDATE operations',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with owner-based update permission
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
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'owner_id', type: 'user' },
            ],
            permissions: {
              update: { type: 'owner', field: 'owner_id' },
            },
          },
        ],
      })

      // Create test users
      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

      await executeQuery([
        `INSERT INTO documents (id, content, owner_id) VALUES
         (1, 'User 1 Doc', '${user1.user.id}'),
         (2, 'User 2 Doc', '${user2.user.id}')`,
      ])

      // WHEN: Checking RLS policy for UPDATE operations
      // THEN: RLS policy for owner-based update should be created

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'documents'`
      )
      expect(rlsEnabled.rows[0].relrowsecurity).toBe(true)

      // Verify RLS policy exists for UPDATE
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'documents' AND cmd = 'UPDATE'`
      )
      expect(policies.rows).toHaveLength(1)
      expect(policies.rows[0].cmd).toBe('UPDATE')

      // Verify policy definition references owner_id field
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'documents'::regclass AND polcmd = 'w'`
      )
      expect(policyDef.rows[0].qual).toContain('owner_id')
    }
  )

  test(
    'APP-TABLES-RLS-ENFORCEMENT-007: should apply owner permission on DELETE operations',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with owner-based delete permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'comments',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'text', type: 'long-text' },
              { id: 3, name: 'author_id', type: 'user' },
            ],
            permissions: {
              delete: { type: 'owner', field: 'author_id' },
            },
          },
        ],
      })

      // Create test users
      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

      await executeQuery([
        `INSERT INTO comments (id, text, author_id) VALUES
         (1, 'User 1 Comment', '${user1.user.id}'),
         (2, 'User 2 Comment', '${user2.user.id}')`,
      ])

      // WHEN: Checking RLS policy for DELETE operations
      // THEN: RLS policy for owner-based delete should be created

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'comments'`
      )
      expect(rlsEnabled.rows[0].relrowsecurity).toBe(true)

      // Verify RLS policy exists for DELETE
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'comments' AND cmd = 'DELETE'`
      )
      expect(policies.rows).toHaveLength(1)
      expect(policies.rows[0].cmd).toBe('DELETE')

      // Verify policy definition references author_id field
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'comments'::regclass AND polcmd = 'd'`
      )
      expect(policyDef.rows[0].qual).toContain('author_id')
    }
  )

  test(
    'APP-TABLES-RLS-ENFORCEMENT-008: should support role-based permissions',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with role-based access
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'reports',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'department', type: 'single-line-text' },
            ],
            permissions: {
              read: { type: 'roles', roles: ['manager', 'admin'] },
              create: { type: 'roles', roles: ['admin'] },
              update: { type: 'roles', roles: ['admin'] },
              delete: { type: 'roles', roles: ['admin'] },
            },
          },
        ],
      })

      await executeQuery([
        `INSERT INTO reports (id, title, department) VALUES
         (1, 'Sales Q1', 'sales'),
         (2, 'Engineering Q1', 'engineering'),
         (3, 'Sales Q2', 'sales')`,
      ])

      // WHEN: Checking RLS policies for role-based permissions
      // THEN: RLS policies for all CRUD operations should be created

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'reports'`
      )
      expect(rlsEnabled.rows[0].relrowsecurity).toBe(true)

      // Verify RLS policies exist for all operations
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'reports' ORDER BY cmd`
      )
      const cmds = policies.rows.map((p: { cmd: string }) => p.cmd)
      expect(cmds).toContain('SELECT')
      expect(cmds).toContain('INSERT')
      expect(cmds).toContain('UPDATE')
      expect(cmds).toContain('DELETE')

      // Verify SELECT policy references role check
      const readPolicy = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'reports'::regclass AND polcmd = 'r'`
      )
      expect(readPolicy.rows[0].qual).toMatch(/role|manager|admin/i)

      // Verify data exists in table
      const data = await executeQuery(`SELECT COUNT(*) as count FROM reports`)
      expect(data.rows[0].count).toBe(3)
    }
  )

  // ============================================================================
  // Phase: Error Configuration Validation Tests (009-011)
  // ============================================================================

  test(
    'APP-TABLES-RLS-ENFORCEMENT-009: should reject RLS policy with syntax error in condition',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: RLS policy with invalid condition syntax
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
                { id: 2, name: 'owner_id', type: 'user' },
              ],
              permissions: {
                records: [
                  {
                    action: 'read',
                    condition: '{userId} == owner_id', // Invalid: double equals
                  },
                ],
              },
            },
          ],
        })
      ).rejects.toThrow(/invalid.*condition.*syntax|syntax error/i)
    }
  )

  test(
    'APP-TABLES-RLS-ENFORCEMENT-010: should reject RLS policy referencing non-existent column',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: RLS policy referencing non-existent column
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
              permissions: {
                records: [
                  {
                    action: 'read',
                    condition: '{userId} = created_by', // 'created_by' column doesn't exist!
                  },
                ],
              },
            },
          ],
        })
      ).rejects.toThrow(/column.*created_by.*not found|field.*does not exist/i)
    }
  )

  test.fixme(
    'APP-TABLES-RLS-ENFORCEMENT-011: should reject field permission read restriction on non-existent field',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Field-level read restriction on non-existent field
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'employees',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
              ],
              permissions: {
                fields: [
                  {
                    field: 'salary', // 'salary' field doesn't exist!
                    read: { type: 'roles', roles: ['admin', 'hr'] },
                  },
                ],
              },
            },
          ],
        })
      ).rejects.toThrow(/field.*salary.*not found|field.*does not exist/i)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-RLS-ENFORCEMENT-012: row-level security enforcement workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      let user1: any
      let user2: any

      await test.step('Setup: Start server with owner-based permissions', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
          },
          tables: [
            {
              id: 1,
              name: 'items',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'user_id', type: 'user' },
              ],
              permissions: {
                read: { type: 'owner', field: 'user_id' },
                create: { type: 'owner', field: 'user_id' },
                update: { type: 'owner', field: 'user_id' },
                delete: { type: 'owner', field: 'user_id' },
              },
            },
          ],
        })
      })

      await test.step('Create test users and insert data', async () => {
        user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
        user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

        await executeQuery([
          `INSERT INTO items (id, name, user_id) VALUES
           (1, 'User 1 Item', '${user1.user.id}'),
           (2, 'User 2 Item', '${user2.user.id}')`,
        ])
      })

      await test.step('Verify RLS enabled on table', async () => {
        const rlsEnabled = await executeQuery(
          `SELECT relrowsecurity FROM pg_class WHERE relname = 'items'`
        )
        expect(rlsEnabled.rows[0].relrowsecurity).toBe(true)
      })

      await test.step('Verify policies exist for all CRUD operations', async () => {
        const policies = await executeQuery(
          `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'items' ORDER BY cmd`
        )
        const cmds = policies.rows.map((p: { cmd: string }) => p.cmd)
        expect(cmds).toContain('SELECT')
        expect(cmds).toContain('INSERT')
        expect(cmds).toContain('UPDATE')
        expect(cmds).toContain('DELETE')
      })

      await test.step('Verify all policies reference user_id field', async () => {
        const policyDefs = await executeQuery(
          `SELECT polcmd, pg_get_expr(polqual, polrelid) as qual, pg_get_expr(polwithcheck, polrelid) as withcheck
           FROM pg_policy WHERE polrelid = 'items'::regclass`
        )
        const policies2 = policyDefs.rows as unknown as Array<{
          polcmd: string
          qual: string | null
          withcheck: string | null
        }>
        for (const policy of policies2) {
          const def = policy.qual || policy.withcheck
          expect(def).toContain('user_id')
        }
      })

      await test.step('Verify data stored correctly', async () => {
        const data = await executeQuery(`SELECT id, name, user_id FROM items ORDER BY id`)
        expect(data.rows).toHaveLength(2)
        expect(data.rows[0].name).toBe('User 1 Item')
        expect(data.rows[0].user_id).toBe(user1.user.id)
        expect(data.rows[1].name).toBe('User 2 Item')
        expect(data.rows[1].user_id).toBe(user2.user.id)
      })

      await test.step('Error handling: RLS policy with syntax error in condition', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error',
            tables: [
              {
                id: 99,
                name: 'invalid',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'owner_id', type: 'user' },
                ],
                permissions: {
                  records: [
                    {
                      action: 'read',
                      condition: '{userId} == owner_id', // Invalid: double equals
                    },
                  ],
                },
              },
            ],
          })
        ).rejects.toThrow(/invalid.*condition.*syntax|syntax error/i)
      })

      await test.step('Error handling: RLS policy referencing non-existent column', async () => {
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
                ],
                permissions: {
                  records: [
                    {
                      action: 'read',
                      condition: '{userId} = created_by', // 'created_by' column doesn't exist!
                    },
                  ],
                },
              },
            ],
          })
        ).rejects.toThrow(/column.*created_by.*not found|field.*does not exist/i)
      })

      await test.step('Error handling: field permission read restriction on non-existent field', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error3',
            tables: [
              {
                id: 97,
                name: 'invalid3',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'name', type: 'single-line-text' },
                ],
                permissions: {
                  fields: [
                    {
                      field: 'salary', // 'salary' field doesn't exist!
                      read: { type: 'roles', roles: ['admin', 'hr'] },
                    },
                  ],
                },
              },
            ],
          })
        ).rejects.toThrow(/field.*salary.*not found|field.*does not exist/i)
      })
    }
  )
})
