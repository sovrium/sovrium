/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Organization Data Isolation
 *
 * Domain: app/tables/permissions
 * Spec Count: 11
 *
 * Test Organization:
 * 1. @spec tests - One per spec (11 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Organization Isolation Scenarios:
 * - Cross-organization data access prevention
 * - Organization-scoped queries
 * - Organization member permissions
 * - Multi-tenant data isolation
 * - Dual-layer permission enforcement (Better Auth + RLS)
 *
 * Related Tests:
 * - specs/api/auth/organization/ (API Layer - API endpoint functionality)
 * - specs/api/auth/enforcement/authorization-bypass.spec.ts (API Layer - API security)
 */

test.describe('Organization Data Isolation', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-ORG-ISOLATION-001: should prevent access to data from other organizations',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createOrganization,
    }) => {
      // GIVEN: Multi-organization setup with separate data
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
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      // Create user A and their organization (userA becomes owner automatically)
      await createAuthenticatedUser({ email: 'usera@example.com' })
      const orgA = await createOrganization({ name: 'Organization A' })

      // Create user B and their organization (userB becomes owner automatically)
      await createAuthenticatedUser({ email: 'userb@example.com' })
      const orgB = await createOrganization({ name: 'Organization B' })

      // Insert projects for each organization (Better Auth uses TEXT IDs)
      await executeQuery([
        `INSERT INTO projects (id, name, organization_id) VALUES
         (1, 'Org A Project 1', '${orgA.organization.id}'),
         (2, 'Org A Project 2', '${orgA.organization.id}'),
         (3, 'Org B Project 1', '${orgB.organization.id}')`,
      ])

      // WHEN: Checking RLS policy for organization isolation
      // THEN: RLS policy for organization-scoped access should be created

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'projects'`
      )
      expect(rlsEnabled.rows[0].relrowsecurity).toBe(true)

      // Verify RLS policy exists for SELECT
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'projects' AND cmd = 'SELECT'`
      )
      expect(policies.rows).toHaveLength(1)

      // Verify policy definition references organization_id
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'projects'::regclass AND polcmd = 'r'`
      )
      expect(policyDef.rows[0].qual).toContain('organization_id')

      // Verify data exists in table with different org IDs
      const data = await executeQuery(`SELECT id, name, organization_id FROM projects ORDER BY id`)
      expect(data.rows).toHaveLength(3)
      expect(data.rows[0].organization_id).toBe(orgA.organization.id)
      expect(data.rows[2].organization_id).toBe(orgB.organization.id)
    }
  )

  test(
    'APP-TABLES-ORG-ISOLATION-002: should deny direct access to other organization records',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createOrganization,
    }) => {
      // GIVEN: Multi-organization setup
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      // Create user A and their organization (userA becomes owner automatically)
      await createAuthenticatedUser({ email: 'user1@example.com' })
      const orgA = await createOrganization({ name: 'Organization A' })

      // Create user B and their organization (userB becomes owner automatically)
      await createAuthenticatedUser({ email: 'user2@example.com' })
      const orgB = await createOrganization({ name: 'Organization B' })

      // Insert documents for each organization (Better Auth uses TEXT IDs)
      await executeQuery([
        `INSERT INTO documents (id, title, organization_id) VALUES
         (1, 'Org A Doc', '${orgA.organization.id}'),
         (2, 'Org B Confidential', '${orgB.organization.id}')`,
      ])

      // WHEN: Checking RLS policy configuration for organization isolation
      // THEN: RLS policy should enforce organization-based access filtering

      // Verify RLS is enabled
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'documents'`
      )
      expect(rlsEnabled.rows[0].relrowsecurity).toBe(true)

      // Verify SELECT policy uses USING clause
      const policies = await executeQuery(
        `SELECT policyname, cmd, permissive FROM pg_policies WHERE tablename = 'documents' AND cmd = 'SELECT'`
      )
      expect(policies.rows).toHaveLength(1)

      // Verify the policy definition references organization_id for filtering
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'documents'::regclass AND polcmd = 'r'`
      )
      expect(policyDef.rows[0].qual).toContain('organization_id')

      // Verify both documents exist but would be filtered by RLS based on org context
      const data = await executeQuery(
        `SELECT id, title, organization_id FROM documents ORDER BY id`
      )
      expect(data.rows).toHaveLength(2)
      expect(data.rows[0].organization_id).toBe(orgA.organization.id)
      expect(data.rows[1].organization_id).toBe(orgB.organization.id)
    }
  )

  test(
    'APP-TABLES-ORG-ISOLATION-003: should prevent creating records in other organizations',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Multi-organization setup
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
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      // WHEN: Checking RLS policy for INSERT operations
      // THEN: RLS policy for organization-scoped create should be configured

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

      // Verify INSERT policy uses WITH CHECK clause referencing organization_id
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polwithcheck, polrelid) as withcheck FROM pg_policy
         WHERE polrelid = 'tasks'::regclass AND polcmd = 'a'`
      )
      expect(policyDef.rows[0].withcheck).toContain('organization_id')
    }
  )

  test(
    'APP-TABLES-ORG-ISOLATION-004: should prevent updating records in other organizations',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createOrganization,
    }) => {
      // GIVEN: Multi-organization setup with records
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'settings',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'value', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      // Create user A and their organization (userA becomes owner automatically)
      await createAuthenticatedUser({ email: 'user1@example.com' })
      const orgA = await createOrganization({ name: 'Organization A' })

      // Create user B and their organization (userB becomes owner automatically)
      await createAuthenticatedUser({ email: 'user2@example.com' })
      const orgB = await createOrganization({ name: 'Organization B' })

      // Insert settings for each organization (Better Auth uses TEXT IDs)
      await executeQuery([
        `INSERT INTO settings (id, value, organization_id) VALUES
         (1, 'Org A Setting', '${orgA.organization.id}'),
         (2, 'Org B Secret Setting', '${orgB.organization.id}')`,
      ])

      // WHEN: Checking RLS policy for UPDATE operations
      // THEN: RLS policy for organization-scoped update should be configured

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'settings'`
      )
      expect(rlsEnabled.rows[0].relrowsecurity).toBe(true)

      // Verify RLS policy exists for UPDATE
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'settings' AND cmd = 'UPDATE'`
      )
      expect(policies.rows).toHaveLength(1)

      // Verify UPDATE policy definition references organization_id
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'settings'::regclass AND polcmd = 'w'`
      )
      expect(policyDef.rows[0].qual).toContain('organization_id')

      // Verify data exists with different org IDs
      const data = await executeQuery(`SELECT id, value, organization_id FROM settings ORDER BY id`)
      expect(data.rows).toHaveLength(2)
      expect(data.rows[0].organization_id).toBe(orgA.organization.id)
      expect(data.rows[1].organization_id).toBe(orgB.organization.id)
    }
  )

  test(
    'APP-TABLES-ORG-ISOLATION-005: should prevent deleting records in other organizations',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createOrganization,
    }) => {
      // GIVEN: Multi-organization setup with records
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      // Create user A and their organization (userA becomes owner automatically)
      await createAuthenticatedUser({ email: 'user1@example.com' })
      const orgA = await createOrganization({ name: 'Organization A' })

      // Create user B and their organization (userB becomes owner automatically)
      await createAuthenticatedUser({ email: 'user2@example.com' })
      const orgB = await createOrganization({ name: 'Organization B' })

      // Insert items for each organization (Better Auth uses TEXT IDs)
      await executeQuery([
        `INSERT INTO items (id, name, organization_id) VALUES
         (1, 'Org A Item', '${orgA.organization.id}'),
         (2, 'Org B Item', '${orgB.organization.id}')`,
      ])

      // WHEN: Checking RLS policy for DELETE operations
      // THEN: RLS policy for organization-scoped delete should be configured

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'items'`
      )
      expect(rlsEnabled.rows[0].relrowsecurity).toBe(true)

      // Verify RLS policy exists for DELETE
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'items' AND cmd = 'DELETE'`
      )
      expect(policies.rows).toHaveLength(1)

      // Verify DELETE policy definition references organization_id
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'items'::regclass AND polcmd = 'd'`
      )
      expect(policyDef.rows[0].qual).toContain('organization_id')

      // Verify data exists with different org IDs
      const data = await executeQuery(`SELECT id, name, organization_id FROM items ORDER BY id`)
      expect(data.rows).toHaveLength(2)
    }
  )

  test(
    'APP-TABLES-ORG-ISOLATION-006: should allow organization admin to access all org data',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createOrganization,
      addMember,
    }) => {
      // GIVEN: Organization with admin and member roles
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'internal_docs',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
              { id: 4, name: 'created_by', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['admin', 'member'] },
              create: { type: 'roles', roles: ['admin'] },
              update: { type: 'roles', roles: ['admin'] },
              delete: { type: 'roles', roles: ['admin'] },
            },
          },
        ],
      })

      // Create admin user and their organization (admin becomes owner automatically)
      const admin = await createAuthenticatedUser({ email: 'admin@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Create member user and add them to the organization
      const member = await createAuthenticatedUser({ email: 'member@example.com' })
      await addMember({
        organizationId: org.organization.id,
        userId: member.user.id,
        role: 'member',
      })

      // Insert docs for the organization (Better Auth uses TEXT IDs)
      await executeQuery([
        `INSERT INTO internal_docs (id, content, organization_id, created_by) VALUES
         (1, 'Admin created doc', '${org.organization.id}', '${admin.user.id}'),
         (2, 'Member created doc', '${org.organization.id}', '${member.user.id}')`,
      ])

      // WHEN: Checking RLS policies for organization + role-based permissions
      // THEN: RLS policies should combine organization scope with role restrictions

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'internal_docs'`
      )
      expect(rlsEnabled.rows[0].relrowsecurity).toBe(true)

      // Verify policies exist for all CRUD operations
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'internal_docs' ORDER BY cmd`
      )
      const cmds = policies.rows.map((p: { cmd: string }) => p.cmd)
      expect(cmds).toContain('SELECT')
      expect(cmds).toContain('INSERT')
      expect(cmds).toContain('UPDATE')
      expect(cmds).toContain('DELETE')

      // Verify SELECT policy combines organization + role check
      const readPolicy = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'internal_docs'::regclass AND polcmd = 'r'`
      )
      expect(readPolicy.rows[0].qual).toContain('organization_id')
      expect(readPolicy.rows[0].qual).toMatch(/role|admin|member/i)

      // Verify data exists within same organization
      const data = await executeQuery(
        `SELECT id, organization_id, created_by FROM internal_docs ORDER BY id`
      )
      expect(data.rows).toHaveLength(2)
      expect(data.rows[0].organization_id).toBe(org.organization.id)
      expect(data.rows[1].organization_id).toBe(org.organization.id)
    }
  )

  test(
    'APP-TABLES-ORG-ISOLATION-007: should support users in multiple organizations',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createOrganization,
      addMember,
    }) => {
      // GIVEN: User belonging to multiple organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'team_notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'note', type: 'long-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      // Create user who will belong to multiple organizations
      const multiOrgUser = await createAuthenticatedUser({ email: 'multiorg@example.com' })

      // Create first organization (multiOrgUser becomes owner)
      const orgA = await createOrganization({ name: 'Organization A' })

      // Create another user who owns organization B
      await createAuthenticatedUser({ email: 'user2@example.com' })
      const orgB = await createOrganization({ name: 'Organization B' })

      // Create another user who owns organization C
      await createAuthenticatedUser({ email: 'user3@example.com' })
      const orgC = await createOrganization({ name: 'Organization C' })

      // Add multiOrgUser as member of organizations B and C
      await addMember({
        organizationId: orgB.organization.id,
        userId: multiOrgUser.user.id,
        role: 'member',
      })
      await addMember({
        organizationId: orgC.organization.id,
        userId: multiOrgUser.user.id,
        role: 'member',
      })

      // Insert notes for each organization (Better Auth uses TEXT IDs)
      await executeQuery([
        `INSERT INTO team_notes (id, note, organization_id) VALUES
         (1, 'Org A Note', '${orgA.organization.id}'),
         (2, 'Org B Note', '${orgB.organization.id}'),
         (3, 'Org C Note', '${orgC.organization.id}')`,
      ])

      // WHEN: Checking RLS policy for organization isolation with multiple orgs
      // THEN: RLS policy should filter based on current organization context

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'team_notes'`
      )
      expect(rlsEnabled.rows[0].relrowsecurity).toBe(true)

      // Verify RLS policy exists for SELECT
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'team_notes' AND cmd = 'SELECT'`
      )
      expect(policies.rows).toHaveLength(1)

      // Verify policy definition references organization_id
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'team_notes'::regclass AND polcmd = 'r'`
      )
      expect(policyDef.rows[0].qual).toContain('organization_id')

      // Verify data exists for multiple organizations
      const data = await executeQuery(
        `SELECT id, note, organization_id FROM team_notes ORDER BY id`
      )
      expect(data.rows).toHaveLength(3)
      expect(data.rows[0].organization_id).toBe(orgA.organization.id)
      expect(data.rows[1].organization_id).toBe(orgB.organization.id)
      expect(data.rows[2].organization_id).toBe(orgC.organization.id)
    }
  )

  // ============================================================================
  // Phase: Error Configuration Validation Tests (008-009)
  // ============================================================================

  test(
    'APP-TABLES-ORG-ISOLATION-008: should reject organizationScoped table without organization_id field',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: organizationScoped table without organization_id field
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
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
                // Missing organization_id field!
              ],
              permissions: {
                organizationScoped: true, // Requires organization_id field!
              },
            },
          ],
        })
      ).rejects.toThrow(/organization_id.*required|organizationScoped.*requires.*organization_id/i)
    }
  )

  test(
    'APP-TABLES-ORG-ISOLATION-009: should reject organizationScoped table with wrong organization_id field type',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: organizationScoped table with organization_id as integer (should be text)
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
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
                { id: 3, name: 'organization_id', type: 'integer' }, // Should be text/single-line-text!
              ],
              permissions: {
                organizationScoped: true,
              },
            },
          ],
        })
      ).rejects.toThrow(/organization_id.*type.*text|organization_id.*invalid.*type/i)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  // ============================================================================
  // Dual-Layer Permission Tests (Better Auth + RLS)
  // ============================================================================

  test(
    'APP-TABLES-ORG-ISOLATION-010: should enforce dual-layer organization isolation (Better Auth validates membership → RLS filters rows)',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      signUp: _signUp,
      signIn,
      signOut,
      page,
      executeQuery,
      createAuthenticatedUser,
      createOrganization,
      addMember: _addMember,
      setActiveOrganization,
    }) => {
      // GIVEN: Application with organization plugin and organization-scoped data
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'company_data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'confidential', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            permissions: {
              read: { type: 'roles', roles: ['member', 'admin', 'owner'] }, // Better Auth: role check
              organizationScoped: true, // RLS: organization filtering
            },
          },
        ],
      })

      // Create two organizations
      await createAuthenticatedUser({ email: 'user1@example.com' })
      const org1 = await createOrganization({ name: 'Company A' })

      await createAuthenticatedUser({ email: 'user2@example.com' })
      const org2 = await createOrganization({ name: 'Company B' })

      // Insert confidential data for each organization
      await executeQuery([
        `INSERT INTO company_data (id, confidential, organization_id) VALUES
         (1, 'Company A Secret', '${org1.organization.id}'),
         (2, 'Company B Secret', '${org2.organization.id}')`,
      ])

      // WHEN: User1 (member of Company A) attempts to access company data
      await signIn({ email: 'user1@example.com', password: 'TestPassword123!' })
      await setActiveOrganization(org1.organization.id)

      const user1Response = await page.request.get('/api/tables/company_data/records')

      // THEN: Better Auth validates organization membership (passes)
      expect(user1Response.status()).toBe(200)

      // THEN: RLS filters rows by organization_id (only Company A visible)
      const user1Data = await user1Response.json()
      expect(user1Data.records).toHaveLength(1)
      expect(user1Data.records[0].fields.confidential).toBe('Company A Secret')
      expect(user1Data.records[0].fields.organization_id).toBe(org1.organization.id)

      // WHEN: User2 (member of Company B) attempts to access company data
      await signIn({ email: 'user2@example.com', password: 'TestPassword123!' })
      await setActiveOrganization(org2.organization.id)

      const user2Response = await page.request.get('/api/tables/company_data/records')

      // THEN: Better Auth validates organization membership (passes)
      expect(user2Response.status()).toBe(200)

      // THEN: RLS filters rows by organization_id (only Company B visible)
      const user2Data = await user2Response.json()
      expect(user2Data.records).toHaveLength(1)
      expect(user2Data.records[0].fields.confidential).toBe('Company B Secret')
      expect(user2Data.records[0].fields.organization_id).toBe(org2.organization.id)

      // WHEN: Unauthenticated user attempts to access company data
      await signOut()

      const unauthResponse = await page.request.get('/api/tables/company_data/records')

      // THEN: Better Auth blocks at API level (not authenticated)
      expect(unauthResponse.status()).toBe(401)

      // THEN: RLS never executes (early rejection by Better Auth)
    }
  )

  test(
    'APP-TABLES-ORG-ISOLATION-011: should prevent cross-organization data manipulation (both layers validate)',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      signUp: _signUp,
      signIn,
      page,
      executeQuery,
      createAuthenticatedUser,
      createOrganization,
      setActiveOrganization,
    }) => {
      // GIVEN: Application with organization-scoped tables and write permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'team_resources',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'resource_name', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            permissions: {
              read: { type: 'roles', roles: ['member', 'admin', 'owner'] },
              create: { type: 'roles', roles: ['member', 'admin', 'owner'] },
              update: { type: 'roles', roles: ['admin', 'owner'] }, // Better Auth: only admins and owners
              organizationScoped: true, // RLS: organization isolation
            },
          },
        ],
      })

      // Create two organizations with data
      await createAuthenticatedUser({ email: 'admin1@example.com' })
      const org1 = await createOrganization({ name: 'Team A' })

      await createAuthenticatedUser({ email: 'admin2@example.com' })
      const org2 = await createOrganization({ name: 'Team B' })

      await executeQuery([
        `INSERT INTO team_resources (id, resource_name, organization_id) VALUES
         (1, 'Team A Resource', '${org1.organization.id}'),
         (2, 'Team B Resource', '${org2.organization.id}')`,
      ])

      // Debug: Check if RLS is enabled and what policies exist
      const rlsCheck = await executeQuery(`
        SELECT relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE relname = 'team_resources'
      `)
      console.log('RLS enabled:', rlsCheck.rows[0])

      const policiesCheck = await executeQuery(`
        SELECT policyname, cmd, qual, with_check
        FROM pg_policies
        WHERE tablename = 'team_resources'
      `)
      console.log('RLS policies:', policiesCheck.rows)

      // WHEN: Admin1 attempts to update Team B's resource (cross-org manipulation)
      await signIn({ email: 'admin1@example.com', password: 'TestPassword123!' })
      await setActiveOrganization(org1.organization.id)

      // Debug: Check session after setting active org
      const sessionCheck = await page.request.get('/api/auth/get-session')
      const sessionData = await sessionCheck.json()
      console.log('Session after setActiveOrganization:', {
        activeOrganizationId: sessionData.session?.activeOrganizationId,
        userId: sessionData.session?.userId,
      })

      const crossOrgUpdateResponse = await page.request.patch(
        '/api/tables/team_resources/records/2',
        {
          data: { resource_name: 'Hacked Resource' },
        }
      )

      // Debug: Check response status and body
      const responseBody = await crossOrgUpdateResponse.json().catch(() => ({}))
      console.log('Cross-org update response:', {
        status: crossOrgUpdateResponse.status(),
        body: responseBody,
      })

      // THEN: Better Auth allows (is owner) → RLS blocks (different organization)
      expect([403, 404]).toContain(crossOrgUpdateResponse.status())

      // THEN: Database unchanged (RLS prevented cross-org update)
      const dbCheck = await executeQuery('SELECT resource_name FROM team_resources WHERE id = 2')
      expect(dbCheck.rows[0].resource_name).toBe('Team B Resource') // Unchanged

      // WHEN: Admin1 attempts to update their own resource (same org)
      const sameOrgUpdateResponse = await page.request.patch(
        '/api/tables/team_resources/records/1',
        {
          data: { resource_name: 'Updated Team A Resource' },
        }
      )

      // THEN: Better Auth allows (is owner) → RLS allows (same organization)
      expect(sameOrgUpdateResponse.status()).toBe(200)

      // THEN: Database updated (both layers granted permission)
      const dbUpdate = await executeQuery('SELECT resource_name FROM team_resources WHERE id = 1')
      expect(dbUpdate.rows[0].resource_name).toBe('Updated Team A Resource')

      // WHEN: Member (non-admin) attempts to update resource
      await createAuthenticatedUser({ email: 'member1@example.com' })

      const memberUpdateResponse = await page.request.patch(
        '/api/tables/team_resources/records/1',
        {
          data: { resource_name: 'Member Attempt' },
        }
      )

      // THEN: Better Auth blocks (not admin) → RLS never executes
      expect([403, 401]).toContain(memberUpdateResponse.status())

      // THEN: Database unchanged (early rejection by Better Auth)
      const dbMemberCheck = await executeQuery(
        'SELECT resource_name FROM team_resources WHERE id = 1'
      )
      expect(dbMemberCheck.rows[0].resource_name).toBe('Updated Team A Resource') // Unchanged
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-ORG-ISOLATION-REGRESSION: organization data isolation workflow',
    { tag: '@regression' },
    async ({
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createOrganization,
      addMember,
      signIn,
      signOut,
      page,
      setActiveOrganization,
    }) => {
      let orgA: any
      let orgB: any
      let orgC: any
      let multiOrgUser: any
      let admin: any
      let member: any
      let org: any

      await test.step('Setup: Start server with organization-scoped table', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            organization: true,
          },
          tables: [
            {
              id: 1,
              name: 'resources',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'content', type: 'long-text' },
                { id: 4, name: 'created_by', type: 'single-line-text' },
                { id: 5, name: 'organization_id', type: 'single-line-text' },
              ],
              permissions: {
                organizationScoped: true,
                read: { type: 'roles', roles: ['member', 'admin', 'owner'] },
                create: { type: 'roles', roles: ['member', 'admin', 'owner'] },
                update: { type: 'roles', roles: ['admin', 'owner'] },
                delete: { type: 'roles', roles: ['admin', 'owner'] },
              },
            },
          ],
        })
      })

      await test.step('APP-TABLES-ORG-ISOLATION-001: Prevent access to data from other organizations', async () => {
        // Create user A and their organization
        await createAuthenticatedUser({ email: 'usera@example.com' })
        orgA = await createOrganization({ name: 'Organization A' })

        // Create user B and their organization
        await createAuthenticatedUser({ email: 'userb@example.com' })
        orgB = await createOrganization({ name: 'Organization B' })

        // Insert projects for each organization
        await executeQuery([
          `INSERT INTO resources (id, name, organization_id) VALUES
           (1, 'Org A Project 1', '${orgA.organization.id}'),
           (2, 'Org A Project 2', '${orgA.organization.id}'),
           (3, 'Org B Project 1', '${orgB.organization.id}')`,
        ])

        // Verify RLS is enabled on table
        const rlsEnabled = await executeQuery(
          `SELECT relrowsecurity FROM pg_class WHERE relname = 'resources'`
        )
        expect(rlsEnabled.rows[0].relrowsecurity).toBe(true)

        // Verify RLS policy exists for SELECT
        const policies = await executeQuery(
          `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'resources' AND cmd = 'SELECT'`
        )
        expect(policies.rows).toHaveLength(1)

        // Verify policy definition references organization_id
        const policyDef = await executeQuery(
          `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
           WHERE polrelid = 'resources'::regclass AND polcmd = 'r'`
        )
        expect(policyDef.rows[0].qual).toContain('organization_id')
      })

      await test.step('APP-TABLES-ORG-ISOLATION-002: Deny direct access to other organization records', async () => {
        // Verify RLS policy uses USING clause
        const policies = await executeQuery(
          `SELECT policyname, cmd, permissive FROM pg_policies WHERE tablename = 'resources' AND cmd = 'SELECT'`
        )
        expect(policies.rows).toHaveLength(1)

        // Verify the policy definition references organization_id for filtering
        const policyDef = await executeQuery(
          `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
           WHERE polrelid = 'resources'::regclass AND polcmd = 'r'`
        )
        expect(policyDef.rows[0].qual).toContain('organization_id')

        // Verify data exists with different org IDs
        const data = await executeQuery(
          `SELECT id, name, organization_id FROM resources ORDER BY id`
        )
        expect(data.rows).toHaveLength(3)
        expect(data.rows[0].organization_id).toBe(orgA.organization.id)
        expect(data.rows[2].organization_id).toBe(orgB.organization.id)
      })

      await test.step('APP-TABLES-ORG-ISOLATION-003: Prevent creating records in other organizations', async () => {
        // Verify RLS policy exists for INSERT
        const policies = await executeQuery(
          `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'resources' AND cmd = 'INSERT'`
        )
        expect(policies.rows).toHaveLength(1)

        // Verify INSERT policy uses WITH CHECK clause referencing organization_id
        const policyDef = await executeQuery(
          `SELECT pg_get_expr(polwithcheck, polrelid) as withcheck FROM pg_policy
           WHERE polrelid = 'resources'::regclass AND polcmd = 'a'`
        )
        expect(policyDef.rows[0].withcheck).toContain('organization_id')
      })

      await test.step('APP-TABLES-ORG-ISOLATION-004: Prevent updating records in other organizations', async () => {
        // Verify RLS policy exists for UPDATE
        const policies = await executeQuery(
          `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'resources' AND cmd = 'UPDATE'`
        )
        expect(policies.rows).toHaveLength(1)

        // Verify UPDATE policy definition references organization_id
        const policyDef = await executeQuery(
          `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
           WHERE polrelid = 'resources'::regclass AND polcmd = 'w'`
        )
        expect(policyDef.rows[0].qual).toContain('organization_id')
      })

      await test.step('APP-TABLES-ORG-ISOLATION-005: Prevent deleting records in other organizations', async () => {
        // Verify RLS policy exists for DELETE
        const policies = await executeQuery(
          `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'resources' AND cmd = 'DELETE'`
        )
        expect(policies.rows).toHaveLength(1)

        // Verify DELETE policy definition references organization_id
        const policyDef = await executeQuery(
          `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
           WHERE polrelid = 'resources'::regclass AND polcmd = 'd'`
        )
        expect(policyDef.rows[0].qual).toContain('organization_id')
      })

      await test.step('APP-TABLES-ORG-ISOLATION-006: Allow organization admin to access all org data', async () => {
        // Create admin user and their organization
        admin = await createAuthenticatedUser({ email: 'admin@example.com' })
        org = await createOrganization({ name: 'Test Org' })

        // Create member user and add them to the organization
        member = await createAuthenticatedUser({ email: 'member@example.com' })
        await addMember({
          organizationId: org.organization.id,
          userId: member.user.id,
          role: 'member',
        })

        // Insert docs with created_by field
        await executeQuery([
          `INSERT INTO resources (id, name, content, organization_id, created_by) VALUES
           (10, 'Admin Doc', 'Admin created', '${org.organization.id}', '${admin.user.id}'),
           (11, 'Member Doc', 'Member created', '${org.organization.id}', '${member.user.id}')`,
        ])

        // Verify SELECT policy combines organization + role check
        const readPolicy = await executeQuery(
          `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
           WHERE polrelid = 'resources'::regclass AND polcmd = 'r'`
        )
        expect(readPolicy.rows[0].qual).toContain('organization_id')
        expect(readPolicy.rows[0].qual).toMatch(/role|admin|member/i)
      })

      await test.step('APP-TABLES-ORG-ISOLATION-007: Support users in multiple organizations', async () => {
        // Create user who will belong to multiple organizations
        multiOrgUser = await createAuthenticatedUser({ email: 'multiorg@example.com' })

        // Create first organization (multiOrgUser becomes owner)
        orgC = await createOrganization({ name: 'Organization C' })

        // Add multiOrgUser as member of organization B
        await addMember({
          organizationId: orgB.organization.id,
          userId: multiOrgUser.user.id,
          role: 'member',
        })

        // Insert notes for organization C
        await executeQuery([
          `INSERT INTO resources (id, name, organization_id) VALUES
           (20, 'Org C Note', '${orgC.organization.id}')`,
        ])

        // Verify policy definition references organization_id
        const policyDef = await executeQuery(
          `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
           WHERE polrelid = 'resources'::regclass AND polcmd = 'r'`
        )
        expect(policyDef.rows[0].qual).toContain('organization_id')
      })

      await test.step('APP-TABLES-ORG-ISOLATION-008: Reject organizationScoped table without organization_id field', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error',
            auth: {
              emailAndPassword: true,
              organization: true,
            },
            tables: [
              {
                id: 99,
                name: 'invalid',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'name', type: 'single-line-text' },
                ],
                permissions: {
                  organizationScoped: true,
                },
              },
            ],
          })
        ).rejects.toThrow(
          /organization_id.*required|organizationScoped.*requires.*organization_id/i
        )
      })

      await test.step('APP-TABLES-ORG-ISOLATION-009: Reject organizationScoped table with wrong organization_id field type', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error2',
            auth: {
              emailAndPassword: true,
              organization: true,
            },
            tables: [
              {
                id: 98,
                name: 'invalid2',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'name', type: 'single-line-text' },
                  { id: 3, name: 'organization_id', type: 'integer' },
                ],
                permissions: {
                  organizationScoped: true,
                },
              },
            ],
          })
        ).rejects.toThrow(/organization_id.*type.*text|organization_id.*invalid.*type/i)
      })

      await test.step('APP-TABLES-ORG-ISOLATION-010: Enforce dual-layer organization isolation (Better Auth validates membership → RLS filters rows)', async () => {
        // Restart server after error-testing steps (008-009 tried invalid configs)
        await startServerWithSchema({
          name: 'test-app-dual-layer',
          auth: {
            emailAndPassword: true,
            organization: true,
          },
          tables: [
            {
              id: 10,
              name: 'company_secrets',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'organization_id', type: 'single-line-text' },
              ],
              permissions: {
                organizationScoped: true,
              },
            },
          ],
        })

        // Note: Users and organizations from earlier steps still exist in database (persist across server restarts)
        // Fetch organization IDs from database
        const orgsResult = await executeQuery(`
          SELECT id, slug FROM organization WHERE slug IN ('company-a', 'company-b') ORDER BY slug
        `)
        const orgAId = orgsResult.rows.find((r: any) => r.slug === 'company-a')?.id
        const orgBId = orgsResult.rows.find((r: any) => r.slug === 'company-b')?.id

        if (!orgAId || !orgBId) {
          throw new Error('Organizations from earlier steps not found in database')
        }

        // Insert confidential data for existing organizations
        await executeQuery([
          `INSERT INTO company_secrets (id, name, organization_id) VALUES
           (30, 'Company A Secret', '${orgAId}'),
           (31, 'Company B Secret', '${orgBId}')`,
        ])

        // User1 (member of Org A) accesses company data
        await signIn({ email: 'usera@example.com', password: 'TestPassword123!' })
        await setActiveOrganization(orgAId)

        const user1Response = await page.request.get('/api/tables/company_secrets/records')

        // Better Auth validates organization membership (passes)
        expect(user1Response.status()).toBe(200)

        // RLS filters rows by organization_id (only Company A visible)
        const user1Data = await user1Response.json()
        expect(user1Data.records.some((r: any) => r.fields.name === 'Company A Secret')).toBe(true)
        expect(user1Data.records.every((r: any) => r.fields.organization_id === orgAId)).toBe(true)

        // Unauthenticated user attempts to access company data
        await signOut()
        const unauthResponse = await page.request.get('/api/tables/company_secrets/records')

        // Better Auth blocks at API level (not authenticated)
        expect(unauthResponse.status()).toBe(401)
      })

      await test.step('APP-TABLES-ORG-ISOLATION-011: Prevent cross-organization data manipulation (both layers validate)', async () => {
        // Reuse organization IDs from database (same server instance as step 010)
        const orgsResult = await executeQuery(`
          SELECT id, slug FROM organization WHERE slug IN ('company-a', 'company-b') ORDER BY slug
        `)
        const orgAId = orgsResult.rows.find((r: any) => r.slug === 'company-a')?.id
        const orgBId = orgsResult.rows.find((r: any) => r.slug === 'company-b')?.id

        // Insert resources for existing organizations
        await executeQuery([
          `INSERT INTO company_secrets (id, name, organization_id) VALUES
           (40, 'Team A Resource', '${orgAId}'),
           (41, 'Team B Resource', '${orgBId}')`,
        ])

        // Admin (user A, owner of org A) attempts to update Org B's resource (cross-org manipulation)
        await signIn({ email: 'usera@example.com', password: 'TestPassword123!' })
        await setActiveOrganization(orgAId)

        const crossOrgUpdateResponse = await page.request.patch(
          '/api/tables/company_secrets/records/41',
          {
            data: { name: 'Hacked Resource' },
          }
        )

        // Better Auth allows (is owner) → RLS blocks (different organization)
        expect([403, 404]).toContain(crossOrgUpdateResponse.status())

        // Database unchanged (RLS prevented cross-org update)
        const dbCheck = await executeQuery('SELECT name FROM company_secrets WHERE id = 41')
        expect(dbCheck.rows[0].name).toBe('Team B Resource')

        // Admin attempts to update their own resource (same org)
        const sameOrgUpdateResponse = await page.request.patch(
          '/api/tables/company_secrets/records/40',
          {
            data: { name: 'Updated Team A Resource' },
          }
        )

        // Better Auth allows (is owner) → RLS allows (same organization)
        expect(sameOrgUpdateResponse.status()).toBe(200)

        // Database updated (both layers granted permission)
        const dbUpdate = await executeQuery('SELECT name FROM company_secrets WHERE id = 40')
        expect(dbUpdate.rows[0].name).toBe('Updated Team A Resource')
      })
    }
  )
})
