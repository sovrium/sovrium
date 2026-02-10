/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Table-Level Permissions (API-Level Enforcement)
 *
 * PURPOSE: Verify table-level read permissions are enforced at the API layer
 *
 * TESTING STRATEGY:
 * - Tests authenticate as different roles (member, viewer, admin)
 * - Make HTTP requests to /api/tables/{id}/records
 * - Assert on HTTP status codes (200 = allowed, 403 = denied, 401 = unauthenticated)
 *
 * PERMISSION BEHAVIOR:
 * - read: string[] (e.g. ['member']) → Only listed roles + admin can read; viewer denied
 * - read: 'all' / 'authenticated' → Admin and member can read; viewer denied by default
 * - permissions: {} (no read) → Admin and member can read (default allow); viewer denied
 *
 * Domain: app
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Table-Level Permissions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-TABLE-PERMISSIONS-001: should allow member and deny viewer when table has role-based read permission',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createAuthenticatedViewer,
      signOut,
    }) => {
      // GIVEN: table with role-based read permission for 'member' role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
        },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: ['member'],
            },
          },
        ],
      })

      // Insert test data
      await executeQuery(`INSERT INTO projects (title) VALUES ('Project Alpha'), ('Project Beta')`)

      // Create member user (default role) and verify access
      await createAuthenticatedUser({ email: 'member@example.com' })

      // WHEN: member requests records via API
      const memberResponse = await request.get('/api/tables/1/records')

      // THEN: member gets 200 with records
      expect(memberResponse.status()).toBe(200)
      const memberData = await memberResponse.json()
      expect(memberData.records).toHaveLength(2)
      expect(memberData.records[0].fields).toHaveProperty('title', 'Project Alpha')

      // Sign out member, create viewer
      await signOut()
      await createAuthenticatedViewer({ email: 'viewer@example.com' })

      // WHEN: viewer requests records via API
      const viewerResponse = await request.get('/api/tables/1/records')

      // THEN: viewer gets 403 Forbidden (not in read: ['member'] list)
      expect(viewerResponse.status()).toBe(403)
    }
  )

  test(
    'APP-TABLES-TABLE-PERMISSIONS-002: should allow authenticated users when table has public read permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: table with 'all' read permission (public access for authenticated users)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
        },
        tables: [
          {
            id: 1,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'content', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'all',
            },
          },
        ],
      })

      // Insert test data
      await executeQuery(
        `INSERT INTO articles (title, content) VALUES ('Article 1', 'Content 1'), ('Article 2', 'Content 2')`
      )

      // Create authenticated member user
      await createAuthenticatedUser({ email: 'member@example.com' })

      // WHEN: authenticated member requests records via API
      const response = await request.get('/api/tables/1/records')

      // THEN: member gets 200 with all records
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records).toHaveLength(2)
      expect(data.records[0].fields).toHaveProperty('title', 'Article 1')
      expect(data.records[1].fields).toHaveProperty('title', 'Article 2')
    }
  )

  test(
    'APP-TABLES-TABLE-PERMISSIONS-003: should allow member and deny viewer when table has no read permission specified',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createAuthenticatedViewer,
      signOut,
    }) => {
      // GIVEN: table with no read permission specified (default behavior)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
        },
        tables: [
          {
            id: 1,
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

      // Insert test data
      await executeQuery(`INSERT INTO secrets (data) VALUES ('Secret Data')`)

      // Create member user (default role) — member is allowed by default
      await createAuthenticatedUser({ email: 'member@example.com' })

      // WHEN: member requests records via API
      const memberResponse = await request.get('/api/tables/1/records')

      // THEN: member gets 200 (non-viewer roles allowed by default)
      expect(memberResponse.status()).toBe(200)
      const memberData = await memberResponse.json()
      expect(memberData.records).toHaveLength(1)
      expect(memberData.records[0].fields).toHaveProperty('data', 'Secret Data')

      // Sign out member, create viewer
      await signOut()
      await createAuthenticatedViewer({ email: 'viewer@example.com' })

      // WHEN: viewer requests records via API
      const viewerResponse = await request.get('/api/tables/1/records')

      // THEN: viewer gets 403 Forbidden (viewers denied by default)
      expect(viewerResponse.status()).toBe(403)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // Generated from 3 @spec tests — covers: role-based permissions, public access, default deny
  // ============================================================================

  test(
    'APP-TABLES-TABLE-PERMISSIONS-REGRESSION: user can complete full table-permissions workflow',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createAuthenticatedViewer,
      signOut,
    }) => {
      // SETUP: Single schema with all 3 tables (each step uses its own table ID)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
        },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: ['member'],
            },
          },
          {
            id: 2,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'all',
            },
          },
          {
            id: 3,
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

      await executeQuery(`INSERT INTO projects (title) VALUES ('Project Alpha'), ('Project Beta')`)
      await executeQuery(`INSERT INTO articles (title) VALUES ('Article 1'), ('Article 2')`)
      await executeQuery(`INSERT INTO secrets (data) VALUES ('Secret Data')`)

      await test.step('APP-TABLES-TABLE-PERMISSIONS-001: Role-based read — member allowed, viewer denied', async () => {
        // Member can read projects (read: ['member'])
        await createAuthenticatedUser({ email: 'member@example.com' })
        const memberResponse = await request.get('/api/tables/1/records')
        expect(memberResponse.status()).toBe(200)
        const memberData = await memberResponse.json()
        expect(memberData.records).toHaveLength(2)

        // Viewer denied
        await signOut()
        await createAuthenticatedViewer({ email: 'viewer@example.com' })
        const viewerResponse = await request.get('/api/tables/1/records')
        expect(viewerResponse.status()).toBe(403)
        await signOut()
      })

      await test.step('APP-TABLES-TABLE-PERMISSIONS-002: Public read — authenticated member allowed', async () => {
        await createAuthenticatedUser({ email: 'member2@example.com' })
        const response = await request.get('/api/tables/2/records')
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.records).toHaveLength(2)
        await signOut()
      })

      await test.step('APP-TABLES-TABLE-PERMISSIONS-003: Default deny — member allowed, viewer denied', async () => {
        // Member allowed (default allow for non-viewers)
        await createAuthenticatedUser({ email: 'member3@example.com' })
        const memberResponse = await request.get('/api/tables/3/records')
        expect(memberResponse.status()).toBe(200)

        // Viewer denied (default deny for viewers)
        await signOut()
        await createAuthenticatedViewer({ email: 'viewer2@example.com' })
        const viewerResponse = await request.get('/api/tables/3/records')
        expect(viewerResponse.status()).toBe(403)
      })
    }
  )
})
