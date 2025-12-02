/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Field-Level Permissions
 *
 * Source: src/domain/models/app/table/permissions/index.ts
 * Domain: app
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Field-Level Permissions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-PERMISSIONS-001: should exclude salary column for non-admin users when field salary has read permission restricted to admin role',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: field 'salary' with read permission restricted to 'admin' role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'salary', type: 'decimal' },
              { id: 4, name: 'department', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
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
        "INSERT INTO employees (name, salary, department) VALUES ('Alice', 75000.00, 'Engineering'), ('Bob', 65000.00, 'Marketing')",
      ])

      // WHEN: user with 'member' role requests records
      // THEN: PostgreSQL query excludes salary column for non-admin users

      // Admin user can SELECT salary column
      const adminResult = await executeQuery(
        'SET ROLE admin_user; SELECT id, name, salary, department FROM employees WHERE id = 1'
      )
      // THEN: assertion
      expect(adminResult).toEqual({
        id: 1,
        name: 'Alice',
        salary: 75_000.0,
        department: 'Engineering',
      })

      // Member user SELECT excludes salary (application layer filtering)
      const memberResult = await executeQuery(
        'SET ROLE member_user; SELECT id, name, department FROM employees WHERE id = 1'
      )
      // THEN: assertion
      expect(memberResult).toEqual({
        id: 1,
        name: 'Alice',
        department: 'Engineering',
      })

      // Member attempting to SELECT salary gets NULL or error
      // THEN: assertion
      await expect(async () => {
        await executeQuery('SET ROLE member_user; SELECT salary FROM employees WHERE id = 1')
      }).rejects.toThrow('permission denied for column salary')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-PERMISSIONS-002: should reject modification when user with member role attempts to update field email with write permission restricted to admin role',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: field 'email' with write permission restricted to 'admin' role
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
              { id: 4, name: 'bio', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              fields: [
                {
                  field: 'email',
                  write: {
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
        "INSERT INTO users (name, email, bio) VALUES ('Alice', 'alice@example.com', 'Software engineer')",
      ])

      // WHEN: user with 'member' role attempts to update field
      // THEN: PostgreSQL UPDATE triggers or application layer rejects modification

      // Admin user can UPDATE email field
      const adminUpdate = await executeQuery(
        "SET ROLE admin_user; UPDATE users SET email = 'alice.new@example.com' WHERE id = 1 RETURNING email"
      )
      // THEN: assertion
      expect(adminUpdate.email).toBe('alice.new@example.com')

      // Member user can UPDATE other fields
      const memberUpdate = await executeQuery(
        "SET ROLE member_user; UPDATE users SET bio = 'Updated bio' WHERE id = 1 RETURNING bio"
      )
      // THEN: assertion
      expect(memberUpdate.bio).toBe('Updated bio')

      // Member user cannot UPDATE email field
      // THEN: assertion
      await expect(async () => {
        await executeQuery(
          "SET ROLE member_user; UPDATE users SET email = 'hacked@example.com' WHERE id = 1"
        )
      }).rejects.toThrow('permission denied for column email')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-PERMISSIONS-003: should include only columns user has permission to read when multiple fields have different read permissions',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: multiple fields with different read permissions (email: authenticated, salary: admin, department: public)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'staff',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'single-line-text' },
              { id: 4, name: 'salary', type: 'decimal' },
              { id: 5, name: 'department', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              fields: [
                {
                  field: 'email',
                  read: {
                    type: 'authenticated',
                  },
                },
                {
                  field: 'salary',
                  read: {
                    type: 'roles',
                    roles: ['admin'],
                  },
                },
                {
                  field: 'department',
                  read: {
                    type: 'public',
                  },
                },
              ],
            },
          },
        ],
      })

      await executeQuery([
        "INSERT INTO staff (name, email, salary, department) VALUES ('Alice', 'alice@example.com', 80000.00, 'Engineering')",
      ])

      // WHEN: users with different roles request records
      // THEN: PostgreSQL SELECT includes only columns user has permission to read

      // Admin user sees all fields
      const adminResult = await executeQuery(
        'SET ROLE admin_user; SELECT name, email, salary, department FROM staff WHERE id = 1'
      )
      // THEN: assertion
      expect(adminResult).toEqual({
        name: 'Alice',
        email: 'alice@example.com',
        salary: 80_000.0,
        department: 'Engineering',
      })

      // Authenticated user sees name, email, department (no salary)
      const authResult = await executeQuery(
        'SET ROLE authenticated_user; SELECT name, email, department FROM staff WHERE id = 1'
      )
      // THEN: assertion
      expect(authResult).toEqual({
        name: 'Alice',
        email: 'alice@example.com',
        department: 'Engineering',
      })

      // Unauthenticated user sees name, department only
      const unauthResult = await executeQuery(
        'RESET ROLE; SELECT name, department FROM staff WHERE id = 1'
      )
      // THEN: assertion
      expect(unauthResult).toEqual({
        name: 'Alice',
        department: 'Engineering',
      })
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-PERMISSIONS-004: should include status field for all users when field status has public read but admin-only write permission',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: field 'status' with public read but admin-only write permission
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'tickets',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              fields: [
                {
                  field: 'status',
                  read: {
                    type: 'public',
                  },
                  write: {
                    type: 'roles',
                    roles: ['admin'],
                  },
                },
              ],
            },
          },
        ],
      })

      await executeQuery(["INSERT INTO tickets (title, status) VALUES ('Bug #123', 'open')"])

      // WHEN: unauthenticated user views records
      // THEN: PostgreSQL SELECT includes status field for all users

      // Unauthenticated user can SELECT status
      const unauthResult = await executeQuery(
        'RESET ROLE; SELECT title, status FROM tickets WHERE id = 1'
      )
      // THEN: assertion
      expect(unauthResult).toEqual({
        title: 'Bug #123',
        status: 'open',
      })

      // Admin user can UPDATE status
      const adminUpdate = await executeQuery(
        "SET ROLE admin_user; UPDATE tickets SET status = 'closed' WHERE id = 1 RETURNING status"
      )
      // THEN: assertion
      expect(adminUpdate.status).toBe('closed')

      // Member user cannot UPDATE status
      // THEN: assertion
      await expect(async () => {
        await executeQuery(
          "SET ROLE member_user; UPDATE tickets SET status = 'reopened' WHERE id = 1"
        )
      }).rejects.toThrow('permission denied for column status')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-PERMISSIONS-005: should deny UPDATE when non-owner attempts to update field notes with custom condition write permission (owner only)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: field 'notes' with custom condition write permission (owner only)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
        tables: [
          {
            id: 5,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'notes', type: 'single-line-text' },
              { id: 4, name: 'owner_id', type: 'user' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              fields: [
                {
                  field: 'notes',
                  write: {
                    type: 'custom',
                    condition: '{userId} = owner_id',
                  },
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
        `INSERT INTO tasks (title, notes, owner_id) VALUES ('Task 1', 'Initial notes', '${user1.user.id}'), ('Task 2', 'Other notes', '${user2.user.id}')`,
      ])

      // WHEN: non-owner attempts to update field
      // THEN: PostgreSQL RLS policy or application layer denies UPDATE

      // Owner (user 1) can UPDATE notes on their task
      const ownerUpdate = await executeQuery(
        `SET LOCAL app.user_id = '${user1.user.id}'; UPDATE tasks SET notes = 'Updated by owner' WHERE id = 1 RETURNING notes`
      )
      // THEN: assertion
      expect(ownerUpdate.notes).toBe('Updated by owner')

      // Non-owner (user 2) cannot UPDATE notes on task 1
      // THEN: assertion
      await expect(async () => {
        await executeQuery(
          `SET LOCAL app.user_id = '${user2.user.id}'; UPDATE tasks SET notes = 'Hacked notes' WHERE id = 1`
        )
      }).rejects.toThrow('permission denied for column notes')

      // Owner can UPDATE notes on their own task (task 2)
      const owner2Update = await executeQuery(
        `SET LOCAL app.user_id = '${user2.user.id}'; UPDATE tasks SET notes = 'My notes' WHERE id = 2 RETURNING notes`
      )
      // THEN: assertion
      expect(owner2Update.notes).toBe('My notes')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-PERMISSIONS-006: should include field in SELECT (inherits table-level permissions) when field created_at has no read permission specified',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: field 'created_at' with no read permission specified (inherit from table)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'content', type: 'single-line-text' },
              { id: 4, name: 'created_at', type: 'datetime' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: {
                type: 'authenticated',
              },
              fields: [],
            },
          },
        ],
      })

      await executeQuery(["INSERT INTO posts (title, content) VALUES ('Post 1', 'Content 1')"])

      // WHEN: user with table read access requests records
      // THEN: PostgreSQL includes field in SELECT (inherits table-level permissions)

      // Field permissions array is empty
      const emptyPermissions = await executeQuery("SELECT '[]'::jsonb as field_permissions")
      // THEN: assertion
      expect(emptyPermissions.field_permissions).toEqual([])

      // Authenticated user can SELECT all fields (including created_at)
      const authResult = await executeQuery(
        'SET ROLE authenticated_user; SELECT id, title, created_at FROM posts WHERE id = 1'
      )
      // THEN: assertion
      expect(authResult).toEqual({
        id: 1,
        title: 'Post 1',
      })

      // Unauthenticated user cannot SELECT (table-level denied)
      // THEN: assertion
      await expect(async () => {
        await executeQuery('RESET ROLE; SELECT id, title FROM posts WHERE id = 1')
      }).rejects.toThrow('permission denied for table posts')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-PERMISSIONS-007: user can complete full field-permissions workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Application configured with representative field-level permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: { emailAndPassword: true },
        },
        tables: [
          {
            id: 7,
            name: 'records',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'public_field', type: 'single-line-text' },
              { id: 4, name: 'private_field', type: 'single-line-text' },
              { id: 5, name: 'owner_id', type: 'user' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: {
                type: 'authenticated',
              },
              fields: [
                {
                  field: 'private_field',
                  read: {
                    type: 'custom',
                    condition: '{userId} = owner_id',
                  },
                  write: {
                    type: 'custom',
                    condition: '{userId} = owner_id',
                  },
                },
              ],
            },
          },
        ],
      })

      // Create test users
      const user1 = await createAuthenticatedUser({ email: 'owner@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'other@example.com' })

      await executeQuery([
        `INSERT INTO records (title, public_field, private_field, owner_id) VALUES ('Record 1', 'Public', 'Private', '${user1.user.id}')`,
      ])

      // WHEN/THEN: Streamlined workflow testing integration points

      // Owner can read all fields including private_field
      const ownerRead = await executeQuery(
        `SET LOCAL app.user_id = '${user1.user.id}'; SELECT title, public_field, private_field FROM records WHERE id = 1`
      )
      // THEN: assertion
      expect(ownerRead.title).toBe('Record 1')
      expect(ownerRead.private_field).toBe('Private')

      // Non-owner can read public fields but not private_field
      // THEN: assertion
      await expect(async () => {
        await executeQuery(
          `SET LOCAL app.user_id = '${user2.user.id}'; SELECT private_field FROM records WHERE id = 1`
        )
      }).rejects.toThrow('permission denied')

      // Owner can update private_field
      const ownerUpdate = await executeQuery(
        `SET LOCAL app.user_id = '${user1.user.id}'; UPDATE records SET private_field = 'Updated' WHERE id = 1 RETURNING private_field`
      )
      // THEN: assertion
      expect(ownerUpdate.private_field).toBe('Updated')

      // Non-owner cannot update private_field
      // THEN: assertion
      await expect(async () => {
        await executeQuery(
          `SET LOCAL app.user_id = '${user2.user.id}'; UPDATE records SET private_field = 'Hacked' WHERE id = 1`
        )
      }).rejects.toThrow('permission denied')

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
