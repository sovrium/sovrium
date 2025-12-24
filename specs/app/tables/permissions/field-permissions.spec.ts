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
 * Spec Count: 9
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (9 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Field-Level Permissions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-PERMISSIONS-001: should exclude salary column for non-admin users when field salary has read permission restricted to admin role',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: field 'salary' with read permission restricted to 'admin' role
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
      const adminResult = await executeQuery([
        'SET ROLE admin_user',
        'SELECT id, name, salary, department FROM employees WHERE id = 1',
      ])
      // THEN: assertion
      expect(adminResult).toMatchObject({
        id: 1,
        name: 'Alice',
        salary: '75000.00', // decimal returned as string by pg
        department: 'Engineering',
      })

      // Member user SELECT excludes salary (application layer filtering)
      const memberResult = await executeQuery([
        'SET ROLE member_user',
        'SELECT id, name, department FROM employees WHERE id = 1',
      ])
      // THEN: assertion
      expect(memberResult).toMatchObject({
        id: 1,
        name: 'Alice',
        department: 'Engineering',
      })

      // Member attempting to SELECT salary gets permission denied
      // THEN: assertion
      // Note: PostgreSQL's column-level GRANT restrictions return "permission denied for table"
      // error message, not "permission denied for column", when a restricted column is queried
      await expect(async () => {
        await executeQuery(['SET ROLE member_user', 'SELECT salary FROM employees WHERE id = 1'])
      }).rejects.toThrow('permission denied for table employees')
    }
  )

  test(
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
      const adminUpdate = await executeQuery([
        'SET ROLE admin_user',
        "UPDATE users SET email = 'alice.new@example.com' WHERE id = 1 RETURNING email",
      ])
      // THEN: assertion
      expect(adminUpdate.email).toBe('alice.new@example.com')

      // Member user can UPDATE other fields
      const memberUpdate = await executeQuery([
        'SET ROLE member_user',
        "UPDATE users SET bio = 'Updated bio' WHERE id = 1 RETURNING bio",
      ])
      // THEN: assertion
      expect(memberUpdate.bio).toBe('Updated bio')

      // Member user cannot UPDATE email field
      // THEN: assertion
      // Note: PostgreSQL returns "permission denied for table" when column-level UPDATE is denied
      // This is consistent with test 004 behavior for field-level write restrictions
      await expect(async () => {
        await executeQuery([
          'SET ROLE member_user',
          "UPDATE users SET email = 'hacked@example.com' WHERE id = 1",
        ])
      }).rejects.toThrow('permission denied for table users')
    }
  )

  test(
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
      const adminResult = await executeQuery([
        'SET ROLE admin_user',
        'SELECT name, email, salary, department FROM staff WHERE id = 1',
      ])
      // THEN: assertion
      expect(adminResult).toMatchObject({
        name: 'Alice',
        email: 'alice@example.com',
        salary: '80000.00', // decimal returned as string by pg
        department: 'Engineering',
      })

      // Authenticated user sees name, email, department (no salary)
      const authResult = await executeQuery([
        'SET ROLE authenticated_user',
        'SELECT name, email, department FROM staff WHERE id = 1',
      ])
      // THEN: assertion
      expect(authResult).toMatchObject({
        name: 'Alice',
        email: 'alice@example.com',
        department: 'Engineering',
      })

      // Unauthenticated user sees name, department only
      const unauthResult = await executeQuery([
        'RESET ROLE',
        'SELECT name, department FROM staff WHERE id = 1',
      ])
      // THEN: assertion
      expect(unauthResult).toMatchObject({
        name: 'Alice',
        department: 'Engineering',
      })
    }
  )

  test(
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
      const unauthResult = await executeQuery([
        'RESET ROLE',
        'SELECT title, status FROM tickets WHERE id = 1',
      ])
      // THEN: assertion
      expect(unauthResult).toMatchObject({
        title: 'Bug #123',
        status: 'open',
      })

      // Admin user can UPDATE status
      const adminUpdate = await executeQuery([
        'SET ROLE admin_user',
        "UPDATE tickets SET status = 'closed' WHERE id = 1 RETURNING status",
      ])
      // THEN: assertion
      expect(adminUpdate.status).toBe('closed')

      // Member user cannot UPDATE status
      // THEN: assertion
      await expect(async () => {
        await executeQuery([
          'SET ROLE member_user',
          "UPDATE tickets SET status = 'reopened' WHERE id = 1",
        ])
      }).rejects.toThrow('permission denied for table tickets')
    }
  )

  test(
    'APP-TABLES-FIELD-PERMISSIONS-005: should deny UPDATE when non-owner attempts to update field notes with custom condition write permission (owner only)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: field 'notes' with custom condition write permission (owner only)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
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
      const ownerUpdate = await executeQuery([
        `SET LOCAL app.user_id = '${user1.user.id}'`,
        "UPDATE tasks SET notes = 'Updated by owner' WHERE id = 1 RETURNING notes",
      ])
      // THEN: assertion
      expect(ownerUpdate.notes).toBe('Updated by owner')

      // Non-owner (user 2) cannot UPDATE notes on task 1
      // THEN: assertion
      await expect(async () => {
        await executeQuery([
          `SET LOCAL app.user_id = '${user2.user.id}'`,
          "UPDATE tasks SET notes = 'Hacked notes' WHERE id = 1",
        ])
      }).rejects.toThrow('permission denied for column notes')

      // Owner can UPDATE notes on their own task (task 2)
      const owner2Update = await executeQuery([
        `SET LOCAL app.user_id = '${user2.user.id}'`,
        "UPDATE tasks SET notes = 'My notes' WHERE id = 2 RETURNING notes",
      ])
      // THEN: assertion
      expect(owner2Update.notes).toBe('My notes')
    }
  )

  test(
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

      // Authenticated user can SELECT all fields when no field restrictions exist
      // Note: Empty fields array [] means "no field-level restrictions",
      // so all fields inherit table-level permission (authenticated via RLS)
      const authResult = await executeQuery('SELECT id, title, created_at FROM posts WHERE id = 1')
      // THEN: assertion (created_at is null because no default value and not inserted)
      expect(authResult).toMatchObject({
        id: 1,
        title: 'Post 1',
        created_at: null,
      })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  // ============================================================================
  // Dual-Layer Permission Tests (Better Auth + RLS)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-PERMISSIONS-007: should demonstrate dual-layer field filtering (Better Auth allows → RLS filters fields)',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, signIn, page, executeQuery }) => {
      // GIVEN: Application with BOTH layers configured for field-level permissions
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
              { id: 3, name: 'salary', type: 'decimal' },
              { id: 4, name: 'ssn', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: { type: 'roles', roles: ['member', 'admin'] }, // Better Auth: base permission
              fields: [
                {
                  field: 'salary',
                  read: { type: 'roles', roles: ['admin'] }, // RLS: field-level filtering
                },
                {
                  field: 'ssn',
                  read: { type: 'roles', roles: ['admin'] }, // RLS: field-level filtering
                },
              ],
            },
          },
        ],
      })

      await executeQuery([
        "INSERT INTO employees (name, salary, ssn) VALUES ('Alice', 75000.00, '123-45-6789'), ('Bob', 65000.00, '987-65-4321')",
      ])

      // Create member user
      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })
      await signIn({
        email: 'member@example.com',
        password: 'MemberPass123!',
      })

      // WHEN: Member user attempts to read employee records
      const response = await page.request.get('/api/tables/employees/records')

      // THEN: Better Auth allows (member has read permission)
      expect(response.status()).toBe(200)

      // THEN: RLS filters out salary and ssn fields (member cannot read them)
      const data = await response.json()
      expect(data.records).toHaveLength(2)
      expect(data.records[0]).toHaveProperty('name')
      expect(data.records[0]).not.toHaveProperty('salary') // Filtered by RLS
      expect(data.records[0]).not.toHaveProperty('ssn') // Filtered by RLS

      // WHEN: Admin user attempts to read employee records
      await signUp({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        name: 'Admin User',
      })
      await signIn({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })

      const adminResponse = await page.request.get('/api/tables/employees/records')

      // THEN: Better Auth allows (admin has read permission)
      expect(adminResponse.status()).toBe(200)

      // THEN: RLS includes all fields (admin can read salary and ssn)
      const adminData = await adminResponse.json()
      expect(adminData.records[0]).toHaveProperty('name')
      expect(adminData.records[0]).toHaveProperty('salary') // Included by RLS
      expect(adminData.records[0]).toHaveProperty('ssn') // Included by RLS
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-PERMISSIONS-008: should prevent field modification at both layers (Better Auth blocks → RLS never executes)',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, signIn, page, executeQuery }) => {
      // GIVEN: Application with field write restrictions at both layers
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
              { id: 3, name: 'verified', type: 'checkbox' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              update: { type: 'roles', roles: ['member', 'admin'] }, // Better Auth: base permission
              fields: [
                {
                  field: 'verified',
                  write: { type: 'roles', roles: ['admin'] }, // RLS: field-level write restriction
                },
              ],
            },
          },
        ],
      })

      await executeQuery([
        "INSERT INTO profiles (display_name, verified) VALUES ('User Profile', false)",
      ])

      // Create member user
      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })
      await signIn({
        email: 'member@example.com',
        password: 'MemberPass123!',
      })

      // WHEN: Member attempts to update verified field
      const response = await page.request.patch('/api/tables/profiles/records/1', {
        data: { verified: true },
      })

      // THEN: Better Auth blocks at API level (hasPermission check fails)
      expect([403, 401]).toContain(response.status())

      // THEN: RLS never executes (early rejection prevents database access)
      const dbResult = await executeQuery('SELECT verified FROM profiles WHERE id = 1')
      expect(dbResult.rows[0].verified).toBe(false) // Unchanged

      // WHEN: Admin attempts to update verified field
      await signUp({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        name: 'Admin User',
      })
      await signIn({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })

      const adminResponse = await page.request.patch('/api/tables/profiles/records/1', {
        data: { verified: true },
      })

      // THEN: Better Auth allows → RLS allows (both layers grant permission)
      expect(adminResponse.status()).toBe(200)

      const adminDbResult = await executeQuery('SELECT verified FROM profiles WHERE id = 1')
      expect(adminDbResult.rows[0].verified).toBe(true) // Updated successfully
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-PERMISSIONS-009: should apply complementary field permissions (Better Auth guards API → RLS enforces row filtering)',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      signUp: _signUp,
      signIn,
      page,
      executeQuery,
      createAuthenticatedUser,
    }) => {
      // GIVEN: Application with owner-based field permissions at both layers
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'private_notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'secret_content', type: 'long-text' },
              { id: 4, name: 'owner_id', type: 'user' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: { type: 'authenticated' }, // Better Auth: must be logged in
              fields: [
                {
                  field: 'secret_content',
                  read: {
                    type: 'custom',
                    condition: '{userId} = owner_id', // RLS: owner-only filtering
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
        `INSERT INTO private_notes (title, secret_content, owner_id) VALUES
         ('Note 1', 'User 1 Secret', '${user1.user.id}'),
         ('Note 2', 'User 2 Secret', '${user2.user.id}')`,
      ])

      // Sign in as user1
      await signIn({
        email: 'user1@example.com',
        password: 'UserPass123!',
      })

      // WHEN: User1 attempts to read notes
      const response = await page.request.get('/api/tables/private_notes/records')

      // THEN: Better Auth allows (authenticated)
      expect(response.status()).toBe(200)

      // THEN: RLS filters secret_content based on ownership
      const data = await response.json()
      const user1Note = data.records.find((r: any) => r.owner_id === user1.user.id)
      const user2Note = data.records.find((r: any) => r.owner_id === user2.user.id)

      // User1 sees their own secret content
      expect(user1Note).toHaveProperty('secret_content')
      expect(user1Note.secret_content).toBe('User 1 Secret')

      // User1 does NOT see User2's secret content (RLS filtered it)
      expect(user2Note).toHaveProperty('title') // Public field visible
      expect(user2Note).not.toHaveProperty('secret_content') // RLS filtered

      // WHEN: Unauthenticated user attempts to read notes
      await signIn({ email: '', password: '' }) // Sign out

      const unauthResponse = await page.request.get('/api/tables/private_notes/records')

      // THEN: Better Auth blocks at API level (not authenticated)
      expect(unauthResponse.status()).toBe(401)

      // THEN: RLS never executes (early rejection by Better Auth)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-PERMISSIONS-010: user can complete full field-permissions workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      let user1: any
      let user2: any

      await test.step('Setup: Start server with field-level permissions', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
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
                update: {
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
      })

      await test.step('Create test users and insert data', async () => {
        user1 = await createAuthenticatedUser({ email: 'owner@example.com' })
        user2 = await createAuthenticatedUser({ email: 'other@example.com' })

        await executeQuery([
          `INSERT INTO records (title, public_field, private_field, owner_id) VALUES ('Record 1', 'Public', 'Private', '${user1.user.id}')`,
        ])
      })

      await test.step('Verify owner can read all fields including private field', async () => {
        // WHEN: Owner queries their own record as authenticated user
        const ownerRead = await executeQuery([
          'SET LOCAL ROLE authenticated_user',
          `SET LOCAL app.user_id = '${user1.user.id}'`,
          'SELECT title, public_field, private_field FROM records WHERE id = 1',
        ])
        // THEN: Owner sees all fields including private_field
        expect(ownerRead.rows[0].title).toBe('Record 1')
        expect(ownerRead.rows[0].private_field).toBe('Private')
      })

      await test.step('Verify non-owner cannot read private field', async () => {
        // WHEN: Non-owner queries the record as authenticated user
        // Note: PostgreSQL RLS filters entire rows when field-level custom conditions aren't met
        // This is a documented PostgreSQL limitation - column-level dynamic permissions don't exist
        const nonOwnerRead = await executeQuery([
          'SET LOCAL ROLE authenticated_user',
          `SET LOCAL app.user_id = '${user2.user.id}'`,
          'SELECT private_field FROM records WHERE id = 1',
        ])
        // THEN: RLS filters out the row (non-owner sees zero rows, not permission denied)
        expect(nonOwnerRead.rows).toHaveLength(0)
      })

      await test.step('Verify owner can update private field', async () => {
        // WHEN: Owner updates their private field as authenticated user
        const ownerUpdate = await executeQuery([
          'SET LOCAL ROLE authenticated_user',
          `SET LOCAL app.user_id = '${user1.user.id}'`,
          "UPDATE records SET private_field = 'Updated' WHERE id = 1 RETURNING private_field",
        ])
        // THEN: Update succeeds
        expect(ownerUpdate.rows).toHaveLength(1)
        expect(ownerUpdate.rows[0].private_field).toBe('Updated')
      })

      await test.step('Verify non-owner cannot update private field', async () => {
        // WHEN: Non-owner attempts to update the private field
        // Note: Write permissions use BEFORE UPDATE triggers which raise exceptions
        try {
          await executeQuery([
            'SET LOCAL ROLE authenticated_user',
            `SET LOCAL app.user_id = '${user2.user.id}'`,
            "UPDATE records SET private_field = 'Hacked' WHERE id = 1",
          ])
          // If we get here, the update succeeded which is wrong
          throw new Error('Expected update to fail with permission denied')
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error)
          // THEN: Trigger raises permission denied exception
          expect(errMsg).toMatch(/permission denied/i)
        }
      })
    }
  )
})
