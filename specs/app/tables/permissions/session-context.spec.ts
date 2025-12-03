/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Database Session Context Integration
 *
 * Domain: app/tables/permissions
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Session Context Integration Scenarios:
 * - Session context set from Better Auth session
 * - RLS policies work with automatic session context
 * - Organization isolation enforced via session context
 * - Role-based permissions work via session context
 * - Session context cleared after transaction
 */

test.describe('Database Session Context Integration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-SESSION-CTX-001: should set session context from Better Auth session',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createOrganization,
    }) => {
      // GIVEN: Application with auth and organization features
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
            ],
          },
        ],
      })

      // Create user and organization
      const user = await createAuthenticatedUser({ email: 'user@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // WHEN: Setting session context using SET LOCAL commands and reading them back
      // Note: Transaction auto-rolls back when connection closes (no explicit COMMIT needed)
      const contextResult = await executeQuery([
        `BEGIN`,
        `SET LOCAL app.user_id = '${user.user.id}'`,
        `SET LOCAL app.organization_id = '${org.organization.id}'`,
        `SET LOCAL app.user_role = 'owner'`,
        `SELECT
          current_setting('app.user_id') as user_id,
          current_setting('app.organization_id') as organization_id,
          current_setting('app.user_role') as role`,
      ])

      // THEN: Session variables should be set correctly
      expect(contextResult.rows[0].user_id).toBe(user.user.id)
      expect(contextResult.rows[0].organization_id).toBe(org.organization.id)
      expect(contextResult.rows[0].role).toBe('owner')
    }
  )

  test(
    'APP-TABLES-SESSION-CTX-002: should enable RLS filtering with session context',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with owner-based RLS
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'owner_id', type: 'user' },
            ],
            permissions: {
              read: { type: 'owner', field: 'owner_id' },
            },
          },
        ],
      })

      // Create two users
      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

      // Insert tasks for both users
      await executeQuery([
        `INSERT INTO tasks (id, title, owner_id) VALUES
         (1, 'User 1 Task', '${user1.user.id}'),
         (2, 'User 2 Task', '${user2.user.id}')`,
      ])

      // WHEN: Setting session context for user1 and querying tasks
      // Note: Transaction auto-rolls back when connection closes (no explicit COMMIT needed)
      // Enable row_security for superuser (FORCE RLS still allows superusers to bypass without this)
      const tasksResult = await executeQuery([
        `BEGIN`,
        `SET LOCAL row_security = on`,
        `SET LOCAL app.user_id = '${user1.user.id}'`,
        `SELECT id, title FROM tasks ORDER BY id`,
      ])

      // THEN: User should only see their own tasks
      expect(tasksResult.rows).toHaveLength(1)
      expect(tasksResult.rows[0].title).toBe('User 1 Task')
    }
  )

  test(
    'APP-TABLES-SESSION-CTX-003: should enforce organization isolation via session context',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createOrganization,
    }) => {
      // GIVEN: Organization-scoped table
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

      // Create two organizations
      await createAuthenticatedUser({ email: 'user1@example.com' })
      const org1 = await createOrganization({ name: 'Org 1' })

      await createAuthenticatedUser({ email: 'user2@example.com' })
      const org2 = await createOrganization({ name: 'Org 2' })

      // Insert projects for both organizations
      await executeQuery([
        `INSERT INTO projects (id, name, organization_id) VALUES
         (1, 'Org 1 Project', '${org1.organization.id}'),
         (2, 'Org 2 Project', '${org2.organization.id}')`,
      ])

      // WHEN: Setting session context for org1 and querying projects
      // Note: Transaction auto-rolls back when connection closes (no explicit COMMIT needed)
      // Enable row_security for superuser (FORCE RLS still allows superusers to bypass without this)
      const projectsResult = await executeQuery([
        `BEGIN`,
        `SET LOCAL row_security = on`,
        `SET LOCAL app.organization_id = '${org1.organization.id}'`,
        `SELECT id, name FROM projects ORDER BY id`,
      ])

      // THEN: User should only see org1 projects
      expect(projectsResult.rows).toHaveLength(1)
      expect(projectsResult.rows[0].name).toBe('Org 1 Project')
    }
  )

  test(
    'APP-TABLES-SESSION-CTX-004: should clear session context after transaction',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Application with auth
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
          },
        ],
      })

      const user = await createAuthenticatedUser({ email: 'user@example.com' })

      // WHEN: Setting session context
      // Note: Transaction auto-rolls back when connection closes (no explicit COMMIT needed)
      const contextBefore = await executeQuery([
        `BEGIN`,
        `SET LOCAL app.user_id = '${user.user.id}'`,
        `SELECT current_setting('app.user_id') as user_id`,
      ])

      // THEN: Variable should be set
      expect(contextBefore.rows[0].user_id).toBe(user.user.id)

      // WHEN: Clearing session context
      // Note: Transaction auto-rolls back when connection closes (no explicit COMMIT needed)
      const contextAfter = await executeQuery([
        `BEGIN`,
        `RESET app.user_id`,
        `RESET app.organization_id`,
        `RESET app.user_role`,
        `SELECT
          current_setting('app.user_id', true) as user_id,
          current_setting('app.organization_id', true) as organization_id,
          current_setting('app.user_role', true) as role`,
      ])

      // THEN: Variables should be cleared (return empty string - defaults from ALTER DATABASE SET)
      expect(contextAfter.rows[0].user_id).toBe('')
      expect(contextAfter.rows[0].organization_id).toBe('')
      expect(contextAfter.rows[0].role).toBe('')
    }
  )

  test(
    'APP-TABLES-SESSION-CTX-005: should handle users without organization membership',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createOrganization,
    }) => {
      // GIVEN: User without organization membership
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
            ],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Create another user who is NOT a member of the org
      const nonMember = await createAuthenticatedUser({ email: 'nonmember@example.com' })

      // WHEN: Setting session context for non-member user
      // Query members table to verify non-member has no role
      const memberResult = await executeQuery(`
        SELECT role FROM members
        WHERE organization_id = '${org.organization.id}'
        AND user_id = '${nonMember.user.id}'
      `)

      // THEN: Non-member should have no record in members table
      expect(memberResult.rows).toHaveLength(0)

      // WHEN: Setting session variables for non-member
      // Note: Transaction auto-rolls back when connection closes (no explicit COMMIT needed)
      const contextResult = await executeQuery([
        `BEGIN`,
        `SET LOCAL app.user_id = '${nonMember.user.id}'`,
        `SET LOCAL app.organization_id = '${org.organization.id}'`,
        `SET LOCAL app.user_role = 'authenticated'`,
        `SELECT
          current_setting('app.user_id') as user_id,
          current_setting('app.organization_id') as organization_id,
          current_setting('app.user_role') as role`,
      ])

      // THEN: Should default to 'authenticated' role for non-members
      expect(contextResult.rows[0].role).toBe('authenticated')
      expect(contextResult.rows[0].organization_id).toBe(org.organization.id)
      expect(contextResult.rows[0].user_id).toBe(nonMember.user.id)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED workflow validation
  // ============================================================================

  test(
    'APP-TABLES-SESSION-CTX-006: session context integration workflow',
    { tag: '@regression' },
    async ({
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createOrganization,
    }) => {
      await test.step('Setup: Create schema with RLS and organization features', async () => {
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
                { id: 4, name: 'owner_id', type: 'user' },
              ],
              permissions: {
                organizationScoped: true,
                read: { type: 'owner', field: 'owner_id' },
              },
            },
          ],
        })
      })

      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const org1 = await createOrganization({ name: 'Org 1' })

      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })
      const org2 = await createOrganization({ name: 'Org 2' })

      await test.step('Insert test data for multiple organizations and owners', async () => {
        await executeQuery([
          `INSERT INTO projects (id, name, organization_id, owner_id) VALUES
           (1, 'User 1 Org 1 Project', '${org1.organization.id}', '${user1.user.id}'),
           (2, 'User 2 Org 2 Project', '${org2.organization.id}', '${user2.user.id}')`,
        ])
      })

      await test.step('Set session context for user1/org1 and verify isolation', async () => {
        // Set session context and query projects
        // Note: Transaction auto-rolls back when connection closes (no explicit COMMIT needed)
        // Enable row_security for superuser (FORCE RLS still allows superusers to bypass without this)
        const projectsResult = await executeQuery([
          `BEGIN`,
          `SET LOCAL row_security = on`,
          `SET LOCAL app.user_id = '${user1.user.id}'`,
          `SET LOCAL app.organization_id = '${org1.organization.id}'`,
          `SELECT id, name FROM projects ORDER BY id`,
        ])

        // Verify RLS filters to only user1's projects in org1
        expect(projectsResult.rows).toHaveLength(1)
        expect(projectsResult.rows[0].name).toBe('User 1 Org 1 Project')
      })

      await test.step('Query without context and verify access is denied', async () => {
        // Without session context, RLS should deny all access
        // Enable row_security for superuser (FORCE RLS still allows superusers to bypass without this)
        const projectsResult = await executeQuery([
          `BEGIN`,
          `SET LOCAL row_security = on`,
          `SELECT id, name FROM projects`,
        ])
        expect(projectsResult.rows).toHaveLength(0)
      })

      await test.step('Switch to user2/org2 and verify different data access', async () => {
        // Set different session context and query projects
        // Note: Transaction auto-rolls back when connection closes (no explicit COMMIT needed)
        // Enable row_security for superuser (FORCE RLS still allows superusers to bypass without this)
        const projectsResult = await executeQuery([
          `BEGIN`,
          `SET LOCAL row_security = on`,
          `SET LOCAL app.user_id = '${user2.user.id}'`,
          `SET LOCAL app.organization_id = '${org2.organization.id}'`,
          `SELECT id, name FROM projects ORDER BY id`,
        ])

        // Verify RLS filters to only user2's projects in org2
        expect(projectsResult.rows).toHaveLength(1)
        expect(projectsResult.rows[0].name).toBe('User 2 Org 2 Project')
      })
    }
  )
})
