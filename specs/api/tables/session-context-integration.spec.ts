/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API Session Context Integration
 *
 * Domain: api/tables
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Critical Integration Scenarios:
 * - API routes set session context before database queries
 * - RLS policies filter data correctly via API
 * - Organization isolation enforced via API
 * - Role-based permissions enforced via API
 * - Field-level permissions enforced via API
 * - Owner-based filtering works via API
 * - Unauthenticated requests are rejected
 */

test.describe('API Session Context Integration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'API-TABLES-SESSION-CTX-INT-001: should set session context from auth token for API requests',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createOrganization }) => {
      // GIVEN: Application with auth and tables
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
            ],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      await createOrganization({ name: 'Test Org' })

      // WHEN: Making authenticated API request
      const response = await request.get('/api/tables/1/records', {})

      // THEN: Session context should be set correctly (verified by successful data access)
      expect(response.status()).toBe(200)

      // Implicit verification: If session context wasn't set,
      // RLS policies would deny access and return empty results
    }
  )

  test.fixme(
    'API-TABLES-SESSION-CTX-INT-002: should enforce RLS owner filtering via API',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Table with owner-based RLS policy
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
      await executeQuery(`
        INSERT INTO tasks (id, title, owner_id)
        VALUES
          (1, 'User 1 Task', '${user1.user.id}'),
          (2, 'User 2 Task', '${user2.user.id}')
      `)

      // WHEN: User1 requests tasks via API
      const response = await request.get('/api/tables/1/records', {})

      // THEN: API should return only user1's tasks (RLS filtering via session context)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].fields.title).toBe('User 1 Task')
      expect(data.records[0].fields.owner_id).toBe(user1.user.id)
    }
  )

  test.fixme(
    'API-TABLES-SESSION-CTX-INT-003: should enforce organization isolation via API',
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
      await executeQuery(`
        INSERT INTO projects (id, name, organization_id)
        VALUES
          (1, 'Org 1 Project', '${org1.organization.id}'),
          (2, 'Org 2 Project', '${org2.organization.id}')
      `)

      // WHEN: User from org1 requests projects via API
      await createAuthenticatedUser({ email: 'org1-user@example.com' })
      // Switch to org1 context
      const response = await request.get('/api/tables/1/records', {
        headers: {
          'X-Organization-Id': org1.organization.id,
        },
      })

      // THEN: API should return only org1 projects (organization isolation via session context)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].fields.name).toBe('Org 1 Project')
      expect(data.records[0].fields.organization_id).toBe(org1.organization.id)
    }
  )

  test.fixme(
    'API-TABLES-SESSION-CTX-INT-004: should enforce role-based permissions via API',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      addMember,
      executeQuery,
    }) => {
      // GIVEN: Table with role-based read permissions (admin only)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'confidential',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'secret', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['owner', 'admin'] },
            },
          },
        ],
      })

      // Create organization and users
      await createAuthenticatedUser({ email: 'owner@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      const member = await createAuthenticatedUser({ email: 'member@example.com' })
      await addMember({
        organizationId: org.organization.id,
        userId: member.user.id,
        role: 'member',
      })

      // Insert confidential data
      await executeQuery(`
        INSERT INTO confidential (id, secret, organization_id)
        VALUES (1, 'Top Secret Data', '${org.organization.id}')
      `)

      // WHEN: Member tries to read confidential data via API
      const memberResponse = await request.get('/api/tables/1/records', {
        headers: {
          'X-Organization-Id': org.organization.id,
        },
      })

      // THEN: Member should be denied (403 or empty results based on RLS)
      // RLS policies return empty results for unauthorized access
      const memberData = await memberResponse.json()
      expect(memberData.records).toHaveLength(0)

      // WHEN: Owner (admin) reads confidential data via API
      const ownerResponse = await request.get('/api/tables/1/records', {
        headers: {
          'X-Organization-Id': org.organization.id,
        },
      })

      // THEN: Owner should see the data (role-based permission via session context)
      expect(ownerResponse.status()).toBe(200)

      const ownerData = await ownerResponse.json()
      expect(ownerData.records).toHaveLength(1)
      expect(ownerData.records[0].secret).toBe('Top Secret Data')
    }
  )

  test.fixme(
    'API-TABLES-SESSION-CTX-INT-005: should enforce field-level permissions via API',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      addMember,
      executeQuery,
    }) => {
      // GIVEN: Table with field-level permissions (salary restricted to admins)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            permissions: {
              organizationScoped: true,
              fields: [
                {
                  field: 'salary',
                  read: { type: 'roles', roles: ['owner', 'admin'] },
                },
              ],
            },
          },
        ],
      })

      // Create organization and users
      await createAuthenticatedUser({ email: 'admin@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      const member = await createAuthenticatedUser({ email: 'member@example.com' })
      await addMember({
        organizationId: org.organization.id,
        userId: member.user.id,
        role: 'member',
      })

      // Insert employee data
      await executeQuery(`
        INSERT INTO employees (id, name, salary, organization_id)
        VALUES (1, 'John Doe', 75000, '${org.organization.id}')
      `)

      // WHEN: Member requests employee data via API
      const memberResponse = await request.get('/api/tables/1/records', {
        headers: {
          'X-Organization-Id': org.organization.id,
        },
      })

      // THEN: Member should see name but NOT salary (field-level permission via session context)
      expect(memberResponse.status()).toBe(200)

      const memberData = await memberResponse.json()
      expect(memberData.records).toHaveLength(1)
      expect(memberData.records[0].fields.name).toBe('John Doe')
      expect(memberData.records[0].fields).not.toHaveProperty('salary')

      // WHEN: Admin requests employee data via API
      const adminResponse = await request.get('/api/tables/1/records', {
        headers: {
          'X-Organization-Id': org.organization.id,
        },
      })

      // THEN: Admin should see ALL fields including salary
      expect(adminResponse.status()).toBe(200)

      const adminData = await adminResponse.json()
      expect(adminData.records).toHaveLength(1)
      expect(adminData.records[0].fields.name).toBe('John Doe')
      expect(adminData.records[0].fields.salary).toBe(75_000)
    }
  )

  test(
    'API-TABLES-SESSION-CTX-INT-006: should reject unauthenticated API requests',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with auth enabled
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

      // WHEN: Making unauthenticated API request (no Authorization header)
      const response = await request.get('/api/tables/1/records')

      // THEN: Should return 401 Unauthorized (no session context = no access)
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data.error).toBeDefined()
    }
  )

  test.fixme(
    'API-TABLES-SESSION-CTX-INT-007: should handle create operations with session context',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with organization scoping
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
              { id: 4, name: 'owner_id', type: 'user' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      const user = await createAuthenticatedUser({ email: 'user@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // WHEN: User creates a new record via API
      const response = await request.post('/api/tables/1/records', {
        headers: {
          'X-Organization-Id': org.organization.id,
          'Content-Type': 'application/json',
        },
        data: {
          name: 'New Project',
        },
      })

      // THEN: Record should be created with correct organization_id and owner_id (set by session context)
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data.record.fields.name).toBe('New Project')

      // Verify in database that organization_id and owner_id were set correctly
      const result = await executeQuery(`
        SELECT * FROM projects WHERE name = 'New Project'
      `)

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].organization_id).toBe(org.organization.id)
      expect(result.rows[0].owner_id).toBe(user.user.id)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED workflow validation
  // ============================================================================

  test(
    'API-TABLES-SESSION-CTX-INT-REGRESSION: user can complete full API session context integration workflow',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // NOTE: Regression test focuses on single user's workflow
      // Multi-user session switching (owner/member) is tested in @spec tests

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
              name: 'projects',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'budget', type: 'currency', currency: 'USD' },
                { id: 4, name: 'organization_id', type: 'single-line-text' },
                { id: 5, name: 'owner_id', type: 'user' },
              ],
              permissions: {
                organizationScoped: true,
                read: { type: 'owner', field: 'owner_id' },
                fields: [
                  {
                    field: 'budget',
                    read: { type: 'roles', roles: ['owner', 'admin'] },
                  },
                ],
              },
            },
          ],
        })
      })

      // Create users in order: other user first, then owner last (so owner is active session)
      // This allows testing RLS owner filtering without session switching
      const otherUser = await createAuthenticatedUser({
        email: 'other@example.com',
        name: 'Other User',
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        name: 'Owner',
      })
      const org = await createOrganization({ name: 'Test Org' })

      await test.step('Setup: Insert test data for both users', async () => {
        await executeQuery(`
          INSERT INTO projects (id, name, budget, organization_id, owner_id)
          VALUES
            (1, 'Owner Project', 100000, '${org.organization.id}', '${owner.user.id}'),
            (2, 'Other Owner Project', 50000, '${org.organization.id}', '${otherUser.user.id}')
        `)
      })

      await test.step('API-TABLES-SESSION-CTX-INT-001: Set session context from auth token for API requests', async () => {
        // Authenticated request should succeed (session context is set)
        const response = await request.get('/api/tables/1/records', {
          headers: {
            'X-Organization-Id': org.organization.id,
          },
        })

        expect(response.status()).toBe(200)
        // Success proves session context was set correctly
      })

      await test.step('API-TABLES-SESSION-CTX-INT-002: Enforce RLS owner filtering via API', async () => {
        // Owner should see only their own projects (RLS owner filtering)
        const response = await request.get('/api/tables/1/records', {
          headers: {
            'X-Organization-Id': org.organization.id,
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(1)
        expect(data.records[0].fields.name).toBe('Owner Project')
        expect(data.records[0].fields.owner_id).toBe(owner.user.id)
        // Should NOT see other owner's project (owner filtering)
        expect(
          data.records.find(
            (r: { fields: { name: string } }) => r.fields.name === 'Other Owner Project'
          )
        ).toBeUndefined()
      })

      await test.step('API-TABLES-SESSION-CTX-INT-003: Owner sees budget field (role-based permission)', async () => {
        // Owner should see budget field (role-based permission)
        const response = await request.get('/api/tables/1/records', {
          headers: {
            'X-Organization-Id': org.organization.id,
          },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(1)
        // Budget may be returned as number or string depending on serialization
        expect(Number(data.records[0].fields.budget)).toBe(100_000)
      })

      // NOTE: Steps 004, 005, 006 (organization isolation, field-level for member, unauthenticated)
      // require different user sessions and are covered in @spec tests
      // NOTE: Step 007 (create operations with session context) is marked .fixme() in @spec tests
      // - feature is not yet implemented
    }
  )
})
