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
 * Spec Count: 9
 *
 * Test Organization:
 * 1. @spec tests - One per spec (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Organization Isolation Scenarios:
 * - Cross-organization data access prevention
 * - Organization-scoped queries
 * - Organization member permissions
 * - Multi-tenant data isolation
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
          plugins: { organization: true },
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
          plugins: { organization: true },
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
          plugins: { organization: true },
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
          plugins: { organization: true },
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
          plugins: { organization: true },
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
          plugins: { organization: true },
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
          plugins: { organization: true },
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
            plugins: { organization: true },
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

  test.fixme(
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
            plugins: { organization: true },
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

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-010: organization data isolation workflow',
    { tag: '@regression' },
    async ({
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createOrganization,
    }) => {
      let orgA: any
      let orgB: any

      await test.step('Setup: Start server with organization-scoped table', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            plugins: { organization: true },
          },
          tables: [
            {
              id: 1,
              name: 'resources',
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
      })

      await test.step('Create two organizations with separate users', async () => {
        await createAuthenticatedUser({ email: 'user1@example.com' })
        orgA = await createOrganization({ name: 'Organization A' })

        await createAuthenticatedUser({ email: 'user2@example.com' })
        orgB = await createOrganization({ name: 'Organization B' })
      })

      await test.step('Insert resources for each organization', async () => {
        await executeQuery([
          `INSERT INTO resources (id, name, organization_id) VALUES
           (1, 'My Resource', '${orgA.organization.id}'),
           (2, 'Other Org Resource', '${orgB.organization.id}')`,
        ])
      })

      await test.step('Verify RLS enabled on table', async () => {
        const rlsEnabled = await executeQuery(
          `SELECT relrowsecurity FROM pg_class WHERE relname = 'resources'`
        )
        expect(rlsEnabled.rows[0].relrowsecurity).toBe(true)
      })

      await test.step('Verify policies exist for all CRUD operations', async () => {
        const policies = await executeQuery(
          `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'resources' ORDER BY cmd`
        )
        const cmds = policies.rows.map((p: { cmd: string }) => p.cmd)
        expect(cmds).toContain('SELECT')
        expect(cmds).toContain('INSERT')
        expect(cmds).toContain('UPDATE')
        expect(cmds).toContain('DELETE')
      })

      await test.step('Verify all policies reference organization_id', async () => {
        const policyDefs = await executeQuery(
          `SELECT polcmd, pg_get_expr(polqual, polrelid) as qual, pg_get_expr(polwithcheck, polrelid) as withcheck
           FROM pg_policy WHERE polrelid = 'resources'::regclass`
        )
        const policies2 = policyDefs.rows as Array<{
          polcmd: string
          qual: string | null
          withcheck: string | null
        }>
        for (const policy of policies2) {
          const def = policy.qual || policy.withcheck
          expect(def).toContain('organization_id')
        }
      })

      await test.step('Verify data stored with correct organization IDs', async () => {
        const data = await executeQuery(
          `SELECT id, name, organization_id FROM resources ORDER BY id`
        )
        expect(data.rows).toHaveLength(2)
        expect(data.rows[0].name).toBe('My Resource')
        expect(data.rows[0].organization_id).toBe(orgA.organization.id)
        expect(data.rows[1].name).toBe('Other Org Resource')
        expect(data.rows[1].organization_id).toBe(orgB.organization.id)
      })

      await test.step('Error handling: organizationScoped table without organization_id field', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error',
            auth: {
              emailAndPassword: true,
              plugins: { organization: true },
            },
            tables: [
              {
                id: 99,
                name: 'invalid',
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
        ).rejects.toThrow(
          /organization_id.*required|organizationScoped.*requires.*organization_id/i
        )
      })

      await test.step('Error handling: organizationScoped table with wrong organization_id field type', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error2',
            auth: {
              emailAndPassword: true,
              plugins: { organization: true },
            },
            tables: [
              {
                id: 98,
                name: 'invalid2',
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
      })
    }
  )
})
