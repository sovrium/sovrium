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
 * Spec Count: 7
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

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-001: should prevent access to data from other organizations',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Multi-organization setup with separate data
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'projects',
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

      await executeQuery([
        // Projects
        `INSERT INTO projects (id, name, organization_id) VALUES
         (1, 'Org A Project 1', 1),
         (2, 'Org A Project 2', 1),
         (3, 'Org B Project 1', 2)`,
      ])

      // WHEN: Checking RLS policy for organization isolation
      // THEN: RLS policy for organization-scoped access should be created

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'projects'`
      )
      expect(rlsEnabled[0].relrowsecurity).toBe(true)

      // Verify RLS policy exists for SELECT
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'projects' AND cmd = 'SELECT'`
      )
      expect(policies).toHaveLength(1)

      // Verify policy definition references organization_id
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'projects'::regclass AND polcmd = 'r'`
      )
      expect(policyDef[0].qual).toContain('organization_id')

      // Verify data exists in table with different org IDs
      const data = await executeQuery(`SELECT id, name, organization_id FROM projects ORDER BY id`)
      expect(data).toHaveLength(3)
      expect(data[0].organization_id).toBe(1)
      expect(data[2].organization_id).toBe(2)
    }
  )

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-002: should deny direct access to other organization records',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Multi-organization setup
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'integer' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      await executeQuery([
        `INSERT INTO documents (id, title, organization_id) VALUES
         (1, 'Org A Doc', 1),
         (2, 'Org B Confidential', 2)`,
      ])

      // WHEN: Checking RLS policy configuration for organization isolation
      // THEN: RLS policy should enforce organization-based access filtering

      // Verify RLS is enabled
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'documents'`
      )
      expect(rlsEnabled[0].relrowsecurity).toBe(true)

      // Verify SELECT policy uses USING clause
      const policies = await executeQuery(
        `SELECT policyname, cmd, permissive FROM pg_policies WHERE tablename = 'documents' AND cmd = 'SELECT'`
      )
      expect(policies).toHaveLength(1)

      // Verify the policy definition references organization_id for filtering
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'documents'::regclass AND polcmd = 'r'`
      )
      expect(policyDef[0].qual).toContain('organization_id')

      // Verify both documents exist but would be filtered by RLS based on org context
      const data = await executeQuery(
        `SELECT id, title, organization_id FROM documents ORDER BY id`
      )
      expect(data).toHaveLength(2)
      expect(data[0].organization_id).toBe(1)
      expect(data[1].organization_id).toBe(2)
    }
  )

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-003: should prevent creating records in other organizations',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Multi-organization setup
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'integer' },
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
      expect(rlsEnabled[0].relrowsecurity).toBe(true)

      // Verify RLS policy exists for INSERT
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'tasks' AND cmd = 'INSERT'`
      )
      expect(policies).toHaveLength(1)

      // Verify INSERT policy uses WITH CHECK clause referencing organization_id
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polwithcheck, polrelid) as withcheck FROM pg_policy
         WHERE polrelid = 'tasks'::regclass AND polcmd = 'a'`
      )
      expect(policyDef[0].withcheck).toContain('organization_id')
    }
  )

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-004: should prevent updating records in other organizations',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Multi-organization setup with records
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'settings',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'value', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'integer' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      await executeQuery([
        `INSERT INTO settings (id, value, organization_id) VALUES
         (1, 'Org A Setting', 1),
         (2, 'Org B Secret Setting', 2)`,
      ])

      // WHEN: Checking RLS policy for UPDATE operations
      // THEN: RLS policy for organization-scoped update should be configured

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'settings'`
      )
      expect(rlsEnabled[0].relrowsecurity).toBe(true)

      // Verify RLS policy exists for UPDATE
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'settings' AND cmd = 'UPDATE'`
      )
      expect(policies).toHaveLength(1)

      // Verify UPDATE policy definition references organization_id
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'settings'::regclass AND polcmd = 'w'`
      )
      expect(policyDef[0].qual).toContain('organization_id')

      // Verify data exists with different org IDs
      const data = await executeQuery(`SELECT id, value, organization_id FROM settings ORDER BY id`)
      expect(data).toHaveLength(2)
      expect(data[0].organization_id).toBe(1)
      expect(data[1].organization_id).toBe(2)
    }
  )

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-005: should prevent deleting records in other organizations',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Multi-organization setup with records
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'items',
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

      await executeQuery([
        `INSERT INTO items (id, name, organization_id) VALUES
         (1, 'Org A Item', 1),
         (2, 'Org B Item', 2)`,
      ])

      // WHEN: Checking RLS policy for DELETE operations
      // THEN: RLS policy for organization-scoped delete should be configured

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'items'`
      )
      expect(rlsEnabled[0].relrowsecurity).toBe(true)

      // Verify RLS policy exists for DELETE
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'items' AND cmd = 'DELETE'`
      )
      expect(policies).toHaveLength(1)

      // Verify DELETE policy definition references organization_id
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'items'::regclass AND polcmd = 'd'`
      )
      expect(policyDef[0].qual).toContain('organization_id')

      // Verify data exists with different org IDs
      const data = await executeQuery(`SELECT id, name, organization_id FROM items ORDER BY id`)
      expect(data).toHaveLength(2)
    }
  )

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-006: should allow organization admin to access all org data',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Organization with admin and member roles
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'internal_docs',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'organization_id', type: 'integer' },
              { id: 4, name: 'created_by', type: 'integer' },
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

      await executeQuery([
        `INSERT INTO internal_docs (id, content, organization_id, created_by) VALUES
         (1, 'Admin created doc', 1, 1),
         (2, 'Member created doc', 1, 2)`,
      ])

      // WHEN: Checking RLS policies for organization + role-based permissions
      // THEN: RLS policies should combine organization scope with role restrictions

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'internal_docs'`
      )
      expect(rlsEnabled[0].relrowsecurity).toBe(true)

      // Verify policies exist for all CRUD operations
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'internal_docs' ORDER BY cmd`
      )
      const cmds = policies.map((p: { cmd: string }) => p.cmd)
      expect(cmds).toContain('SELECT')
      expect(cmds).toContain('INSERT')
      expect(cmds).toContain('UPDATE')
      expect(cmds).toContain('DELETE')

      // Verify SELECT policy combines organization + role check
      const readPolicy = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'internal_docs'::regclass AND polcmd = 'r'`
      )
      expect(readPolicy[0].qual).toContain('organization_id')
      expect(readPolicy[0].qual).toMatch(/role|admin|member/i)

      // Verify data exists within same organization
      const data = await executeQuery(
        `SELECT id, organization_id, created_by FROM internal_docs ORDER BY id`
      )
      expect(data).toHaveLength(2)
      expect(data[0].organization_id).toBe(1)
      expect(data[1].organization_id).toBe(1)
    }
  )

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-007: should support users in multiple organizations',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: User belonging to multiple organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'team_notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'note', type: 'long-text' },
              { id: 3, name: 'organization_id', type: 'integer' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      await executeQuery([
        `INSERT INTO team_notes (id, note, organization_id) VALUES
         (1, 'Org A Note', 1),
         (2, 'Org B Note', 2),
         (3, 'Org C Note', 3)`,
      ])

      // WHEN: Checking RLS policy for organization isolation with multiple orgs
      // THEN: RLS policy should filter based on current organization context

      // Verify RLS is enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'team_notes'`
      )
      expect(rlsEnabled[0].relrowsecurity).toBe(true)

      // Verify RLS policy exists for SELECT
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'team_notes' AND cmd = 'SELECT'`
      )
      expect(policies).toHaveLength(1)

      // Verify policy definition references organization_id
      const policyDef = await executeQuery(
        `SELECT pg_get_expr(polqual, polrelid) as qual FROM pg_policy
         WHERE polrelid = 'team_notes'::regclass AND polcmd = 'r'`
      )
      expect(policyDef[0].qual).toContain('organization_id')

      // Verify data exists for multiple organizations
      const data = await executeQuery(
        `SELECT id, note, organization_id FROM team_notes ORDER BY id`
      )
      expect(data).toHaveLength(3)
      expect(data[0].organization_id).toBe(1)
      expect(data[1].organization_id).toBe(2)
      expect(data[2].organization_id).toBe(3)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-008: organization data isolation workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Two organizations with separate data
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'resources',
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

      await executeQuery([
        `INSERT INTO resources (id, name, organization_id) VALUES
         (1, 'My Resource', 1),
         (2, 'Other Org Resource', 2)`,
      ])

      // WHEN: Checking complete organization isolation RLS configuration
      // THEN: All CRUD operations should have organization-scoped policies

      // Test 1: RLS enabled on table
      const rlsEnabled = await executeQuery(
        `SELECT relrowsecurity FROM pg_class WHERE relname = 'resources'`
      )
      expect(rlsEnabled[0].relrowsecurity).toBe(true)

      // Test 2: Policies exist for all CRUD operations
      const policies = await executeQuery(
        `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'resources' ORDER BY cmd`
      )
      const cmds = policies.map((p: { cmd: string }) => p.cmd)
      expect(cmds).toContain('SELECT')
      expect(cmds).toContain('INSERT')
      expect(cmds).toContain('UPDATE')
      expect(cmds).toContain('DELETE')

      // Test 3: All policies reference organization_id
      const policyDefs = await executeQuery(
        `SELECT polcmd, pg_get_expr(polqual, polrelid) as qual, pg_get_expr(polwithcheck, polrelid) as withcheck
         FROM pg_policy WHERE polrelid = 'resources'::regclass`
      )
      const policies2 = policyDefs as unknown as Array<{
        polcmd: string
        qual: string | null
        withcheck: string | null
      }>
      for (const policy of policies2) {
        const def = policy.qual || policy.withcheck
        expect(def).toContain('organization_id')
      }

      // Test 4: Data is stored correctly with different org IDs
      const data = await executeQuery(`SELECT id, name, organization_id FROM resources ORDER BY id`)
      expect(data).toHaveLength(2)
      expect(data[0].name).toBe('My Resource')
      expect(data[0].organization_id).toBe(1)
      expect(data[1].name).toBe('Other Org Resource')
      expect(data[1].organization_id).toBe(2)
    }
  )
})
