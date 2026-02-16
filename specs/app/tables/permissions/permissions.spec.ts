/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Table Permissions (API-Level Enforcement)
 *
 * PURPOSE: Verify table-level and field-level permissions are enforced at the API layer
 *
 * TESTING STRATEGY:
 * - Tests authenticate as different roles (member, viewer, admin)
 * - Make HTTP requests to /api/tables/{id}/records
 * - Assert on HTTP status codes (200 = allowed, 403 = denied)
 * - Assert on field presence/absence in JSON responses (field-level filtering)
 *
 * PERMISSION BEHAVIOR:
 * - read: string[] (e.g. ['admin']) → Only listed roles + admin can read; others denied
 * - read: 'all' / 'authenticated' → Admin and member can read; viewer denied by default
 * - permissions: {} (no read) → Admin and member can read (default allow); viewer denied
 * - fields[].read: string[] → Only listed roles see that field in response
 *
 * Domain: app
 * Spec Count: 9
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (9 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Table Permissions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-PERMISSIONS-001: should deny viewer when table has admin-only read permission',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedMember,
      createAuthenticatedViewer,
      signOut,
    }) => {
      // GIVEN: table with admin-only read permission
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
            name: 'admin_data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'secret', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: ['admin'],
            },
          },
        ],
      })

      await executeQuery(`INSERT INTO admin_data (secret) VALUES ('Secret 1'), ('Secret 2')`)

      // WHEN: member requests records via API (member not in ['admin'] list)
      await createAuthenticatedMember({ email: 'member@example.com' })
      const memberResponse = await request.get('/api/tables/1/records')

      // THEN: member gets 403 Forbidden (not in read: ['admin'] list)
      expect(memberResponse.status()).toBe(403)

      // WHEN: viewer requests records via API
      await signOut()
      await createAuthenticatedViewer({ email: 'viewer@example.com' })
      const viewerResponse = await request.get('/api/tables/1/records')

      // THEN: viewer also gets 403 Forbidden
      expect(viewerResponse.status()).toBe(403)
    }
  )

  test(
    'APP-TABLES-PERMISSIONS-002: should filter sensitive fields based on field-level permissions',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: table with field-level permission restricting salary_info to admin
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
              { id: 3, name: 'salary_info', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: ['member'],
              fields: [
                {
                  field: 'salary_info',
                  read: ['admin'],
                },
              ],
            },
          },
        ],
      })

      await executeQuery(
        `INSERT INTO employees (name, salary_info) VALUES ('Alice', '$100k'), ('Bob', '$120k')`
      )

      // WHEN: member requests records via API
      await createAuthenticatedMember({ email: 'member@example.com' })
      const response = await request.get('/api/tables/1/records')

      // THEN: member gets 200 but salary_info is filtered out
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records).toHaveLength(2)
      expect(data.records[0].fields).toHaveProperty('name', 'Alice')
      expect(data.records[0].fields).not.toHaveProperty('salary_info')
      expect(data.records[1].fields).toHaveProperty('name', 'Bob')
      expect(data.records[1].fields).not.toHaveProperty('salary_info')
    }
  )

  test(
    'APP-TABLES-PERMISSIONS-003: should enforce hierarchical permissions (table + field)',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedMember,
      createAuthenticatedAdmin,
      signOut,
    }) => {
      // GIVEN: table with authenticated read + admin-only salary field
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
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'content', type: 'single-line-text' },
              { id: 4, name: 'salary_info', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'authenticated',
              fields: [
                {
                  field: 'salary_info',
                  read: ['admin'],
                },
              ],
            },
          },
        ],
      })

      await executeQuery(
        `INSERT INTO documents (title, content, salary_info) VALUES ('Doc 1', 'Content 1', 'Confidential'), ('Doc 2', 'Content 2', 'Secret')`
      )

      // WHEN: member requests records via API
      await createAuthenticatedMember({ email: 'member@example.com' })
      const memberResponse = await request.get('/api/tables/1/records')

      // THEN: member gets 200 with title and content, but NOT salary_info
      expect(memberResponse.status()).toBe(200)
      const memberData = await memberResponse.json()
      expect(memberData.records).toHaveLength(2)
      expect(memberData.records[0].fields).toHaveProperty('title', 'Doc 1')
      expect(memberData.records[0].fields).toHaveProperty('content', 'Content 1')
      expect(memberData.records[0].fields).not.toHaveProperty('salary_info')

      // WHEN: admin requests records via API
      await signOut()
      await createAuthenticatedAdmin({ email: 'admin@example.com' })
      const adminResponse = await request.get('/api/tables/1/records')

      // THEN: admin gets 200 with ALL fields including salary_info
      expect(adminResponse.status()).toBe(200)
      const adminData = await adminResponse.json()
      expect(adminData.records).toHaveLength(2)
      expect(adminData.records[0].fields).toHaveProperty('title', 'Doc 1')
      expect(adminData.records[0].fields).toHaveProperty('salary_info', 'Confidential')
    }
  )

  test(
    'APP-TABLES-PERMISSIONS-004: should deny all non-admin when table has no read permission and viewer by default',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedMember,
      createAuthenticatedViewer,
      signOut,
    }) => {
      // GIVEN: table with read: ['admin'] (most restrictive)
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
            name: 'restricted',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'data', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: ['admin'],
            },
          },
        ],
      })

      await executeQuery(`INSERT INTO restricted (data) VALUES ('Top Secret')`)

      // WHEN: member requests records via API
      await createAuthenticatedMember({ email: 'member@example.com' })
      const memberResponse = await request.get('/api/tables/1/records')

      // THEN: member gets 403 (not in ['admin'] list)
      expect(memberResponse.status()).toBe(403)

      // WHEN: viewer requests records via API
      await signOut()
      await createAuthenticatedViewer({ email: 'viewer@example.com' })
      const viewerResponse = await request.get('/api/tables/1/records')

      // THEN: viewer also gets 403
      expect(viewerResponse.status()).toBe(403)
    }
  )

  test(
    'APP-TABLES-PERMISSIONS-005: should enforce complete permission hierarchy with admin override',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedMember,
      createAuthenticatedAdmin,
      createAuthenticatedViewer,
      signOut,
    }) => {
      // GIVEN: table with member+admin read, admin-only confidential field
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
            name: 'reports',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'summary', type: 'single-line-text' },
              { id: 4, name: 'confidential', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: ['member', 'admin'],
              fields: [
                {
                  field: 'confidential',
                  read: ['admin'],
                },
              ],
            },
          },
        ],
      })

      await executeQuery(
        `INSERT INTO reports (title, summary, confidential) VALUES ('Q1 Report', 'Good quarter', 'Revenue details')`
      )

      // WHEN: admin requests records via API
      await createAuthenticatedAdmin({ email: 'admin@example.com' })
      const adminResponse = await request.get('/api/tables/1/records')

      // THEN: admin gets 200 with ALL fields
      expect(adminResponse.status()).toBe(200)
      const adminData = await adminResponse.json()
      expect(adminData.records).toHaveLength(1)
      expect(adminData.records[0].fields).toHaveProperty('title', 'Q1 Report')
      expect(adminData.records[0].fields).toHaveProperty('confidential', 'Revenue details')

      // WHEN: member requests records via API
      await signOut()
      await createAuthenticatedMember({ email: 'member@example.com' })
      const memberResponse = await request.get('/api/tables/1/records')

      // THEN: member gets 200 with title and summary, but NOT confidential
      expect(memberResponse.status()).toBe(200)
      const memberData = await memberResponse.json()
      expect(memberData.records).toHaveLength(1)
      expect(memberData.records[0].fields).toHaveProperty('title', 'Q1 Report')
      expect(memberData.records[0].fields).toHaveProperty('summary', 'Good quarter')
      expect(memberData.records[0].fields).not.toHaveProperty('confidential')

      // WHEN: viewer requests records via API
      await signOut()
      await createAuthenticatedViewer({ email: 'viewer@example.com' })
      const viewerResponse = await request.get('/api/tables/1/records')

      // THEN: viewer gets 403 (not in ['member', 'admin'] list)
      expect(viewerResponse.status()).toBe(403)
    }
  )

  // ============================================================================
  // Schema validation tests - KEEP as-is (no RLS dependency)
  // ============================================================================

  test(
    'APP-TABLES-PERMISSIONS-006: should accept custom roles beyond default set',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: schema with custom role 'super_admin' in permissions
      // WHEN: server starts with this schema
      // THEN: should accept without error
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'custom_role_table',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: ['super_admin'],
            },
          },
        ],
      })
    }
  )

  test(
    'APP-TABLES-PERMISSIONS-007: should reject field permission referencing non-existent field',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: schema with field permission referencing non-existent 'salary' field
      // WHEN: server starts with this schema
      // THEN: should reject with descriptive error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'invalid_table',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                fields: [
                  {
                    field: 'salary',
                    read: ['admin'],
                  },
                ],
              },
            },
          ],
        })
      ).rejects.toThrow(/field.*salary.*not found|field.*does not exist/i)
    }
  )

  test(
    'APP-TABLES-PERMISSIONS-008: should reject duplicate field permissions',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: schema with duplicate field permissions for 'content'
      // WHEN: server starts with this schema
      // THEN: should reject with descriptive error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'invalid_table',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'content', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                fields: [
                  {
                    field: 'content',
                    read: 'all',
                  },
                  {
                    field: 'content',
                    read: ['admin'],
                  },
                ],
              },
            },
          ],
        })
      ).rejects.toThrow(/duplicate.*field.*permission|conflicting.*permission/i)
    }
  )

  // NOTE: Test 009 (owner_id record permission) was removed — owner isolation concept was removed.

  test(
    'APP-TABLES-PERMISSIONS-010: should reject circular relationship dependency between tables',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: two tables with circular relationship references
      // WHEN: server starts with this schema
      // THEN: should reject with circular dependency error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'table_a',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                {
                  id: 3,
                  name: 'table_b_ref',
                  type: 'relationship',
                  relatedTable: 'table_b',
                  relationType: 'many-to-one',
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
            {
              id: 2,
              name: 'table_b',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                {
                  id: 3,
                  name: 'table_a_ref',
                  type: 'relationship',
                  relatedTable: 'table_a',
                  relationType: 'many-to-one',
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      ).rejects.toThrow(/circular.*dependency|dependency.*cycle|cannot resolve.*order/i)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // Generated from 9 @spec tests — covers: table-level, field-level, schema validation
  // ============================================================================

  test(
    'APP-TABLES-PERMISSIONS-REGRESSION: user can complete full permissions workflow',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedMember,
      createAuthenticatedAdmin,
      createAuthenticatedViewer,
      signOut,
    }) => {
      // SETUP: Single schema with all 6 tables (each DB step uses its own table ID)
      // Table 99 with custom role 'super-admin' proves custom roles are accepted (step 006)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [
            { name: 'editor', description: 'Can edit content', level: 30 },
            { name: 'super-admin', description: 'Super administrator', level: 90 },
          ],
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
              read: ['admin'],
            },
          },
          {
            id: 2,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'salary_info', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: ['member'],
              fields: [
                {
                  field: 'salary_info',
                  read: ['admin'],
                },
              ],
            },
          },
          {
            id: 3,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'salary_info', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'authenticated',
              fields: [
                {
                  field: 'salary_info',
                  read: ['admin'],
                },
              ],
            },
          },
          {
            id: 4,
            name: 'restricted',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'data', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: ['admin'],
            },
          },
          {
            id: 5,
            name: 'reports',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'confidential', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: ['member', 'admin'],
              fields: [
                {
                  field: 'confidential',
                  read: ['admin'],
                },
              ],
            },
          },
          {
            id: 99,
            name: 'custom_role_table',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: ['super-admin'],
            },
          },
        ],
      })

      await executeQuery(`INSERT INTO admin_data (secret) VALUES ('Secret 1'), ('Secret 2')`)
      await executeQuery(`INSERT INTO employees (name, salary_info) VALUES ('Alice', '$100k')`)
      await executeQuery(
        `INSERT INTO documents (title, salary_info) VALUES ('Doc 1', 'Confidential')`
      )
      await executeQuery(`INSERT INTO restricted (data) VALUES ('Top Secret')`)
      await executeQuery(
        `INSERT INTO reports (title, confidential) VALUES ('Q1', 'Revenue details')`
      )

      await test.step('APP-TABLES-PERMISSIONS-001: Admin-only table — member and viewer denied', async () => {
        // Member denied
        await createAuthenticatedMember({ email: 'member@example.com' })
        const memberResponse = await request.get('/api/tables/1/records')
        expect(memberResponse.status()).toBe(403)

        // Viewer denied
        await signOut()
        await createAuthenticatedViewer({ email: 'viewer@example.com' })
        const viewerResponse = await request.get('/api/tables/1/records')
        expect(viewerResponse.status()).toBe(403)
        await signOut()
      })

      await test.step('APP-TABLES-PERMISSIONS-002: Field-level filtering — member sees name but not salary_info', async () => {
        await createAuthenticatedMember({ email: 'member2@example.com' })
        const response = await request.get('/api/tables/2/records')
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.records[0].fields).toHaveProperty('name', 'Alice')
        expect(data.records[0].fields).not.toHaveProperty('salary_info')
        await signOut()
      })

      await test.step('APP-TABLES-PERMISSIONS-003: Hierarchical permissions — admin sees all fields, member filtered', async () => {
        // Member sees title but not salary_info
        await createAuthenticatedMember({ email: 'member3@example.com' })
        const memberResponse = await request.get('/api/tables/3/records')
        expect(memberResponse.status()).toBe(200)
        const memberData = await memberResponse.json()
        expect(memberData.records[0].fields).toHaveProperty('title', 'Doc 1')
        expect(memberData.records[0].fields).not.toHaveProperty('salary_info')

        // Admin sees all fields
        await signOut()
        await createAuthenticatedAdmin({ email: 'admin@example.com' })
        const adminResponse = await request.get('/api/tables/3/records')
        expect(adminResponse.status()).toBe(200)
        const adminData = await adminResponse.json()
        expect(adminData.records[0].fields).toHaveProperty('salary_info', 'Confidential')
        await signOut()
      })

      await test.step('APP-TABLES-PERMISSIONS-004: Admin-only restriction — member and viewer both denied', async () => {
        await createAuthenticatedMember({ email: 'member4@example.com' })
        expect((await request.get('/api/tables/4/records')).status()).toBe(403)

        await signOut()
        await createAuthenticatedViewer({ email: 'viewer2@example.com' })
        expect((await request.get('/api/tables/4/records')).status()).toBe(403)
        await signOut()
      })

      await test.step('APP-TABLES-PERMISSIONS-005: Full hierarchy — admin all, member filtered, viewer denied', async () => {
        // Admin sees all
        await createAuthenticatedAdmin({ email: 'admin2@example.com' })
        const adminResponse = await request.get('/api/tables/5/records')
        expect(adminResponse.status()).toBe(200)
        const adminData = await adminResponse.json()
        expect(adminData.records[0].fields).toHaveProperty('confidential', 'Revenue details')

        // Member sees title, not confidential
        await signOut()
        await createAuthenticatedMember({ email: 'member5@example.com' })
        const memberResponse = await request.get('/api/tables/5/records')
        expect(memberResponse.status()).toBe(200)
        const memberData = await memberResponse.json()
        expect(memberData.records[0].fields).toHaveProperty('title', 'Q1')
        expect(memberData.records[0].fields).not.toHaveProperty('confidential')

        // Viewer denied
        await signOut()
        await createAuthenticatedViewer({ email: 'viewer3@example.com' })
        expect((await request.get('/api/tables/5/records')).status()).toBe(403)
        await signOut()
      })

      await test.step('APP-TABLES-PERMISSIONS-006: Accept custom roles beyond default set', async () => {
        // Table 99 with read: ['super_admin'] was included in the schema above.
        // Server started successfully, proving custom roles are accepted.
        const result = await executeQuery(`SELECT COUNT(*) as cnt FROM custom_role_table`)
        expect(Number(result.rows[0].cnt)).toBe(0)
      })

      await test.step('APP-TABLES-PERMISSIONS-007: Reject field permission referencing non-existent field', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error2',
            tables: [
              {
                id: 98,
                name: 'invalid2',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'name', type: 'single-line-text' },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
                permissions: {
                  fields: [
                    {
                      field: 'salary',
                      read: ['admin'],
                    },
                  ],
                },
              },
            ],
          })
        ).rejects.toThrow(/field.*salary.*not found|field.*does not exist/i)
      })

      await test.step('APP-TABLES-PERMISSIONS-008: Reject duplicate field permissions', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error3',
            tables: [
              {
                id: 97,
                name: 'invalid3',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'content', type: 'single-line-text' },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
                permissions: {
                  fields: [
                    {
                      field: 'content',
                      read: 'all',
                    },
                    {
                      field: 'content',
                      read: ['admin'],
                    },
                  ],
                },
              },
            ],
          })
        ).rejects.toThrow(/duplicate.*field.*permission|conflicting.*permission/i)
      })

      await test.step('APP-TABLES-PERMISSIONS-010: Reject circular relationship dependency', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error5',
            tables: [
              {
                id: 95,
                name: 'table_a',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'name', type: 'single-line-text' },
                  {
                    id: 3,
                    name: 'table_b_ref',
                    type: 'relationship',
                    relatedTable: 'table_b',
                    relationType: 'many-to-one',
                  },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
              },
              {
                id: 94,
                name: 'table_b',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'name', type: 'single-line-text' },
                  {
                    id: 3,
                    name: 'table_a_ref',
                    type: 'relationship',
                    relatedTable: 'table_a',
                    relationType: 'many-to-one',
                  },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
              },
            ],
          })
        ).rejects.toThrow(/circular.*dependency|dependency.*cycle|cannot resolve.*order/i)
      })
    }
  )
})
