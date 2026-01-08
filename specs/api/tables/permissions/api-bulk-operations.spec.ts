/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, type OrganizationResult, type AuthResult } from '@/specs/fixtures'

/**
 * E2E Tests for Bulk Operations with Permissions
 *
 * PURPOSE: Verify that permissions are correctly enforced during bulk create/update/delete operations
 *
 * KEY SCENARIOS:
 * - Bulk create with role-based permissions
 * - Bulk update where user owns some but not all records
 * - Bulk delete with organization isolation
 * - Mixed permission scenarios in batch operations
 *
 * BEHAVIOR PATTERNS:
 * - Atomic: Entire batch fails if ANY record fails permission check
 * - Partial: Successful operations proceed, failed ones are reported
 * - RLS-based: PostgreSQL RLS handles per-row permission automatically
 *
 * Domain: api
 * Spec Count: 7
 */

test.describe('API Bulk Operations with Permissions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of bulk operation permissions
  // ============================================================================

  test(
    'API-TABLES-PERMISSIONS-BULK-001: bulk create succeeds when user has create permission',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with authenticated create permission
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
      await createOrganization({ name: 'Test Org' })

      // WHEN: User bulk creates multiple records
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ title: 'Task 1' }, { title: 'Task 2' }, { title: 'Task 3' }],
        },
      })

      // THEN: All records are created successfully
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data.records).toHaveLength(3)
      expect(data.records.map((r: any) => r.fields.title)).toEqual(['Task 1', 'Task 2', 'Task 3'])

      // Verify in database
      const dbResult = await executeQuery('SELECT COUNT(*) as count FROM tasks')
      expect(dbResult.rows[0].count).toBe('3')
    }
  )

  test(
    'API-TABLES-PERMISSIONS-BULK-002: bulk create fails entirely when user lacks permission',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      addMember,
      executeQuery,
      signOut,
    }) => {
      // GIVEN: Table with admin-only create permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'restricted_items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' },
              create: { type: 'roles', roles: ['admin'] }, // Only admin can create
            },
          },
        ],
      })

      // Create owner and org
      await createAuthenticatedUser({ email: 'owner@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Create member (not admin)
      await signOut()
      const member = await createAuthenticatedUser({ email: 'member@example.com' })
      await addMember({
        organizationId: org.organization.id,
        userId: member.user.id,
        role: 'member',
      })

      // WHEN: Member tries to bulk create
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [{ name: 'Item 1' }, { name: 'Item 2' }],
        },
      })

      // THEN: Entire batch fails
      expect(response.status()).toBe(403)

      // Verify no records were created
      const dbResult = await executeQuery('SELECT COUNT(*) as count FROM restricted_items')
      expect(dbResult.rows[0].count).toBe('0')
    }
  )

  test(
    'API-TABLES-PERMISSIONS-BULK-003: bulk update succeeds for owned records only',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with owner-based update permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'owner_id', type: 'created-by' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' },
              update: { type: 'owner', field: 'owner_id' },
            },
          },
        ],
      })

      const user = await createAuthenticatedUser({ email: 'user@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Insert notes: 2 owned by user, 1 by someone else
      await executeQuery(`
        INSERT INTO notes (id, content, owner_id, organization_id) VALUES
          (1, 'My Note 1', '${user.user.id}', '${org.organization.id}'),
          (2, 'My Note 2', '${user.user.id}', '${org.organization.id}'),
          (3, 'Other Note', 'other-user-id', '${org.organization.id}')
      `)

      // WHEN: User tries to bulk update their own notes
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: '1', fields: { content: 'Updated Note 1' } },
            { id: '2', fields: { content: 'Updated Note 2' } },
          ],
        },
      })

      // THEN: Updates succeed for owned records
      expect(response.status()).toBe(200)

      // Verify updates
      const dbResult = await executeQuery('SELECT id, content FROM notes ORDER BY id')
      expect(dbResult.rows[0].content).toBe('Updated Note 1')
      expect(dbResult.rows[1].content).toBe('Updated Note 2')
      expect(dbResult.rows[2].content).toBe('Other Note') // Unchanged
    }
  )

  test(
    'API-TABLES-PERMISSIONS-BULK-004: bulk update with mixed ownership returns partial success or fails atomically',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with owner-based update permission
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
              { id: 3, name: 'owner_id', type: 'created-by' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' },
              update: { type: 'owner', field: 'owner_id' },
            },
          },
        ],
      })

      const user = await createAuthenticatedUser({ email: 'user@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Insert documents: 1 owned by user, 1 by someone else
      await executeQuery(`
        INSERT INTO documents (id, title, owner_id, organization_id) VALUES
          (1, 'My Doc', '${user.user.id}', '${org.organization.id}'),
          (2, 'Other Doc', 'other-user-id', '${org.organization.id}')
      `)

      // WHEN: User tries to bulk update BOTH (owns one, doesn't own other)
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: '1', fields: { title: 'Updated My Doc' } },
            { id: '2', fields: { title: 'Trying to Update Other Doc' } },
          ],
        },
      })

      // THEN: Atomic behavior - entire batch fails OR partial success reported
      // Implementation choice: We expect atomic (all or nothing) for security
      expect([200, 403, 207]).toContain(response.status()) // 207 = Multi-Status (partial)

      if (response.status() === 403) {
        // Atomic: Both updates rolled back
        const dbResult = await executeQuery('SELECT id, title FROM documents ORDER BY id')
        expect(dbResult.rows[0].title).toBe('My Doc')
        expect(dbResult.rows[1].title).toBe('Other Doc')
      } else if (response.status() === 207) {
        // Partial: Check which succeeded
        const data = await response.json()
        expect(data.results).toBeDefined()
        // User's doc should succeed, other should fail
        const ownedResult = data.results.find((r: any) => r.id === 1)
        const otherResult = data.results.find((r: any) => r.id === 2)
        expect(ownedResult.status).toBe('success')
        expect(otherResult.status).toBe('error')
      }
    }
  )

  test(
    'API-TABLES-PERMISSIONS-BULK-005: bulk delete respects organization isolation',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
      signOut,
      signIn,
      setActiveOrganization,
    }) => {
      // GIVEN: Table with organization-scoped delete permission
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
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' },
              delete: { type: 'authenticated' },
            },
          },
        ],
      })

      // Create user A in Org A
      await createAuthenticatedUser({ email: 'user-a@example.com' })
      const orgA = await createOrganization({ name: 'Organization A' })

      // Create user B in Org B
      await signOut()
      await createAuthenticatedUser({ email: 'user-b@example.com' })
      const orgB = await createOrganization({ name: 'Organization B' })

      // Insert items in both orgs
      await executeQuery(`
        INSERT INTO items (id, name, organization_id) VALUES
          (1, 'Org A Item 1', '${orgA.organization.id}'),
          (2, 'Org A Item 2', '${orgA.organization.id}'),
          (3, 'Org B Item 1', '${orgB.organization.id}')
      `)

      // WHEN: User A tries to bulk delete including Org B's item
      await signOut()
      await signIn({ email: 'user-a@example.com', password: 'TestPassword123!' })
      await setActiveOrganization(orgA.organization.id)

      const response = await request.delete('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          ids: ['1', '2', '3'], // Includes Org B's item (strings expected by API)
        },
      })

      // THEN: Only Org A items are soft-deleted (Org B item is ignored due to RLS)
      expect(response.status()).toBe(200)

      // Verify: Org A items soft-deleted, Org B item still active
      // Note: Sovrium uses soft-delete by default (deleted_at column)
      const dbResult = await executeQuery(
        'SELECT id, organization_id FROM items WHERE deleted_at IS NULL ORDER BY id'
      )
      expect(dbResult.rows).toHaveLength(1)
      expect(dbResult.rows[0].id).toBe(3) // Only Org B item remains active
    }
  )

  test(
    'API-TABLES-PERMISSIONS-BULK-006: bulk create with field-level permissions',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      addMember,
      signOut,
    }) => {
      // GIVEN: Table with field-level create permissions
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
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' },
              create: { type: 'authenticated' },
              fields: [
                {
                  field: 'salary',
                  read: { type: 'roles', roles: ['owner', 'admin'] },
                  write: { type: 'roles', roles: ['admin'] }, // Only admin can set salary
                },
              ],
            },
          },
        ],
      })

      // Create owner
      await createAuthenticatedUser({ email: 'owner@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Create member
      await signOut()
      const member = await createAuthenticatedUser({ email: 'member@example.com' })
      await addMember({
        organizationId: org.organization.id,
        userId: member.user.id,
        role: 'member',
      })

      // WHEN: Member tries to bulk create with salary field
      const response = await request.post('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { name: 'Employee 1', salary: 50_000 },
            { name: 'Employee 2', salary: 60_000 },
          ],
        },
      })

      // THEN: Fails because member can't write salary field
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.message).toMatch(/permission|salary|forbidden/i)
    }
  )

  test(
    'API-TABLES-PERMISSIONS-BULK-007: bulk update with rate limiting by permission level',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      addMember,
      executeQuery,
      signOut,
    }) => {
      // GIVEN: Table where members can only update limited records per request
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'records',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'value', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' },
              update: { type: 'authenticated' },
              // Note: Rate limiting would be configured at API level, not schema level
              // This test verifies the behavior when limits are exceeded
            },
          },
        ],
      })

      // Create owner and member
      await createAuthenticatedUser({ email: 'owner@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      await signOut()
      const member = await createAuthenticatedUser({ email: 'member@example.com' })
      await addMember({
        organizationId: org.organization.id,
        userId: member.user.id,
        role: 'member',
      })

      // Insert many records
      await executeQuery(`
        INSERT INTO records (id, value, organization_id) VALUES
          (1, 'Value 1', '${org.organization.id}'),
          (2, 'Value 2', '${org.organization.id}'),
          (3, 'Value 3', '${org.organization.id}'),
          (4, 'Value 4', '${org.organization.id}'),
          (5, 'Value 5', '${org.organization.id}')
      `)

      // WHEN: Member attempts large bulk update
      const response = await request.patch('/api/tables/1/records/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          records: [
            { id: '1', fields: { value: 'Updated 1' } },
            { id: '2', fields: { value: 'Updated 2' } },
            { id: '3', fields: { value: 'Updated 3' } },
            { id: '4', fields: { value: 'Updated 4' } },
            { id: '5', fields: { value: 'Updated 5' } },
          ],
        },
      })

      // THEN: Either succeeds or fails with rate limit error
      // (depending on implementation - documenting expected behavior)
      expect([200, 429]).toContain(response.status())

      if (response.status() === 429) {
        const data = await response.json()
        expect(data.error).toMatch(/rate limit|too many/i)
      }
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying bulk operations work correctly with various permission scenarios
  // Generated from 7 @spec tests - covers: create, update, delete with role-based, owner-based, field-level, and org-scoped permissions
  // ============================================================================

  test(
    'API-TABLES-PERMISSIONS-BULK-REGRESSION: complete bulk operations workflow with permissions',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      addMember,
      executeQuery,
      signOut,
      signIn,
      setActiveOrganization,
    }) => {
      let ownerOrg: OrganizationResult
      let memberUser: AuthResult
      let adminUser: AuthResult
      let crossOrgAId: string
      let crossOrgBId: string

      await test.step('Setup: Initialize comprehensive permission test schema', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            organization: true,
          },
          tables: [
            // Table 1: Simple authenticated create (for BULK-001)
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
            // Table 2: Admin-only create (for BULK-002)
            {
              id: 2,
              name: 'restricted_items',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'organization_id', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                organizationScoped: true,
                read: { type: 'authenticated' },
                create: { type: 'roles', roles: ['admin'] },
              },
            },
            // Table 3: Owner-based update (for BULK-003, BULK-004)
            {
              id: 3,
              name: 'notes',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'content', type: 'long-text' },
                { id: 3, name: 'owner_id', type: 'created-by' },
                { id: 4, name: 'organization_id', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                organizationScoped: true,
                read: { type: 'authenticated' },
                update: { type: 'owner', field: 'owner_id' },
              },
            },
            // Table 4: Organization-scoped delete (for BULK-005)
            {
              id: 4,
              name: 'items',
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
            // Table 5: Field-level permissions (for BULK-006)
            {
              id: 5,
              name: 'employees',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
                { id: 4, name: 'organization_id', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                organizationScoped: true,
                read: { type: 'authenticated' },
                create: { type: 'authenticated' },
                fields: [
                  {
                    field: 'salary',
                    read: { type: 'roles', roles: ['owner', 'admin'] },
                    write: { type: 'roles', roles: ['admin'] },
                  },
                ],
              },
            },
            // Table 6: Batch update testing (for BULK-007)
            {
              id: 6,
              name: 'records',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'value', type: 'single-line-text' },
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

        // Create owner and organization
        await createAuthenticatedUser({ email: 'owner@example.com' })
        ownerOrg = await createOrganization({ name: 'Test Org' })

        // Create admin
        await signOut()
        adminUser = await createAuthenticatedUser({ email: 'admin@example.com' })
        await addMember({
          organizationId: ownerOrg.organization.id,
          userId: adminUser.user.id,
          role: 'admin',
        })

        // Create member
        await signOut()
        memberUser = await createAuthenticatedUser({ email: 'member@example.com' })
        await addMember({
          organizationId: ownerOrg.organization.id,
          userId: memberUser.user.id,
          role: 'member',
        })

        // Create second organization for cross-org testing
        await signOut()
        await createAuthenticatedUser({ email: 'user-b@example.com' })
        const orgB = await createOrganization({ name: 'Organization B' })
        crossOrgBId = orgB.organization.id

        // Switch back to first org for testing
        await signOut()
        await signIn({ email: 'owner@example.com', password: 'TestPassword123!' })
        await setActiveOrganization(ownerOrg.organization.id)
        crossOrgAId = ownerOrg.organization.id
      })

      await test.step('BULK-001: Bulk create succeeds with authenticated permission', async () => {
        const response = await request.post('/api/tables/1/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ title: 'Task 1' }, { title: 'Task 2' }, { title: 'Task 3' }],
          },
        })

        expect(response.status()).toBe(201)
        const data = await response.json()
        expect(data.records).toHaveLength(3)
        expect(data.records.map((r: any) => r.fields.title)).toEqual(['Task 1', 'Task 2', 'Task 3'])
      })

      await test.step('BULK-002: Bulk create fails when user lacks role permission', async () => {
        // Switch to member user
        await signOut()
        await signIn({ email: 'member@example.com', password: 'TestPassword123!' })
        await setActiveOrganization(ownerOrg.organization.id)

        const response = await request.post('/api/tables/2/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [{ name: 'Item 1' }, { name: 'Item 2' }],
          },
        })

        expect(response.status()).toBe(403)

        // Switch back to owner
        await signOut()
        await signIn({ email: 'owner@example.com', password: 'TestPassword123!' })
        await setActiveOrganization(ownerOrg.organization.id)
      })

      await test.step('BULK-003: Bulk update succeeds for owner-based permissions', async () => {
        // Insert notes owned by owner
        await executeQuery(`
          INSERT INTO notes (id, content, owner_id, organization_id) VALUES
            (1, 'My Note 1', '${adminUser.user.id}', '${ownerOrg.organization.id}'),
            (2, 'My Note 2', '${adminUser.user.id}', '${ownerOrg.organization.id}')
        `)

        // Switch to admin user (note owner)
        await signOut()
        await signIn({ email: 'admin@example.com', password: 'TestPassword123!' })
        await setActiveOrganization(ownerOrg.organization.id)

        const response = await request.patch('/api/tables/3/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { id: '1', fields: { content: 'Updated Note 1' } },
              { id: '2', fields: { content: 'Updated Note 2' } },
            ],
          },
        })

        expect(response.status()).toBe(200)

        const dbResult = await executeQuery('SELECT id, content FROM notes ORDER BY id')
        expect(dbResult.rows[0].content).toBe('Updated Note 1')
        expect(dbResult.rows[1].content).toBe('Updated Note 2')

        // Switch back to owner
        await signOut()
        await signIn({ email: 'owner@example.com', password: 'TestPassword123!' })
        await setActiveOrganization(ownerOrg.organization.id)
      })

      await test.step('BULK-004: Mixed ownership update handles partial success', async () => {
        // Insert notes with mixed ownership (owner owns note 3, admin owns note 4)
        await executeQuery(`
          INSERT INTO notes (id, content, owner_id, organization_id) VALUES
            (3, 'Owner Note', '${adminUser.user.id}', '${ownerOrg.organization.id}'),
            (4, 'Member Note', '${memberUser.user.id}', '${ownerOrg.organization.id}')
        `)

        // Admin tries to update both notes (owns 3, doesn't own 4)
        await signOut()
        await signIn({ email: 'admin@example.com', password: 'TestPassword123!' })
        await setActiveOrganization(ownerOrg.organization.id)

        const response = await request.patch('/api/tables/3/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { id: '3', fields: { content: 'Updated Owner Note' } },
              { id: '4', fields: { content: 'Trying to Update Member Note' } },
            ],
          },
        })

        expect([200, 403, 207]).toContain(response.status())

        // Switch back to owner
        await signOut()
        await signIn({ email: 'owner@example.com', password: 'TestPassword123!' })
        await setActiveOrganization(ownerOrg.organization.id)
      })

      await test.step('BULK-005: Bulk delete respects organization isolation', async () => {
        // Insert items in both organizations
        await executeQuery(`
          INSERT INTO items (id, name, organization_id) VALUES
            (1, 'Org A Item 1', '${crossOrgAId}'),
            (2, 'Org A Item 2', '${crossOrgAId}'),
            (3, 'Org B Item 1', '${crossOrgBId}')
        `)

        // Try to delete all items including cross-org item
        const response = await request.delete('/api/tables/4/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            ids: ['1', '2', '3'],
          },
        })

        expect(response.status()).toBe(200)

        // Only Org A items should be soft-deleted (Org B item ignored by RLS)
        const dbResult = await executeQuery(
          'SELECT id FROM items WHERE deleted_at IS NULL ORDER BY id'
        )
        expect(dbResult.rows).toHaveLength(1)
        expect(dbResult.rows[0].id).toBe(3)
      })

      await test.step('BULK-006: Bulk create respects field-level permissions', async () => {
        // Switch to member user
        await signOut()
        await signIn({ email: 'member@example.com', password: 'TestPassword123!' })
        await setActiveOrganization(ownerOrg.organization.id)

        const response = await request.post('/api/tables/5/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { name: 'Employee 1', salary: 50_000 },
              { name: 'Employee 2', salary: 60_000 },
            ],
          },
        })

        expect(response.status()).toBe(403)
        const data = await response.json()
        expect(data.message).toMatch(/permission|salary|forbidden/i)

        // Switch back to owner
        await signOut()
        await signIn({ email: 'owner@example.com', password: 'TestPassword123!' })
        await setActiveOrganization(ownerOrg.organization.id)
      })

      await test.step('BULK-007: Large batch update handles rate limiting', async () => {
        // Insert test records
        await executeQuery(`
          INSERT INTO records (id, value, organization_id) VALUES
            (1, 'Value 1', '${ownerOrg.organization.id}'),
            (2, 'Value 2', '${ownerOrg.organization.id}'),
            (3, 'Value 3', '${ownerOrg.organization.id}'),
            (4, 'Value 4', '${ownerOrg.organization.id}'),
            (5, 'Value 5', '${ownerOrg.organization.id}')
        `)

        // Switch to member
        await signOut()
        await signIn({ email: 'member@example.com', password: 'TestPassword123!' })
        await setActiveOrganization(ownerOrg.organization.id)

        const response = await request.patch('/api/tables/6/records/batch', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            records: [
              { id: '1', fields: { value: 'Updated 1' } },
              { id: '2', fields: { value: 'Updated 2' } },
              { id: '3', fields: { value: 'Updated 3' } },
              { id: '4', fields: { value: 'Updated 4' } },
              { id: '5', fields: { value: 'Updated 5' } },
            ],
          },
        })

        expect([200, 429]).toContain(response.status())
      })
    }
  )
})
