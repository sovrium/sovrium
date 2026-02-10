/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Field-Level Permissions (API-Level Enforcement)
 *
 * PURPOSE: Verify field-level permissions are enforced at the API layer
 *
 * TESTING STRATEGY:
 * - Tests authenticate as different roles (member, viewer, admin)
 * - Make HTTP requests to /api/tables/{id}/records
 * - Assert on HTTP status codes and field presence/absence in response
 *
 * FIELD PERMISSION BEHAVIOR:
 * - read: ['admin'] → field only visible to admin, excluded from member response
 * - read: 'authenticated' → field visible to any authenticated user (member, admin)
 * - read: 'all' → field visible to all authenticated users with table access
 * - No read specified → field inherits table-level permissions (visible to all with table access)
 * - write: ['admin'] → only admin can update this field (test.fixme — not yet API-enforced)
 *
 * NOTE: Tests 002, 005, 008 are test.fixme — field-level write enforcement not yet implemented at API layer.
 *       Test 005 was rewritten — owner isolation concept was removed.
 *       Test 009 was rewritten — owner-based filtering replaced with role-based filtering.
 *
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
    'APP-TABLES-FIELD-PERMISSIONS-001: should exclude salary field for member when field has admin-only read permission',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedMember,
      createAuthenticatedAdmin,
      signOut,
    }) => {
      // GIVEN: field 'salary' with read permission restricted to 'admin' role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
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
              fields: [{ field: 'salary', read: ['admin'] }],
            },
          },
        ],
      })

      await executeQuery(
        `INSERT INTO employees (name, salary, department) VALUES ('Alice', 75000.00, 'Engineering'), ('Bob', 65000.00, 'Marketing')`
      )

      // WHEN: member requests records via API
      await createAuthenticatedMember({ email: 'member@example.com' })
      const memberResponse = await request.get('/api/tables/1/records')

      // THEN: member gets 200 but salary field is excluded
      expect(memberResponse.status()).toBe(200)
      const memberData = await memberResponse.json()
      expect(memberData.records).toHaveLength(2)
      expect(memberData.records[0].fields).toHaveProperty('name', 'Alice')
      expect(memberData.records[0].fields).toHaveProperty('department', 'Engineering')
      expect(memberData.records[0].fields).not.toHaveProperty('salary')

      // WHEN: admin requests records via API
      await signOut()
      await createAuthenticatedAdmin({ email: 'admin@example.com' })
      const adminResponse = await request.get('/api/tables/1/records')

      // THEN: admin gets 200 with salary field included
      expect(adminResponse.status()).toBe(200)
      const adminData = await adminResponse.json()
      expect(adminData.records[0].fields).toHaveProperty('name', 'Alice')
      expect(adminData.records[0].fields).toHaveProperty('salary')
      expect(adminData.records[0].fields).toHaveProperty('department', 'Engineering')
    }
  )

  test(
    'APP-TABLES-FIELD-PERMISSIONS-002: should reject email update by member when field has admin-only write permission',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedMember,
      createAuthenticatedAdmin,
      signOut,
    }) => {
      // GIVEN: field 'email' with write permission restricted to 'admin' role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
        },
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'single-line-text' },
              { id: 4, name: 'bio', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              fields: [{ field: 'email', write: ['admin'] }],
            },
          },
        ],
      })

      await executeQuery(
        `INSERT INTO users (name, email, bio) VALUES ('Alice', 'alice@example.com', 'Software engineer')`
      )

      // WHEN: member attempts to update email via API
      await createAuthenticatedMember({ email: 'member@example.com' })
      const memberResponse = await request.patch('/api/tables/1/records/1', {
        data: { fields: { email: 'hacked@example.com' } },
      })

      // THEN: member gets 403 (field write restricted to admin)
      expect(memberResponse.status()).toBe(403)

      // WHEN: admin updates email via API
      await signOut()
      await createAuthenticatedAdmin({ email: 'admin@example.com' })
      const adminResponse = await request.patch('/api/tables/1/records/1', {
        data: { fields: { email: 'admin.updated@example.com' } },
      })

      // THEN: admin gets 200 (field write allowed)
      expect(adminResponse.status()).toBe(200)
    }
  )

  test(
    'APP-TABLES-FIELD-PERMISSIONS-003: should filter fields based on multiple different read permissions per role',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedMember,
      createAuthenticatedAdmin,
      signOut,
    }) => {
      // GIVEN: multiple fields with different read permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
        },
        tables: [
          {
            id: 1,
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
                { field: 'email', read: 'authenticated' },
                { field: 'salary', read: ['admin'] },
                { field: 'department', read: 'all' },
              ],
            },
          },
        ],
      })

      await executeQuery(
        `INSERT INTO staff (name, email, salary, department) VALUES ('Alice', 'alice@example.com', 80000.00, 'Engineering')`
      )

      // WHEN: member (authenticated) requests records via API
      await createAuthenticatedMember({ email: 'member@example.com' })
      const memberResponse = await request.get('/api/tables/1/records')

      // THEN: member sees name, email (authenticated), department (all) but NOT salary (admin)
      expect(memberResponse.status()).toBe(200)
      const memberData = await memberResponse.json()
      expect(memberData.records[0].fields).toHaveProperty('name', 'Alice')
      expect(memberData.records[0].fields).toHaveProperty('email', 'alice@example.com')
      expect(memberData.records[0].fields).toHaveProperty('department', 'Engineering')
      expect(memberData.records[0].fields).not.toHaveProperty('salary')

      // WHEN: admin requests records via API
      await signOut()
      await createAuthenticatedAdmin({ email: 'admin@example.com' })
      const adminResponse = await request.get('/api/tables/1/records')

      // THEN: admin sees ALL fields
      expect(adminResponse.status()).toBe(200)
      const adminData = await adminResponse.json()
      expect(adminData.records[0].fields).toHaveProperty('name', 'Alice')
      expect(adminData.records[0].fields).toHaveProperty('email', 'alice@example.com')
      expect(adminData.records[0].fields).toHaveProperty('salary')
      expect(adminData.records[0].fields).toHaveProperty('department', 'Engineering')
    }
  )

  test(
    'APP-TABLES-FIELD-PERMISSIONS-004: should include status field for all authenticated users when field has public read permission',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedMember,
      createAuthenticatedAdmin,
      signOut,
    }) => {
      // GIVEN: field 'status' with public read permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
        },
        tables: [
          {
            id: 1,
            name: 'tickets',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              fields: [{ field: 'status', read: 'all', write: ['admin'] }],
            },
          },
        ],
      })

      await executeQuery(`INSERT INTO tickets (title, status) VALUES ('Bug #123', 'open')`)

      // WHEN: member requests records via API
      await createAuthenticatedMember({ email: 'member@example.com' })
      const memberResponse = await request.get('/api/tables/1/records')

      // THEN: member sees status field (read: 'all' includes all authenticated users)
      expect(memberResponse.status()).toBe(200)
      const memberData = await memberResponse.json()
      expect(memberData.records[0].fields).toHaveProperty('title', 'Bug #123')
      expect(memberData.records[0].fields).toHaveProperty('status', 'open')

      // WHEN: admin requests records via API
      await signOut()
      await createAuthenticatedAdmin({ email: 'admin@example.com' })
      const adminResponse = await request.get('/api/tables/1/records')

      // THEN: admin also sees status field
      expect(adminResponse.status()).toBe(200)
      const adminData = await adminResponse.json()
      expect(adminData.records[0].fields).toHaveProperty('title', 'Bug #123')
      expect(adminData.records[0].fields).toHaveProperty('status', 'open')
    }
  )

  // NOTE: Test 005 was rewritten — owner isolation concept was removed.
  // Original tested owner-only write via SET LOCAL app.user_id.
  // Rewritten to test role-based field write restriction (member vs viewer).
  test.fixme(
    'APP-TABLES-FIELD-PERMISSIONS-005: should restrict notes field write to member role via API',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedMember,
      createAuthenticatedViewer,
      signOut,
    }) => {
      // GIVEN: field 'notes' with write permission restricted to 'member' role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'notes', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              fields: [{ field: 'notes', write: ['member'] }],
            },
          },
        ],
      })

      await executeQuery(`INSERT INTO tasks (title, notes) VALUES ('Task 1', 'Initial notes')`)

      // WHEN: member updates notes via API
      await createAuthenticatedMember({ email: 'member@example.com' })
      const memberResponse = await request.patch('/api/tables/1/records/1', {
        data: { fields: { notes: 'Updated by member' } },
      })

      // THEN: member gets 200 (write: ['member'] allows member)
      expect(memberResponse.status()).toBe(200)

      // WHEN: viewer attempts to update notes via API
      await signOut()
      await createAuthenticatedViewer({ email: 'viewer@example.com' })
      const viewerResponse = await request.patch('/api/tables/1/records/1', {
        data: { fields: { notes: 'Hacked' } },
      })

      // THEN: viewer gets 403 (not in write permission list)
      expect(viewerResponse.status()).toBe(403)
    }
  )

  test(
    'APP-TABLES-FIELD-PERMISSIONS-006: should include all fields when no field-level permissions are specified',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: table with empty fields permission array (no field-level restrictions)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
        },
        tables: [
          {
            id: 1,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'content', type: 'single-line-text' },
              { id: 4, name: 'created_at', type: 'datetime' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'authenticated',
              fields: [],
            },
          },
        ],
      })

      await executeQuery(`INSERT INTO posts (title, content) VALUES ('Post 1', 'Content 1')`)

      // WHEN: member requests records via API
      await createAuthenticatedMember({ email: 'member@example.com' })
      const response = await request.get('/api/tables/1/records')

      // THEN: all fields are included (no field-level restrictions)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].fields).toHaveProperty('title', 'Post 1')
      expect(data.records[0].fields).toHaveProperty('content', 'Content 1')
      // created_at is present but null (no default value and not provided in INSERT)
      expect(data.records[0].fields).toHaveProperty('created_at')
    }
  )

  test(
    'APP-TABLES-FIELD-PERMISSIONS-007: should demonstrate field filtering where member sees base fields but admin sees all',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedMember,
      createAuthenticatedAdmin,
      signOut,
    }) => {
      // GIVEN: table with explicit table-level read for member+admin, field-level admin-only fields
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
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
              read: ['member', 'admin'],
              fields: [
                { field: 'salary', read: ['admin'] },
                { field: 'ssn', read: ['admin'] },
              ],
            },
          },
        ],
      })

      await executeQuery(
        `INSERT INTO employees (name, salary, ssn) VALUES ('Alice', 75000.00, '123-45-6789'), ('Bob', 65000.00, '987-65-4321')`
      )

      // WHEN: member requests records via API
      await createAuthenticatedMember({ email: 'member@example.com' })
      const memberResponse = await request.get('/api/tables/1/records')

      // THEN: member sees name but NOT salary or ssn (filtered by application layer)
      expect(memberResponse.status()).toBe(200)
      const memberData = await memberResponse.json()
      expect(memberData.records).toHaveLength(2)
      expect(memberData.records[0].fields).toHaveProperty('name')
      expect(memberData.records[0].fields).not.toHaveProperty('salary')
      expect(memberData.records[0].fields).not.toHaveProperty('ssn')

      // WHEN: admin requests records via API
      await signOut()
      await createAuthenticatedAdmin({ email: 'admin@example.com' })
      const adminResponse = await request.get('/api/tables/1/records')

      // THEN: admin sees all fields including salary and ssn
      expect(adminResponse.status()).toBe(200)
      const adminData = await adminResponse.json()
      expect(adminData.records[0].fields).toHaveProperty('name')
      expect(adminData.records[0].fields).toHaveProperty('salary')
      expect(adminData.records[0].fields).toHaveProperty('ssn')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-PERMISSIONS-008: should prevent field modification at API level based on write permissions',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedMember,
      createAuthenticatedAdmin,
      signOut,
    }) => {
      // GIVEN: field 'verified' with write permission restricted to 'admin' role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
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
              update: ['member', 'admin'],
              fields: [{ field: 'verified', write: ['admin'] }],
            },
          },
        ],
      })

      await executeQuery(
        `INSERT INTO profiles (display_name, verified) VALUES ('User Profile', false)`
      )

      // WHEN: member attempts to update verified field via API
      await createAuthenticatedMember({ email: 'member@example.com' })
      const memberResponse = await request.patch('/api/tables/1/records/1', {
        data: { fields: { verified: true } },
      })

      // THEN: member gets 403 (field write restricted to admin)
      expect(memberResponse.status()).toBe(403)

      // Verify field unchanged in database
      const dbResult = await executeQuery('SELECT verified FROM profiles WHERE id = 1')
      expect(dbResult.rows[0].verified).toBe(false)

      // WHEN: admin updates verified field via API
      await signOut()
      await createAuthenticatedAdmin({ email: 'admin@example.com' })
      const adminResponse = await request.patch('/api/tables/1/records/1', {
        data: { fields: { verified: true } },
      })

      // THEN: admin gets 200 (field write allowed)
      expect(adminResponse.status()).toBe(200)

      const adminDbResult = await executeQuery('SELECT verified FROM profiles WHERE id = 1')
      expect(adminDbResult.rows[0].verified).toBe(true)
    }
  )

  // NOTE: Test 009 was rewritten — owner-based field filtering replaced with role-based filtering.
  // Original tested owner_id-based secret_content visibility.
  // Rewritten to test admin-only field read restriction at API level.
  test(
    'APP-TABLES-FIELD-PERMISSIONS-009: should apply complementary permissions where admin-only field is excluded for member',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedMember,
      createAuthenticatedAdmin,
      signOut,
    }) => {
      // GIVEN: table with authenticated read + admin-only secret_content field
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
        },
        tables: [
          {
            id: 1,
            name: 'private_notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'secret_content', type: 'long-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'authenticated',
              fields: [{ field: 'secret_content', read: ['admin'] }],
            },
          },
        ],
      })

      await executeQuery(
        `INSERT INTO private_notes (title, secret_content) VALUES ('Note 1', 'Top Secret Data'), ('Note 2', 'Another Secret')`
      )

      // WHEN: member requests records via API
      await createAuthenticatedMember({ email: 'member@example.com' })
      const memberResponse = await request.get('/api/tables/1/records')

      // THEN: member sees title but NOT secret_content (admin-only field)
      expect(memberResponse.status()).toBe(200)
      const memberData = await memberResponse.json()
      expect(memberData.records).toHaveLength(2)
      expect(memberData.records[0].fields).toHaveProperty('title', 'Note 1')
      expect(memberData.records[0].fields).not.toHaveProperty('secret_content')

      // WHEN: admin requests records via API
      await signOut()
      await createAuthenticatedAdmin({ email: 'admin@example.com' })
      const adminResponse = await request.get('/api/tables/1/records')

      // THEN: admin sees all fields including secret_content
      expect(adminResponse.status()).toBe(200)
      const adminData = await adminResponse.json()
      expect(adminData.records[0].fields).toHaveProperty('title', 'Note 1')
      expect(adminData.records[0].fields).toHaveProperty('secret_content', 'Top Secret Data')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // Generated from 6 working @spec tests — covers: field read filtering, multiple permissions, public fields, inheritance, dual-layer, complementary
  // Excludes fixme tests: 002, 005, 008 (field-level write not yet API-enforced)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-PERMISSIONS-REGRESSION: user can complete full field-permissions workflow',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedMember,
      createAuthenticatedAdmin,
      signOut,
    }) => {
      // SETUP: Single schema with all 6 tables (each step uses its own table ID)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
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
              fields: [{ field: 'salary', read: ['admin'] }],
            },
          },
          {
            id: 2,
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
                { field: 'email', read: 'authenticated' },
                { field: 'salary', read: ['admin'] },
                { field: 'department', read: 'all' },
              ],
            },
          },
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
              fields: [{ field: 'status', read: 'all', write: ['admin'] }],
            },
          },
          {
            id: 4,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'content', type: 'single-line-text' },
              { id: 4, name: 'created_at', type: 'datetime' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'authenticated',
              fields: [],
            },
          },
          {
            id: 5,
            name: 'hr_records',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'salary', type: 'decimal' },
              { id: 4, name: 'ssn', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: ['member', 'admin'],
              fields: [
                { field: 'salary', read: ['admin'] },
                { field: 'ssn', read: ['admin'] },
              ],
            },
          },
          {
            id: 6,
            name: 'private_notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'secret_content', type: 'long-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'authenticated',
              fields: [{ field: 'secret_content', read: ['admin'] }],
            },
          },
        ],
      })

      await executeQuery(
        `INSERT INTO employees (name, salary, department) VALUES ('Alice', 75000.00, 'Engineering')`
      )
      await executeQuery(
        `INSERT INTO staff (name, email, salary, department) VALUES ('Alice', 'alice@example.com', 80000.00, 'Engineering')`
      )
      await executeQuery(`INSERT INTO tickets (title, status) VALUES ('Bug #123', 'open')`)
      await executeQuery(`INSERT INTO posts (title, content) VALUES ('Post 1', 'Content 1')`)
      await executeQuery(
        `INSERT INTO hr_records (name, salary, ssn) VALUES ('Alice', 75000.00, '123-45-6789')`
      )
      await executeQuery(
        `INSERT INTO private_notes (title, secret_content) VALUES ('Note 1', 'Top Secret Data')`
      )

      await test.step('APP-TABLES-FIELD-PERMISSIONS-001: Admin-only field excluded for member', async () => {
        // Member excluded from salary
        await createAuthenticatedMember({ email: 'member@example.com' })
        const memberResponse = await request.get('/api/tables/1/records')
        expect(memberResponse.status()).toBe(200)
        const memberData = await memberResponse.json()
        expect(memberData.records[0].fields).toHaveProperty('name', 'Alice')
        expect(memberData.records[0].fields).not.toHaveProperty('salary')

        // Admin sees salary
        await signOut()
        await createAuthenticatedAdmin({ email: 'admin@example.com' })
        const adminResponse = await request.get('/api/tables/1/records')
        expect(adminResponse.status()).toBe(200)
        const adminData = await adminResponse.json()
        expect(adminData.records[0].fields).toHaveProperty('salary')
        await signOut()
      })

      await test.step('APP-TABLES-FIELD-PERMISSIONS-003: Multiple field permissions — filtered per role', async () => {
        // Member sees name, email, department but NOT salary
        await createAuthenticatedMember({ email: 'member2@example.com' })
        const memberResponse = await request.get('/api/tables/2/records')
        expect(memberResponse.status()).toBe(200)
        const memberData = await memberResponse.json()
        expect(memberData.records[0].fields).toHaveProperty('name', 'Alice')
        expect(memberData.records[0].fields).toHaveProperty('email')
        expect(memberData.records[0].fields).toHaveProperty('department')
        expect(memberData.records[0].fields).not.toHaveProperty('salary')

        // Admin sees all
        await signOut()
        await createAuthenticatedAdmin({ email: 'admin2@example.com' })
        const adminResponse = await request.get('/api/tables/2/records')
        expect(adminResponse.status()).toBe(200)
        const adminData = await adminResponse.json()
        expect(adminData.records[0].fields).toHaveProperty('salary')
        await signOut()
      })

      await test.step('APP-TABLES-FIELD-PERMISSIONS-004: Public read field — visible to member', async () => {
        await createAuthenticatedMember({ email: 'member3@example.com' })
        const response = await request.get('/api/tables/3/records')
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.records[0].fields).toHaveProperty('status', 'open')
        await signOut()
      })

      await test.step('APP-TABLES-FIELD-PERMISSIONS-006: No restrictions — all fields visible', async () => {
        await createAuthenticatedMember({ email: 'member4@example.com' })
        const response = await request.get('/api/tables/4/records')
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.records[0].fields).toHaveProperty('title', 'Post 1')
        expect(data.records[0].fields).toHaveProperty('content', 'Content 1')
        expect(data.records[0].fields).toHaveProperty('created_at')
        await signOut()
      })

      await test.step('APP-TABLES-FIELD-PERMISSIONS-007: Dual-layer — member sees base fields, admin sees all', async () => {
        // Member sees name only
        await createAuthenticatedMember({ email: 'member5@example.com' })
        const memberResponse = await request.get('/api/tables/5/records')
        expect(memberResponse.status()).toBe(200)
        const memberData = await memberResponse.json()
        expect(memberData.records[0].fields).toHaveProperty('name')
        expect(memberData.records[0].fields).not.toHaveProperty('salary')
        expect(memberData.records[0].fields).not.toHaveProperty('ssn')

        // Admin sees all
        await signOut()
        await createAuthenticatedAdmin({ email: 'admin3@example.com' })
        const adminResponse = await request.get('/api/tables/5/records')
        expect(adminResponse.status()).toBe(200)
        const adminData = await adminResponse.json()
        expect(adminData.records[0].fields).toHaveProperty('salary')
        expect(adminData.records[0].fields).toHaveProperty('ssn')
        await signOut()
      })

      await test.step('APP-TABLES-FIELD-PERMISSIONS-009: Complementary — admin-only field excluded for member', async () => {
        // Member excluded from secret_content
        await createAuthenticatedMember({ email: 'member6@example.com' })
        const memberResponse = await request.get('/api/tables/6/records')
        expect(memberResponse.status()).toBe(200)
        const memberData = await memberResponse.json()
        expect(memberData.records[0].fields).toHaveProperty('title', 'Note 1')
        expect(memberData.records[0].fields).not.toHaveProperty('secret_content')

        // Admin sees secret_content
        await signOut()
        await createAuthenticatedAdmin({ email: 'admin4@example.com' })
        const adminResponse = await request.get('/api/tables/6/records')
        expect(adminResponse.status()).toBe(200)
        const adminData = await adminResponse.json()
        expect(adminData.records[0].fields).toHaveProperty('secret_content', 'Top Secret Data')
      })
    }
  )
})
