/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API-Level Organization Isolation
 *
 * PURPOSE: Verify that organization-scoped data is properly isolated in API responses
 *
 * TESTING STRATEGY (Hybrid Approach):
 * - Database-level tests (specs/app/tables/permissions/organization-isolation.spec.ts)
 *   verify that RLS policies correctly filter by organization_id
 * - API-level tests (this file) verify the complete flow:
 *   1. User authenticates with session token
 *   2. Session context sets organization_id from auth
 *   3. API queries use RLS to filter data
 *   4. Response only contains user's organization data
 *
 * SECURITY PRINCIPLE: Multi-tenancy isolation
 * - Users should ONLY see data from their organization
 * - Cross-org access attempts should return 404 (prevent enumeration)
 * - Organization context must propagate from auth → session → RLS
 *
 * Domain: api
 * Spec Count: 7
 */

test.describe('API Organization Isolation', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of organization isolation via API
  // ============================================================================

  test(
    "API-TABLES-PERMISSIONS-ORG-001: should only return records from user's organization in list endpoint",
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Two organizations with separate data
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' },
            },
          },
        ],
      })

      // Create user in Org A
      await createAuthenticatedUser({ email: 'user-a@example.com' })
      const orgA = await createOrganization({ name: 'Organization A' })

      // Insert data for both organizations (simulating multi-tenant data)
      await executeQuery(`
        INSERT INTO projects (id, name, organization_id) VALUES
          (1, 'Org A Project 1', '${orgA.organization.id}'),
          (2, 'Org A Project 2', '${orgA.organization.id}'),
          (3, 'Org B Project 1', 'other-org-id'),
          (4, 'Org B Project 2', 'other-org-id')
      `)

      // WHEN: User from Org A requests projects
      const response = await request.get('/api/tables/1/records')

      // THEN: Only Org A projects should be returned
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(2)
      expect(
        data.records.every((r: any) => r.fields.organization_id === orgA.organization.id)
      ).toBe(true)
      expect(data.records.map((r: any) => r.fields.name)).toContain('Org A Project 1')
      expect(data.records.map((r: any) => r.fields.name)).not.toContain('Org B Project 1')
    }
  )

  test(
    'API-TABLES-PERMISSIONS-ORG-002: should return 404 when accessing record from different organization',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Record exists in Org B but user is in Org A
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' },
            },
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user-a@example.com' })
      await createOrganization({ name: 'Organization A' })

      // Record belongs to different org
      await executeQuery(`
        INSERT INTO projects (id, name, organization_id) VALUES
          (1, 'Other Org Project', 'other-org-id')
      `)

      // WHEN: User from Org A tries to access Org B record by ID
      const response = await request.get('/api/tables/1/records/1')

      // THEN: 404 Not Found (don't leak existence to other orgs)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Record not found')
    }
  )

  test.fixme(
    'API-TABLES-PERMISSIONS-ORG-003: should auto-set organization_id on create when organizationScoped is true',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Organization-scoped table
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' },
              create: { type: 'authenticated' },
            },
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      const org = await createOrganization({ name: 'My Organization' })

      // WHEN: User creates a task without specifying organization_id
      const response = await request.post('/api/tables/1/records', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          title: 'New Task',
          // Note: NOT providing organization_id
        },
      })

      // THEN: Record should be created with user's organization_id auto-set
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data.fields.organization_id).toBe(org.organization.id)

      // Verify in database
      const dbResult = await executeQuery(
        "SELECT organization_id FROM tasks WHERE title = 'New Task'"
      )
      expect(dbResult.rows[0].organization_id).toBe(org.organization.id)
    }
  )

  test(
    'API-TABLES-PERMISSIONS-ORG-004: should reject create with mismatched organization_id',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createOrganization }) => {
      // GIVEN: User attempts to create record for different organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' },
              create: { type: 'authenticated' },
            },
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      const org = await createOrganization({ name: 'My Organization' })

      // WHEN: User tries to create record with different org ID
      const response = await request.post('/api/tables/1/records', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          title: 'Malicious Task',
          organization_id: 'other-org-id', // Attempting to inject different org
        },
      })

      // THEN: Should silently override with correct org (security by design)
      // Rationale: Rejecting with 403 would leak information about org structure.
      // Silently overriding ensures data goes to the correct org regardless of malicious input.
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data.fields.organization_id).toBe(org.organization.id) // Overridden to user's actual org
    }
  )

  test.fixme(
    'API-TABLES-PERMISSIONS-ORG-005: should prevent update to change organization_id',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Record exists in user's organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' },
              update: { type: 'authenticated' },
            },
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      const org = await createOrganization({ name: 'My Organization' })

      await executeQuery(`
        INSERT INTO tasks (id, title, organization_id) VALUES
          (1, 'My Task', '${org.organization.id}')
      `)

      // WHEN: User tries to change organization_id via update
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          organization_id: 'other-org-id', // Attempting to move to different org
        },
      })

      // THEN: Should ignore the org_id field in update (return 200 but don't change org)
      // Rationale: organization_id is a system-managed field that cannot be changed via API.
      // The update succeeds for other fields but org_id is silently ignored.
      expect(response.status()).toBe(200)

      // Verify organization_id was NOT changed (silently ignored)
      const dbResult = await executeQuery('SELECT organization_id FROM tasks WHERE id = 1')
      expect(dbResult.rows[0].organization_id).toBe(org.organization.id)
    }
  )

  test.fixme(
    'API-TABLES-PERMISSIONS-ORG-006: should filter search results by organization',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Records with same name in different organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' },
            },
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      const org = await createOrganization({ name: 'My Organization' })

      // Same project name in different orgs
      await executeQuery(`
        INSERT INTO projects (id, name, organization_id) VALUES
          (1, 'Alpha Project', '${org.organization.id}'),
          (2, 'Alpha Project', 'other-org-id')
      `)

      // WHEN: User searches for "Alpha"
      const response = await request.get('/api/tables/1/records', {
        params: {
          filter: JSON.stringify({
            and: [{ field: 'name', operator: 'contains', value: 'Alpha' }],
          }),
        },
      })

      // THEN: Only the Alpha Project from user's org should be found
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].id).toBe(1) // User's org version
    }
  )

  test(
    'API-TABLES-PERMISSIONS-ORG-007: should prevent delete of records from other organizations',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Record exists in different organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' },
              delete: { type: 'authenticated' },
            },
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      await createOrganization({ name: 'My Organization' })

      // Record in different org
      await executeQuery(`
        INSERT INTO projects (id, name, organization_id) VALUES
          (1, 'Other Org Project', 'other-org-id')
      `)

      // WHEN: User tries to delete record from other org
      const response = await request.delete('/api/tables/1/records/1')

      // THEN: 404 Not Found (record doesn't exist in user's org context)
      expect(response.status()).toBe(404)

      // Verify record still exists in database
      const dbResult = await executeQuery('SELECT COUNT(*) as count FROM projects WHERE id = 1')
      expect(dbResult.rows[0].count).toBe('1')
    }
  )

  // ============================================================================
  // @regression test - Complete workflow validation
  // Generated from 7 @spec tests - covers organization isolation via API
  // ============================================================================

  test.fixme(
    'API-TABLES-PERMISSIONS-ORG-REGRESSION: complete multi-org isolation workflow via API',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
      signOut,
    }) => {
      let orgA: { organization: { id: string } }
      let orgB: { organization: { id: string } }

      await test.step('Setup: Create multi-tenant schema with two organizations', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            organization: true,
          },
          tables: [
            {
              id: 1,
              name: 'projects',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'budget', type: 'currency', currency: 'USD' },
                { id: 4, name: 'organization_id', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                organizationScoped: true,
                read: { type: 'authenticated' },
                create: { type: 'authenticated' },
                update: { type: 'authenticated' },
                delete: { type: 'authenticated' },
              },
            },
          ],
        })

        // User A in Org A
        await createAuthenticatedUser({ email: 'user-a@example.com' })
        orgA = await createOrganization({ name: 'Organization A' })

        await signOut()

        // User B in Org B
        await createAuthenticatedUser({ email: 'user-b@example.com' })
        orgB = await createOrganization({ name: 'Organization B' })
      })

      await test.step('API-TABLES-PERMISSIONS-ORG-003: Auto-sets organization_id on create', async () => {
        // WHEN: User creates project without specifying organization_id
        await signOut()
        await createAuthenticatedUser({ email: 'user-a@example.com' })

        const response = await request.post('/api/tables/1/records', {
          headers: { 'Content-Type': 'application/json' },
          data: { name: 'Org A Project', budget: 100_000 },
        })

        // THEN: Record should be created with user's organization_id auto-set
        expect(response.status()).toBe(201)
        const data = await response.json()
        expect(data.fields.organization_id).toBe(orgA.organization.id)

        // Verify in database
        const dbResult = await executeQuery(
          "SELECT organization_id FROM projects WHERE name = 'Org A Project'"
        )
        expect(dbResult.rows[0].organization_id).toBe(orgA.organization.id)
      })

      await test.step('API-TABLES-PERMISSIONS-ORG-004: Silently overrides mismatched organization_id', async () => {
        // WHEN: User tries to create record with different org ID
        const response = await request.post('/api/tables/1/records', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            name: 'Malicious Project',
            organization_id: 'other-org-id', // Attempting to inject different org
          },
        })

        // THEN: Should silently override with correct org (security by design)
        expect(response.status()).toBe(201)
        const data = await response.json()
        expect(data.fields.organization_id).toBe(orgA.organization.id) // Overridden to user's actual org
      })

      await test.step('API-TABLES-PERMISSIONS-ORG-001: Returns only records from users organization', async () => {
        // Insert Org B project
        await signOut()
        await createAuthenticatedUser({ email: 'user-b@example.com' })
        await request.post('/api/tables/1/records', {
          headers: { 'Content-Type': 'application/json' },
          data: { name: 'Org B Project', budget: 50_000 },
        })

        // Switch to user A
        await signOut()
        await createAuthenticatedUser({ email: 'user-a@example.com' })

        // WHEN: User from Org A requests projects
        const response = await request.get('/api/tables/1/records')

        // THEN: Only Org A projects should be returned
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(
          data.records.every((r: any) => r.fields.organization_id === orgA.organization.id)
        ).toBe(true)
        expect(data.records.map((r: any) => r.fields.name)).toContain('Org A Project')
        expect(data.records.map((r: any) => r.fields.name)).not.toContain('Org B Project')
      })

      await test.step('API-TABLES-PERMISSIONS-ORG-002: Returns 404 for record from different org', async () => {
        // Get Org B project ID
        const orgBProject = await executeQuery(
          `SELECT id FROM projects WHERE name = 'Org B Project'`
        )

        // WHEN: User from Org A tries to access Org B record by ID
        const response = await request.get(`/api/tables/1/records/${orgBProject.rows[0].id}`)

        // THEN: 404 Not Found (don't leak existence to other orgs)
        expect(response.status()).toBe(404)
        const data = await response.json()
        expect(data.error).toBe('Record not found')
      })

      await test.step('API-TABLES-PERMISSIONS-ORG-005: Prevents update to change organization_id', async () => {
        // Get Org A project ID
        const orgAProject = await executeQuery(
          `SELECT id FROM projects WHERE name = 'Org A Project'`
        )

        // WHEN: User tries to change organization_id via update
        const response = await request.patch(`/api/tables/1/records/${orgAProject.rows[0].id}`, {
          headers: { 'Content-Type': 'application/json' },
          data: { organization_id: 'other-org-id' }, // Attempting to move to different org
        })

        // THEN: Should ignore the org_id field in update (return 200 but don't change org)
        expect(response.status()).toBe(200)

        // Verify organization_id was NOT changed (silently ignored)
        const dbResult = await executeQuery(
          `SELECT organization_id FROM projects WHERE id = ${orgAProject.rows[0].id}`
        )
        expect(dbResult.rows[0].organization_id).toBe(orgA.organization.id)
      })

      await test.step('API-TABLES-PERMISSIONS-ORG-006: Filters search results by organization', async () => {
        // Insert same-name project in Org B
        await signOut()
        await createAuthenticatedUser({ email: 'user-b@example.com' })
        await request.post('/api/tables/1/records', {
          headers: { 'Content-Type': 'application/json' },
          data: { name: 'Alpha Project' },
        })

        // Insert same-name project in Org A
        await signOut()
        await createAuthenticatedUser({ email: 'user-a@example.com' })
        await request.post('/api/tables/1/records', {
          headers: { 'Content-Type': 'application/json' },
          data: { name: 'Alpha Project' },
        })

        // WHEN: User searches for "Alpha"
        const response = await request.get('/api/tables/1/records', {
          params: {
            filter: JSON.stringify({
              and: [{ field: 'name', operator: 'contains', value: 'Alpha' }],
            }),
          },
        })

        // THEN: Only the Alpha Project from user's org should be found
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.records).toHaveLength(1)
        expect(data.records[0].fields.organization_id).toBe(orgA.organization.id)
      })

      await test.step('API-TABLES-PERMISSIONS-ORG-007: Prevents delete of records from other org', async () => {
        // Get Org B project ID
        const orgBProject = await executeQuery(
          `SELECT id FROM projects WHERE organization_id = '${orgB.organization.id}' LIMIT 1`
        )

        // WHEN: User from Org A tries to delete Org B record
        const response = await request.delete(`/api/tables/1/records/${orgBProject.rows[0].id}`)

        // THEN: 404 Not Found (record doesn't exist in user's org context)
        expect(response.status()).toBe(404)

        // Verify record still exists in database
        const dbResult = await executeQuery(
          `SELECT COUNT(*) as count FROM projects WHERE id = ${orgBProject.rows[0].id}`
        )
        expect(dbResult.rows[0].count).toBe('1')
      })
    }
  )
})
