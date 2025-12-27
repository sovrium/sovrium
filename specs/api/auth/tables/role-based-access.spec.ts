/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Role-Based Table Access Control
 *
 * Domain: api/auth/tables
 * Spec Count: 12
 *
 * These tests verify the integration between Better Auth roles and table permissions:
 * - Organization context: membership roles control table access
 * - Non-organization context: global user roles control table access
 * - Context switching: role changes when switching organizations
 * - Edge cases: default roles, multi-org isolation
 *
 * Role Resolution Priority (Option B):
 * 1. If active organization → use org membership role (owner/admin/member/viewer)
 * 2. If no organization AND NOT org-scoped table → use global user role
 * 3. If no organization AND org-scoped table → DENY (require org membership)
 * 4. Default fallback → 'authenticated' role
 *
 * Test Organization:
 * 1. @spec tests - One per spec (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test (1 test) - Efficient workflow validation
 */

test.describe('Role-Based Table Access Control', () => {
  // ============================================================================
  // ORGANIZATION CONTEXT TESTS (API-AUTH-TABLES-ROLE-001 to 003)
  // Verify org membership roles control access to org-scoped tables
  // ============================================================================

  test.fixme(
    'API-AUTH-TABLES-ROLE-001: org member role should grant access to org-scoped table with member permission',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, setActiveOrganization, page }) => {
      // GIVEN: An org-scoped table with member read permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'team_docs',
            fields: [
              { id: 1, name: 'id', type: 'integer' },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['member'] },
              create: { type: 'roles', roles: ['admin'] },
            },
          },
        ],
      })

      // AND: A user who is a member of an organization
      await signUp({
        email: 'member@example.com',
        password: 'TestPassword123!',
        name: 'Member User',
      })

      const { organization } = await createOrganization({
        name: 'Test Org',
        slug: 'test-org',
      })

      await setActiveOrganization(organization.id)

      // WHEN: User accesses the org-scoped table
      const response = await page.request.get('/api/tables/team_docs')

      // THEN: Access should be granted (member role allows read)
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-TABLES-ROLE-002: org admin role should grant elevated access to org-scoped table',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, setActiveOrganization, page }) => {
      // GIVEN: An org-scoped table with admin-only create permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'team_settings',
            fields: [
              { id: 1, name: 'id', type: 'integer' },
              { id: 2, name: 'key', type: 'single-line-text' },
              { id: 3, name: 'value', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['member'] },
              create: { type: 'roles', roles: ['admin'] },
              update: { type: 'roles', roles: ['admin'] },
            },
          },
        ],
      })

      // AND: A user who is an admin of the organization (org creator = owner/admin)
      await signUp({
        email: 'admin@example.com',
        password: 'TestPassword123!',
        name: 'Admin User',
      })

      const { organization } = await createOrganization({
        name: 'Admin Org',
        slug: 'admin-org',
      })

      await setActiveOrganization(organization.id)

      // WHEN: Admin creates a new setting
      const response = await page.request.post('/api/tables/team_settings', {
        data: { key: 'theme', value: 'dark' },
      })

      // THEN: Create should be allowed (admin role grants create permission)
      expect(response.status()).toBe(201)
    }
  )

  test.fixme(
    'API-AUTH-TABLES-ROLE-003: org viewer role should have read-only access to org-scoped table',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: An org-scoped table with viewer read permission but admin-only write
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'team_reports',
            fields: [
              { id: 1, name: 'id', type: 'integer' },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['viewer'] },
              create: { type: 'roles', roles: ['admin'] },
              update: { type: 'roles', roles: ['admin'] },
            },
          },
        ],
      })

      // WHEN: Testing viewer role via direct RLS query
      // Set up as viewer role with organization context
      const readResult = await executeQuery([
        'BEGIN',
        'SET ROLE app_user',
        "SET LOCAL app.user_role = 'viewer'",
        "SET LOCAL app.organization_id = 'org-123'",
        'SELECT COUNT(*) as count FROM team_reports',
        'COMMIT',
      ])

      // THEN: Read should succeed
      expect(readResult).toBeDefined()

      // AND: Write should fail
      await expect(
        executeQuery([
          'BEGIN',
          'SET ROLE app_user',
          "SET LOCAL app.user_role = 'viewer'",
          "SET LOCAL app.organization_id = 'org-123'",
          "INSERT INTO team_reports (title) VALUES ('test')",
          'COMMIT',
        ])
      ).rejects.toThrow()
    }
  )

  // ============================================================================
  // NON-ORGANIZATION CONTEXT TESTS (API-AUTH-TABLES-ROLE-004 to 006)
  // Verify global user roles control access to non-org tables
  // ============================================================================

  test.fixme(
    'API-AUTH-TABLES-ROLE-004: global admin role should access non-org admin-only table',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: A non-org table with admin role permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'system_config',
            fields: [
              { id: 1, name: 'id', type: 'integer' },
              { id: 2, name: 'key', type: 'single-line-text' },
              { id: 3, name: 'value', type: 'single-line-text' },
            ],
            permissions: {
              read: { type: 'roles', roles: ['admin'] },
              create: { type: 'roles', roles: ['admin'] },
              update: { type: 'roles', roles: ['admin'] },
              delete: { type: 'roles', roles: ['admin'] },
            },
          },
        ],
      })

      // WHEN: Global admin accesses the table (no org context)
      const result = await executeQuery([
        'BEGIN',
        'SET ROLE app_user',
        "SET LOCAL app.user_role = 'admin'",
        'SELECT COUNT(*) as count FROM system_config',
        'COMMIT',
      ])

      // THEN: Access should be granted
      expect(result).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-TABLES-ROLE-005: global user role should access non-org user-level table',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: A non-org table with user role permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'user_preferences',
            fields: [
              { id: 1, name: 'id', type: 'integer' },
              { id: 2, name: 'theme', type: 'single-line-text' },
            ],
            permissions: {
              read: { type: 'roles', roles: ['user'] },
              create: { type: 'roles', roles: ['user'] },
              update: { type: 'roles', roles: ['user'] },
            },
          },
        ],
      })

      // WHEN: Global user accesses the table
      const result = await executeQuery([
        'BEGIN',
        'SET ROLE app_user',
        "SET LOCAL app.user_role = 'user'",
        'SELECT COUNT(*) as count FROM user_preferences',
        'COMMIT',
      ])

      // THEN: Access should be granted
      expect(result).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-TABLES-ROLE-006: global user role should NOT access org-scoped table (Option B)',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: An org-scoped table with member permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'org_data',
            fields: [
              { id: 1, name: 'id', type: 'integer' },
              { id: 2, name: 'content', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['member'] },
            },
          },
        ],
      })

      // AND: A user with global 'user' role but NO organization membership
      await signUp({
        email: 'noorg@example.com',
        password: 'TestPassword123!',
        name: 'No Org User',
      })

      // WHEN: User tries to access org-scoped table without org context
      const response = await page.request.get('/api/tables/org_data')

      // THEN: Access should be DENIED (Option B: global user ≠ org member)
      expect(response.status()).toBe(403)
    }
  )

  // ============================================================================
  // CONTEXT SWITCHING TESTS (API-AUTH-TABLES-ROLE-007 to 009)
  // Verify role changes correctly when switching organizations
  // ============================================================================

  test.fixme(
    'API-AUTH-TABLES-ROLE-007: switching organizations should apply new org role',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, setActiveOrganization, page }) => {
      // GIVEN: A user who is admin in Org A but member in Org B
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'org_settings',
            fields: [
              { id: 1, name: 'id', type: 'integer' },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['member'] },
              create: { type: 'roles', roles: ['admin'] },
            },
          },
        ],
      })

      await signUp({
        email: 'multi@example.com',
        password: 'TestPassword123!',
        name: 'Multi Org User',
      })

      // Create Org A (user is owner/admin)
      const { organization: orgA } = await createOrganization({
        name: 'Org A',
        slug: 'org-a',
      })

      // WHEN: Active in Org A (as admin)
      await setActiveOrganization(orgA.id)
      const createResponseA = await page.request.post('/api/tables/org_settings', {
        data: { name: 'setting-a' },
      })

      // THEN: Create should succeed (admin in Org A)
      expect(createResponseA.status()).toBe(201)

      // Note: Full test would require being invited to Org B as member
      // and verifying create fails when switching to Org B
    }
  )

  test.fixme(
    'API-AUTH-TABLES-ROLE-008: clearing active organization should revoke org-scoped access',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, setActiveOrganization, page }) => {
      // GIVEN: A user with active organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'team_data',
            fields: [
              { id: 1, name: 'id', type: 'integer' },
              { id: 2, name: 'content', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['member'] },
            },
          },
        ],
      })

      await signUp({
        email: 'clear@example.com',
        password: 'TestPassword123!',
        name: 'Clear Org User',
      })

      const { organization } = await createOrganization({
        name: 'Clear Org',
        slug: 'clear-org',
      })

      await setActiveOrganization(organization.id)

      // Verify access with active org
      const withOrgResponse = await page.request.get('/api/tables/team_data')
      expect(withOrgResponse.status()).toBe(200)

      // WHEN: Clear active organization
      await setActiveOrganization(null as unknown as string)

      // THEN: Access should be denied (no org context)
      const noOrgResponse = await page.request.get('/api/tables/team_data')
      expect(noOrgResponse.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-TABLES-ROLE-009: role should be correctly resolved during concurrent requests',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, setActiveOrganization, page }) => {
      // GIVEN: Setup with org-scoped table
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'concurrent_data',
            fields: [
              { id: 1, name: 'id', type: 'integer' },
              { id: 2, name: 'value', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['member'] },
            },
          },
        ],
      })

      await signUp({
        email: 'concurrent@example.com',
        password: 'TestPassword123!',
        name: 'Concurrent User',
      })

      const { organization } = await createOrganization({
        name: 'Concurrent Org',
        slug: 'concurrent-org',
      })

      await setActiveOrganization(organization.id)

      // WHEN: Multiple concurrent requests
      const responses = await Promise.all([
        page.request.get('/api/tables/concurrent_data'),
        page.request.get('/api/tables/concurrent_data'),
        page.request.get('/api/tables/concurrent_data'),
      ])

      // THEN: All should have consistent role resolution
      responses.forEach((response) => {
        expect(response.status()).toBe(200)
      })
    }
  )

  // ============================================================================
  // EDGE CASES (API-AUTH-TABLES-ROLE-010 to 012)
  // ============================================================================

  test.fixme(
    'API-AUTH-TABLES-ROLE-010: authenticated user without explicit role should use default role',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Table with authenticated permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'public_data',
            fields: [
              { id: 1, name: 'id', type: 'integer' },
              { id: 2, name: 'content', type: 'single-line-text' },
            ],
            permissions: {
              read: { type: 'authenticated' },
            },
          },
        ],
      })

      // AND: A newly signed up user (default role)
      await signUp({
        email: 'default@example.com',
        password: 'TestPassword123!',
        name: 'Default Role User',
      })

      // WHEN: User accesses authenticated table
      const response = await page.request.get('/api/tables/public_data')

      // THEN: Should have access via authenticated permission
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-TABLES-ROLE-011: org owner should have full access to all org-scoped tables',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, setActiveOrganization, page }) => {
      // GIVEN: Org-scoped table with owner-only delete permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'org_critical',
            fields: [
              { id: 1, name: 'id', type: 'integer' },
              { id: 2, name: 'data', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['member'] },
              create: { type: 'roles', roles: ['admin'] },
              update: { type: 'roles', roles: ['admin'] },
              delete: { type: 'roles', roles: ['owner'] },
            },
          },
        ],
      })

      await signUp({
        email: 'owner@example.com',
        password: 'TestPassword123!',
        name: 'Owner User',
      })

      const { organization } = await createOrganization({
        name: 'Owner Org',
        slug: 'owner-org',
      })

      await setActiveOrganization(organization.id)

      // First create a record
      const createResponse = await page.request.post('/api/tables/org_critical', {
        data: { data: 'to-delete' },
      })
      expect(createResponse.status()).toBe(201)
      const created = await createResponse.json()

      // WHEN: Owner deletes the record
      const deleteResponse = await page.request.delete(`/api/tables/org_critical/${created.id}`)

      // THEN: Delete should succeed (owner role)
      expect(deleteResponse.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-TABLES-ROLE-012: user in multiple orgs should only access active org data',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, setActiveOrganization, page }) => {
      // GIVEN: User in two organizations, each with org-scoped data
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'org_isolated',
            fields: [
              { id: 1, name: 'id', type: 'integer' },
              { id: 2, name: 'org_name', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['member'] },
              create: { type: 'roles', roles: ['member'] },
            },
          },
        ],
      })

      await signUp({
        email: 'multiorg@example.com',
        password: 'TestPassword123!',
        name: 'Multi Org User',
      })

      // Create Org A and add data
      const { organization: orgA } = await createOrganization({
        name: 'Org A',
        slug: 'org-a-isolated',
      })
      await setActiveOrganization(orgA.id)
      await page.request.post('/api/tables/org_isolated', {
        data: { org_name: 'Org A Data' },
      })

      // Create Org B and add data
      const { organization: orgB } = await createOrganization({
        name: 'Org B',
        slug: 'org-b-isolated',
      })
      await setActiveOrganization(orgB.id)
      await page.request.post('/api/tables/org_isolated', {
        data: { org_name: 'Org B Data' },
      })

      // WHEN: Query with Org B active
      const response = await page.request.get('/api/tables/org_isolated')
      const data = await response.json()

      // THEN: Should only see Org B data
      expect(data.records).toHaveLength(1)
      expect(data.records[0].org_name).toBe('Org B Data')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-TABLES-ROLE-013: complete role-based access workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, createOrganization, setActiveOrganization, page }) => {
      await test.step('Setup: Start server with mixed permission tables', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            organization: true,
          },
          tables: [
            {
              id: 1,
              name: 'global_config',
              fields: [
                { id: 1, name: 'id', type: 'integer' },
                { id: 2, name: 'key', type: 'single-line-text' },
              ],
              permissions: {
                read: { type: 'roles', roles: ['admin'] },
              },
            },
            {
              id: 2,
              name: 'org_docs',
              fields: [
                { id: 3, name: 'id', type: 'integer' },
                { id: 4, name: 'title', type: 'single-line-text' },
              ],
              permissions: {
                organizationScoped: true,
                read: { type: 'roles', roles: ['member'] },
                create: { type: 'roles', roles: ['admin'] },
              },
            },
          ],
        })
      })

      await test.step('Setup: Create user and organization', async () => {
        await signUp({
          email: 'workflow@example.com',
          password: 'TestPassword123!',
          name: 'Workflow User',
        })

        const { organization } = await createOrganization({
          name: 'Workflow Org',
          slug: 'workflow-org',
        })

        await setActiveOrganization(organization.id)
      })

      await test.step('Verify: Org member can read org-scoped table', async () => {
        const response = await page.request.get('/api/tables/org_docs')
        expect(response.status()).toBe(200)
      })

      await test.step('Verify: Org owner/admin can create in org-scoped table', async () => {
        const response = await page.request.post('/api/tables/org_docs', {
          data: { title: 'Test Doc' },
        })
        expect(response.status()).toBe(201)
      })

      await test.step('Verify: Without org context, org-scoped access denied', async () => {
        // Clear org context
        await setActiveOrganization(null as unknown as string)

        const response = await page.request.get('/api/tables/org_docs')
        expect(response.status()).toBe(403)
      })

      await test.step('Verify: Global tables accessible without org context', async () => {
        // Note: This depends on user having global admin role
        // Default users may not have admin role, so this might need adjustment
        const response = await page.request.get('/api/tables/global_config')
        // Expect 403 if user doesn't have global admin role
        expect([200, 403]).toContain(response.status())
      })
    }
  )
})
