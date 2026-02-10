/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Session Context Integration
 *
 * PURPOSE: Verify Better Auth session data is available for permission evaluation
 *
 * TESTING STRATEGY:
 * - Tests authenticate as different roles (member, viewer)
 * - Verify session context variables (user_id, org_id, user_role) are set
 * - Assert role-based access control uses session context
 *
 * Domain: app
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Session Context Integration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-TABLES-SESSION-CONTEXT-001: should set session context variables at connection start',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedMember }) => {
      // GIVEN: Server with auth and a table requiring authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Editor', level: 30 }],
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: { read: 'authenticated' },
          },
        ],
      })

      // WHEN: Authenticated member makes a request
      await createAuthenticatedMember({ email: 'member@example.com' })

      // THEN: Session context variables are set in PostgreSQL connection
      // Verify via current_setting() that user_id is populated
      const result = await executeQuery(`SELECT current_setting('app.user_id', true) as user_id`)
      expect(result).toBeDefined()
      // The user_id should be a valid UUID from Better Auth session
    }
  )

  test.fixme(
    'APP-TABLES-SESSION-CONTEXT-002: should make session organization ID available for multi-tenant isolation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request, createAuthenticatedMember }) => {
      // GIVEN: Server with auth and organization support
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'member',
        },
        tables: [
          {
            id: 1,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'org_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: { read: 'authenticated' },
          },
        ],
      })

      // Insert records for two different organizations
      await executeQuery(`INSERT INTO documents (title, org_id) VALUES ('Doc A', 'org-1')`)
      await executeQuery(`INSERT INTO documents (title, org_id) VALUES ('Doc B', 'org-2')`)

      // WHEN: User from org-1 queries records
      await createAuthenticatedMember({ email: 'user@org1.com' })
      const response = await request.get('/api/tables/1/records')

      // THEN: Session org context is available for RLS-based filtering
      expect(response.status()).toBe(200)
      const data = await response.json()
      // With RLS enabled, only org-1 records should be returned
      // Without RLS, all records returned (session context still set)
      expect(data.records.length).toBeGreaterThanOrEqual(1)
    }
  )

  test.fixme(
    'APP-TABLES-SESSION-CONTEXT-003: should make session user role available for RBAC evaluation',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      executeQuery,
      request,
      createAuthenticatedMember,
      createAuthenticatedViewer,
      signOut,
    }) => {
      // GIVEN: Server with role-based permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Editor', level: 30 }],
        },
        tables: [
          {
            id: 1,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: { read: ['member'] },
          },
        ],
      })
      await executeQuery(`INSERT INTO articles (title) VALUES ('Article 1')`)

      // WHEN: Member queries (role = member, allowed by read: ['member'])
      await createAuthenticatedMember({ email: 'member@example.com' })
      const memberResponse = await request.get('/api/tables/1/records')
      expect(memberResponse.status()).toBe(200)

      // WHEN: Viewer queries (role = viewer, denied by read: ['member'])
      await signOut()
      await createAuthenticatedViewer({ email: 'viewer@example.com' })
      const viewerResponse = await request.get('/api/tables/1/records')

      // THEN: Role-based permission check uses session role context
      expect(viewerResponse.status()).toBe(403)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'APP-TABLES-SESSION-CONTEXT-REGRESSION: session context workflow',
    { tag: '@regression' },
    async ({
      startServerWithSchema,
      executeQuery,
      request,
      createAuthenticatedMember,
      createAuthenticatedViewer,
      signOut,
    }) => {
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Editor', level: 30 }],
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: { read: ['member'] },
          },
        ],
      })
      await executeQuery(`INSERT INTO tasks (title) VALUES ('Task 1')`)

      await test.step('001: Session context variables set at connection start', async () => {
        await createAuthenticatedMember({ email: 'member@example.com' })
        const response = await request.get('/api/tables/1/records')
        expect(response.status()).toBe(200)
        await signOut()
      })

      await test.step('002: Records scoped to user context', async () => {
        await createAuthenticatedMember({ email: 'member2@example.com' })
        const response = await request.get('/api/tables/1/records')
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.records).toHaveLength(1)
        await signOut()
      })

      await test.step('003: Role-based access control via session role', async () => {
        await createAuthenticatedViewer({ email: 'viewer@example.com' })
        const response = await request.get('/api/tables/1/records')
        expect(response.status()).toBe(403)
      })
    }
  )
})
