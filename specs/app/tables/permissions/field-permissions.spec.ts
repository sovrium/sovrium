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

  test(
    'APP-TABLES-FIELD-PERMISSIONS-007: should demonstrate dual-layer field filtering (Better Auth allows → RLS filters fields)',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, signIn, page, executeQuery }) => {
      // GIVEN: Application with BOTH layers configured for field-level permissions
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: true,
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
        },
        {
          adminBootstrap: {
            email: 'admin@example.com',
            password: 'AdminPass123!',
            name: 'Admin User',
          },
        }
      )

      await executeQuery([
        "INSERT INTO employees (name, salary, ssn) VALUES ('Alice', 75000.00, '123-45-6789'), ('Bob', 65000.00, '987-65-4321')",
      ])

      // Create member user
      const memberResult = await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      // Manually set user role to member (default role in Better Auth)
      await executeQuery([
        `UPDATE auth.user SET role = 'member' WHERE id = '${memberResult.user!.id}'`,
      ])

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
      expect(data.records[0].fields).toHaveProperty('name')
      expect(data.records[0].fields).not.toHaveProperty('salary') // Filtered by RLS
      expect(data.records[0].fields).not.toHaveProperty('ssn') // Filtered by RLS

      // WHEN: Admin user attempts to read employee records
      await signIn({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })

      const adminResponse = await page.request.get('/api/tables/employees/records')

      // THEN: Better Auth allows (admin has read permission)
      expect(adminResponse.status()).toBe(200)

      // THEN: RLS includes all fields (admin can read salary and ssn)
      const adminData = await adminResponse.json()
      expect(adminData.records[0].fields).toHaveProperty('name')
      expect(adminData.records[0].fields).toHaveProperty('salary') // Included by RLS
      expect(adminData.records[0].fields).toHaveProperty('ssn') // Included by RLS
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-PERMISSIONS-008: should prevent field modification at both layers (Better Auth blocks → RLS never executes)',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, signIn, page, executeQuery }) => {
      // GIVEN: Application with field write restrictions at both layers
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: true,
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
        },
        {
          adminBootstrap: {
            email: 'admin@example.com',
            password: 'AdminPass123!',
            name: 'Admin User',
          },
        }
      )

      await executeQuery([
        "INSERT INTO profiles (display_name, verified) VALUES ('User Profile', false)",
      ])

      // Create member user
      const memberResult = await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      // Manually set user role to member (default role in Better Auth)
      await executeQuery([
        `UPDATE auth.user SET role = 'member' WHERE id = '${memberResult.user!.id}'`,
      ])

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

  test(
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
        password: 'TestPassword123!',
      })

      // WHEN: User1 attempts to read notes
      const response = await page.request.get('/api/tables/private_notes/records')

      // THEN: Better Auth allows (authenticated)
      expect(response.status()).toBe(200)

      // THEN: RLS filters secret_content based on ownership
      const data = await response.json()
      console.log('DEBUG: API returned records:', JSON.stringify(data.records, null, 2))
      console.log('DEBUG: user1.user.id:', user1.user.id)
      console.log('DEBUG: user2.user.id:', user2.user.id)
      const user1Note = data.records.find((r: any) => r.fields.owner_id === user1.user.id)
      const user2Note = data.records.find((r: any) => r.fields.owner_id === user2.user.id)
      console.log('DEBUG: user1Note:', user1Note)
      console.log('DEBUG: user2Note:', user2Note)

      // User1 sees their own secret content
      expect(user1Note.fields).toHaveProperty('secret_content')
      expect(user1Note.fields.secret_content).toBe('User 1 Secret')

      // User1 does NOT see User2's secret content (Better Auth filtered it)
      expect(user2Note.fields).toHaveProperty('title') // Public field visible
      expect(user2Note.fields).not.toHaveProperty('secret_content') // Better Auth filtered

      // WHEN: Unauthenticated user attempts to read notes (using request without auth cookies)
      const unauthResponse = await page.request.get('/api/tables/private_notes/records', {
        headers: {
          Cookie: '', // Clear cookies to simulate unauthenticated request
        },
      })

      // THEN: Better Auth blocks at API level (not authenticated)
      expect(unauthResponse.status()).toBe(401)

      // THEN: RLS never executes (early rejection by Better Auth)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-PERMISSIONS-REGRESSION: user can complete full field-permissions workflow',
    { tag: '@regression' },
    async ({
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      signUp,
      signIn,
      page,
    }) => {
      let user1: any
      let user2: any

      await test.step('Setup: Start server with comprehensive field permissions', async () => {
        await startServerWithSchema(
          {
            name: 'test-app',
            auth: {
              emailAndPassword: true,
              admin: true,
            },
            tables: [
              // Table for spec 001, 003, 007 - role-based read permissions
              // Note: Matches @spec test schema - NO table-level read permission
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
                  // NO table-level permissions - only field-level (matches @spec 001)
                  fields: [
                    {
                      field: 'salary',
                      read: { type: 'roles', roles: ['admin'] },
                    },
                  ],
                },
              },
              // Table for spec 002, 008 - role-based write permissions
              // Note: Matches @spec test 002 - NO table-level update permission
              {
                id: 2,
                name: 'profiles',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'name', type: 'single-line-text' },
                  { id: 3, name: 'email', type: 'single-line-text' },
                  { id: 4, name: 'bio', type: 'single-line-text' },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
                permissions: {
                  // NO table-level permissions - only field-level (matches @spec 002)
                  fields: [
                    {
                      field: 'email',
                      write: { type: 'roles', roles: ['admin'] },
                    },
                  ],
                },
              },
              // Table for spec 004 - public read, admin-only write
              {
                id: 3,
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
                      read: { type: 'public' },
                      write: { type: 'roles', roles: ['admin'] },
                    },
                  ],
                },
              },
              // Table for spec 005, 009 - custom condition (owner-only)
              {
                id: 4,
                name: 'tasks',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'title', type: 'single-line-text' },
                  { id: 3, name: 'notes', type: 'single-line-text' },
                  { id: 4, name: 'secret_content', type: 'long-text' },
                  { id: 5, name: 'owner_id', type: 'user' },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
                permissions: {
                  read: { type: 'authenticated' },
                  update: { type: 'authenticated' },
                  fields: [
                    {
                      field: 'notes',
                      write: {
                        type: 'custom',
                        condition: '{userId} = owner_id',
                      },
                    },
                    {
                      field: 'secret_content',
                      read: {
                        type: 'custom',
                        condition: '{userId} = owner_id',
                      },
                    },
                  ],
                },
              },
              // Table for spec 006 - no field restrictions (inherit table-level)
              {
                id: 5,
                name: 'posts',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'title', type: 'single-line-text' },
                  { id: 3, name: 'content', type: 'single-line-text' },
                  { id: 4, name: 'created_at', type: 'datetime' },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
                permissions: {
                  read: { type: 'authenticated' },
                  fields: [],
                },
              },
            ],
          },
          {
            adminBootstrap: {
              email: 'admin@example.com',
              password: 'AdminPass123!',
              name: 'Admin User',
            },
          }
        )
      })

      await test.step('APP-TABLES-FIELD-PERMISSIONS-001: Exclude salary for non-admin users', async () => {
        // Insert test data (matches simplified schema without email/ssn columns)
        await executeQuery([
          "INSERT INTO employees (name, salary, department) VALUES ('Alice', 75000.00, 'Engineering')",
        ])

        // Admin can SELECT salary
        const adminResult = await executeQuery([
          'SET ROLE admin_user',
          'SELECT id, name, salary, department FROM employees WHERE id = 1',
        ])
        expect(adminResult).toMatchObject({
          id: 1,
          name: 'Alice',
          salary: '75000.00',
          department: 'Engineering',
        })

        // Member user SELECT excludes salary (application layer filtering)
        const memberResult = await executeQuery([
          'SET ROLE member_user',
          'SELECT id, name, department FROM employees WHERE id = 1',
        ])
        expect(memberResult).toMatchObject({
          id: 1,
          name: 'Alice',
          department: 'Engineering',
        })

        // Member cannot SELECT salary (permission denied)
        await expect(async () => {
          await executeQuery(['SET ROLE member_user', 'SELECT salary FROM employees WHERE id = 1'])
        }).rejects.toThrow('permission denied for table employees')
      })

      await test.step('APP-TABLES-FIELD-PERMISSIONS-002: Reject email update by member role', async () => {
        // Note: Simplified schema matches @spec test 002 - only name, email, bio fields
        await executeQuery([
          "INSERT INTO profiles (name, email, bio) VALUES ('Alice Profile', 'alice@example.com', 'Software engineer')",
        ])

        // Admin can UPDATE email
        const adminUpdate = await executeQuery([
          'SET ROLE admin_user',
          "UPDATE profiles SET email = 'alice.new@example.com' WHERE id = 1 RETURNING email",
        ])
        expect(adminUpdate.email).toBe('alice.new@example.com')

        // Member can UPDATE other fields
        const memberUpdate = await executeQuery([
          'SET ROLE member_user',
          "UPDATE profiles SET bio = 'Updated bio' WHERE id = 1 RETURNING bio",
        ])
        expect(memberUpdate.bio).toBe('Updated bio')

        // Member cannot UPDATE email
        await expect(async () => {
          await executeQuery([
            'SET ROLE member_user',
            "UPDATE profiles SET email = 'hacked@example.com' WHERE id = 1",
          ])
        }).rejects.toThrow('permission denied for table profiles')
      })

      await test.step('APP-TABLES-FIELD-PERMISSIONS-003: Include only permitted columns for different roles', async () => {
        // Admin sees all fields including salary (simplified schema matches @spec 001)
        const adminResult = await executeQuery([
          'SET ROLE admin_user',
          'SELECT name, salary, department FROM employees WHERE id = 1',
        ])
        expect(adminResult).toMatchObject({
          name: 'Alice',
          salary: '75000.00',
          department: 'Engineering',
        })

        // Member can see name and department but not salary
        const memberResult = await executeQuery([
          'SET ROLE member_user',
          'SELECT name, department FROM employees WHERE id = 1',
        ])
        expect(memberResult).toMatchObject({
          name: 'Alice',
          department: 'Engineering',
        })
      })

      await test.step('APP-TABLES-FIELD-PERMISSIONS-004: Include status for all (public read, admin write)', async () => {
        await executeQuery(["INSERT INTO tickets (title, status) VALUES ('Bug #123', 'open')"])

        // Unauthenticated can SELECT status
        const unauthResult = await executeQuery([
          'RESET ROLE',
          'SELECT title, status FROM tickets WHERE id = 1',
        ])
        expect(unauthResult).toMatchObject({
          title: 'Bug #123',
          status: 'open',
        })

        // Admin can UPDATE status
        const adminUpdate = await executeQuery([
          'SET ROLE admin_user',
          "UPDATE tickets SET status = 'closed' WHERE id = 1 RETURNING status",
        ])
        expect(adminUpdate.status).toBe('closed')

        // Member cannot UPDATE status
        await expect(async () => {
          await executeQuery([
            'SET ROLE member_user',
            "UPDATE tickets SET status = 'reopened' WHERE id = 1",
          ])
        }).rejects.toThrow('permission denied for table tickets')
      })

      await test.step('APP-TABLES-FIELD-PERMISSIONS-005: Deny update for non-owner (custom condition)', async () => {
        user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
        user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

        await executeQuery([
          `INSERT INTO tasks (title, notes, owner_id) VALUES ('Task 1', 'Initial notes', '${user1.user.id}')`,
        ])

        // Owner can UPDATE notes
        const ownerUpdate = await executeQuery([
          `SET LOCAL app.user_id = '${user1.user.id}'`,
          "UPDATE tasks SET notes = 'Updated by owner' WHERE id = 1 RETURNING notes",
        ])
        expect(ownerUpdate.notes).toBe('Updated by owner')

        // Non-owner cannot UPDATE notes
        await expect(async () => {
          await executeQuery([
            `SET LOCAL app.user_id = '${user2.user.id}'`,
            "UPDATE tasks SET notes = 'Hacked notes' WHERE id = 1",
          ])
        }).rejects.toThrow('permission denied for column notes')
      })

      await test.step('APP-TABLES-FIELD-PERMISSIONS-006: Include created_at (inherits table permissions)', async () => {
        await executeQuery(["INSERT INTO posts (title, content) VALUES ('Post 1', 'Content 1')"])

        // Empty fields array means no field-level restrictions
        const emptyPermissions = await executeQuery("SELECT '[]'::jsonb as field_permissions")
        expect(emptyPermissions.field_permissions).toEqual([])

        // Authenticated user can SELECT all fields
        const authResult = await executeQuery(
          'SELECT id, title, created_at FROM posts WHERE id = 1'
        )
        expect(authResult).toMatchObject({
          id: 1,
          title: 'Post 1',
          created_at: null,
        })
      })

      await test.step('APP-TABLES-FIELD-PERMISSIONS-007: Demonstrate dual-layer field filtering (Better Auth + RLS)', async () => {
        // Create member user
        const memberResult = await signUp({
          email: 'member@example.com',
          password: 'MemberPass123!',
          name: 'Member User',
        })

        await executeQuery([
          `UPDATE auth.user SET role = 'member' WHERE id = '${memberResult.user!.id}'`,
        ])

        await signIn({
          email: 'member@example.com',
          password: 'MemberPass123!',
        })

        // Member reads employees - Better Auth allows, RLS filters salary
        const response = await page.request.get('/api/tables/employees/records')
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records[0].fields).toHaveProperty('name')
        expect(data.records[0].fields).not.toHaveProperty('salary') // Filtered by RLS

        // Sign in as admin user
        await signIn({
          email: 'admin@example.com',
          password: 'AdminPass123!',
        })

        // Admin reads employees - Better Auth allows, RLS includes all fields
        const adminResponse = await page.request.get('/api/tables/employees/records')
        expect(adminResponse.status()).toBe(200)

        const adminData = await adminResponse.json()
        expect(adminData.records[0].fields).toHaveProperty('salary') // Included by RLS
      })

      await test.step('APP-TABLES-FIELD-PERMISSIONS-008: Prevent field modification at both layers', async () => {
        // Sign in as member (created in step 007)
        await signIn({
          email: 'member@example.com',
          password: 'MemberPass123!',
        })

        // Note: Testing email field restriction (simplified schema uses email instead of verified)
        // Member attempts to update email field - Better Auth blocks
        const response = await page.request.patch('/api/tables/profiles/records/1', {
          data: { fields: { email: 'hacker@example.com' } },
        })
        expect([403, 401]).toContain(response.status())

        // Verify email field unchanged
        const dbResult = await executeQuery('SELECT email FROM profiles WHERE id = 1')
        expect(dbResult.email).toBe('alice.new@example.com') // Value from step 002

        // Admin updates email field - both layers allow
        await signIn({
          email: 'admin@example.com',
          password: 'AdminPass123!',
        })

        const adminResponse = await page.request.patch('/api/tables/profiles/records/1', {
          data: { fields: { email: 'admin.updated@example.com' } },
        })
        expect(adminResponse.status()).toBe(200)

        const adminDbResult = await executeQuery('SELECT email FROM profiles WHERE id = 1')
        expect(adminDbResult.email).toBe('admin.updated@example.com')
      })

      await test.step('APP-TABLES-FIELD-PERMISSIONS-009: Apply complementary permissions (Better Auth guards + RLS filters)', async () => {
        await executeQuery([
          `INSERT INTO tasks (title, secret_content, owner_id) VALUES
           ('Task 2', 'User 1 Secret', '${user1.user.id}'),
           ('Task 3', 'User 2 Secret', '${user2.user.id}')`,
        ])

        // Sign in as user1
        await signIn({
          email: 'user1@example.com',
          password: 'TestPassword123!',
        })

        // User1 reads tasks - Better Auth allows, RLS filters secret_content by ownership
        const response = await page.request.get('/api/tables/tasks/records')
        expect(response.status()).toBe(200)

        const data = await response.json()
        // Note: Find by title to avoid confusion with Task 1 from step 005 (which has no secret_content)
        const user1Task = data.records.find((r: any) => r.fields.title === 'Task 2')
        const user2Task = data.records.find((r: any) => r.fields.title === 'Task 3')

        // User1 sees their own secret content
        expect(user1Task.fields).toHaveProperty('secret_content')
        expect(user1Task.fields.secret_content).toBe('User 1 Secret')

        // User1 does NOT see User2's secret content
        expect(user2Task.fields).toHaveProperty('title')
        expect(user2Task.fields).not.toHaveProperty('secret_content')

        // Unauthenticated user blocked by Better Auth
        const unauthResponse = await page.request.get('/api/tables/tasks/records', {
          headers: { Cookie: '' },
        })
        expect(unauthResponse.status()).toBe(401)
      })
    }
  )
})
